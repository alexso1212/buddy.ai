import { sql } from 'drizzle-orm';
import { storage } from '../../storage';
import { vectorSearch } from './embedding';

export interface KBSearchResult {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  category: string;
  content: string;
  similarity: number;
  source: 'vector' | 'fulltext';
}

export async function searchKnowledge(options: {
  orgId: number;
  query: string;
  topK?: number;
  userRole?: string;
  userDeptId?: number | null;
}): Promise<KBSearchResult[]> {
  const { orgId, query, topK = 5, userRole = 'member', userDeptId = null } = options;

  if (!query || query.trim().length < 2) return [];

  const [vectorResults, fulltextResults] = await Promise.all([
    vectorSearch(orgId, query, topK),
    fulltextSearch(orgId, query, topK),
  ]);

  const resultMap = new Map<number, KBSearchResult>();

  for (const r of vectorResults) {
    resultMap.set(r.id, {
      chunkId: r.id,
      documentId: r.documentId,
      documentTitle: '',
      category: '',
      content: r.content,
      similarity: r.similarity,
      source: 'vector',
    });
  }

  for (const r of fulltextResults) {
    if (!resultMap.has(r.chunkId)) {
      resultMap.set(r.chunkId, r);
    }
  }

  let results = Array.from(resultMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  const docIds = [...new Set(results.map(r => r.documentId))];
  const docInfoMap = new Map<number, { title: string; category: string; visibility: string; visibleDeptIds: string | null }>();

  for (const docId of docIds) {
    const doc = await storage.getKbDocumentById(docId);
    if (doc) {
      docInfoMap.set(docId, {
        title: doc.title,
        category: doc.category,
        visibility: doc.visibility,
        visibleDeptIds: doc.visibleDeptIds,
      });
    }
  }

  results = results
    .map(r => {
      const docInfo = docInfoMap.get(r.documentId);
      if (!docInfo) return null;

      if (docInfo.visibility === 'admin' && !['owner', 'admin'].includes(userRole)) return null;
      if (docInfo.visibility === 'department' && !['owner', 'admin'].includes(userRole)) {
        if (!userDeptId) return null;
        const visibleDepts = docInfo.visibleDeptIds ? JSON.parse(docInfo.visibleDeptIds) : [];
        if (!visibleDepts.includes(userDeptId)) return null;
      }

      return { ...r, documentTitle: docInfo.title, category: docInfo.category };
    })
    .filter(Boolean) as KBSearchResult[];

  return results;
}

async function fulltextSearch(
  orgId: number,
  query: string,
  topK: number = 5
): Promise<KBSearchResult[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  try {
    const patterns = keywords.map(kw => `%${kw}%`);

    const conditions = patterns.map((_, i) => sql`c.content ILIKE ${patterns[i]}`);
    const matchCases = patterns.map((_, i) => sql`CASE WHEN c.content ILIKE ${patterns[i]} THEN 1 ELSE 0 END`);

    const orCondition = sql.join(conditions, sql` OR `);
    const sumExpr = sql.join(matchCases, sql` + `);

    const results = await storage.executeRaw(
      sql`SELECT 
            c.id as "chunkId",
            c.document_id as "documentId",
            c.content,
            d.title as "documentTitle",
            d.category,
            (${sumExpr})::float / ${keywords.length} as similarity
          FROM kb_chunks c
          JOIN kb_documents d ON c.document_id = d.id
          WHERE c.org_id = ${orgId}
            AND d.status = 'ready'
            AND (${orCondition})
          ORDER BY (${sumExpr}) DESC, c.chunk_index ASC
          LIMIT ${topK}`
    );
    const rows = (results.rows || results) as any[];

    return rows.map((r: any) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      documentTitle: r.documentTitle || '',
      category: r.category || '',
      content: r.content,
      similarity: Math.min(r.similarity || 0, 1),
      source: 'fulltext' as const,
    }));
  } catch (err: any) {
    console.error(`[KB Fulltext] Error:`, err.message);
    return [];
  }
}

function extractKeywords(query: string): string[] {
  const keywords: string[] = [];

  const englishWords = query.match(/[a-zA-Z]{3,}/g) || [];
  keywords.push(...englishWords);

  const chinesePhrases = query.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const phrase of chinesePhrases) {
    if (phrase.length <= 2) {
      keywords.push(phrase);
    } else {
      keywords.push(phrase);
      for (let i = 0; i < phrase.length - 1; i++) {
        keywords.push(phrase.slice(i, i + 2));
      }
      if (phrase.length > 3) {
        for (let i = 0; i < phrase.length - 2; i++) {
          keywords.push(phrase.slice(i, i + 3));
        }
      }
    }
  }

  return [...new Set(keywords)].slice(0, 10);
}

