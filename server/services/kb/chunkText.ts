interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
  minChunkLength?: number;
}

interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalChars = text.length;
  const chineseRatio = totalChars > 0 ? chineseChars / totalChars : 0;
  const charsPerToken = chineseRatio > 0.3 ? 1.5 : chineseRatio > 0.1 ? 2 : 4;
  return Math.ceil(totalChars / charsPerToken);
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxTokens || 500;
  const overlap = options.overlap || 50;
  const minChunkLength = options.minChunkLength || 30;

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const chineseRatio = text.length > 0 ? chineseChars / text.length : 0;
  const charsPerToken = chineseRatio > 0.3 ? 1.5 : chineseRatio > 0.1 ? 2 : 4;

  const maxChars = Math.floor(maxTokens * charsPerToken);
  const overlapChars = Math.floor(overlap * charsPerToken);

  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

  if (paragraphs.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (currentChunk.length >= minChunkLength) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: estimateTokens(currentChunk),
        });
      }

      const sentences = para.split(/(?<=[。！？.!?\n])\s*/);
      currentChunk = '';

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            tokenCount: estimateTokens(currentChunk),
          });
          currentChunk = currentChunk.slice(-overlapChars) + sentence;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      }
      continue;
    }

    if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: estimateTokens(currentChunk),
      });
      const overlapText = currentChunk.slice(-overlapChars);
      currentChunk = overlapText + '\n\n' + para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim().length >= minChunkLength) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex++,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}
