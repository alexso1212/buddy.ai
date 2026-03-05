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

    case 'docx': {
      const result = await mammoth.extractRawText({ path: absolutePath });
      return result.value || '';
    }

    case 'txt':
    case 'md': {
      return fs.readFileSync(absolutePath, 'utf-8');
    }

    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}
