import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.cache', '.local', '.upm',
  'attached_assets', '.config', '.npm', 'migrations', 'coverage',
  '__pycache__', '.next', '.replit', '.pythonlibs',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html',
  '.sql', '.md', '.yaml', '.yml',
]);

const SAFE_DIRS = ['client/', 'server/', 'shared/', 'docs/', 'script/', 'references/'];

const BLOCKED_PATTERNS = [
  /\.env/i,
  /secret/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /credentials/i,
];

let cachedTree: { tree: string; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function generateFileTreeRecursive(dir: string, prefix: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return ['  '.repeat(depth) + '...'];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    if (EXCLUDED_DIRS.has(entry.name) && entry.isDirectory()) continue;
    if (EXCLUDED_FILES.has(entry.name)) continue;

    const indent = '  '.repeat(depth);

    if (entry.isDirectory()) {
      lines.push(`${indent}${entry.name}/`);
      const subLines = generateFileTreeRecursive(
        path.join(dir, entry.name), prefix, depth + 1, maxDepth
      );
      lines.push(...subLines);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext) || entry.name === 'Dockerfile' || entry.name === 'Makefile') {
        lines.push(`${indent}${entry.name}`);
      }
    }
  }

  return lines;
}

export function generateFileTree(): string {
  if (cachedTree && Date.now() - cachedTree.timestamp < CACHE_TTL) {
    return cachedTree.tree;
  }

  const lines = generateFileTreeRecursive(PROJECT_ROOT, '', 0, 5);
  const tree = lines.join('\n');
  cachedTree = { tree, timestamp: Date.now() };
  return tree;
}

function isFileSafe(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }

  const ext = path.extname(normalized).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) return false;

  const isTopLevelSafe = ['replit.md', 'package.json', 'tsconfig.json', 'tailwind.config.ts',
    'vite.config.ts', 'drizzle.config.ts', 'components.json'].includes(normalized);
  if (isTopLevelSafe) return true;

  return SAFE_DIRS.some(dir => normalized.startsWith(dir));
}

export function readFileContent(filePath: string, maxLines = 500): { content: string; truncated: boolean; totalLines: number } | null {
  const resolved = path.resolve(PROJECT_ROOT, filePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    return null;
  }

  if (!isFileSafe(filePath)) {
    return null;
  }

  try {
    if (!fs.existsSync(resolved)) return null;
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) return null;
    if (stat.size > 500_000) {
      return { content: `[文件过大: ${(stat.size / 1024).toFixed(1)}KB，跳过]`, truncated: true, totalLines: 0 };
    }

    const raw = fs.readFileSync(resolved, 'utf-8');
    const lines = raw.split('\n');
    const totalLines = lines.length;

    if (totalLines > maxLines) {
      return {
        content: lines.slice(0, maxLines).join('\n') + `\n\n... [已截断，共 ${totalLines} 行，显示前 ${maxLines} 行]`,
        truncated: true,
        totalLines,
      };
    }

    return { content: raw, truncated: false, totalLines };
  } catch {
    return null;
  }
}

function generateRoutesSummary(): string {
  const routesPath = path.join(PROJECT_ROOT, 'server/routes.ts');
  try {
    const raw = fs.readFileSync(routesPath, 'utf-8');
    const routePattern = /app\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
    const routes: string[] = [];
    let match;
    while ((match = routePattern.exec(raw)) !== null) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
    return routes.join('\n');
  } catch {
    return '';
  }
}

export function getKeyFilesContent(): { file: string; content: string }[] {
  const keyFiles: { file: string; content: string }[] = [];

  const schema = readFileContent('shared/schema.ts', 300);
  if (schema) {
    keyFiles.push({ file: 'shared/schema.ts', content: schema.content });
  }

  const routesSummary = generateRoutesSummary();
  if (routesSummary) {
    keyFiles.push({ file: 'server/routes.ts (API路由列表)', content: routesSummary });
  }

  const replitMd = readFileContent('replit.md', 200);
  if (replitMd) {
    keyFiles.push({ file: 'replit.md (项目概述)', content: replitMd.content });
  }

  return keyFiles;
}

export function extractFileReferences(message: string): string[] {
  const pattern = /@([\w./-]+\.\w+)/g;
  const refs: string[] = [];
  let match;
  while ((match = pattern.exec(message)) !== null) {
    refs.push(match[1]);
  }
  return [...new Set(refs)];
}

export function buildCodeContextBlock(message: string, includeKeyFiles = true): { contextBlock: string; loadedFiles: string[]; failedFiles: string[] } {
  const parts: string[] = [];
  const loadedFiles: string[] = [];
  const failedFiles: string[] = [];

  parts.push('## 项目代码结构');
  parts.push('以下是当前项目的文件目录树：');
  parts.push('```');
  parts.push(generateFileTree());
  parts.push('```');

  if (includeKeyFiles) {
    const keyFiles = getKeyFilesContent();
    for (const kf of keyFiles) {
      parts.push(`\n### ${kf.file}`);
      parts.push('```');
      parts.push(kf.content);
      parts.push('```');
      loadedFiles.push(kf.file);
    }
  }

  const fileRefs = extractFileReferences(message);
  for (const ref of fileRefs) {
    if (loadedFiles.some(f => f.startsWith(ref))) continue;
    const fileData = readFileContent(ref);
    if (fileData) {
      parts.push(`\n### ${ref}${fileData.truncated ? ' (已截断)' : ''}`);
      parts.push('```');
      parts.push(fileData.content);
      parts.push('```');
      loadedFiles.push(ref);
    } else {
      failedFiles.push(ref);
    }
  }

  parts.push(`
## 代码上下文使用指南

你现在可以看到项目的源代码。请基于以上代码信息回答用户关于产品实现、架构、功能的问题。你可以引用具体的文件路径和代码片段。用户可以用 @文件路径 的方式让你查看特定文件。

## 产品经理模式

当用户讨论产品需求、功能改进、或要求落地方案时，你应该扮演产品经理的角色：
1. 先分析需求的合理性和可行性（基于你看到的代码架构）
2. 识别需要修改的文件和模块
3. 生成结构化的开发指令，格式如下：

---

### 开发指令（可直接复制给 Replit Agent 执行）

\`\`\`
# 目标
[用一句话描述要实现什么]

# 背景
[简要说明当前代码状态和为什么要做这个改动]

# 任务

## 1. [具体任务名]
- 文件: [需要修改的文件路径]
- 改动: [具体要做什么修改，描述清楚]
- 验收: [如何验证这个改动是正确的]

## 2. [具体任务名]
- 文件: [文件路径]
- 改动: [具体修改内容]
- 验收: [验收标准]

# 注意事项
- [需要特别注意的技术细节或约束]
\`\`\`

---

指令生成规则：
- 指令必须基于你看到的真实代码结构，引用具体的文件路径、函数名、变量名
- 每个任务要足够具体，让 Replit Agent 不需要额外猜测就能执行
- 如果改动涉及数据库 schema，明确说明表名和字段
- 如果涉及前后端联动，按依赖顺序排列任务（先后端再前端）
- 对于复杂需求，先给出整体方案分析，再生成指令
- 用户没有要求生成指令时，正常回答问题即可，不要每次都输出指令块`);

  return { contextBlock: parts.join('\n'), loadedFiles, failedFiles };
}
