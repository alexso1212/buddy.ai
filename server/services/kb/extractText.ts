import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

export async function extractText(filePath: string, fileType: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }

  switch (fileType.toLowerCase()) {
    case 'pdf': {
      const pdfParseModule = (await import('pdf-parse'));
      const pdfParseFn = (pdfParseModule as any).default || pdfParseModule;
      const dataBuffer = fs.readFileSync(absolutePath);
      const data = await pdfParseFn(dataBuffer);
      return data.text || '';
    }

    case 'doc': {
      return '[不支持旧版 .doc 格式，请转换为 .docx 后重新上传]';
    }

    case 'docx': {
      const result = await mammoth.extractRawText({ path: absolutePath });
      return result.value || '';
    }

    case 'txt':
    case 'md':
    case 'csv': {
      return fs.readFileSync(absolutePath, 'utf-8');
    }

    case 'xlsx':
    case 'xls': {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(absolutePath);
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim().length > 10) {
          sheets.push(`=== 工作表: ${sheetName} ===\n${csv}`);
        }
      }
      return sheets.join('\n\n');
    }

    case 'pptx': {
      const AdmZipModule = (await import('adm-zip')) as any;
      const AdmZip = AdmZipModule.default || AdmZipModule;
      const zip = new (AdmZip as any)(absolutePath);
      const texts: string[] = [];
      const entries = zip.getEntries();
      const slideEntries = entries
        .filter((e: any) => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
        .sort((a: any, b: any) => {
          const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || '0');
          const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || '0');
          return numA - numB;
        });
      for (const entry of slideEntries) {
        const content = entry.getData().toString('utf8');
        const matchResult = content.matchAll(/<a:t>(.*?)<\/a:t>/g);
        const slideTextResult = Array.from(matchResult).map((m: any) => m[1]).join(' ');
        if (slideTextResult.trim()) {
          texts.push(slideTextResult);
        }
      }
      return texts.join('\n\n');
    }

    case 'html':
    case 'htm': {
      const cheerio = await import('cheerio');
      const html = fs.readFileSync(absolutePath, 'utf-8');
      const $ = cheerio.load(html);
      $('script, style, nav, header, footer').remove();
      return $('body').text().trim();
    }

    case 'rtf': {
      const rtf = fs.readFileSync(absolutePath, 'utf-8');
      return rtf
        .replace(/\\par\b/g, '\n')
        .replace(/\{\\[^{}]*\}/g, '')
        .replace(/\\[a-z]+\d* ?/gi, '')
        .replace(/[{}]/g, '')
        .trim();
    }

    case 'json': {
      return fs.readFileSync(absolutePath, 'utf-8');
    }

    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}
