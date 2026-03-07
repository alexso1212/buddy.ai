import { storage } from "../../storage";

export async function detectTaskDuplicate(params: {
  orgId: number;
  title: string;
  description?: string;
}): Promise<{
  hasDuplicate: boolean;
  matches: { id: number; title: string; status: string; assigneeName: string; similarity: number }[];
}> {
  const { orgId, title } = params;

  const tasks = await storage.getActiveTasksByOrg(orgId);

  const matches: { id: number; title: string; status: string; assigneeName: string; similarity: number }[] = [];
  const titleKeywords = extractKeywords(title);

  for (const task of tasks) {
    const taskKeywords = extractKeywords(task.title);
    const sim = jaccardSimilarity(titleKeywords, taskKeywords);

    if (sim > 0.5) {
      matches.push({
        id: task.id,
        title: task.title,
        status: task.status,
        assigneeName: (task as any).assigneeName || '未分配',
        similarity: sim,
      });
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    hasDuplicate: matches.length > 0,
    matches: matches.slice(0, 3),
  };
}

function extractKeywords(text: string): string[] {
  const words: string[] = [];
  const en = text.match(/[a-zA-Z0-9]+/g) || [];
  const stopEn = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'for', 'and', 'or', 'not', 'this', 'that', 'it', 'be', 'do', 'have']);
  words.push(...en.filter(w => w.length > 1 && !stopEn.has(w.toLowerCase())).map(w => w.toLowerCase()));
  const cn = text.replace(/[a-zA-Z0-9\s\p{P}]/gu, '');
  const stopCn = new Set(['的', '了', '和', '是', '在', '有', '这', '那', '个', '中', '为', '与', '等', '一', '不', '人', '我', '他', '她', '你', '们', '会', '要', '就', '也', '能', '把', '到', '上', '下', '被', '让', '给', '从', '很', '都', '才', '又']);
  for (let i = 0; i < cn.length - 1; i++) {
    const bigram = cn.slice(i, i + 2);
    if (!stopCn.has(bigram[0]) && !stopCn.has(bigram[1])) words.push(bigram);
  }
  return words;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}
