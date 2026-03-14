import * as AdmZipModule from 'adm-zip';
const AdmZip = (AdmZipModule as any).default || AdmZipModule;
import fs from 'fs';
import path from 'path';
import { extractText } from '../kb/extractText';

export interface ExtractedFile {
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  content: string;
  fullContent: string;
  skipped?: boolean;
}

const skipPatterns = [
  /发票/, /invoice/i,
  /报销单/, /expense/i,
  /银行流水/, /bank.*statement/i,
  /财务报表/, /financial.*report/i,
  /税/, /tax/i,
  /工资条/, /payroll.*slip/i, /salary.*slip/i,
  /水电/, /utility/i,
  /快递/, /物流单/, /shipping/i,
  /会计凭证/, /voucher/i,
  /扫描件/, /scan/i,
  /照片/, /photo/i, /^img/i,
  /截图/, /screenshot/i,
];

export function isLikelyRelevant(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return !skipPatterns.some(p => p.test(name));
}

export async function processZipFile(zipPath: string): Promise<ExtractedFile[]> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files: ExtractedFile[] = [];

  const tempDir = path.join('uploads', 'setup_temp_' + Date.now());
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const supportedExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls', 'csv', 'pptx', 'html', 'htm', 'rtf', 'json'];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName;
    if (entryName.startsWith('__MACOSX') || entryName.startsWith('.')) continue;
    if (entryName.includes('/.')) continue;

    const ext = entryName.split('.').pop()?.toLowerCase() || '';
    if (!supportedExts.includes(ext)) continue;

    const fileName = entryName.split('/').pop() || entryName;
    const tempPath = path.join(tempDir, Date.now() + '_' + fileName);

    try {
      const fileData = entry.getData();
      fs.writeFileSync(tempPath, fileData);

      const fullContent = await extractText(tempPath, ext);

      if (fullContent && fullContent.trim().length > 20) {
        const skipped = !isLikelyRelevant(fileName);
        files.push({
          fileName,
          filePath: tempPath,
          fileType: ext,
          fileSize: entry.header.size,
          content: fullContent.slice(0, 10000),
          fullContent,
          skipped,
        });
      } else {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    } catch (err: any) {
      console.warn(`[Setup] Failed to process ${fileName}:`, err.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  const skippedCount = files.filter(f => f.skipped).length;
  console.log(`[Setup] Extracted ${files.length} files from ZIP (${skippedCount} skipped by filename filter)`);
  if (skippedCount > 0) {
    console.log(`[Setup] Skipped files: ${files.filter(f => f.skipped).map(f => f.fileName).join(', ')}`);
  }
  return files;
}

export async function processMultipleFiles(filePaths: { originalName: string; tempPath: string }[]): Promise<ExtractedFile[]> {
  const files: ExtractedFile[] = [];
  const supportedExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls', 'csv', 'pptx', 'html', 'htm', 'rtf', 'json'];

  for (const { originalName, tempPath } of filePaths) {
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    if (!supportedExts.includes(ext)) continue;

    try {
      const stats = fs.statSync(tempPath);
      const fullContent = await extractText(tempPath, ext);

      if (fullContent && fullContent.trim().length > 20) {
        const skipped = !isLikelyRelevant(originalName);
        files.push({
          fileName: originalName,
          filePath: tempPath,
          fileType: ext,
          fileSize: stats.size,
          content: fullContent.slice(0, 10000),
          fullContent,
          skipped,
        });
      }
    } catch (err: any) {
      console.warn(`[Setup] Failed to process ${originalName}:`, err.message);
    }
  }

  return files;
}

export function cleanupTempFiles(files: ExtractedFile[]) {
  for (const file of files) {
    try {
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
    } catch {}
  }
  try {
    const tempDirs = fs.readdirSync('uploads').filter(d => d.startsWith('setup_temp_'));
    for (const dir of tempDirs) {
      try {
        fs.rmSync(path.join('uploads', dir), { recursive: true, force: true });
      } catch {}
    }
  } catch {}
}
