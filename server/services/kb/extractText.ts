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
      const pdfParse = (await import('pdf-parse')).default;
      const dataBuffer = fs.readFileSync(absolutePath);
      const data = await pdfParse(dataBuffer);
      return data.text || '';
    }

    case 'docx':
    case 'doc': {
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
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(absolutePath);
      const texts: string[] = [];
      const entries = zip.getEntries();
      const slideEntries = entries
        .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
        .sort((a, b) => {
          const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || '0');
          const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || '0');
          return numA - numB;
        });
      for (const entry of slideEntries) {
        const xml = entry.getData().toString('utf-8');
        const matches = xml.match(/<a:t>(.*?)<\/a:t>/g) || [];
        const slideText = matches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
        if (slideText.trim()) {
          texts.push(slideText);
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
