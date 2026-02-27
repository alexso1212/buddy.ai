import * as fs from 'fs';
import * as path from 'path';
import { readFileContent } from './codeContext';

const PROJECT_ROOT = process.cwd();

const SAFE_DIRS = ['client/', 'server/', 'shared/', 'docs/', 'script/', 'references/'];

const BLOCKED_PATTERNS = [
  /\.env/i,
  /secret/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /credentials/i,
];

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.cache', '.local', '.upm',
  'attached_assets', '.config', '.npm', 'migrations', 'coverage',
  '__pycache__', '.next', '.replit', '.pythonlibs',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html',
  '.sql', '.md', '.yaml', '.yml',
]);

function isPathSafe(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  const isTopLevel = ['replit.md', 'package.json', 'tsconfig.json', 'tailwind.config.ts',
    'vite.config.ts', 'drizzle.config.ts', 'components.json'].includes(normalized);
  if (isTopLevel) return true;
  return SAFE_DIRS.some(dir => normalized.startsWith(dir));
}

export const CODE_TOOLS = [
  {
    name: 'read_file',
    description: '读取项目中指定文件的内容。支持的目录：client/, server/, shared/, docs/。文件路径相对于项目根目录，如 "server/routes.ts" 或 "client/src/pages/agent.tsx"。',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要读取的文件路径（相对于项目根目录）',
        },
        max_lines: {
          type: 'number',
          description: '最大读取行数，默认 300。对于大文件可以减少行数先看概览。',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'list_directory',
    description: '列出指定目录下的文件和子目录。可以用来了解项目结构或某个目录的组成。',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description: '要列出的目录路径（相对于项目根目录），如 "server/services/ai" 或 "client/src/pages"。留空则列出项目根目录。',
        },
        depth: {
          type: 'number',
          description: '递归深度，默认 2。设为 1 只看当前目录。',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_code',
    description: '在代码库中搜索包含指定文本的文件和代码行。用于查找函数定义、变量使用、API 路由等。',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '要搜索的文本（区分大小写）',
        },
        file_pattern: {
          type: 'string',
          description: '可选的文件名后缀过滤，如 ".tsx" 或 ".ts"。不填则搜索所有代码文件。',
        },
      },
      required: ['query'],
    },
  },
];

function listDir(dirPath: string, depth: number, maxDepth: number): string[] {
  const resolved = path.resolve(PROJECT_ROOT, dirPath);
  if (!resolved.startsWith(PROJECT_ROOT)) return ['[路径不安全]'];

  const relative = path.relative(PROJECT_ROOT, resolved).replace(/\\/g, '/');
  if (relative && !isPathSafe(relative + '/dummy.ts') && relative !== '') {
    const isSafeDir = SAFE_DIRS.some(sd => relative.startsWith(sd.replace(/\/$/, '')) || sd.startsWith(relative + '/'));
    if (!isSafeDir && relative !== '') return ['[目录不在允许范围内]'];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true });
  } catch {
    return ['[目录不存在或无法读取]'];
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDED_DIRS.has(entry.name) && entry.isDirectory()) continue;

    if (entry.isDirectory()) {
      lines.push(`${indent}${entry.name}/`);
      if (depth < maxDepth) {
        lines.push(...listDir(path.join(dirPath, entry.name), depth + 1, maxDepth));
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext) || entry.name === 'Dockerfile' || entry.name === 'Makefile') {
        lines.push(`${indent}${entry.name}`);
      }
    }
  }

  return lines;
}

function searchInFiles(dir: string, query: string, filePattern: string | undefined, results: { file: string; line: number; text: string }[], maxResults: number): void {
  if (results.length >= maxResults) return;

  const resolved = path.resolve(PROJECT_ROOT, dir);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return;
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDED_DIRS.has(entry.name) && entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      searchInFiles(fullPath, query, filePattern, results, maxResults);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;
      if (filePattern && !entry.name.endsWith(filePattern)) continue;

      const absPath = path.resolve(PROJECT_ROOT, fullPath);
      try {
        const stat = fs.statSync(absPath);
        if (stat.size > 500_000) continue;

        const content = fs.readFileSync(absPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) return;
          if (lines[i].includes(query)) {
            results.push({ file: fullPath, line: i + 1, text: lines[i].trim().substring(0, 200) });
          }
        }
      } catch {
        continue;
      }
    }
  }
}

export function executeCodeTool(name: string, input: Record<string, any>): string {
  try {
    switch (name) {
      case 'read_file': {
        const filePath = input.file_path as string;
        const maxLines = (input.max_lines as number) || 300;
        if (!filePath) return '错误：未提供文件路径';

        const result = readFileContent(filePath, maxLines);
        if (!result) return `文件不存在或不在允许的访问范围内: ${filePath}`;

        let output = result.content;
        if (result.truncated) {
          output += `\n\n[文件共 ${result.totalLines} 行，已显示前 ${maxLines} 行]`;
        }
        return output;
      }

      case 'list_directory': {
        const dir = (input.directory as string) || '';
        const depth = Math.min((input.depth as number) || 2, 4);
        const lines = listDir(dir || '.', 0, depth);
        return lines.join('\n') || '（空目录）';
      }

      case 'search_code': {
        const query = input.query as string;
        if (!query) return '错误：未提供搜索关键词';

        const filePattern = input.file_pattern as string | undefined;
        const results: { file: string; line: number; text: string }[] = [];

        for (const safeDir of SAFE_DIRS) {
          const dirName = safeDir.replace(/\/$/, '');
          searchInFiles(dirName, query, filePattern, results, 25);
          if (results.length >= 25) break;
        }

        if (results.length === 0) return `未找到包含 "${query}" 的代码`;

        return results.map(r => `${r.file}:${r.line}  ${r.text}`).join('\n');
      }

      default:
        return `未知工具: ${name}`;
    }
  } catch (err: any) {
    return `工具执行错误: ${err.message}`;
  }
}
