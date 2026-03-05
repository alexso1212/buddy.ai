import { storage } from '../../storage';
import { extractText } from './extractText';
import { chunkText } from './chunkText';

export async function processDocument(documentId: number): Promise<void> {
  try {
    const doc = await storage.getKbDocumentById(documentId);
    if (!doc) {
      console.error(`[KB] Document not found: ${documentId}`);
      return;
    }

    await storage.updateKbDocument(documentId, { status: 'processing' });
    console.log(`[KB] Processing document: ${doc.title} (${doc.fileType})`);

    const filePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;

    let rawText: string;
    try {
      rawText = await extractText(filePath, doc.fileType);
    } catch (err: any) {
      console.error(`[KB] Text extraction failed for ${doc.fileName}:`, err.message);
      await storage.updateKbDocument(documentId, {
        status: 'error',
        errorMessage: `文本提取失败: ${err.message}`,
      });
      return;
    }

    if (!rawText || rawText.trim().length < 10) {
      await storage.updateKbDocument(documentId, {
        status: 'error',
        errorMessage: '无法从文件中提取到有效文本内容',
      });
      return;
    }

    console.log(`[KB] Extracted ${rawText.length} chars from ${doc.fileName}`);

    const chunks = chunkText(rawText, {
      maxTokens: 500,
      overlap: 50,
      minChunkLength: 30,
    });

    if (chunks.length === 0) {
      await storage.updateKbDocument(documentId, {
        status: 'error',
        errorMessage: '文本切片后无有效内容',
      });
      return;
    }

    console.log(`[KB] Created ${chunks.length} chunks from ${doc.fileName}`);

    await storage.deleteKbChunksByDocument(documentId);

    const chunkRecords = chunks.map(chunk => ({
      documentId: documentId,
      orgId: doc.orgId,
      chunkIndex: chunk.index,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: JSON.stringify({
        sourceFile: doc.fileName,
        sourceTitle: doc.title,
        category: doc.category,
      }),
    }));

    await storage.createKbChunks(chunkRecords);

    try {
      const { generateEmbeddingsForDocument } = await import('./embedding');
      const savedChunks = await storage.getKbChunksByDocument(documentId);
      const chunksForEmbedding = savedChunks.map((c: any) => ({ id: c.id, content: c.content }));

      const embeddingResult = await generateEmbeddingsForDocument(documentId, chunksForEmbedding);
      console.log(`[KB] Embeddings: ${embeddingResult.success} success, ${embeddingResult.failed} failed`);
    } catch (err: any) {
      console.warn(`[KB] Embedding generation failed (non-fatal):`, err.message);
    }

    await storage.updateKbDocument(documentId, {
      status: 'ready',
      chunkCount: chunks.length,
    });

    console.log(`[KB] Document ready: ${doc.title} (${chunks.length} chunks)`);

  } catch (err: any) {
    console.error(`[KB] Processing error for document ${documentId}:`, err.message);
    try {
      await storage.updateKbDocument(documentId, {
        status: 'error',
        errorMessage: `处理失败: ${err.message}`,
      });
    } catch {
      console.error(`[KB] Failed to update error status for document ${documentId}`);
    }
  }
}
