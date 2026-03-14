import { sql } from 'drizzle-orm';
import { storage } from '../../storage';

const EMBEDDING_AVAILABLE = process.env.EMBEDDING_ENABLED !== 'false';
const EMBEDDING_BASE_URL = process.env.AI_BASE_URL || 'https://vip.aipro.love/v1';
const EMBEDDING_API_KEY = process.env.CLAUDE_SIMPLE_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

const BATCH_SIZE = 20;
const BATCH_DELAY = 1000;

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_AVAILABLE) return null;

  try {
    const response = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[KB Embedding] API error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    return data?.data?.[0]?.embedding || null;
  } catch (err: any) {
    console.error(`[KB Embedding] Failed:`, err.message);
    return null;
  }
}

export async function generateEmbeddingsForDocument(documentId: number, chunks: { id: number; content: string }[]): Promise<{ success: number; failed: number }> {
  if (!EMBEDDING_AVAILABLE) {
    console.log(`[KB Embedding] Embedding not available, skipping for document ${documentId}`);
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    for (const chunk of batch) {
      try {
        const embedding = await generateEmbedding(chunk.content);
        if (embedding && embedding.length === EMBEDDING_DIMENSIONS) {
          const vectorStr = `[${embedding.join(',')}]`;
          await storage.executeRaw(
            sql`UPDATE kb_chunks SET embedding = ${vectorStr}::vector WHERE id = ${chunk.id}`
          );
          success++;
        } else {
          failed++;
          console.warn(`[KB Embedding] Invalid embedding for chunk ${chunk.id}`);
        }
      } catch (err: any) {
        failed++;
        console.error(`[KB Embedding] Error for chunk ${chunk.id}:`, err.message);
      }
    }

    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log(`[KB Embedding] Document ${documentId}: ${success} success, ${failed} failed`);
  return { success, failed };
}

export async function vectorSearch(
  orgId: number,
  queryText: string,
  topK: number = 5
): Promise<{ id: number; documentId: number; content: string; similarity: number; metadata: string | null }[]> {
  if (!EMBEDDING_AVAILABLE) return [];

  const queryEmbedding = await generateEmbedding(queryText);
  if (!queryEmbedding) return [];

  const vectorStr = `[${queryEmbedding.join(',')}]`;

  try {
    const results = await storage.executeRaw(
      sql`SELECT 
            c.id, 
            c.document_id as "documentId", 
            c.content, 
            c.metadata,
            1 - (c.embedding <=> ${vectorStr}::vector) as similarity
          FROM kb_chunks c
          JOIN kb_documents d ON c.document_id = d.id
          WHERE c.org_id = ${orgId}
            AND d.status = 'ready'
            AND c.embedding IS NOT NULL
          ORDER BY c.embedding <=> ${vectorStr}::vector
          LIMIT ${topK}`
    );
    return (results.rows || results) as any[];
  } catch (err: any) {
    console.error(`[KB Vector Search] Error:`, err.message);
    return [];
  }
}
