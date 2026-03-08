export function buildKnowledgePrompt(chunks: { content: string; documentTitle: string; category: string }[]): string {
  if (!chunks || chunks.length === 0) return '';

  const chunksText = chunks.map((chunk, i) => 
    `### 文档片段 ${i + 1}（来源：${chunk.documentTitle}）\n${chunk.content}`
  ).join('\n\n');

  return `

## 📚 知识库参考文档

以下是从企业知识库中检索到的相关文档片段。请基于这些文档回答用户问题。

${chunksText}

## 知识库回答规则
- 优先基于以上参考文档回答用户问题
- 如果参考文档中包含相关信息，基于文档内容给出准确回答
- 如果参考文档中没有相关信息，明确告知"知识库中暂无相关信息"，然后用你的通用知识尝试回答
- 回答末尾用 📄 标注来源文档名，格式：📄 来源：文档名1、文档名2
- 不要编造文档中没有的信息
- 回答语气保持专业简洁`;
}
