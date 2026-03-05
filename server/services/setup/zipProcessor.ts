import AdmZip from 'adm-zip';
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
}

export async function processZipFile(zipPath: string): Promise<ExtractedFile[]> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files: ExtractedFile[] = [];

  const tempDir = path.join('uploads', 'setup_temp_' + Date.now());
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const supportedExts = ['pdf', 'docx', 'txt', 'md'];

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
        files.push({
          fileName,
          filePath: tempPath,
          fileType: ext,
          fileSize: entry.header.size,
          content: fullContent.slice(0, 10000),
          fullContent,
        });
      } else {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    } catch (err: any) {
      console.warn(`[Setup] Failed to process ${fileName}:`, err.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  console.log(`[Setup] Extracted ${files.length} files from ZIP`);
  return files;
}

export async function processMultipleFiles(filePaths: { originalName: string; tempPath: string }[]): Promise<ExtractedFile[]> {
  const files: ExtractedFile[] = [];
  const supportedExts = ['pdf', 'docx', 'txt', 'md'];

  for (const { originalName, tempPath } of filePaths) {
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    if (!supportedExts.includes(ext)) continue;

    try {
      const stats = fs.statSync(tempPath);
      const fullContent = await extractText(tempPath, ext);

      if (fullContent && fullContent.trim().length > 20) {
        files.push({
          fileName: originalName,
          filePath: tempPath,
          fileType: ext,
          fileSize: stats.size,
          content: fullContent.slice(0, 10000),
          fullContent,
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
