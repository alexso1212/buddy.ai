import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType } from 'docx';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface DocumentRequest {
  title: string;
  content: string;
  orgName?: string;
  author?: string;
}

export async function generateDocx(request: DocumentRequest): Promise<{ filePath: string; fileName: string }> {
  const { title, content, orgName, author } = request;

  const children: any[] = [];

  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        children.push(
          new Paragraph({
            border: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
            children: [
              new TextRun({
                text: codeBlockContent.join('\n'),
                font: 'Courier New',
                size: 20,
              }),
            ],
          })
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map(r => r.length));
        const colWidth = Math.floor(9360 / colCount);
        const border = { style: BorderStyle.SINGLE as const, size: 1, color: 'CCCCCC' };
        const borders = { top: border, bottom: border, left: border, right: border };

        const rows = tableRows.map((row, rowIndex) =>
          new TableRow({
            children: Array.from({ length: colCount }, (_, i) =>
              new TableCell({
                borders,
                width: { size: colWidth, type: WidthType.DXA },
                shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: 'E8F0FE' } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: row[i] || '',
                        bold: rowIndex === 0,
                        size: 20,
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              })
            ),
          })
        );

        children.push(
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: Array(colCount).fill(colWidth),
            rows,
          })
        );
        children.push(new Paragraph({ children: [] }));
      }
      tableRows = [];
      inTable = false;
    }

    if (line.trim() === '') {
      children.push(new Paragraph({ children: [] }));
      continue;
    }

    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: h1Match[1], bold: true, size: 32, font: 'Arial' })],
      }));
      continue;
    }
    if (h2Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: h2Match[1], bold: true, size: 28, font: 'Arial' })],
      }));
      continue;
    }
    if (h3Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: h3Match[1], bold: true, size: 24, font: 'Arial' })],
      }));
      continue;
    }

    if (line.match(/^[\s]*[-*] /)) {
      const indent = (line.match(/^(\s*)/)?.[1].length || 0) / 2;
      const text = line.replace(/^[\s]*[-*] /, '');
      children.push(new Paragraph({
        indent: { left: 360 + indent * 360 },
        children: parseInlineFormatting('\u2022 ' + text),
      }));
      continue;
    }

    const olMatch = line.match(/^[\s]*(\d+)\. (.+)/);
    if (olMatch) {
      children.push(new Paragraph({
        indent: { left: 360 },
        children: parseInlineFormatting(olMatch[1] + '. ' + olMatch[2]),
      }));
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
        spacing: { before: 120, after: 120 },
        children: [],
      }));
      continue;
    }

    children.push(new Paragraph({
      spacing: { after: 80 },
      children: parseInlineFormatting(line),
    }));
  }

  if (inTable && tableRows.length > 0) {
    const colCount = Math.max(...tableRows.map(r => r.length));
    const colWidth = Math.floor(9360 / colCount);
    const border = { style: BorderStyle.SINGLE as const, size: 1, color: 'CCCCCC' };
    const borders = { top: border, bottom: border, left: border, right: border };
    const rows = tableRows.map((row, rowIndex) =>
      new TableRow({
        children: Array.from({ length: colCount }, (_, i) =>
          new TableCell({
            borders,
            width: { size: colWidth, type: WidthType.DXA },
            shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: 'E8F0FE' } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: row[i] || '', bold: rowIndex === 0, size: 20, font: 'Arial' })] })],
          })
        ),
      })
    );
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: Array(colCount).fill(colWidth),
      rows,
    }));
  }

  const doc = new Document({
    creator: author || 'Buddy AI',
    title,
    description: `Generated by Buddy AI for ${orgName || 'organization'}`,
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: title, bold: true, size: 36, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({ text: `${orgName || ''} \u00B7 ${new Date().toLocaleDateString('zh-CN')} \u00B7 Buddy AI 生成`, size: 18, color: '888888', font: 'Arial' }),
          ],
        }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
          spacing: { after: 300 },
          children: [],
        }),
        ...children,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileId = crypto.randomBytes(8).toString('hex');
  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 50);
  const fileName = `${safeTitle}_${fileId}.docx`;
  const filePath = path.join(uploadsDir, fileName);

  fs.writeFileSync(filePath, buffer);

  return { filePath, fileName };
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|([^*`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, size: 22, font: 'Arial' }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true, size: 22, font: 'Arial' }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], font: 'Courier New', size: 20, shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' } }));
    } else if (match[7]) {
      runs.push(new TextRun({ text: match[7], size: 22, font: 'Arial' }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: 22, font: 'Arial' }));
  }

  return runs;
}
