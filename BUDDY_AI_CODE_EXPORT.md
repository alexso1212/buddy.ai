# Buddy AI 代码导出 — 外部审核用

生成时间: 2026-03-08 05:12 UTC
文件总数: 16

## 目录

1. `server/services/ai/prompts.ts` (359 行)
2. `server/services/ai/index.ts` (2057 行)
3. `server/services/ai/verdictService.ts` (351 行)
4. `server/services/ai/actionExecutor.ts` (550 行)
5. `server/services/ai/decisionService.ts` (148 行)
6. `server/services/ai/codeTools.ts` (237 行)
7. `server/services/setup/aiExtractor.ts` (402 行)
8. `server/services/briefing/briefingGenerator.ts` (228 行)
9. `server/routes.ts` (4675 行)
10. `server/services/kb/chunkText.ts` (91 行)
11. `server/services/kb/embedding.ts` (116 行)
12. `server/services/kb/processDocument.ts` (123 行)
13. `server/services/kb/search.ts` (164 行)
14. `server/services/kb/extractText.ts` (96 行)
15. `shared/schema.ts` (1068 行)
16. `server/storage.ts` (1374 行)

---

## ===== 文件路径: server/services/ai/prompts.ts (359 行) =====

```typescript
export const SYSTEM_PROMPT = `你是 {{orgName}} 的企业任务管理 AI 助手。你的工作是帮助团队成员用自然语言管理任务。

## 你的能力
你可以帮助用户执行以下操作：
1. create_task — 创建新任务
2. update_task — 更新任务（状态、优先级、负责人、截止日期等）
3. create_project — 创建新项目
4. add_comment — 给任务添加评论
5. 回答查询类问题（任务列表、项目进展、工作概览等）
6. judge_assignment — 判定任务分配是否合理（权责判定），用户说"判断一下"、"合不合理"、"应该谁做"时触发
7. query_verdicts — 查询某人的权责判定历史和统计，用户说"权责分布"、"分外工作"时触发
8. resolve_decision — 确认决策任务（当用户回复待确认信息时自动触发）

## 当前系统上下文
- 组织: {{orgName}}
- 当前用户ID: {{currentUserId}}
- 当前用户名: {{currentUserName}}
- 当前时间: {{currentTime}}

## 团队成员
{{teamMembers}}

## 项目列表
{{projectList}}

## 当前活跃任务（未完成/未取消）
{{taskList}}

## 任务统计
- 总任务数: {{totalTasks}}
- 已完成: {{doneTasks}}
- 逾期: {{overdueTasks}}

## 重要规则

### 规则1: 输出格式
你必须以纯 JSON 格式回复（不要用 markdown 代码块包裹），严格遵循以下结构：

**写入操作（创建/更新/删除）→ 必须用 confirm：**
{
  "type": "confirm",
  "action": {
    "actionType": "create_task",
    "data": { "title": "...", "projectId": 4 },
    "summary": "创建任务「完成Q1课程大纲」，分配给Michael，截止3月15日",
    "confidence": 0.9
  }
}

**查询类问题 → 必须用 text，直接给出结果：**
{
  "type": "text",
  "message": "当前有3个进行中的任务：\\n1. 阶段二验收准备（截止2/25）\\n2. CEO决策-双主体定价（截止2/25）\\n3. 重构销售KPI（截止2/21）"
}

**信息不足需要引导 → 用 follow_up（AI 只返回已知数据和缺失字段列表，具体选项由后端生成）：**

首先判断用户要创建的是什么：
- "组织拔河比赛"、"创建一个任务" → creationType: "task"
- "我们要开始做抖音矩阵号了"、"新建一个项目" → creationType: "project"
- "在课程录制任务下面加一个字幕翻译" → creationType: "task"（且 partialData 中包含 parentTaskId 信息）

当用户要创建任务或项目，但信息不足时返回：
{
  "type": "follow_up",
  "message": "好的，帮你创建「拔河比赛」的任务，需要确认几个信息：",
  "creationType": "task",
  "partialData": { "title": "组织拔河比赛" },
  "missingFields": ["projectId", "assigneeId", "dueDate"]
}

creationType 只有两种值：
- "task" — 创建任务（包括子任务）
- "project" — 创建项目

partialData: AI 从用户描述中提取到的所有已知信息，字段名对应数据模型
- 任务：title, projectId, assigneeId, dueDate, priority, weight, type, parentTaskId, description, tags
- 项目：name, description, deptId, ownerId, startDate, targetDate

missingFields: 仅列出仍需用户确认的字段名（不要列已知字段），可选字段列表：
- 任务：projectId, parentTaskId, assigneeId, dueDate, priority, weight, type, description, tags
- 项目：description, deptId, ownerId, startDate, targetDate

### 信息充足的判断（极其重要）：
如果用户说"在AI知识库项目里给Michael创建转录校对任务，高优先级，下周五前完成"
→ 所有关键信息已知，直接返回 confirm，不走 follow_up

如果用户说"明天组织拔河比赛"
→ 缺少 projectId，需要 follow_up
→ partialData: { "title": "组织拔河比赛", "dueDate": "tomorrow's date" }
→ missingFields: ["projectId", "assigneeId"]

如果用户说"创建一个任务"
→ 缺少所有信息，需要 follow_up
→ partialData: {}
→ missingFields: ["title", "projectId", "assigneeId", "dueDate"]

如果用户说"创建一个新项目做抖音矩阵号"
→ creationType: "project"
→ partialData: { "name": "抖音矩阵号运营" }
→ missingFields: ["description", "deptId", "ownerId", "startDate", "targetDate"]

注意：
- missingFields 中不需要包含有合理默认值的字段（如 priority 默认 medium, weight 默认 3, status 默认 todo）
- 但如果 AI 无法从上下文确定 assigneeId，必须包含在 missingFields 中
- 如果只有 title 是必填但缺失，返回 type="text" 直接追问标题文字，不用 follow_up
- 后端会根据 missingFields 自动生成带数据库选项的步骤，AI 不需要生成任何选项

**批量写入操作 → 用 multi_confirm：**
{
  "type": "multi_confirm",
  "actions": [
    { "actionType": "create_task", "data": { "title": "设计用户界面", "projectId": 1, "ref": "T1" }, "summary": "创建任务「设计用户界面」", "confidence": 0.9 },
    { "actionType": "create_task", "data": { "title": "实现前端页面", "projectId": 1, "ref": "T2", "dependsOnRef": ["T1"] }, "summary": "创建任务「实现前端页面」（依赖 T1）", "confidence": 0.9 }
  ]
}

**批量创建中的依赖关系字段：**
- ref: 当前任务在本批次中的临时标识（如 "T1", "T2"），用于同批次内其他任务引用
- dependsOn: 依赖的已有任务 ID 列表（数据库中已存在的任务）
- dependsOnRef: 依赖同批次内其他任务的 ref 标识列表（如 ["T1"] 表示依赖本批次中 ref="T1" 的任务）

**会议纪要/批量任务处理流程（重要）：**
当用户发送会议纪要、工作计划、或包含多个待办事项的文本时，必须遵循"两步确认"流程：
1. 第一步（先整理）：用自然语言列出你从文本中提取的任务清单，用表格展示（序号、标题、负责人、截止日期、所属项目、依赖关系）。问用户"以上任务清单是否正确？确认后我将批量创建。"
2. 第二步（用户确认后）：用户确认（说"确认"、"可以"、"好的"等）后，再输出 multi_confirm 的 action 块进行批量创建。如果系统中已有类似标题的活跃任务，在 summary 中标注提醒。
绝对不要在第一步就直接输出 multi_confirm，必须先让用户审核清单。

### 规则2: 查询 vs 写入的区分（极其重要）
- 用户问"有什么任务"、"项目进展"、"谁在做什么"、"概览"、"有多少任务"等 → 这是查询，返回 type="text"，直接用文字描述结果
- 用户说"创建"、"建个任务"、"更新"、"改状态"、"添加评论" → 这是写入，返回 type="confirm"
- **绝对不要对查询类请求返回 confirm 或 multi_confirm**

### 规则3: 信息完整度与warnings
当用户提供的信息不足以完成操作时，有两种处理方式：
- 如果只缺少一两个关键字段（如项目ID、负责人），使用 follow_up 格式让用户点选
- 如果是从会议纪要、长文本中批量提取任务，允许带warnings创建

必填字段：
- create_task: title（标题必须有），projectId（必须确认项目）
- 其他字段如果用户没提供，使用合理默认值：
  - priority: "medium"
  - status: "todo"
  - weight: 3
  - assigneeId: 当前用户

#### warnings 字段规则
从会议纪要或长文本提取任务时，对每个 action 的 data 新增 warnings 字段（字符串数组），标注信息缺失情况：
- 负责人不明确时: "⚠️ 负责人未明确，已暂分给xxx，请确认"
- 截止日期是AI推测的: "⚠️ 截止日期为AI推测，原文未指定"
- 会议中说待定/后续再议: "⚠️ 会议中标记为待定"
- 任务描述模糊: "⚠️ 任务内容较模糊，建议补充"
- 其他信息缺失可自行组合类似格式

#### confidence 真实反映完整度
- 信息完整（标题、项目、负责人、截止日期都明确）: confidence ≥ 0.9
- 有推测或猜测（如推测了截止日期或负责人）: confidence 0.7-0.8
- 信息严重缺失（多个字段靠默认值）: confidence 0.5-0.6
- warnings 为空或不存在时，confidence 应 ≥ 0.9

示例：
{
  "actionType": "create_task",
  "data": {
    "title": "完成Q1课程大纲",
    "projectId": 4,
    "assigneeId": 3,
    "warnings": ["⚠️ 负责人未明确，已暂分给Michael，请确认", "⚠️ 截止日期为AI推测，原文未指定"]
  },
  "summary": "创建任务「完成Q1课程大纲」",
  "confidence": 0.7
}

### 规则4: 智能匹配
用户说"Michael"或"michael"→ 匹配到 Michael 用户
用户说"AI项目"或"知识库"→ 匹配到 AI知识库Bot开发 项目
用户说"人事"或"架构"→ 匹配到 人事协议与组织架构调整 项目
用户说"销售"或"运营"→ 匹配到 销售运营与内容体系优化 项目
模糊匹配时 confidence 降低，并在 summary 中说明匹配结果让用户确认。

### 规则4.5: 权责判定
- 用户问"这个任务给XX合不合理"、"判断一下"→ 返回 type="confirm", actionType="judge_assignment"
- 用户问"XX的权责分布"、"分外工作比例" → 返回 type="text"，查询统计数据直接给结果
- judge_assignment 的 data 需要包含: taskId (任务ID), userId (被判定的用户ID)
- query_verdicts 的 data 需要包含: userId (可选), taskId (可选)

### 规则5: 决策确认（resolve_decision）
当系统上下文包含"待确认决策任务"时，如果用户的回复包含对这些决策的确认信息，你应该：
- 解析用户回复中提到的编号（如"第1个"、"第2项"）或任务名称
- 提取用户提供的具体信息（负责人、截止日期、优先级等）
- 对每个已确认的决策，返回 confirm 或 multi_confirm，actionType 为 "resolve_decision"
- resolve_decision 的 data 格式：{ "decisionTaskId": 123, "updates": { "assigneeId": 5, "dueDate": "2024-03-15" } }
- 如果用户的回复仍然模糊，用 type="text" 追问具体信息
- 如果用户一次确认多个决策，使用 multi_confirm

示例：
用户说"第1个交给张三，第2个下周五前完成"→
{
  "type": "multi_confirm",
  "actions": [
    { "actionType": "resolve_decision", "data": { "decisionTaskId": 101, "updates": { "assigneeId": 5 } }, "summary": "确认任务负责人为张三" },
    { "actionType": "resolve_decision", "data": { "decisionTaskId": 102, "updates": { "dueDate": "next-friday-date" } }, "summary": "确认截止日期为下周五" }
  ]
}

### 规则6: 交互式选择（极其重要）

当你的回复包含以下任何一种情况时，**必须**在 JSON 中附带 interactiveInput 字段，让用户通过点击按钮而不是打字来回应：

#### 必须弹出 Widget 的场景：

1. **确认类**：任何需要用户说"确认""好的""可以"的地方
   → 弹出 [确认] [取消] 按钮

2. **选择类**：任何"你想要A还是B"的地方
   → 弹出选项按钮

3. **是否类**：任何"需要我帮你xxx吗？"的地方
   → 弹出 [好的] [不用了] 按钮

4. **澄清类**：任何"你是指xxx还是yyy？"的地方
   → 弹出对应选项

5. **下一步类**：完成一个操作后询问后续
   → 弹出 [继续] [就到这里] 按钮

#### interactiveInput 的 JSON 格式：

在你的正常回复 JSON 中，额外添加 interactiveInput 数组：

{
  "type": "text",
  "message": "我整理了以下3个任务，请确认是否创建：\\n\\n1. 制定投流控本奖励规则\\n2. 设计熔断管控机制\\n3. 制定超额获客奖励标准",
  "interactiveInput": [
    {
      "type": "single_select",
      "question": "是否创建这些任务？",
      "options": ["全部确认创建", "我要修改几个", "先不创建"]
    }
  ]
}

又比如：
{
  "type": "text",
  "message": "这个任务可以分配给张三（销售经理）或李四（销售专员），你觉得谁更合适？",
  "interactiveInput": [
    {
      "type": "single_select",
      "question": "分配给谁？",
      "options": ["张三（销售经理）", "李四（销售专员）", "先不分配"]
    }
  ]
}

又比如完成操作后：
{
  "type": "text",
  "message": "任务已创建成功，已分配给AlexSo。",
  "interactiveInput": [
    {
      "type": "single_select",
      "question": "接下来？",
      "options": ["继续创建下一个任务", "查看所有待办", "就到这里"]
    }
  ]
}

#### interactiveInput 支持的类型：

1. single_select — 单选（用户点一个选项）
{
  "type": "single_select",
  "question": "问题文字",
  "options": ["选项A", "选项B", "选项C"]
}

2. multi_select — 多选（用户可选多个）
{
  "type": "multi_select",
  "question": "选择要创建的任务",
  "options": ["任务1", "任务2", "任务3", "全部"]
}

3. confirm — 简单确认（是/否）
{
  "type": "confirm",
  "question": "确认创建这个任务吗？"
}
→ 自动渲染为 [确认] [取消] 两个按钮

4. date_pick — 日期选择
{
  "type": "date_pick",
  "question": "截止日期是？"
}

#### 重要原则：
- 宁可多弹 Widget 也不要让用户打字确认
- 如果你不确定某个回复是否需要 Widget，就加上
- Widget 的选项要简洁明了，通常 2-4 个选项
- 每次回复最多1个 interactiveInput（不要堆叠多个）
- 如果回复是纯信息展示（如查询结果），不需要 Widget

### 规则7: 创建前自检（防止重复）

在创建任务之前，检查「当前活跃任务」列表：

1. 如果发现语义高度相似的已有任务（即使措辞不同），**不要直接创建**
2. 在回复中列出疑似重复项，用 interactiveInput 让用户选择

示例：
  用户说："创建任务整理Q2销售数据"
  已有任务列表中有："Q2销售报表整理（进行中，AlexSo负责）"

  → 你应该回复：
  {
    "type": "text",
    "message": "系统中已有一个相似任务：\\n\\n- Q2销售报表整理（进行中，AlexSo负责）\\n\\n请确认是否需要另外创建。",
    "interactiveInput": [{
      "type": "single_select",
      "question": "如何处理？",
      "options": ["这是同一个任务，不用创建", "这是不同的任务，继续创建"]
    }]
  }

3. 从会议纪要批量提取任务时，在任务清单中标注哪些和已有任务重复：
  用 [新] 标记新任务，[疑似重复] 标记疑似重复

### 规则8: 永远不要
- 永远不要编造不存在的项目或用户
- 永远不要在 JSON 之外输出额外内容
- 永远不要用 markdown 代码块包裹 JSON
- 永远不要对查询请求返回 confirm 类型
`;

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

```

---

## ===== 文件路径: server/services/ai/index.ts (2057 行) =====

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';
import { CODE_TOOLS, executeCodeTool } from './codeTools';
import type { AiProvider, AiModelProvider } from '@shared/schema';

let cachedProviders: AiProvider[] | null = null;
let cachedModelProviders: AiModelProvider[] | null = null;
let providersCacheTime = 0;
let modelProvidersCacheTime = 0;
const PROVIDER_CACHE_TTL = 60000;
const clientCache = new Map<string, OpenAI>();

async function loadProviders(): Promise<AiProvider[]> {
  const now = Date.now();
  if (cachedProviders && now - providersCacheTime < PROVIDER_CACHE_TTL) {
    return cachedProviders;
  }
  try {
    cachedProviders = await storage.getAiProviders();
    providersCacheTime = now;
    return cachedProviders;
  } catch (e) {
    if (cachedProviders) return cachedProviders;
    return getHardcodedFallbackProviders();
  }
}

function getHardcodedFallbackProviders(): AiProvider[] {
  return [
    { id: -1, name: 'Claude Simple', type: 'proxy', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_SIMPLE_API_KEY', models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5'], timeout: 90000, priority: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: -2, name: 'Claude Complex', type: 'proxy', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_COMPLEX_API_KEY', models: ['claude-opus-4-6'], timeout: 180000, priority: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: -3, name: 'OpenRouter', type: 'direct', baseUrl: process.env.AI_BASE_URL || '', apiKeyEnvVar: 'AI_API_KEY', models: ['gpt-4o', 'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.2', 'deepseek-chat'], timeout: 30000, priority: 2, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
}

export function invalidateProviderCache() {
  cachedProviders = null;
  cachedModelProviders = null;
  providersCacheTime = 0;
  modelProvidersCacheTime = 0;
  clientCache.clear();
}

async function loadModelProviders(): Promise<AiModelProvider[]> {
  const now = Date.now();
  if (cachedModelProviders && now - modelProvidersCacheTime < PROVIDER_CACHE_TTL) {
    return cachedModelProviders;
  }
  try {
    cachedModelProviders = await storage.getModelProviders();
    modelProvidersCacheTime = now;
    return cachedModelProviders;
  } catch (e) {
    if (cachedModelProviders) return cachedModelProviders;
    return [];
  }
}

const MODEL_ALIAS_MAP: Record<string, string> = {
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'gpt-5.4': 'gpt-4o',
  'gpt-5.4-pro': 'gpt-4o',
  'gpt-5.2': 'gpt-4o',
};

const REVERSE_MODEL_ALIASES: Record<string, string[]> = {};
for (const [alias, canonical] of Object.entries(MODEL_ALIAS_MAP)) {
  if (!REVERSE_MODEL_ALIASES[canonical]) REVERSE_MODEL_ALIASES[canonical] = [];
  REVERSE_MODEL_ALIASES[canonical].push(alias);
}

function resolveModelId(model: string): string {
  return MODEL_ALIAS_MAP[model] || model;
}

export async function claudeComplete(params: {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: { role: string; content: string }[];
}): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const resolved = resolveModelId(params.model);
  const isClaudeModel = resolved.startsWith('claude-');
  const officialKey = isClaudeModel ? await findAnthropicKey(resolved) : null;

  if (isClaudeModel && officialKey) {
    const client = new Anthropic({ apiKey: officialKey });
    const systemMsg = params.messages.find(m => m.role === 'system');
    const nonSystemMsgs = params.messages.filter(m => m.role !== 'system');
    const response = await client.messages.create({
      model: resolved,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: nonSystemMsgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    return {
      content: text,
      usage: {
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      },
    };
  }

  const aiClient = await getClientForModel(params.model);
  const response = await aiClient.chat.completions.create({
    model: resolved,
    max_tokens: params.max_tokens,
    temperature: params.temperature ?? 0,
    messages: params.messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
  });
  return {
    content: response.choices[0]?.message?.content || '',
    usage: response.usage ? {
      prompt_tokens: response.usage.prompt_tokens ?? 0,
      completion_tokens: response.usage.completion_tokens ?? 0,
      total_tokens: response.usage.total_tokens ?? 0,
    } : undefined,
  };
}

function getDefaultBaseUrl(modelId: string): string {
  const resolved = resolveModelId(modelId);
  if (resolved.startsWith('claude')) return 'https://vip.aipro.love/v1';
  if (resolved === 'deepseek-chat') return 'https://openrouter.ai/api/v1';
  return 'https://api.openai.com/v1';
}

function resolveApiKey(mp: AiModelProvider): string | null {
  if (mp.apiKey) return mp.apiKey;
  if (mp.apiKeyEnvVar) {
    const envVal = process.env[mp.apiKeyEnvVar];
    if (envVal) return envVal;
    if (mp.apiKeyEnvVar.startsWith('sk-')) return mp.apiKeyEnvVar;
  }
  return null;
}

async function findAnthropicKey(modelId?: string): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (!modelId) return null;
  try {
    const modelProviders = await loadModelProviders();
    const resolved = resolveModelId(modelId);
    for (const mp of modelProviders) {
      if (!mp.isActive) continue;
      if (mp.modelId !== modelId && mp.modelId !== resolved) continue;
      const key = resolveApiKey(mp);
      if (key && key.startsWith('sk-ant-')) return key;
    }
  } catch {}
  return null;
}

function getClientForModelProvider(mp: AiModelProvider): OpenAI | null {
  const apiKey = resolveApiKey(mp);
  if (!apiKey) return null;
  const isAnthropicKey = apiKey.startsWith('sk-ant-');
  const hasProxyUrl = mp.baseUrl && !mp.baseUrl.includes('anthropic.com');
  if (isAnthropicKey && !hasProxyUrl) return null;
  const baseUrl = mp.baseUrl || getDefaultBaseUrl(mp.modelId);
  const cacheKey = `mp_${mp.id}_${baseUrl}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: mp.timeout,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

function getClientForProvider(provider: AiProvider): OpenAI | null {
  const apiKey = process.env[provider.apiKeyEnvVar];
  if (!apiKey) return null;
  const cacheKey = `${provider.id}_${provider.baseUrl}_${provider.apiKeyEnvVar}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      baseURL: provider.baseUrl,
      apiKey,
      timeout: provider.timeout,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

async function getProvidersForModel(model: string): Promise<{ provider: { name: string; id: number }; client: OpenAI }[]> {
  const resolved = resolveModelId(model);
  const modelProviders = await loadModelProviders();
  const modelSpecific = modelProviders.filter(mp => (mp.modelId === model || mp.modelId === resolved) && mp.isActive);

  if (modelSpecific.length > 0) {
    const result: { provider: { name: string; id: number }; client: OpenAI }[] = [];
    for (const mp of modelSpecific) {
      const client = getClientForModelProvider(mp);
      if (client) result.push({ provider: { name: mp.providerName, id: mp.id }, client });
    }
    if (result.length > 0) return result;
  }

  const providers = await loadProviders();
  const result: { provider: { name: string; id: number }; client: OpenAI }[] = [];
  for (const p of providers) {
    if (!p.isActive) continue;
    if (!p.models.includes(model) && !p.models.includes(resolved)) continue;
    const client = getClientForProvider(p);
    if (client) result.push({ provider: { name: p.name, id: p.id }, client });
  }
  return result;
}

async function getClientForModel(model: string): Promise<OpenAI> {
  const entries = await getProvidersForModel(model);
  if (entries.length > 0) return entries[0].client;
  const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.CLAUDE_COMPLEX_API_KEY || process.env.AI_API_KEY;
  return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey: apiKey || '', timeout: 90000 });
}

async function callWithFallback<T>(
  model: string,
  callFn: (client: OpenAI, providerName: string) => Promise<T>,
): Promise<T> {
  const entries = await getProvidersForModel(model);
  if (entries.length === 0) {
    const fallbackClient = await getClientForModel(model);
    return callFn(fallbackClient, 'fallback');
  }
  let lastError: Error | null = null;
  for (const { provider, client } of entries) {
    try {
      return await callFn(client, provider.name);
    } catch (err: any) {
      lastError = err;
      console.error(`[AI Fallback] Provider "${provider.name}" failed for model ${model}: ${err.message}`);
    }
  }
  throw lastError || new Error(`All providers failed for model ${model}`);
}

type TaskCategory = 'title_generation' | 'auto_judgment' | 'quick_reply' | 'general_chat' | 'code_generation' | 'complex_analysis' | 'document_processing' | 'knowledge_qa';

interface ModelConfig {
  model: string;
  max_tokens: number;
  thinking: { type: 'enabled'; budget_tokens: number } | { type: 'disabled' };
  temperature: number;
}

const TASK_MODEL_CONFIGS: Record<TaskCategory, ModelConfig> = {
  title_generation: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    thinking: { type: 'disabled' },
    temperature: 0.7,
  },
  auto_judgment: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    thinking: { type: 'disabled' },
    temperature: 0.0,
  },
  quick_reply: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    thinking: { type: 'disabled' },
    temperature: 0.5,
  },
  general_chat: {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    thinking: { type: 'disabled' },
    temperature: 0.7,
  },
  code_generation: {
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 16000 },
    temperature: 0.3,
  },
  complex_analysis: {
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    thinking: { type: 'enabled', budget_tokens: 32000 },
    temperature: 0.5,
  },
  document_processing: {
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 10000 },
    temperature: 0.3,
  },
  knowledge_qa: {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    thinking: { type: 'disabled' },
    temperature: 0.3,
  },
};

const USER_MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6': 64000,
  'claude-sonnet-4-6': 8192,
  'claude-haiku-4-5-20251001': 2048,
  'claude-haiku-4-5': 2048,
  'gpt-4o': 16384,
  'gpt-5.4': 16384,
  'gpt-5.4-pro': 32768,
  'gpt-5.2': 16384,
  'deepseek-chat': 8192,
};

function getMaxTokensForModel(model: string): number {
  return USER_MODEL_MAX_TOKENS[model] || 16384;
}

function getConfigForTask(task: TaskCategory, userModel?: string, extendedThinking?: boolean): ModelConfig {
  const baseConfig = { ...TASK_MODEL_CONFIGS[task] };

  if (userModel) {
    baseConfig.model = userModel;
    if (userModel === 'claude-opus-4-6') {
      baseConfig.max_tokens = 64000;
      if (extendedThinking) {
        baseConfig.thinking = { type: 'enabled', budget_tokens: 32000 };
      }
    } else {
      const modelMaxTokens = USER_MODEL_MAX_TOKENS[userModel];
      if (modelMaxTokens && baseConfig.max_tokens > modelMaxTokens) {
        baseConfig.max_tokens = modelMaxTokens;
      }
    }
  }

  if (!extendedThinking) {
    baseConfig.thinking = { type: 'disabled' };
  } else if (baseConfig.model.startsWith('claude-haiku')) {
    baseConfig.thinking = { type: 'disabled' };
  } else if (!baseConfig.model.startsWith('claude-')) {
    baseConfig.thinking = { type: 'disabled' };
  }

  return baseConfig;
}

async function classifyTask(userMessage: string, hasAttachments?: boolean): Promise<TaskCategory> {
  if (hasAttachments) return 'document_processing';

  const lowerMsg = userMessage.toLowerCase();

  if (/^(hi|hello|hey|你好|嗨|谢谢|ok|好的|thanks|thank you|再见|bye|哈哈|嗯|对|是的|没错|ok了|收到|明白|知道了)$/i.test(userMessage.trim())) {
    return 'quick_reply';
  }

  if (/代码|code|function|实现|写一个|debug|bug|error|fix|修复|编程|script|api|接口|import|export|class|component|变量|variable/.test(lowerMsg)) {
    return 'code_generation';
  }

  if (/分析|analyze|analysis|对比|比较|evaluate|评估|report|报告|策略|strategy|规划|plan|深度|详细分析|root cause/.test(lowerMsg)) {
    return 'complex_analysis';
  }

  if (/总结|summarize|summary|文档|document|摘要|extract|提取|归纳|概括/.test(lowerMsg)) {
    return 'document_processing';
  }

  if (userMessage.length < 50) {
    return 'quick_reply';
  }

  try {
    const response = await claudeComplete({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Classify the user message into exactly one category. Reply with ONLY the category name, nothing else.
Categories:
- quick_reply: greetings, simple yes/no questions, short casual chat
- general_chat: normal conversation, task descriptions, general discussion
- code_generation: code writing, debugging, technical implementation
- complex_analysis: deep reasoning, multi-step analysis, strategic planning
- document_processing: long document reading, summarization, data extraction`
        },
        { role: 'user', content: userMessage.slice(0, 500) }
      ],
    });
    const result = (response.content || '').trim().toLowerCase();
    const validCategories: TaskCategory[] = ['quick_reply', 'general_chat', 'code_generation', 'complex_analysis', 'document_processing'];
    if (validCategories.includes(result as TaskCategory)) return result as TaskCategory;
    return 'general_chat';
  } catch {
    return 'general_chat';
  }
}

const CONTEXT_LIMITS: Record<TaskCategory, number> = {
  title_generation: 4,
  auto_judgment: 4,
  quick_reply: 4,
  general_chat: 20,
  code_generation: 10,
  complex_analysis: 20,
  document_processing: 6,
  knowledge_qa: 10,
};

async function buildOptimizedContext(
  conversationHistory: { role: string; content: string | any[] }[],
  task: TaskCategory,
): Promise<{ role: string; content: string | any[] }[]> {
  const limit = CONTEXT_LIMITS[task];
  const filtered = conversationHistory.filter(
    msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true)
  );

  if (filtered.length <= limit) {
    return filtered;
  }

  const recentMessages = filtered.slice(-limit);
  const olderMessages = filtered.slice(0, -limit);

  try {
    const olderText = olderMessages
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 200) : '[附件内容]'}`)
      .join('\n');

    const response = await claudeComplete({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: '将以下对话历史压缩为简洁摘要（200字以内），保留核心需求、已达成的结论和关键细节。直接输出摘要。'
        },
        { role: 'user', content: olderText.slice(0, 4000) }
      ],
    });

    const summary = response.content || '';

    const firstRecent = recentMessages[0];
    if (firstRecent && firstRecent.role === 'user') {
      const merged = { ...firstRecent, content: `[前期对话摘要]\n${summary}\n\n[最近对话开始]\n${typeof firstRecent.content === 'string' ? firstRecent.content : ''}` };
      return [merged, ...recentMessages.slice(1)];
    }
    return [
      { role: 'user', content: `[前期对话摘要] ${summary}` },
      ...recentMessages,
    ];
  } catch {
    return recentMessages;
  }
}

interface ChatResponse {
  type: 'text' | 'confirm' | 'multi_confirm' | 'follow_up';
  message?: string;
  action?: {
    actionType: string;
    data: Record<string, any>;
    summary: string;
    confidence: number;
    missingFields?: string[];
    followUpQuestion?: string;
  };
  actions?: {
    actionType: string;
    data: Record<string, any>;
    summary: string;
    confidence: number;
  }[];
  followUp?: {
    message: string;
    creationType: 'task' | 'project';
    partialData: Record<string, any>;
    steps: {
      step: number;
      field: string;
      icon: string;
      label: string;
      options: { label: string; value: any; description?: string; icon?: string }[];
      allowCustomInput: boolean;
      customInputPlaceholder?: string;
      allowSkip: boolean;
      skipValue?: any;
      inputType?: 'text' | 'date' | 'textarea';
    }[];
    currentStep: number;
  };
  tokenUsage?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getNextDayOfWeek(dayOfWeek: number): Date {
  const now = new Date();
  const current = now.getDay();
  let diff = dayOfWeek - current;
  if (diff <= 0) diff += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + diff);
  return result;
}

function getEndOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

function getNextMonthFirst(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function formatDisplayDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildGuidedSteps(
  creationType: 'task' | 'project',
  partialData: Record<string, any>,
  missingFields: string[],
  message: string,
  allUsers: any[],
  allProjects: any[],
  allTasks: any[],
  currentUserId: number,
  allDepartments: any[],
  jobRoleMap: Map<number, any>
): ChatResponse {
  const steps: ChatResponse['followUp'] extends undefined ? never : NonNullable<ChatResponse['followUp']>['steps'] = [];
  let stepNum = 1;

  const now = new Date();
  const today = formatDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  const friday = getNextDayOfWeek(5);
  const fridayStr = formatDate(friday);
  const monday = getNextDayOfWeek(1);
  const mondayStr = formatDate(monday);
  const nextFriday = new Date(friday);
  nextFriday.setDate(friday.getDate() + 7);
  const nextFridayStr = formatDate(nextFriday);
  const endOfMonth = getEndOfMonth();
  const endOfMonthStr = formatDate(endOfMonth);

  const buildUserOptions = () => {
    const opts: { label: string; value: any; description?: string }[] = [];
    const currentUser = allUsers.find((u: any) => u.id === currentUserId);
    if (currentUser) {
      const role = currentUser.jobRoleId ? jobRoleMap.get(currentUser.jobRoleId) : null;
      opts.push({ label: '我自己', value: currentUser.id, description: role?.title || '' });
    }
    for (const u of allUsers) {
      if (u.id !== currentUserId && u.isActive !== false) {
        const role = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
        opts.push({ label: u.displayName, value: u.id, description: role?.title || '' });
      }
    }
    return opts;
  };

  if (creationType === 'task') {
    const taskFieldOrder = ['title', 'projectId', 'parentTaskId', 'assigneeId', 'dueDate', 'priority', 'weight', 'type', 'description', 'tags'];
    const orderedFields = taskFieldOrder.filter(f => missingFields.includes(f));

    for (const field of orderedFields) {
      const step: any = { step: stepNum++, field, options: [], allowCustomInput: false, allowSkip: false };

      switch (field) {
        case 'title':
          step.icon = '📝';
          step.label = '任务的标题是什么？';
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入任务标题';
          step.allowSkip = false;
          step.inputType = 'text';
          break;

        case 'projectId':
          step.icon = '📁';
          step.label = '属于哪个项目？';
          step.options = allProjects
            .filter((p: any) => p.status !== 'cancelled')
            .map((p: any) => ({ label: p.name, value: p.id }));
          step.options.push({ label: '➕ 创建新项目', value: 'new_project' });
          step.options.push({ label: '📋 暂不归属项目', value: null });
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入项目名称搜索...';
          step.allowSkip = false;
          break;

        case 'parentTaskId':
          step.icon = '🏷️';
          step.label = '这是独立任务还是子任务？';
          step.options = [{ label: '独立任务 — 直接挂在项目下', value: null }];
          if (partialData.projectId) {
            const projectTasks = allTasks.filter((t: any) =>
              t.projectId === partialData.projectId && !t.parentTaskId && t.status !== 'cancelled'
            );
            for (const t of projectTasks) {
              step.options.push({ label: t.title, value: t.id, description: `${t.status} | 优先级: ${t.priority}` });
            }
          }
          step.allowCustomInput = false;
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'assigneeId':
          step.icon = '👤';
          step.label = '谁来负责？';
          step.options = buildUserOptions();
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入名字...';
          step.allowSkip = false;
          break;

        case 'dueDate':
          step.icon = '📅';
          step.label = '什么时候需要完成？';
          step.options = [
            { label: `今天 (${formatDisplayDate(now)})`, value: today },
            { label: `明天 (${formatDisplayDate(tomorrow)})`, value: tomorrowStr },
            { label: `本周五 (${formatDisplayDate(friday)})`, value: fridayStr },
            { label: `下周一 (${formatDisplayDate(monday)})`, value: mondayStr },
            { label: `下周五 (${formatDisplayDate(nextFriday)})`, value: nextFridayStr },
            { label: `月底 (${formatDisplayDate(endOfMonth)})`, value: endOfMonthStr },
            { label: '⏭️ 暂不确定，稍后补充', value: null },
          ];
          step.allowCustomInput = true;
          step.inputType = 'date';
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'priority':
          step.icon = '🔴';
          step.label = '紧急程度？';
          step.options = [
            { label: '🔴 紧急', value: 'critical', description: '立即处理，阻塞其他工作' },
            { label: '🟠 高', value: 'high', description: '本周内需要重点推进' },
            { label: '🔵 中', value: 'medium', description: '正常优先级' },
            { label: '⚪ 低', value: 'low', description: '有空再处理' },
          ];
          step.allowSkip = true;
          step.skipValue = 'medium';
          break;

        case 'weight':
          step.icon = '⚖️';
          step.label = '重要程度？（影响图谱节点大小，1-10）';
          step.options = [
            { label: '1-3 小事项', value: 2 },
            { label: '4-6 一般', value: 5 },
            { label: '7-8 重要', value: 8 },
            { label: '9-10 核心', value: 10 },
          ];
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入具体数值';
          step.allowSkip = true;
          step.skipValue = 3;
          break;

        case 'type':
          step.icon = '📋';
          step.label = '任务类型？';
          step.options = [
            { label: '任务', value: 'task' },
            { label: '里程碑', value: 'milestone' },
            { label: 'Bug', value: 'bug' },
            { label: '需求', value: 'request' },
          ];
          step.allowSkip = true;
          step.skipValue = 'task';
          break;

        case 'description':
          step.icon = '📝';
          step.label = '需要添加描述吗？';
          step.allowCustomInput = true;
          step.inputType = 'textarea';
          step.customInputPlaceholder = '输入任务描述...';
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'tags':
          step.icon = '🏷️';
          step.label = '添加标签？';
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入标签，用逗号分隔';
          step.allowSkip = true;
          step.skipValue = null;
          break;
      }

      steps.push(step);
    }
  } else {
    const projectFieldOrder = ['name', 'description', 'deptId', 'ownerId', 'startDate', 'targetDate'];
    const orderedFields = projectFieldOrder.filter(f => missingFields.includes(f));

    const nextMonthFirst = getNextMonthFirst();

    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);
    const twoMonthsLater = new Date(now);
    twoMonthsLater.setMonth(now.getMonth() + 2);
    const quarterEnd = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);
    const halfYearLater = new Date(now);
    halfYearLater.setMonth(now.getMonth() + 6);

    for (const field of orderedFields) {
      const step: any = { step: stepNum++, field, options: [], allowCustomInput: false, allowSkip: false };

      switch (field) {
        case 'name':
          step.icon = '🏗️';
          step.label = '项目名称是什么？';
          step.allowCustomInput = true;
          step.inputType = 'text';
          step.allowSkip = false;
          break;

        case 'description':
          step.icon = '📝';
          step.label = '简单描述一下项目目标和背景：';
          step.allowCustomInput = true;
          step.inputType = 'textarea';
          step.customInputPlaceholder = '输入项目描述';
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'deptId':
          step.icon = '🏢';
          step.label = '属于哪个部门？';
          step.options = allDepartments.map((d: any) => ({ label: d.name, value: d.id }));
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入部门名称...';
          step.allowSkip = true;
          break;

        case 'ownerId':
          step.icon = '👤';
          step.label = '谁是项目负责人？';
          step.options = buildUserOptions();
          step.allowCustomInput = true;
          step.allowSkip = false;
          break;

        case 'startDate':
          step.icon = '📅';
          step.label = '项目什么时候开始？';
          step.options = [
            { label: `今天 (${formatDisplayDate(now)})`, value: today },
            { label: `下周一 (${formatDisplayDate(monday)})`, value: mondayStr },
            { label: `下月1号 (${formatDisplayDate(nextMonthFirst)})`, value: formatDate(nextMonthFirst) },
          ];
          step.allowSkip = true;
          step.inputType = 'date';
          break;

        case 'targetDate':
          step.icon = '🎯';
          step.label = '预计什么时候完成？';
          step.options = [
            { label: `1个月后 (${formatDisplayDate(oneMonthLater)})`, value: formatDate(oneMonthLater) },
            { label: `2个月后 (${formatDisplayDate(twoMonthsLater)})`, value: formatDate(twoMonthsLater) },
            { label: `季度末 (${formatDisplayDate(quarterEnd)})`, value: formatDate(quarterEnd) },
            { label: `半年后 (${formatDisplayDate(halfYearLater)})`, value: formatDate(halfYearLater) },
          ];
          step.allowSkip = true;
          step.inputType = 'date';
          break;
      }

      steps.push(step);
    }
  }

  return {
    type: 'follow_up',
    followUp: {
      message: message || '需要确认几个信息：',
      creationType,
      partialData,
      steps,
      currentStep: 1,
    },
  };
}

function buildDisplayData(data: Record<string, any>, users: any[], projects: any[]): Record<string, string> {
  const display: Record<string, string> = {};

  if (data.projectId && typeof data.projectId === 'number') {
    const project = projects.find((p: any) => p.id === data.projectId);
    if (project) display.projectName = project.name;
  }

  if (data.assigneeId && typeof data.assigneeId === 'number') {
    const user = users.find((u: any) => u.id === data.assigneeId);
    if (user) display.assigneeName = user.displayName || user.email;
  }

  const priorityMap: Record<string, string> = {
    critical: '\u{1F534} \u7D27\u6025',
    high: '\u{1F7E0} \u9AD8',
    medium: '\u{1F7E1} \u4E2D',
    low: '\u{1F7E2} \u4F4E',
    none: '\u26AA \u65E0',
  };
  if (data.priority && priorityMap[data.priority]) {
    display.priorityLabel = priorityMap[data.priority];
  }

  const statusMap: Record<string, string> = {
    todo: '\u5F85\u529E',
    in_progress: '\u8FDB\u884C\u4E2D',
    done: '\u5DF2\u5B8C\u6210',
    blocked: '\u5DF2\u963B\u585E',
    cancelled: '\u5DF2\u53D6\u6D88',
  };
  if (data.status && statusMap[data.status]) {
    display.statusLabel = statusMap[data.status];
  }

  return display;
}

interface TeamMemberEntry {
  id: number;
  displayName: string;
  role: string;
  email: string;
  idType: 'assigneeId' | 'memberProfileId';
  aliases?: string[];
  deptName?: string;
  jobTitle?: string;
}

function formatTeamMembers(members: TeamMemberEntry[]): string {
  return members.map(m => {
    const aliasStr = m.aliases && m.aliases.length > 0 ? `（${m.aliases.join('/')}）` : '';
    const deptRole = m.deptName || m.jobTitle
      ? ` [${m.deptName || '未分配'}·${m.jobTitle || '未分配'}]`
      : '';
    const status = m.idType === 'memberProfileId' ? '（待认领）' : '';
    return `- ${m.displayName}${aliasStr}${deptRole}${status} → 分配任务时用 ${m.idType}: ${m.id}`;
  }).join('\n');
}

function formatProjectList(projects: { id: number; name: string; status: string; description?: string | null }[]): string {
  return projects.map(p => `- ID:${p.id} ${p.name}（${p.status}）${p.description || ''}`).join('\n');
}

async function loadBusinessContext(orgId?: number) {
  const allUsersRaw = await storage.getUsers();
  const allProjectsRaw = await storage.getProjects();
  const allTasksRaw = await storage.getTasks({});
  const allDepartmentsRaw = await storage.getDepartments();
  const allJobRoles = await storage.getJobRoles();

  const allUsers = orgId ? allUsersRaw.filter((u: any) => u.orgId === orgId) : allUsersRaw;
  const allProjects = orgId ? allProjectsRaw.filter((p: any) => p.orgId === orgId) : allProjectsRaw;
  const allTasks = orgId ? allTasksRaw.filter((t: any) => t.orgId === orgId) : allTasksRaw;
  const allDepartments = orgId ? allDepartmentsRaw.filter((d: any) => d.orgId === orgId) : allDepartmentsRaw;

  const pendingProfiles = orgId ? await storage.getPendingProfilesByOrg(orgId) : [];

  const jobRoleMap = new Map(allJobRoles.map(r => [r.id, r]));
  const deptMap = new Map(allDepartments.map((d: any) => [d.id, d]));
  const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const doneTasks = allTasks.filter(t => t.status === 'done');
  const now = new Date();
  const overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'cancelled');

  const teamMembers: TeamMemberEntry[] = [
    ...allUsers.map((u: any) => {
      const dept = u.deptId ? deptMap.get(u.deptId) : null;
      const jr = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
      return {
        id: u.id,
        displayName: u.displayName || u.email,
        role: u.role || 'member',
        email: u.email,
        idType: 'assigneeId' as const,
        deptName: dept?.name,
        jobTitle: jr?.title,
      };
    }),
    ...pendingProfiles.map(p => {
      const dept = p.deptId ? deptMap.get(p.deptId) : null;
      const jr = p.jobRoleId ? jobRoleMap.get(p.jobRoleId) : null;
      return {
        id: p.id,
        displayName: p.fullName,
        role: 'pending',
        email: p.email || '',
        idType: 'memberProfileId' as const,
        aliases: (() => { try { return p.aliases ? JSON.parse(p.aliases) : []; } catch { return []; } })(),
        deptName: dept?.name,
        jobTitle: jr?.title || p.title || undefined,
      };
    }),
  ];

  return { allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks, doneTasks, overdueTasks, teamMembers, pendingProfiles };
}

function buildContextBlock(
  ctx: { currentUserId: number; currentUserName: string; model?: string; orgName?: string },
  allUsers: any[],
  allProjects: any[],
  activeTasks: any[],
  allTasks: any[],
  doneTasks: any[],
  overdueTasks: any[],
  teamMembers?: TeamMemberEntry[],
): string {
  const modelName = ctx.model || 'claude-sonnet-4-6';
  const teamFormatted = teamMembers
    ? formatTeamMembers(teamMembers)
    : formatTeamMembers(allUsers.map((u: any) => ({
        id: u.id,
        displayName: u.displayName || u.email,
        role: u.role || 'member',
        email: u.email,
        idType: 'assigneeId' as const,
      })));
  const projectsFormatted = formatProjectList(allProjects);
  const tasksFormatted = formatTaskList(activeTasks, allUsers, ctx.currentUserId);
  const orgDisplayName = ctx.orgName || '当前组织';

  return `## 当前系统上下文
- 组织: ${orgDisplayName}
- 当前用户ID: ${ctx.currentUserId}
- 当前用户名: ${ctx.currentUserName}
- 当前时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- 运行模型: ${modelName}

## 团队成员
${teamFormatted}

## 项目列表
${projectsFormatted}

## 当前活跃任务（未完成/未取消）
${tasksFormatted}

## 任务统计
- 总任务数: ${allTasks.length}
- 已完成: ${doneTasks.length}
- 逾期: ${overdueTasks.length}`;
}

export async function buildContextualSystemPrompt(
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; orgId?: number },
  mode: 'streaming' | 'json' = 'streaming'
): Promise<{ prompt: string; allUsers: any[]; allProjects: any[]; allTasks: any[]; allDepartments: any[]; allJobRoles: any[]; jobRoleMap: Map<number, any>; activeTasks: any[] }> {
  const orgId = context.orgId || 1;
  const { allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks, doneTasks, overdueTasks, teamMembers } = await loadBusinessContext(orgId);
  const memories = await storage.getUserMemories(context.currentUserId, orgId);

  let orgName = '当前组织';
  try {
    const org = await storage.getOrganizationById(orgId);
    if (org) orgName = org.name;
  } catch {}

  const contextWithOrg = { ...context, orgName };
  const contextBlock = buildContextBlock(contextWithOrg, allUsers, allProjects, activeTasks, allTasks, doneTasks, overdueTasks, teamMembers);
  const modelName = context.model || 'claude-sonnet-4-6';

  let prompt: string;

  if (mode === 'streaming') {
    prompt = `你是 Buddy，${orgName} 的智能助手。你熟悉公司的团队、项目和任务情况，能以自然对话的方式帮助团队成员了解工作进展、回答问题、提供建议。

${contextBlock}

## 回复规则
- 用自然语言回复，使用 Markdown 格式让内容更易读（标题、列表、粗体等）
- 使用与用户相同的语言回复（用户用中文就用中文，用英文就用英文）
- 基于上面的团队、项目、任务数据来回答问题，不要编造不存在的数据
- 当用户问"你是什么模型"时，如实告知你运行在 ${modelName} 上
- 回答要简洁专业，必要时引用具体的任务、项目或人员信息
- 你可以帮助分析任务进度、工作负荷、项目风险等

## 操作能力
你具备在系统中创建任务、更新任务、创建项目、添加评论的能力。当用户要求你执行这些操作时（比如"帮我创建任务"、"把这些写入系统"、"从会议纪要提取任务"），你应该：

1. 先用自然语言描述你要做什么
2. 然后在回复末尾输出一个操作块，格式如下：

<<<ACTIONS>>>
{"type":"confirm","action":{"actionType":"create_task","data":{"title":"任务标题","projectId":1},"summary":"创建任务「任务标题」","confidence":0.9}}
<<<END_ACTIONS>>>

批量操作用 multi_confirm（支持依赖关系）：
<<<ACTIONS>>>
{"type":"multi_confirm","actions":[{"actionType":"create_task","data":{"title":"设计用户界面","projectId":1,"ref":"T1"},"summary":"创建任务「设计用户界面」","confidence":0.9},{"actionType":"create_task","data":{"title":"实现前端页面","projectId":1,"ref":"T2","dependsOnRef":["T1"]},"summary":"创建任务「实现前端页面」（依赖 T1）","confidence":0.9}]}
<<<END_ACTIONS>>>

批量创建中的依赖关系字段：
- ref: 当前任务在本批次中的临时标识（如 "T1", "T2"），用于同批次内其他任务引用
- dependsOn: 依赖的数据库中已存在任务的 ID 列表
- dependsOnRef: 依赖同批次内其他任务的 ref 标识列表（如 ["T1"]）

可用的 actionType：
- create_task: 需要 title(必填), projectId(必填), 可选 description, type(task/subtask/milestone/bug/request), status(todo), priority(critical/high/medium/low), assigneeId, dueDate, weight(1-10), parentTaskId, tags, warnings(数组), ref, dependsOn, dependsOnRef
- update_task: 需要 taskId(必填), 可选 title, status, priority, assigneeId, dueDate, weight, progress, description
- create_project: 需要 name(必填), 可选 description, deptId, startDate, targetDate
- add_comment: 需要 taskId(必填), content(必填)
- create_user: 需要 displayName(必填), email(必填), 可选 role(owner/admin/head/member, 默认member), deptId, jobRoleId
- update_user: 需要 userId(必填), 可选 displayName, role, deptId, jobRoleId, isActive
- create_department: 需要 name(必填), 可选 description, color(hex如#FF5733), parentDeptId

重要规则：
- projectId 必须是上面项目列表中存在的项目ID，不要编造
- assigneeId 必须是上面团队成员中存在的用户ID
- deptId、jobRoleId、parentDeptId 必须是系统中已存在的ID
- 创建成员时 email 必须唯一，如果用户没指定邮箱可以用姓名拼音@组织域名的格式
- 如果用户没有指定项目，你需要先问用户要放到哪个项目
- 从会议纪要等文档提取任务时，对信息不确定的字段添加 warnings 数组（如 "负责人未明确，已暂分给当前用户"）
- confidence: 信息完整≥0.9，有推测0.7-0.8，严重缺失0.5-0.6
- 操作块必须放在回复的最末尾，<<<ACTIONS>>> 和 <<<END_ACTIONS>>> 各占一行
- 绝对不要对查询类请求（如"有什么任务"）输出操作块

## 交互式选择 Widget（极其重要）

**核心原则：宁可多弹 Widget 也不要让用户打字确认。** 当你的回复需要用户做任何确认、选择或决策时，必须在回复末尾附带 interactive_input 操作块，让用户通过点击按钮回应。

### 必须弹出 Widget 的场景：

1. **确认类**：任何需要用户说"确认""好的""可以"的地方 → 弹出 [确认] [取消] 或选项按钮
2. **选择类**：任何"你想要A还是B"的地方 → 弹出选项按钮
3. **是否类**：任何"需要我帮你xxx吗？"的地方 → 弹出 [好的] [不用了] 按钮
4. **澄清类**：任何"你是指xxx还是yyy？"的地方 → 弹出对应选项
5. **下一步类**：完成一个操作后询问后续 → 弹出 [继续] [就到这里] 按钮
6. **批量确认类**：整理完任务清单后 → 弹出 [全部确认创建] [我要修改几个] [先不创建]

### 格式（放在回复末尾的操作块中）：

先用自然语言描述内容，然后在末尾输出：

<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"q1","question":"是否创建这些任务？","type":"single_select","options":["全部确认创建","我要修改几个","先不创建"]}]}
<<<END_ACTIONS>>>

又比如完成操作后：
<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"q1","question":"接下来？","type":"single_select","options":["继续创建下一个任务","查看所有待办","就到这里"]}]}
<<<END_ACTIONS>>>

又比如需要确认分配：
<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"q1","question":"分配给谁？","type":"single_select","options":["张三（销售经理）","李四（销售专员）","先不分配"]}]}
<<<END_ACTIONS>>>

又比如简单的是/否确认：
<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"q1","question":"确认创建这个任务吗？","type":"confirm"}]}
<<<END_ACTIONS>>>

### 可用的 question type：
- single_select: 单选（用户点一个选项），需要 options 数组
- multi_select: 多选（用户可选多个），需要 options 数组
- confirm: 简单确认（自动渲染为 [确认] [取消] 两个按钮），不需要 options
- date_pick: 日期选择（自动渲染日期选择器），不需要 options
- rank_priorities: 排序（拖拽排列优先级），需要 options 数组

### 重要规则：
- 如果你不确定某个回复是否需要 Widget，就加上
- Widget 的选项要简洁明了，通常 2-4 个选项
- 每次回复最多输出1个 interactive_input 操作块
- 纯信息展示（如查询结果）不需要 Widget
- 选项应基于系统中的真实数据（如真实的部门名、项目名）
- interactive_input 操作块和 confirm/multi_confirm 操作块不要在同一个回复中同时出现

## 创建前自检（防止重复）

在创建任务之前，检查「当前活跃任务」列表：
1. 如果发现语义高度相似的已有任务（即使措辞不同），**不要直接创建**
2. 在回复中列出疑似重复项，用 interactive_input Widget 让用户选择：

<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"dup_check","question":"系统中已有相似任务，如何处理？","type":"single_select","options":["这是同一个任务，不用创建","这是不同的任务，继续创建"]}]}
<<<END_ACTIONS>>>

3. 从会议纪要批量提取任务时，在任务清单中标注哪些和已有任务重复：用 [新] 标记新任务，[疑似重复] 标记疑似重复

## 会议纪要/批量任务处理流程（极其重要）
当用户发送会议纪要、工作计划、或包含多个待办事项的文本时，必须遵循"两步确认"流程：
1. **第一步（先整理）**：用自然语言列出你从文本中提取的任务清单，用表格展示：序号、标题、负责人、截止日期、所属项目、依赖关系。如有需要确认的问题（如项目归属、负责人不明确等），用编号列出。然后在末尾附带 interactive_input Widget 让用户点选确认，例如：

<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"q1","question":"以上任务清单是否正确？","type":"single_select","options":["全部确认，批量创建","我要修改几个","先不创建"]}]}
<<<END_ACTIONS>>>

2. **第二步（用户确认后）**：用户点击确认或回复确认后，再输出 multi_confirm 的 <<<ACTIONS>>> 块进行批量创建。如果系统中已有类似标题的活跃任务，在 summary 中标注提醒。

绝对不要在第一步就直接输出 multi_confirm 操作块，必须先让用户审核清单。`;
  } else {
    prompt = SYSTEM_PROMPT
      .replace(/\{\{orgName\}\}/g, orgName)
      .replace('{{currentUserId}}', String(context.currentUserId))
      .replace('{{currentUserName}}', context.currentUserName)
      .replace('{{currentTime}}', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))
      .replace('{{teamMembers}}', formatTeamMembers(teamMembers))
      .replace('{{projectList}}', formatProjectList(allProjects))
      .replace('{{taskList}}', formatTaskList(activeTasks, allUsers))
      .replace('{{totalTasks}}', String(allTasks.length))
      .replace('{{doneTasks}}', String(doneTasks.length))
      .replace('{{overdueTasks}}', String(overdueTasks.length));
  }

  if (memories.length > 0) {
    const memoryLines = memories.map(m => `- [${m.category}] ${m.content}`).join('\n');
    prompt += `\n\n## 关于当前用户的记忆
以下是你通过之前对话了解到的关于当前用户的信息：
${memoryLines}`;
  }

  try {
    const pendingDecisions = await storage.getPendingDecisionTasksForUser(context.currentUserId, context.orgId);
    if (pendingDecisions.length > 0) {
      const decisionLines = await Promise.all(pendingDecisions.map(async (d, i) => {
        const originalTask = d.decisionForTaskId ? await storage.getTaskById(d.decisionForTaskId) : null;
        const typeLabels: Record<string, string> = {
          assignee_unclear: '需要确认负责人',
          deadline_missing: '需要确认截止日期',
          scope_unclear: '需要明确任务范围',
          priority_unclear: '需要确认优先级',
          dependency_unclear: '需要确认依赖关系',
        };
        const label = typeLabels[d.decisionType || ''] || '需要确认';
        return `${i + 1}. [决策ID: ${d.id}] 原始任务「${originalTask?.title || '未知'}」(#${d.decisionForTaskId}) — ${label}`;
      }));
      prompt += `\n\n## 待确认决策任务
当前用户有以下待确认的决策任务，如果用户的回复涉及这些决策的确认信息，请使用 resolve_decision 操作来处理：
${decisionLines.join('\n')}`;
    }
  } catch (err) {
    console.error('[AI] Failed to load pending decisions:', err);
  }

  if (context.customSystemPrompt) {
    prompt += `\n\n## 额外指令\n${context.customSystemPrompt}`;
  }

  const modelStyleHints: Record<string, string> = {
    'claude-haiku-4-5-20251001': '回复尽量简短直接，不需要解释推理过程。',
    'claude-haiku-4-5': '回复尽量简短直接，不需要解释推理过程。',
    'claude-sonnet-4-6': '回复清晰有条理，适当解释但避免冗长。使用自然段落。',
    'claude-opus-4-6': '可以进行深入分析，提供多角度思考，但保持条理清晰。',
    'gpt-5.4': '回复清晰有条理，适当解释但避免冗长。',
    'gpt-5.4-pro': '可以进行深入分析，提供详细推理过程。',
    'gpt-5.2': '回复清晰简练，注重效率。',
  };
  const styleHint = modelStyleHints[context.model || 'claude-sonnet-4-6'];
  if (styleHint) {
    prompt += `\n\n## 回复风格\n${styleHint}`;
  }

  return { prompt, allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks };
}

async function executeQuery(actionType: string, data: Record<string, any>, orgId?: number): Promise<string> {
  switch (actionType) {
    case 'query_tasks': {
      const filters: Record<string, any> = {};
      if (data.projectId) filters.projectId = data.projectId;
      if (data.assigneeId) filters.assigneeId = data.assigneeId;
      if (data.status) filters.status = data.status;
      const allTasks = await storage.getTasks(filters);
      const tasks = orgId ? allTasks.filter((t: any) => t.orgId === orgId) : allTasks;
      if (tasks.length === 0) return '当前没有符合条件的任务。';
      const lines = tasks.map((t, i) =>
        `${i + 1}. ${t.title}（${t.status}，优先级: ${t.priority}${t.dueDate ? '，截止: ' + new Date(t.dueDate).toLocaleDateString('zh-CN') : ''}）`
      );
      return `共找到 ${tasks.length} 个任务：\n${lines.join('\n')}`;
    }
    case 'query_projects': {
      const allProjects = await storage.getProjects();
      const projects = orgId ? allProjects.filter((p: any) => p.orgId === orgId) : allProjects;
      if (projects.length === 0) return '当前没有项目。';
      const lines = projects.map((p, i) =>
        `${i + 1}. ${p.name}（${p.status}${p.targetDate ? '，目标: ' + new Date(p.targetDate).toLocaleDateString('zh-CN') : ''}）`
      );
      return `共 ${projects.length} 个项目：\n${lines.join('\n')}`;
    }
    case 'query_verdicts': {
      const verdicts = data.userId 
        ? await storage.getVerdictsByUserId(data.userId)
        : data.taskId
          ? await storage.getVerdictsByTaskId(data.taskId)
          : await storage.getAllVerdicts();
      
      if (verdicts.length === 0) return '暂无权责判定记录。';
      
      if (data.userId) {
        const user = await storage.getUserById(data.userId);
        const stats = { in_scope: 0, stretch: 0, out_of_scope: 0, shared: 0, total: 0 };
        for (const v of verdicts) {
          if (v.verdict in stats) (stats as any)[v.verdict]++;
          stats.total++;
        }
        const pct = (n: number) => stats.total > 0 ? Math.round(n / stats.total * 100) : 0;
        return `${user?.displayName || 'Unknown'}的权责分布（共${stats.total}条判定）：\n` +
          `- 份内职责: ${pct(stats.in_scope)}% (${stats.in_scope}个)\n` +
          `- 延伸职责: ${pct(stats.stretch)}% (${stats.stretch}个)\n` +
          `- 分外工作: ${pct(stats.out_of_scope)}% (${stats.out_of_scope}个)\n` +
          `- 跨部门协作: ${pct(stats.shared)}% (${stats.shared}个)`;
      }
      
      const lines = verdicts.slice(0, 10).map((v, i) => 
        `${i + 1}. 任务ID:${v.taskId} → 用户ID:${v.userId} | ${v.verdict} (${v.confidence}%)`
      );
      return `共${verdicts.length}条判定记录：\n${lines.join('\n')}`;
    }
    case 'query_overview': {
      const allTasksRaw = await storage.getTasks({});
      const allTasks = orgId ? allTasksRaw.filter((t: any) => t.orgId === orgId) : allTasksRaw;
      const total = allTasks.length;
      const byStatus: Record<string, number> = {};
      let overdue = 0;
      const now = new Date();
      for (const t of allTasks) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'cancelled') {
          overdue++;
        }
      }
      const statusLines = Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join('，');
      return `任务总览：共 ${total} 个任务\n状态分布：${statusLines}\n逾期任务：${overdue} 个`;
    }
    default:
      return '不支持的查询类型';
  }
}

function formatTaskList(tasks: any[], users: any[], currentUserId?: number): string {
  const userMap = new Map(users.map(u => [u.id, u.displayName]));
  if (tasks.length === 0) return '（暂无任务）';

  const now = new Date();
  const myTasks = currentUserId ? tasks.filter(t => t.assigneeId === currentUserId) : [];
  const otherTasks = currentUserId ? tasks.filter(t => t.assigneeId !== currentUserId) : tasks;

  const urgentOthers = otherTasks.filter(t =>
    t.priority === 'critical' || t.priority === 'high' ||
    t.status === 'blocked' ||
    (t.dueDate && new Date(t.dueDate) < now)
  );
  const normalOthers = otherTasks.filter(t => !urgentOthers.includes(t));

  const formatOne = (t: any) => {
    const assignee = t.assigneeId ? userMap.get(t.assigneeId) || `ID:${t.assigneeId}` : '未分配';
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('zh-CN') : '';
    return `- ID:${t.id}「${t.title}」状态:${t.status} 优先级:${t.priority} 负责人:${assignee}${due ? ' 截止:' + due : ''} 进度:${t.progress}%`;
  };

  const formatCompact = (t: any) => {
    const assignee = t.assigneeId ? userMap.get(t.assigneeId) || `${t.assigneeId}` : '-';
    return `- ${t.id}:${t.title}|${t.status}|${t.priority}|${assignee}`;
  };

  const parts: string[] = [];

  if (myTasks.length > 0) {
    parts.push(`### 你的任务 (${myTasks.length})`);
    parts.push(...myTasks.map(formatOne));
  }

  if (urgentOthers.length > 0) {
    parts.push(`### 重要/紧急任务 (${urgentOthers.length})`);
    parts.push(...urgentOthers.map(formatOne));
  }

  const MAX_NORMAL = 40;
  if (normalOthers.length > 0) {
    const shown = normalOthers.slice(0, MAX_NORMAL);
    parts.push(`### 其他任务 (${normalOthers.length}${normalOthers.length > MAX_NORMAL ? `，显示前${MAX_NORMAL}` : ''})`);
    parts.push(...shown.map(formatCompact));
    if (normalOthers.length > MAX_NORMAL) {
      parts.push(`...（还有 ${normalOthers.length - MAX_NORMAL} 个任务未列出，需要时可通过 query_tasks 查询）`);
    }
  }

  return parts.join('\n');
}

export async function chat(
  message: string,
  conversationHistory: { role: string; content: string }[],
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; extendedThinking?: boolean; orgId?: number }
): Promise<ChatResponse> {
  const { prompt: systemPrompt, allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks } = await buildContextualSystemPrompt(context, 'json');

  const taskCategory = await classifyTask(message);
  const config = getConfigForTask(taskCategory, context.model, context.extendedThinking);
  const modelName = config.model;
  const apiModelName = resolveModelId(modelName);
  const aiClient = await getClientForModel(modelName);

  const optimizedHistory = await buildOptimizedContext(conversationHistory, taskCategory);

  const requestParams: any = {
    model: apiModelName,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      ...optimizedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ],
  };

  const isClaudeModel = apiModelName.startsWith('claude-');
  const officialAnthropicKeyChat = isClaudeModel ? await findAnthropicKey(apiModelName) : null;

  let aiText = '';
  let tokenInfo: ChatResponse['tokenUsage'] | undefined;

  if (isClaudeModel && officialAnthropicKeyChat) {
    const nativeClient = new Anthropic({ apiKey: officialAnthropicKeyChat });
    const anthropicMsgs: Anthropic.MessageParam[] = [
      ...optimizedHistory
        .filter(msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true))
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content as string,
        })),
      { role: 'user', content: message },
    ];

    const nativeParams: any = {
      model: apiModelName,
      max_tokens: config.max_tokens,
      system: systemPrompt,
      messages: anthropicMsgs,
    };

    if (config.thinking.type === 'enabled') {
      nativeParams.thinking = { type: 'enabled', budget_tokens: config.thinking.budget_tokens };
    } else {
      nativeParams.temperature = config.temperature;
    }

    console.log(`[AI] Using official Anthropic API for non-streaming model=${apiModelName}`);
    const nativeResp = await nativeClient.messages.create(nativeParams);
    const textBlocks = nativeResp.content.filter((b: any) => b.type === 'text');
    aiText = textBlocks.map((b: any) => b.text).join('');
    tokenInfo = {
      model: modelName,
      promptTokens: nativeResp.usage?.input_tokens ?? 0,
      completionTokens: nativeResp.usage?.output_tokens ?? 0,
      totalTokens: (nativeResp.usage?.input_tokens ?? 0) + (nativeResp.usage?.output_tokens ?? 0),
    };
  } else {
    if (config.thinking.type === 'enabled' && isClaudeModel) {
      requestParams.extra_body = {
        thinking: {
          type: 'enabled',
          budget_tokens: config.thinking.budget_tokens,
        }
      };
    }

    const response = await aiClient.chat.completions.create(requestParams);
    const usage = response.usage;
    tokenInfo = usage ? {
      model: modelName,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    } : undefined;
    aiText = response.choices[0]?.message?.content || '';
  }

  const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    aiText = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(aiText);

    if (!parsed.type || !['text', 'confirm', 'multi_confirm', 'follow_up'].includes(parsed.type)) {
      if (parsed.message && typeof parsed.message === 'string') {
        return { type: 'text', message: parsed.message, tokenUsage: tokenInfo };
      }
      return { type: 'text', message: aiText, tokenUsage: tokenInfo };
    }

    if (parsed.type === 'follow_up') {
      const ct = parsed.creationType || 'task';
      const pd = parsed.partialData || {};
      const mf = parsed.missingFields || ['projectId', 'assigneeId', 'dueDate'];
      const result = buildGuidedSteps(ct, pd, mf, parsed.message || '需要确认几个信息：', allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap);
      result.tokenUsage = tokenInfo;
      return result;
    }

    if (parsed.type === 'confirm' && parsed.action) {
      if (parsed.action.actionType && parsed.action.actionType.startsWith('query_')) {
        const result = await executeQuery(parsed.action.actionType, parsed.action.data || {}, context.orgId);
        return { type: 'text', message: result, tokenUsage: tokenInfo };
      }

      if (parsed.action.actionType === 'create_task') {
        const schema = ACTION_SCHEMAS['create_task'];
        if (schema) {
          const validation = schema.safeParse(parsed.action.data);
          if (!validation.success) {
            const actionData = parsed.action.data || {};
            if (actionData.title) {
              const missingFields: string[] = [];
              if (!actionData.projectId) missingFields.push('projectId');
              if (!actionData.assigneeId) missingFields.push('assigneeId');
              if (!actionData.dueDate) missingFields.push('dueDate');
              const result = buildGuidedSteps(
                'task',
                actionData,
                missingFields,
                `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
                allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap
              );
              result.tokenUsage = tokenInfo;
              return result;
            }
            return {
              type: 'text',
              message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。',
            };
          }
        }

        if (parsed.action.confidence < 0.7) {
          const actionData = parsed.action.data || {};
          const missingKey = ['projectId', 'assigneeId', 'dueDate'].some(f => !actionData[f]);
          if (missingKey && actionData.title) {
            const missingFields: string[] = [];
            if (!actionData.projectId) missingFields.push('projectId');
            if (!actionData.assigneeId) missingFields.push('assigneeId');
            if (!actionData.dueDate) missingFields.push('dueDate');
            const result = buildGuidedSteps(
              'task',
              actionData,
              missingFields,
              `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
              allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap
            );
            result.tokenUsage = tokenInfo;
            return result;
          }
        }
      }

      const schema = ACTION_SCHEMAS[parsed.action.actionType];
      if (schema && parsed.action.actionType !== 'create_task') {
        const validation = schema.safeParse(parsed.action.data);
        if (!validation.success) {
          return {
            type: 'text',
            message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。',
          };
        }
      }
    }

    if (parsed.type === 'multi_confirm' && parsed.actions) {
      const queryActions = parsed.actions.filter((a: any) => a.actionType?.startsWith('query_'));
      const writeActions = parsed.actions.filter((a: any) => !a.actionType?.startsWith('query_'));

      if (queryActions.length > 0) {
        const queryResults = await Promise.all(
          queryActions.map((a: any) => executeQuery(a.actionType, a.data || {}, context.orgId))
        );
        const queryText = queryResults.join('\n\n');

        if (writeActions.length === 0) {
          return { type: 'text', message: queryText };
        }

        return {
          type: 'multi_confirm',
          message: queryText,
          actions: writeActions,
        };
      }

      for (const action of parsed.actions) {
        const schema = ACTION_SCHEMAS[action.actionType];
        if (schema) {
          const validation = schema.safeParse(action.data);
          if (!validation.success) {
            return {
              type: 'text',
              message: '抱歉，批量操作中有数据验证失败。请重新描述一下你的需求。',
            };
          }
        }
      }
    }

    if (parsed.type === 'confirm' && parsed.action) {
      parsed.action.displayData = buildDisplayData(parsed.action.data, allUsers, allProjects);
    }
    if (parsed.type === 'multi_confirm' && parsed.actions) {
      for (const action of parsed.actions) {
        action.displayData = buildDisplayData(action.data, allUsers, allProjects);
      }
    }

    parsed.tokenUsage = tokenInfo;
    return parsed;
  } catch {
    return { type: 'text', message: aiText, tokenUsage: tokenInfo };
  }
}

export async function* chatStream(
  message: string,
  conversationHistory: { role: string; content: string | any[] }[],
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; extendedThinking?: boolean; orgId?: number; knowledgeBaseEnabled?: boolean; userRole?: string; userDeptId?: number | null },
  attachments?: { type: string; name: string; mimeType: string; base64: string }[]
): AsyncGenerator<{ type: 'token' | 'done' | 'error'; content?: string; tokenUsage?: ChatResponse['tokenUsage'] }> {
  const hasAttachments = !!(attachments && attachments.length > 0);
  let taskCategory = await classifyTask(message, hasAttachments);

  if (context.knowledgeBaseEnabled) {
    taskCategory = 'knowledge_qa';
  }

  const config = getConfigForTask(taskCategory, context.model, context.extendedThinking);
  const modelName = config.model;
  let { prompt: systemPrompt } = await buildContextualSystemPrompt({ ...context, model: modelName }, 'streaming');

  if (context.knowledgeBaseEnabled && context.orgId) {
    try {
      const { searchKnowledge } = await import('../kb/search');
      const { buildKnowledgePrompt } = await import('./prompts');

      const kbResults = await searchKnowledge({
        orgId: context.orgId,
        query: message,
        topK: 5,
        userRole: context.userRole || 'member',
        userDeptId: context.userDeptId || null,
      });

      if (kbResults.length > 0) {
        const kbPrompt = buildKnowledgePrompt(kbResults.map(r => ({
          content: r.content,
          documentTitle: r.documentTitle,
          category: r.category,
        })));
        systemPrompt += kbPrompt;
        const kbSources = [...new Set(kbResults.map(r => r.documentTitle))];
        console.log(`[KB] Injected ${kbResults.length} chunks from: ${kbSources.join(', ')}`);
      } else {
        console.log(`[KB] No results found for query: ${message.slice(0, 50)}...`);
      }
    } catch (err: any) {
      console.error(`[KB] Search error (non-fatal):`, err.message);
    }
  }

  const aiClient = await getClientForModel(modelName);

  const optimizedHistory = await buildOptimizedContext(conversationHistory, taskCategory);

  let userContent: any = message;
  if (hasAttachments) {
    const contentParts: any[] = [];
    for (const att of attachments!) {
      if (att.type === 'image') {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${att.mimeType};base64,${att.base64}`,
          }
        });
      } else {
        let fileText = '';
        const buffer = Buffer.from(att.base64, 'base64');
        const ext = att.name.toLowerCase().split('.').pop() || '';
        if (ext === 'docx') {
          try {
            const result = await mammoth.extractRawText({ buffer });
            fileText = result.value;
          } catch {
            fileText = '[无法解析此 .docx 文件]';
          }
        } else if (['txt', 'csv', 'json', 'md', 'xml', 'html', 'css', 'js', 'ts', 'py', 'yaml', 'yml', 'log', 'ini', 'cfg', 'env', 'sh', 'bat'].includes(ext)) {
          fileText = buffer.toString('utf-8');
        } else {
          fileText = `[不支持直接解析的文件格式: .${ext}]`;
        }
        contentParts.push({
          type: 'text',
          text: `[附件: ${att.name}]\n内容:\n${fileText}`,
        });
      }
    }
    contentParts.push({ type: 'text', text: message || '请查看附件' });
    userContent = contentParts;
  }

  const apiModelName = resolveModelId(modelName);
  const isClaudeModel = apiModelName.startsWith('claude-');
  const officialAnthropicKey = isClaudeModel ? await findAnthropicKey(apiModelName) : null;

  if (isClaudeModel && officialAnthropicKey) {
    const nativeClient = new Anthropic({
      apiKey: officialAnthropicKey,
    });

    const anthropicMessages: Anthropic.MessageParam[] = [
      ...optimizedHistory
        .filter(msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true))
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content as string,
        })),
      { role: 'user', content: userContent as string },
    ];

    const streamParams: any = {
      model: apiModelName,
      max_tokens: config.max_tokens,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    };

    if (config.thinking.type === 'enabled') {
      streamParams.thinking = {
        type: 'enabled',
        budget_tokens: config.thinking.budget_tokens,
      };
      delete streamParams.temperature;
    } else {
      streamParams.temperature = config.temperature;
    }

    try {
      console.log(`[AI] Using official Anthropic API for model=${apiModelName}`);
      const stream = nativeClient.messages.stream(streamParams);
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'thinking_delta' && delta.thinking) {
            yield { type: 'thinking' as const, content: delta.thinking };
          } else if (delta.type === 'text_delta' && delta.text) {
            yield { type: 'token' as const, content: delta.text };
          }
        } else if (event.type === 'message_delta') {
          const usage = (event as any).usage;
          if (usage) {
            totalCompletionTokens = usage.output_tokens ?? 0;
          }
        } else if (event.type === 'message_start') {
          const usage = (event as any).message?.usage;
          if (usage) {
            totalPromptTokens = usage.input_tokens ?? 0;
          }
        }
      }

      yield {
        type: 'done' as const,
        tokenUsage: {
          model: modelName,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        }
      };
    } catch (err: any) {
      const statusCode = err.status || err.statusCode || '';
      const detail = err.error?.error?.message || err.message || 'Stream error';
      console.error(`[AI Stream Error] model=${modelName} status=${statusCode} message=${detail}`);
      yield { type: 'error' as const, content: detail };
    }
    return;
  }

  const requestParams: any = {
    model: apiModelName,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...optimizedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userContent },
    ],
  };

  if (!isClaudeModel) {
    requestParams.stream_options = { include_usage: true };
  }

  if (config.thinking.type === 'enabled' && isClaudeModel) {
    requestParams.extra_body = {
      thinking: {
        type: 'enabled',
        budget_tokens: config.thinking.budget_tokens,
      }
    };
  }

  try {
    const stream = await aiClient.chat.completions.create(requestParams);
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta;
      if ((delta as any)?.reasoning_content) {
        yield { type: 'thinking', content: (delta as any).reasoning_content };
      }
      if (delta?.content) {
        yield { type: 'token', content: delta.content };
      }
      if (chunk.usage) {
        totalPromptTokens = chunk.usage.prompt_tokens ?? 0;
        totalCompletionTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    yield {
      type: 'done',
      tokenUsage: {
        model: modelName,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      }
    };
  } catch (err: any) {
    const statusCode = err.status || err.statusCode || '';
    const errBody = err.error?.message || err.response?.data?.error?.message || '';
    const detail = errBody || err.message || 'Stream error';
    console.error(`[AI Stream Error] model=${modelName} status=${statusCode} message=${detail}`);
    yield { type: 'error', content: detail };
  }
}

export async function generateProjectTasks(
  projectName: string,
  projectDescription: string,
  context: { currentUserId: number; currentUserName: string }
): Promise<{ tasks: { title: string; description?: string; priority: string; type: string }[]; tokenUsage?: ChatResponse['tokenUsage'] }> {
  const genModel = 'claude-sonnet-4-6';
  const response = await claudeComplete({
    model: genModel,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `你是一个项目管理专家。用户正在创建一个新项目，请根据项目名称和描述，建议 3-8 个初始任务来拆解这个项目。

输出格式为纯 JSON（不要用 markdown 包裹）：
{
  "tasks": [
    { "title": "任务标题", "description": "简短描述", "priority": "medium", "type": "task" },
    ...
  ]
}

规则：
- 每个任务标题应简洁明确
- 任务应覆盖项目的主要工作模块
- 按逻辑顺序排列
- priority 从 critical/high/medium/low 中选择
- type 一般用 "task"，关键节点用 "milestone"
- 不要编造具体的人名或日期`
      },
      {
        role: 'user',
        content: `项目名称：${projectName}\n项目描述：${projectDescription || '暂无描述'}`
      }
    ],
  });

  const modelName = 'claude-sonnet-4-6';
  const tokenInfo = response.usage ? {
    model: modelName,
    promptTokens: response.usage.prompt_tokens ?? 0,
    completionTokens: response.usage.completion_tokens ?? 0,
    totalTokens: response.usage.total_tokens ?? 0,
  } : undefined;

  let aiText = response.content || '';
  const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    aiText = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(aiText);
    return { tasks: parsed.tasks || [], tokenUsage: tokenInfo };
  } catch {
    return { tasks: [], tokenUsage: tokenInfo };
  }
}

export async function extractMemories(
  conversationMessages: { role: string; content: string }[],
  userId: number,
  orgId: number
): Promise<void> {
  if (conversationMessages.length < 2) return;

  const model = 'claude-haiku-4-5-20251001';

  const conversationText = conversationMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const response = await claudeComplete({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `你是一个记忆提取助手。分析以下对话，提取值得记住的用户偏好、事实、工作风格或上下文信息。

只提取明确的、有价值的信息，不要猜测。如果没有值得记住的信息，返回空数组。

输出格式为纯 JSON（不要用 markdown 包裹）：
{
  "memories": [
    { "category": "preference|fact|work_style|context", "content": "简短描述" }
  ]
}

category 说明：
- preference: 用户的偏好（如回复风格、语言偏好等）
- fact: 关于用户的事实（如负责的项目、专业领域等）
- work_style: 工作风格（如喜欢详细计划、偏好快速迭代等）
- context: 重要的上下文信息（如正在处理的紧急事项等）`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
    });

    let aiText = response.content || '';
    const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      aiText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(aiText);
    const memories = parsed.memories || [];

    for (const mem of memories) {
      if (mem.category && mem.content) {
        await storage.createUserMemory({
          userId,
          orgId,
          category: mem.category,
          content: mem.content,
          source: 'auto',
        });
      }
    }
  } catch (err) {
    console.error('Failed to extract memories:', err);
  }
}

export async function generateConversationTitle(
  userMessage: string,
  assistantReply: string
): Promise<string> {
  const truncatedUser = userMessage.slice(0, 500);
  const truncatedAssistant = assistantReply.slice(0, 500);

  const response = await claudeComplete({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [
      {
        role: 'system',
        content: '根据用户和AI的对话，生成一个简短的对话标题（2-8个词）。直接输出标题文字，不要加引号、标点或解释。用对话的主要语言。'
      },
      {
        role: 'user',
        content: `用户: ${truncatedUser}\n\nAI: ${truncatedAssistant}`
      }
    ],
  });

  const title = (response.content || '').trim().slice(0, 50);
  return title || userMessage.slice(0, 30);
}

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_SIMPLE_API_KEY,
  ...(process.env.ANTHROPIC_API_KEY ? {} : { baseURL: 'https://vip.aipro.love' }),
});

export async function* codeToolChatStream(
  message: string,
  conversationHistory: { role: string; content: string | any[] }[],
  systemPrompt: string,
  modelName?: string,
): AsyncGenerator<{ type: string; content?: string; toolName?: string; toolInput?: any; tokenUsage?: ChatResponse['tokenUsage']; result?: string }> {
  const model = modelName || 'claude-sonnet-4-6';
  const MAX_TOOL_ROUNDS = 8;

  const messages: Anthropic.MessageParam[] = conversationHistory
    .filter(msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true))
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content as string,
    }));

  messages.push({ role: 'user', content: message });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  const MAX_TOOL_RESULT_LENGTH = 15000;

  function truncateToolResult(result: string): string {
    if (result.length <= MAX_TOOL_RESULT_LENGTH) return result;
    return result.slice(0, MAX_TOOL_RESULT_LENGTH) + `\n\n[内容已截断，共 ${result.length} 字符，已显示前 ${MAX_TOOL_RESULT_LENGTH} 字符]`;
  }

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropicClient.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        tools: CODE_TOOLS as Anthropic.Tool[],
        messages,
      });

      totalPromptTokens += response.usage?.input_tokens ?? 0;
      totalCompletionTokens += response.usage?.output_tokens ?? 0;

      if (response.stop_reason === 'tool_use') {
        const assistantContent = response.content;
        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of assistantContent) {
          if (block.type === 'tool_use') {
            yield { type: 'tool_use', toolName: block.name, toolInput: block.input };

            const result = truncateToolResult(executeCodeTool(block.name, block.input as Record<string, any>));
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });

            const resultSummary = typeof result === 'string'
              ? result.slice(0, 200)
              : Array.isArray(result) ? JSON.stringify(result).slice(0, 200) : '';
            yield { type: 'tool_result_event', toolName: block.name, result: resultSummary };
          }
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      for (const block of response.content) {
        if (block.type === 'text') {
          yield { type: 'token', content: block.text };
        }
      }

      yield {
        type: 'done',
        tokenUsage: {
          model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        },
      };
      return;
    }

    yield { type: 'token', content: '\n\n[已达到最大工具调用轮次限制]' };
    yield {
      type: 'done',
      tokenUsage: {
        model,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
    };
  } catch (err: any) {
    const statusCode = err.status || err.statusCode || '';
    const errBody = err.error?.message || err.response?.data?.error?.message || '';
    const detail = errBody || err.message || 'Code tool stream error';
    console.error(`[AI CodeTool Stream Error] model=${model} status=${statusCode} message=${detail}`);
    yield { type: 'error', content: detail };
  }
}

```

---

## ===== 文件路径: server/services/ai/verdictService.ts (351 行) =====

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../../storage';
import type { AiProvider } from '@shared/schema';

let _cachedProviders: AiProvider[] | null = null;
let _cacheTime = 0;

async function getVerdictClient(): Promise<OpenAI> {
  const now = Date.now();
  if (!_cachedProviders || now - _cacheTime > 60000) {
    try {
      _cachedProviders = await storage.getAiProviders();
      _cacheTime = now;
    } catch {
      if (!_cachedProviders) {
        const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.AI_API_KEY || '';
        return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey, timeout: 30000 });
      }
    }
  }
  const model = 'claude-haiku-4-5-20251001';
  for (const p of _cachedProviders!) {
    if (!p.isActive || !p.models.includes(model)) continue;
    const key = process.env[p.apiKeyEnvVar];
    if (key) return new OpenAI({ baseURL: p.baseUrl, apiKey: key, timeout: p.timeout });
  }
  const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.AI_API_KEY || '';
  return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey, timeout: 30000 });
}

async function verdictComplete(params: { model: string; max_tokens: number; temperature?: number; messages: { role: string; content: string }[] }): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemMsg = params.messages.find(m => m.role === 'system');
    const nonSystem = params.messages.filter(m => m.role !== 'system');
    const resp = await client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: nonSystem.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });
    const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    return {
      content: text,
      usage: {
        prompt_tokens: resp.usage?.input_tokens ?? 0,
        completion_tokens: resp.usage?.output_tokens ?? 0,
        total_tokens: (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0),
      },
    };
  }
  const client = await getVerdictClient();
  const resp = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    messages: params.messages as any,
  });
  return {
    content: resp.choices[0]?.message?.content || '{}',
    usage: resp.usage ? {
      prompt_tokens: resp.usage.prompt_tokens ?? 0,
      completion_tokens: resp.usage.completion_tokens ?? 0,
      total_tokens: resp.usage.total_tokens ?? 0,
    } : undefined,
  };
}

const VERDICT_SYSTEM_PROMPT = `你是一个企业权责判定专家。你的职责是客观、公正地判断一个任务分配给某个员工是否合理。

## 判定标准

### verdict 类型
1. **in_scope（份内职责）**: 任务明确落在该员工的岗位职责描述中，属于日常工作范围
2. **stretch（延伸职责）**: 任务与员工的核心职责相关但不完全匹配，属于能力可覆盖但不是主要工作内容
3. **out_of_scope（分外工作）**: 任务明显不在员工的职责范围内，属于其他岗位/部门的工作
4. **shared（跨部门协作）**: 任务涉及多个岗位/部门的协作，不能单独归属于某一个人

### 判定依据（按优先级排序）
1. 员工的岗位职责描述（responsibilities）— 最直接的依据
2. 员工的职责边界说明（boundaries）— 明确排除的工作
3. 员工的所属部门 — 部门职能范围
4. 员工的技能匹配度（requiredSkills vs 任务需求）
5. 历史任务分配模式 — 该员工过去是否做过类似任务
6. 团队中其他成员的岗位匹配度 — 是否有更合适的人选

### confidence 评分标准
- 90-100: 非常确定，职责描述中有明确对应的条目
- 70-89: 比较确定，基于部门职能和技能匹配推断
- 50-69: 不太确定，存在模糊地带，建议管理者判断
- 0-49: 无法判定，信息不足

### 输出格式
你必须以 JSON 格式回复，结构如下：
{
  "verdict": "in_scope | stretch | out_of_scope | shared",
  "confidence": 85,
  "reasoning": "判定理由的详细说明，需要引用具体的岗位职责条目",
  "matchedResponsibilities": ["匹配到的职责条目1", "匹配到的职责条目2"],
  "suggestedAssigneeId": null,
  "suggestedReason": null
}

当 verdict 为 out_of_scope 时，必须提供 suggestedAssigneeId（更合适的人选ID）和 suggestedReason。

### 重要原则
- 基于事实判定，不带情感偏向
- 有多个合理人选时，说明每个人选的匹配度
- 如果岗位职责描述不够详细，降低 confidence 并说明
- 永远不要编造不存在的职责描述
- 在 JSON 之外不要输出任何内容
`;

interface UserWithRole {
  id: number;
  displayName: string;
  deptName: string;
  jobTitle: string | null;
  responsibilities: string[];
  boundaries: string[];
  requiredSkills: string[];
}

interface TaskWithDetails {
  id: number;
  title: string;
  description: string | null;
  projectName: string;
  deptName: string | null;
  priority: string;
  type: string;
  tags: string | null;
}

export interface VerdictResult {
  verdict: 'in_scope' | 'stretch' | 'out_of_scope' | 'shared';
  confidence: number;
  reasoning: string;
  matchedResponsibilities: string[];
  suggestedAssigneeId: number | null;
  suggestedReason: string | null;
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function robustJsonParse(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    let extracted = match[0];
    try {
      return JSON.parse(extracted);
    } catch {}

    extracted = extracted.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(extracted);
    } catch {}

    extracted = extracted.replace(/[\x00-\x1F\x7F]/g, (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
      return '';
    });
    try {
      return JSON.parse(extracted);
    } catch {}
  }

  console.error('robustJsonParse failed. Raw content:', raw.slice(0, 500));
  throw new Error('AI 返回的判定结果格式异常，请重试');
}

async function buildUserWithRole(userId: number): Promise<UserWithRole | null> {
  const user = await storage.getUserById(userId);
  if (!user) return null;
  
  const departments = await storage.getDepartments();
  const dept = departments.find(d => d.id === user.deptId);
  
  let jobTitle: string | null = null;
  let responsibilities: string[] = [];
  let boundaries: string[] = [];
  let requiredSkills: string[] = [];
  
  if (user.jobRoleId) {
    const jobRole = await storage.getJobRoleById(user.jobRoleId);
    if (jobRole) {
      jobTitle = jobRole.title;
      responsibilities = parseJsonArray(jobRole.responsibilities);
      boundaries = parseJsonArray(jobRole.boundaries);
      requiredSkills = parseJsonArray(jobRole.requiredSkills);
    }
  }
  
  return {
    id: user.id,
    displayName: user.displayName,
    deptName: dept?.name ?? '未知部门',
    jobTitle,
    responsibilities,
    boundaries,
    requiredSkills,
  };
}

async function buildAllUsersWithRoles(orgId?: number): Promise<UserWithRole[]> {
  const allUsersRaw = await storage.getUsers();
  const allUsers = orgId ? allUsersRaw.filter((u: any) => u.orgId === orgId) : allUsersRaw;
  const departmentsRaw = await storage.getDepartments();
  const departments = orgId ? departmentsRaw.filter((d: any) => d.orgId === orgId) : departmentsRaw;
  const jobRolesData = await storage.getJobRoles();
  const deptMap = new Map(departments.map(d => [d.id, d]));
  const roleMap = new Map(jobRolesData.map(r => [r.id, r]));
  
  return allUsers
    .filter(u => u.isActive)
    .map(u => {
      const dept = u.deptId ? deptMap.get(u.deptId) : null;
      const jobRole = u.jobRoleId ? roleMap.get(u.jobRoleId) : null;
      return {
        id: u.id,
        displayName: u.displayName,
        deptName: dept?.name ?? '未知部门',
        jobTitle: jobRole?.title ?? null,
        responsibilities: parseJsonArray(jobRole?.responsibilities ?? null),
        boundaries: parseJsonArray(jobRole?.boundaries ?? null),
        requiredSkills: parseJsonArray(jobRole?.requiredSkills ?? null),
      };
    });
}

async function buildTaskWithDetails(taskId: number): Promise<TaskWithDetails | null> {
  const task = await storage.getTaskById(taskId);
  if (!task) return null;
  
  const project = await storage.getProjectById(task.projectId);
  const departments = await storage.getDepartments();
  const dept = project?.deptId ? departments.find(d => d.id === project.deptId) : null;
  
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    projectName: project?.name ?? '未知项目',
    deptName: dept?.name ?? null,
    priority: task.priority,
    type: task.type,
    tags: task.tags,
  };
}

function buildVerdictPrompt(
  task: TaskWithDetails,
  targetUser: UserWithRole,
  allUsers: UserWithRole[]
): string {
  return `
## 待判定的任务
- 标题: ${task.title}
- 描述: ${task.description || '无'}
- 项目: ${task.projectName}
- 项目所属部门: ${task.deptName || '未指定'}
- 优先级: ${task.priority}
- 类型: ${task.type}
- 标签: ${task.tags || '无'}

## 被分配的员工
- 姓名: ${targetUser.displayName}
- 部门: ${targetUser.deptName}
- 岗位: ${targetUser.jobTitle || '未定义'}
- 岗位职责: ${JSON.stringify(targetUser.responsibilities)}
- 职责边界（不负责的事）: ${JSON.stringify(targetUser.boundaries)}
- 所需技能: ${JSON.stringify(targetUser.requiredSkills)}

## 团队中的其他成员（用于判断是否有更合适的人选）
${allUsers.filter(u => u.id !== targetUser.id).map(u => `
- ${u.displayName} (ID: ${u.id}) | 部门: ${u.deptName} | 岗位: ${u.jobTitle || '未定义'}
  职责: ${JSON.stringify(u.responsibilities)}
  技能: ${JSON.stringify(u.requiredSkills)}
`).join('')}

请根据以上信息，判定将该任务分配给「${targetUser.displayName}」是否合理。
`;
}

export interface VerdictResultWithUsage extends VerdictResult {
  tokenUsage?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function judgeTaskAssignment(
  taskId: number,
  userId: number,
  orgId?: number
): Promise<VerdictResultWithUsage> {
  const task = await buildTaskWithDetails(taskId);
  if (!task) throw new Error('Task not found');
  
  const targetUser = await buildUserWithRole(userId);
  if (!targetUser) throw new Error('User not found');
  
  const allUsers = await buildAllUsersWithRoles(orgId);
  
  const prompt = buildVerdictPrompt(task, targetUser, allUsers);
  
  const modelName = 'claude-sonnet-4-6';
  const response = await verdictComplete({
    model: modelName,
    max_tokens: 2048,
    temperature: 0.1,
    messages: [
      { role: 'system', content: VERDICT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });
  
  const result: VerdictResultWithUsage = robustJsonParse(response.content);

  if (response.usage) {
    result.tokenUsage = {
      model: modelName,
      promptTokens: response.usage.prompt_tokens ?? 0,
      completionTokens: response.usage.completion_tokens ?? 0,
      totalTokens: response.usage.total_tokens ?? 0,
    };
  }

  return result;
}

```

---

## ===== 文件路径: server/services/ai/actionExecutor.ts (550 行) =====

```typescript
import { storage } from "../../storage";
import { judgeTaskAssignment } from "./verdictService";
import { createDecisionTasksForWarnings, pushDecisionRequests } from "./decisionService";
import { detectTaskDuplicate } from "../tasks/deduplication";

export async function executeAction(
  actionType: string,
  data: Record<string, any>,
  userId: number,
  orgId: number = 1,
  options?: { forceCreate?: boolean }
): Promise<{ success: boolean; message: string; entity?: any; duplicateWarning?: string; error?: string; matches?: any[] }> {
  switch (actionType) {
    case 'create_task': {
      if (!options?.forceCreate) {
        const dupCheck = await detectTaskDuplicate({ orgId, title: data.title });
        if (dupCheck.hasDuplicate) {
          return {
            success: false,
            error: 'duplicate_suspected',
            message: `发现 ${dupCheck.matches.length} 个相似任务`,
            matches: dupCheck.matches,
          };
        }
      }

      const duplicate = await storage.checkDuplicateTask(orgId, data.title, data.assigneeId, data.memberProfileId);
      let duplicateWarning: string | undefined;
      if (duplicate) {
        duplicateWarning = `系统中已存在类似任务「${duplicate.title}」(#${duplicate.id})，创建于 ${new Date(duplicate.createdAt).toLocaleString('zh-CN')}`;
      }

      const hasWarnings = Array.isArray(data.warnings) && data.warnings.length > 0;
      let assigneeId = data.assigneeId || userId;
      let memberProfileId = null;
      if (data.memberProfileId) {
        const profile = await storage.getMemberProfileById(data.memberProfileId);
        if (!profile || profile.orgId !== orgId) {
          return { success: false, message: `成员档案 #${data.memberProfileId} 不存在或不属于当前组织` };
        }
        memberProfileId = data.memberProfileId;
        assigneeId = null;
      }

      const taskData = {
        orgId,
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        type: data.type || 'task',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        creatorId: userId,
        assigneeId,
        memberProfileId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        weight: data.weight || 3,
        progress: 0,
        parentTaskId: data.parentTaskId || null,
        tags: data.tags || null,
        needsReview: hasWarnings,
        warnings: hasWarnings ? JSON.stringify(data.warnings) : null,
      };

      const dependsOnIds = Array.isArray(data.dependsOn) ? data.dependsOn : [];

      let newTask;
      if (dependsOnIds.length > 0) {
        newTask = await storage.createTaskWithDependencies(taskData, dependsOnIds, orgId, userId);
      } else {
        newTask = await storage.createTask(taskData);
        await storage.createActivityLog({
          orgId,
          userId,
          entityType: 'task',
          entityId: newTask.id,
          action: 'create',
          changes: JSON.stringify(data),
          source: 'ai_chat',
        });
      }

      if (hasWarnings && newTask) {
        try {
          const decisionTasks = await createDecisionTasksForWarnings(
            newTask, data.warnings, userId, orgId
          );
          if (decisionTasks.length > 0) {
            await pushDecisionRequests(decisionTasks, orgId, userId);
          }
        } catch (err) {
          console.error('[DecisionService] Failed to create decision tasks:', err);
        }
      }

      return {
        success: true,
        message: `任务「${data.title}」已成功创建`,
        entity: newTask,
        duplicateWarning,
      };
    }

    case 'update_task': {
      const { taskId, version, ...updateFields } = data;

      const oldTask = await storage.getTaskById(taskId);
      if (!oldTask) {
        return { success: false, message: '未找到该任务' };
      }

      const updateData: Record<string, any> = {};
      if (updateFields.title) updateData.title = updateFields.title;
      if (updateFields.status) updateData.status = updateFields.status;
      if (updateFields.priority) updateData.priority = updateFields.priority;
      if (updateFields.memberProfileId) {
        const mp = await storage.getMemberProfileById(updateFields.memberProfileId);
        if (!mp || mp.orgId !== orgId) {
          return { success: false, message: `成员档案 #${updateFields.memberProfileId} 不存在或不属于当前组织` };
        }
        updateData.memberProfileId = updateFields.memberProfileId;
        updateData.assigneeId = null;
      } else if (updateFields.assigneeId) {
        updateData.assigneeId = updateFields.assigneeId;
        updateData.memberProfileId = null;
      }
      if (updateFields.dueDate) updateData.dueDate = new Date(updateFields.dueDate);
      if (updateFields.weight) updateData.weight = updateFields.weight;
      if (updateFields.progress !== undefined) updateData.progress = updateFields.progress;
      if (updateFields.description) updateData.description = updateFields.description;

      if (updateFields.status === 'done') {
        updateData.completedAt = new Date();
      }

      let updated;
      if (version !== undefined) {
        updated = await storage.updateTaskWithVersion(taskId, version, updateData);
        if (!updated) {
          return {
            success: false,
            message: '该任务已被其他人修改，请刷新后重试',
            entity: { conflict: true, taskId },
          };
        }
      } else {
        updated = await storage.updateTask(taskId, updateData);
        if (!updated) {
          return { success: false, message: '更新失败' };
        }
      }

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'task',
        entityId: taskId,
        action: 'update',
        changes: JSON.stringify({
          before: oldTask,
          after: updateFields,
        }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `任务「${updated.title}」已更新`,
        entity: updated,
      };
    }

    case 'create_project': {
      const newProject = await storage.createProject({
        orgId,
        name: data.name,
        description: data.description || null,
        deptId: data.deptId || null,
        ownerId: userId,
        status: 'active',
        startDate: data.startDate ? new Date(data.startDate) : null,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      });

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'project',
        entityId: newProject.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `项目「${data.name}」已成功创建`,
        entity: newProject,
      };
    }

    case 'add_comment': {
      const newComment = await storage.createTaskComment({
        taskId: data.taskId,
        userId: userId,
        content: data.content,
      });

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'task',
        entityId: data.taskId,
        action: 'comment',
        changes: JSON.stringify({ content: data.content }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: '评论已添加',
        entity: newComment,
      };
    }

    case 'create_user': {
      let newUser;
      try {
        newUser = await storage.createUser({
          orgId,
          displayName: data.displayName,
          email: data.email,
          role: data.role || 'member',
          deptId: data.deptId ?? null,
          jobRoleId: data.jobRoleId ?? null,
          isActive: true,
          authProvider: 'manual',
        });
      } catch (err: any) {
        if (err.message?.includes('unique') || err.code === '23505') {
          return { success: false, message: `邮箱「${data.email}」已被使用，请换一个邮箱` };
        }
        throw err;
      }

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'user',
        entityId: newUser.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `成员「${data.displayName}」已成功创建`,
        entity: newUser,
      };
    }

    case 'update_user': {
      const { userId: targetUserId, ...updateFields } = data;
      const oldUser = await storage.getUserById(targetUserId);
      if (!oldUser) {
        return { success: false, message: '未找到该用户' };
      }

      if (oldUser.orgId !== orgId) {
        return { success: false, message: '无法修改其他组织的成员' };
      }

      const requester = await storage.getUserById(userId);
      const requesterRole = requester?.role || 'member';
      const roleHierarchy: Record<string, number> = { member: 0, head: 1, admin: 2, owner: 3 };

      if (updateFields.role !== undefined) {
        if (roleHierarchy[requesterRole] < 2) {
          return { success: false, message: '只有管理员或负责人才能修改角色' };
        }
        if (roleHierarchy[updateFields.role] >= roleHierarchy[requesterRole]) {
          return { success: false, message: '不能将角色提升到与自己相同或更高的级别' };
        }
      }

      if (updateFields.isActive !== undefined && roleHierarchy[requesterRole] < 2) {
        return { success: false, message: '只有管理员或负责人才能停用/激活成员' };
      }

      const updateData: Record<string, any> = {};
      if (updateFields.displayName !== undefined) updateData.displayName = updateFields.displayName;
      if (updateFields.role !== undefined) updateData.role = updateFields.role;
      if (updateFields.deptId !== undefined) updateData.deptId = updateFields.deptId;
      if (updateFields.jobRoleId !== undefined) updateData.jobRoleId = updateFields.jobRoleId;
      if (updateFields.isActive !== undefined) updateData.isActive = updateFields.isActive;

      const updated = await storage.updateUser(targetUserId, updateData);
      if (!updated) {
        return { success: false, message: '更新失败' };
      }

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'update',
        changes: JSON.stringify({ before: oldUser, after: updateFields }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `成员「${updated.displayName}」已更新`,
        entity: updated,
      };
    }

    case 'create_department': {
      const newDept = await storage.createDepartment({
        orgId,
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        parentDeptId: data.parentDeptId || null,
      });

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'department',
        entityId: newDept.id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `部门「${data.name}」已成功创建`,
        entity: newDept,
      };
    }

    case 'judge_assignment': {
      const { taskId, userId: targetUserId } = data;
      try {
        const verdictResult = await judgeTaskAssignment(taskId, targetUserId);
        
        const verdict = await storage.createVerdict({
          orgId,
          taskId,
          userId: targetUserId,
          verdict: verdictResult.verdict,
          confidence: verdictResult.confidence,
          reasoning: verdictResult.reasoning,
          matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
          suggestedAssignee: verdictResult.suggestedAssigneeId,
          suggestedReason: verdictResult.suggestedReason,
          requestedBy: userId,
          status: 'completed',
        });

        const VERDICT_LABELS: Record<string, string> = {
          in_scope: '份内职责', stretch: '延伸职责',
          out_of_scope: '分外工作', shared: '跨部门协作',
        };

        const targetUser = await storage.getUserById(targetUserId);
        const task = await storage.getTaskById(taskId);
        
        let message = `⚖️ 权责判定结果\n任务「${task?.title}」→ ${targetUser?.displayName}\n`;
        message += `判定: ${VERDICT_LABELS[verdictResult.verdict] || verdictResult.verdict} (置信度${verdictResult.confidence}%)\n`;
        message += `理由: ${verdictResult.reasoning}\n`;
        if (verdictResult.matchedResponsibilities.length > 0) {
          message += `匹配职责: ${verdictResult.matchedResponsibilities.map(r => '✓ ' + r).join('、')}\n`;
        }
        if (verdictResult.suggestedAssigneeId) {
          const suggested = await storage.getUserById(verdictResult.suggestedAssigneeId);
          message += `建议: → ${suggested?.displayName} — ${verdictResult.suggestedReason}`;
        }

        return { success: true, message, entity: verdict };
      } catch (err: any) {
        return { success: false, message: `判定失败: ${err.message}` };
      }
    }

    case 'resolve_decision': {
      const { decisionTaskId, updates } = data;
      try {
        const decisionCheck = await storage.getTaskById(decisionTaskId);
        if (!decisionCheck) {
          return { success: false, message: `决策任务 #${decisionTaskId} 不存在` };
        }
        if (decisionCheck.orgId !== orgId) {
          return { success: false, message: '无权操作此决策任务' };
        }
        if (!decisionCheck.isDecisionTask) {
          return { success: false, message: `任务 #${decisionTaskId} 不是决策任务` };
        }
        if (decisionCheck.assigneeId !== userId && decisionCheck.creatorId !== userId) {
          return { success: false, message: '你不是此决策任务的负责人或创建者' };
        }

        const updateData: Record<string, any> = {};
        if (updates.assigneeId) updateData.assigneeId = updates.assigneeId;
        if (updates.dueDate) {
          const parsedDate = new Date(updates.dueDate);
          if (isNaN(parsedDate.getTime())) {
            return { success: false, message: '截止日期格式无效' };
          }
          updateData.dueDate = parsedDate;
        }
        if (updates.priority) updateData.priority = updates.priority;
        if (updates.description) updateData.description = updates.description;
        if (updates.weight) updateData.weight = updates.weight;

        const { decisionTask, originalTask } = await storage.resolveDecisionTask(decisionTaskId, updateData);
        const taskTitle = originalTask?.title || '未知任务';

        await storage.createActivityLog({
          orgId,
          userId,
          entityType: 'task',
          entityId: originalTask?.id || decisionTaskId,
          action: 'decision_resolved',
          changes: JSON.stringify({ decisionTaskId, updates }),
          source: 'ai_chat',
        });

        return {
          success: true,
          message: `决策已确认，任务「${taskTitle}」已更新`,
          entity: originalTask,
        };
      } catch (err: any) {
        return { success: false, message: err.message || '决策处理失败' };
      }
    }

    default:
      return { success: false, message: `不支持的操作类型: ${actionType}` };
  }
}

export async function executeBatchActions(
  actions: Array<{ actionType: string; data: Record<string, any> }>,
  userId: number,
  orgId: number
): Promise<{ success: boolean; results: Array<{ success: boolean; message: string; entity?: any; duplicateWarning?: string }> }> {
  const createTaskActions = actions.filter(a => a.actionType === 'create_task');
  const otherActions = actions.filter(a => a.actionType !== 'create_task');

  const results: Array<{ success: boolean; message: string; entity?: any; duplicateWarning?: string }> = [];

  if (createTaskActions.length > 0) {
    const duplicateWarnings = new Map<number, string>();
    const taskItems = [];

    for (let i = 0; i < createTaskActions.length; i++) {
      const data = createTaskActions[i].data;
      const duplicate = await storage.checkDuplicateTask(orgId, data.title, data.assigneeId, data.memberProfileId);
      if (duplicate) {
        duplicateWarnings.set(i, `系统中已存在类似任务「${duplicate.title}」(#${duplicate.id})`);
      }

      const hasWarnings = Array.isArray(data.warnings) && data.warnings.length > 0;
      let batchAssigneeId = data.assigneeId || userId;
      let batchMemberProfileId = null;
      if (data.memberProfileId) {
        const mp = await storage.getMemberProfileById(data.memberProfileId);
        if (mp && mp.orgId === orgId) {
          batchMemberProfileId = data.memberProfileId;
          batchAssigneeId = null;
        }
      }

      taskItems.push({
        data: {
          orgId,
          projectId: data.projectId,
          title: data.title,
          description: data.description || null,
          type: data.type || 'task',
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          creatorId: userId,
          assigneeId: batchAssigneeId,
          memberProfileId: batchMemberProfileId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          weight: data.weight || 3,
          progress: 0,
          parentTaskId: data.parentTaskId || null,
          tags: data.tags || null,
          needsReview: hasWarnings,
          warnings: hasWarnings ? JSON.stringify(data.warnings) : null,
        },
        ref: data.ref,
        dependsOn: Array.isArray(data.dependsOn) ? data.dependsOn : undefined,
        dependsOnRef: Array.isArray(data.dependsOnRef) ? data.dependsOnRef : undefined,
      });
    }

    const createdTasks = await storage.batchCreateTasks(taskItems, orgId, userId);

    const allDecisionTasks: any[] = [];
    for (let i = 0; i < createdTasks.length; i++) {
      results.push({
        success: true,
        message: `任务「${createdTasks[i].title}」已成功创建`,
        entity: createdTasks[i],
        duplicateWarning: duplicateWarnings.get(i),
      });

      if (createdTasks[i].needsReview && createdTasks[i].warnings) {
        try {
          const warnings = JSON.parse(createdTasks[i].warnings!);
          if (Array.isArray(warnings) && warnings.length > 0) {
            const decisionTasks = await createDecisionTasksForWarnings(
              createdTasks[i], warnings, userId, orgId
            );
            allDecisionTasks.push(...decisionTasks);
          }
        } catch (err) {
          console.error('[DecisionService] Failed to create decision tasks for batch task:', err);
        }
      }
    }

    if (allDecisionTasks.length > 0) {
      try {
        await pushDecisionRequests(allDecisionTasks, orgId, userId);
      } catch (err) {
        console.error('[DecisionService] Failed to push decision requests:', err);
      }
    }
  }

  for (const action of otherActions) {
    const result = await executeAction(action.actionType, action.data, userId, orgId);
    results.push(result);
  }

  return {
    success: results.every(r => r.success),
    results,
  };
}

```

---

## ===== 文件路径: server/services/ai/decisionService.ts (148 行) =====

```typescript
import { storage } from "../../storage";
import type { Task } from "@shared/schema";

const WARNING_TYPE_MAP: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /负责人|指派|分配|assignee|指定.*人/i, type: 'assignee_unclear' },
  { pattern: /截止|deadline|due.*date|到期|完成时间/i, type: 'deadline_missing' },
  { pattern: /范围|scope|需求.*不清|描述.*模糊|内容.*不明/i, type: 'scope_unclear' },
  { pattern: /优先级|priority|紧急程度/i, type: 'priority_unclear' },
  { pattern: /依赖|dependency|前置|阻塞/i, type: 'dependency_unclear' },
];

function classifyWarning(warningText: string): string {
  for (const { pattern, type } of WARNING_TYPE_MAP) {
    if (pattern.test(warningText)) return type;
  }
  return 'scope_unclear';
}

const DECISION_TYPE_LABELS: Record<string, string> = {
  assignee_unclear: '需要确认负责人',
  deadline_missing: '需要确认截止日期',
  scope_unclear: '需要明确任务范围',
  priority_unclear: '需要确认优先级',
  dependency_unclear: '需要确认依赖关系',
};

export async function createDecisionTasksForWarnings(
  originalTask: Task,
  warnings: string[],
  creatorId: number,
  orgId: number
): Promise<Task[]> {
  const decisionTasks: Task[] = [];
  const now = new Date();
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const escalation = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  let decisionMakerId: number;
  const warningTypes = warnings.map(w => classifyWarning(w));
  const hasAssigneeIssue = warningTypes.includes('assignee_unclear');

  if (hasAssigneeIssue) {
    decisionMakerId = creatorId;
  } else if (originalTask.assigneeId) {
    decisionMakerId = originalTask.assigneeId;
  } else {
    decisionMakerId = creatorId;
  }

  for (let i = 0; i < warnings.length; i++) {
    const warningText = warnings[i];
    const decisionType = warningTypes[i];
    const label = DECISION_TYPE_LABELS[decisionType] || '需要确认';

    const decisionTask = await storage.createDecisionTask({
      orgId,
      projectId: originalTask.projectId,
      title: `[决策] ${originalTask.title} — ${label}`,
      description: `原始任务: #${originalTask.id} ${originalTask.title}\n\n待确认事项: ${warningText}\n\n请回复确认或提供所需信息。`,
      creatorId,
      assigneeId: decisionMakerId,
      decisionForTaskId: originalTask.id,
      decisionType,
      decisionDeadline: deadline,
      escalationDeadline: escalation,
    });

    decisionTasks.push(decisionTask);
  }

  return decisionTasks;
}

export async function pushDecisionRequests(
  decisionTasks: Task[],
  orgId: number,
  creatorId: number
): Promise<void> {
  if (decisionTasks.length === 0) return;

  const byAssignee = new Map<number, Task[]>();
  for (const dt of decisionTasks) {
    const assigneeId = dt.assigneeId || creatorId;
    if (!byAssignee.has(assigneeId)) {
      byAssignee.set(assigneeId, []);
    }
    byAssignee.get(assigneeId)!.push(dt);
  }

  for (const [userId, userDecisionTasks] of byAssignee) {
    const allConversations = await storage.getConversationsByUser(orgId, userId);
    let conversation = allConversations.find(c => !c.isArchived);

    if (!conversation) {
      conversation = await storage.createConversation({
        orgId,
        userId,
        title: '任务决策确认',
        visibility: 'private',
      });
    }

    const items = await Promise.all(userDecisionTasks.map(async (dt, index) => {
      const originalTask = dt.decisionForTaskId
        ? await storage.getTaskById(dt.decisionForTaskId)
        : null;
      const label = DECISION_TYPE_LABELS[dt.decisionType || ''] || '需要确认';
      return {
        index: index + 1,
        decisionTaskId: dt.id,
        originalTaskId: dt.decisionForTaskId,
        originalTaskTitle: originalTask?.title || '未知任务',
        decisionType: dt.decisionType,
        label,
        warning: dt.description?.split('待确认事项: ')[1]?.split('\n')[0] || '',
      };
    }));

    const messageContent = JSON.stringify({
      type: 'decision_request',
      items,
      createdAt: new Date().toISOString(),
    });

    await storage.createChatMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: messageContent,
      type: 'decision_request',
      metadata: JSON.stringify({ isSystemGenerated: true }),
    });

    await storage.updateConversation(conversation.id, {
      lastMessageAt: new Date(),
    });

    await storage.createNotification({
      userId,
      orgId,
      type: 'decision_required',
      entityType: 'task',
      entityId: userDecisionTasks[0].decisionForTaskId || userDecisionTasks[0].id,
      entityTitle: `${userDecisionTasks.length} 个任务需要你确认`,
      message: `你有 ${userDecisionTasks.length} 个AI创建的任务需要确认信息，请在AI对话中回复。`,
      triggeredBy: creatorId,
    });
  }
}

```

---

## ===== 文件路径: server/services/ai/codeTools.ts (237 行) =====

```typescript
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

```

---

## ===== 文件路径: server/services/setup/aiExtractor.ts (402 行) =====

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

async function claudeExtract(params: { model: string; max_tokens: number; temperature?: number; messages: { role: string; content: string | any[] }[] }): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemMsg = params.messages.find(m => m.role === 'system');
    const nonSystem = params.messages.filter(m => m.role !== 'system');
    const resp = await client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0,
      ...(systemMsg ? { system: typeof systemMsg.content === 'string' ? systemMsg.content : '' } : {}),
      messages: nonSystem.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as any })),
    });
    return resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }
  const timeout = params.model.includes('opus') ? 300000 : 90000;
  const apiKey = params.model.includes('opus')
    ? (process.env.CLAUDE_COMPLEX_API_KEY || process.env.CLAUDE_SIMPLE_API_KEY || '')
    : (process.env.CLAUDE_SIMPLE_API_KEY || '');
  const client = new OpenAI({
    baseURL: 'https://vip.aipro.love/v1',
    apiKey,
    timeout,
  });
  const resp = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    messages: params.messages as any,
  });
  return resp.choices[0]?.message?.content || '';
}

export type DocumentCategory =
  | 'org_chart' | 'roster' | 'jd' | 'contract' | 'kpi'
  | 'policy' | 'handbook' | 'sop'
  | 'product' | 'sales' | 'project'
  | 'finance' | 'legal'
  | 'marketing' | 'brand'
  | 'technical'
  | 'general';

export interface FileAnalysis {
  fileName: string;
  category: DocumentCategory;
  orgRelevance: number;
  kbRelevance: number;
  orgReason: string;
  kbReason: string;
  sensitivity: 'high' | 'medium' | 'low';
  summary: string;
  suggestedVisibility: 'org' | 'admin' | 'department';
  suggestedDepartment: string;
  mentionedDepartments: string[];
  mentionedRoles: string[];
  mentionedNames: string[];
}

export interface ExtractedMember {
  fullName: string;
  aliases: string[];
  departmentName: string;
  jobRoleTitle: string;
  employeeId: string;
  phone: string;
  email: string;
  title: string;
  hireDate: string;
  contractHighlights: string;
}

export interface EnterpriseProfile {
  companyName: string;
  companyDescription: string;
  departments: {
    name: string;
    description: string;
    children?: { name: string; description: string }[];
  }[];
  jobRoles: {
    title: string;
    departmentName: string;
    responsibilities: string;
    boundaries: string;
    requiredSkills: string;
  }[];
  members: ExtractedMember[];
  fileClassifications: FileAnalysis[];
}

export async function analyzeFileWithHaiku(fileName: string, content: string): Promise<FileAnalysis> {
  try {
    const text = await claudeExtract({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `你是一个企业文档分析助手。请分析以下企业文件，返回纯 JSON（不要 markdown 代码块）。

只看文件名和文件开头内容（前500字符），快速判断以下信息：

{
  "category": "从以下选项中选一个：org_chart/roster/jd/contract/kpi/policy/handbook/sop/product/sales/project/finance/legal/marketing/brand/technical/general",
  "orgRelevance": 4,
  "kbRelevance": 3,
  "orgReason": "一句话说明为什么给这个 orgRelevance 分数",
  "kbReason": "一句话说明为什么给这个 kbRelevance 分数",
  "sensitivity": "low",
  "summary": "一句话概括文件内容（20字以内）",
  "suggestedVisibility": "org/admin/department 三选一",
  "suggestedDepartment": "如果 suggestedVisibility=department，填哪个部门（否则空字符串）",
  "mentionedDepartments": ["识别到的部门名称"],
  "mentionedRoles": ["识别到的岗位/职位名称"],
  "mentionedNames": ["识别到的人名"]
}

分类说明：
- org_chart: 组织架构图
- roster: 花名册/通讯录/人员名册
- jd: 岗位说明书/职位描述
- contract: 劳动合同/保密协议
- kpi: 绩效考核标准/KPI表
- policy: 规章制度（考勤、报销、行政等）
- handbook: 员工手册（综合性文档）
- sop: 标准操作流程
- product: 产品相关（目录、手册、规格）
- sales: 销售相关（话术、客户、报价）
- project: 项目相关（方案、计划、纪要）
- finance: 财务相关
- legal: 法务合同/协议
- marketing: 市场营销相关
- brand: 品牌/公司介绍
- technical: 技术文档
- general: 无法分类的

orgRelevance 评分标准（对理解组织架构的价值，1-5整数）：
  5 = 直接包含组织架构信息（组织架构图、花名册、通讯录）
  4 = 包含岗位职责或人员信息（岗位说明书、劳动合同、绩效考核表）
  3 = 间接包含组织信息（员工手册中提到部门、SOP中提到负责人、项目方案中有分工）
  2 = 可能有零星的人名或部门提及（会议纪要、工作报告）
  1 = 与组织架构完全无关（产品手册、财务数据、发票、市场资料）

kbRelevance 评分标准（员工日常查询价值，1-5整数）：
  5 = 员工高频查询（考勤制度、报销流程、请假规定、产品FAQ）
  4 = 工作参考文档（SOP、产品手册、销售话术、技术规范）
  3 = 偶尔参考（培训计划、项目方案、竞品分析）
  2 = 低频但有存档价值（合同、年度计划、品牌手册）
  1 = 几乎不会被查询（发票、银行流水、物流单号、水电费通知）

sensitivity 判断：
  high = 涉及个人薪资、银行信息、商业核心机密
  medium = 涉及合同条款、客户名单、财务概况
  low = 可以全员公开的制度、流程、产品信息

suggestedVisibility 判断：
  org = 全员应知的（考勤、办公规范、报销流程、产品知识）
  admin = 涉及薪资、合同条款、人事的敏感文件
  department = 只和特定部门相关的文件`
        },
        {
          role: 'user',
          content: `文件名：${fileName}\n\n文件内容（开头部分）：\n${content.slice(0, 500)}`
        }
      ],
    });
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      fileName,
      category: parsed.category || 'general',
      orgRelevance: typeof parsed.orgRelevance === 'number' ? parsed.orgRelevance : 3,
      kbRelevance: typeof parsed.kbRelevance === 'number' ? parsed.kbRelevance : 3,
      orgReason: parsed.orgReason || '',
      kbReason: parsed.kbReason || '',
      sensitivity: ['high', 'medium', 'low'].includes(parsed.sensitivity) ? parsed.sensitivity : 'low',
      summary: parsed.summary || '',
      suggestedVisibility: parsed.suggestedVisibility || 'org',
      suggestedDepartment: parsed.suggestedDepartment || '',
      mentionedDepartments: parsed.mentionedDepartments || [],
      mentionedRoles: parsed.mentionedRoles || [],
      mentionedNames: parsed.mentionedNames || [],
    };
  } catch (err: any) {
    console.error(`[Setup AI] Haiku analysis failed for ${fileName}:`, err.message);
    return {
      fileName,
      category: 'general',
      orgRelevance: 3,
      kbRelevance: 3,
      orgReason: '分析失败，默认中等相关性',
      kbReason: '分析失败，默认中等相关性',
      sensitivity: 'low',
      summary: '无法自动分析',
      suggestedVisibility: 'org',
      suggestedDepartment: '',
      mentionedDepartments: [],
      mentionedRoles: [],
      mentionedNames: [],
    };
  }
}

async function synthesizeWithOpus(
  allFileAnalyses: FileAnalysis[],
  selectedFiles: { fileName: string; content: string }[]
): Promise<EnterpriseProfile> {
  const summaryBlock = allFileAnalyses.map(f =>
    `【${f.fileName}】类型:${f.category} | 组织:${f.orgRelevance}/5 知识库:${f.kbRelevance}/5 | 摘要:${f.summary} | 部门:${f.mentionedDepartments.join(',')} | 岗位:${f.mentionedRoles.join(',')} | 人名:${f.mentionedNames.join(',')}`
  ).join('\n');

  const keyContents = selectedFiles
    .map(f => `### ${f.fileName}\n${f.content}`)
    .join('\n\n');

  try {
    const text = await claudeExtract({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `你是一个企业组织架构分析专家。根据多份企业文件的分析摘要和关键文件原文，整合出完整的企业组织信息。

返回纯 JSON（不要 markdown 代码块）：
{
  "companyName": "从文件中识别的公司全称（找不到就填空字符串）",
  "companyDescription": "公司简介1-2句话（找不到就填空）",
  "departments": [
    {
      "name": "部门名称",
      "description": "部门职责简述（1句话）",
      "children": [
        { "name": "子部门名", "description": "简述" }
      ]
    }
  ],
  "jobRoles": [
    {
      "title": "岗位名称",
      "departmentName": "所属部门（和departments中的name对应）",
      "responsibilities": "核心职责，用分号分隔",
      "boundaries": "不负责的事项（没有就填空）",
      "requiredSkills": "技能要求（没有就填空）"
    }
  ],
  "members": [
    {
      "fullName": "员工正式姓名（必填）",
      "aliases": ["该员工的其他称呼：英文名、小名、昵称、职位简称等"],
      "departmentName": "所属部门（和departments中的name对应）",
      "jobRoleTitle": "岗位名称（和jobRoles中的title对应）",
      "employeeId": "工号（如果有）",
      "phone": "手机号（如果有）",
      "email": "邮箱（如果有）",
      "title": "职位头衔",
      "hireDate": "入职日期（如果有）",
      "contractHighlights": "合同关键条款摘要（如果是从合同中提取的）"
    }
  ]
}

规则：
- 只提取文件中明确提到的信息，不编造
- 去重：多个文件提到同一个部门只列一次
- 识别层级关系（如"大客户组"隶属于"销售部"放在children里）
- 如果找不到某项信息，对应字段填空字符串或空数组
- departments、jobRoles、members 数组如果完全没有信息就返回空数组

人员提取规则（最重要）：
- 仔细阅读所有关键文件原文，从人员名册、组织架构图、通讯录、劳动合同、签名栏、表格等位置识别人员
- 每个在文件中出现的内部员工都必须提取，不要遗漏
- aliases 很重要——收集文件中出现的该人的所有不同称呼（中文名、英文名、昵称等）
- 如果同一个人在多份文件中出现，合并信息（用最完整的版本）
- 不要提取客户、供应商等外部人员，只提取公司内部员工
- 如果文件中有明确的汇报关系（如"向XX汇报"），记录在该人的 contractHighlights 中
- 不要提取薪资等敏感信息，只提取职责相关的条款`
        },
        {
          role: 'user',
          content: `以下是对一家企业${allFileAnalyses.length}份文件的分析结果：

## 全部文件摘要
${summaryBlock}

## 关键文件内容（共${selectedFiles.length}篇，orgRelevance≥3）
${keyContents || '（无关键文件内容）'}

请从以上信息中整合出这家企业的完整组织架构，特别注意提取所有内部员工信息。`
        }
      ],
    });
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const members = (parsed.members || []).map((m: any) => ({
      fullName: m.fullName || '',
      aliases: Array.isArray(m.aliases) ? m.aliases : [],
      departmentName: m.departmentName || '',
      jobRoleTitle: m.jobRoleTitle || '',
      employeeId: m.employeeId || '',
      phone: m.phone || '',
      email: m.email || '',
      title: m.title || '',
      hireDate: m.hireDate || '',
      contractHighlights: m.contractHighlights || '',
    }));

    return {
      companyName: parsed.companyName || '',
      companyDescription: parsed.companyDescription || '',
      departments: parsed.departments || [],
      jobRoles: parsed.jobRoles || [],
      members,
      fileClassifications: allFileAnalyses,
    };
  } catch (err: any) {
    console.error('[Setup AI] Opus synthesis failed:', err.message);
    return {
      companyName: '',
      companyDescription: '',
      departments: [],
      jobRoles: [],
      members: [],
      fileClassifications: allFileAnalyses,
    };
  }
}

export interface ExtractionResult extends EnterpriseProfile {
  analyzedFileCount: number;
  totalFileCount: number;
}

export async function extractEnterpriseProfile(
  files: { fileName: string; content: string; skipped?: boolean }[]
): Promise<ExtractionResult> {
  const totalFileCount = files.length;
  console.log(`[Setup AI] Starting extraction for ${totalFileCount} files`);

  const relevantFiles = files.filter(f => !f.skipped);
  const skippedByName = files.filter(f => f.skipped);
  if (skippedByName.length > 0) {
    console.log(`[Setup AI] Stage 0: ${skippedByName.length} files skipped by filename filter`);
  }

  console.log(`[Setup AI] Stage 1: Haiku scoring ${relevantFiles.length} files...`);
  const fileAnalyses = await Promise.all(
    relevantFiles.map(f => analyzeFileWithHaiku(f.fileName, f.content))
  );

  const skippedAnalyses: FileAnalysis[] = skippedByName.map(f => ({
    fileName: f.fileName,
    category: 'general' as const,
    orgRelevance: 1,
    kbRelevance: 1,
    orgReason: '文件名匹配跳过规则',
    kbReason: '文件名匹配跳过规则',
    sensitivity: 'low' as const,
    summary: '文件名过滤跳过',
    suggestedVisibility: 'org' as const,
    suggestedDepartment: '',
    mentionedDepartments: [],
    mentionedRoles: [],
    mentionedNames: [],
  }));

  const allAnalyses = [...fileAnalyses, ...skippedAnalyses];
  console.log(`[Setup AI] Stage 1 complete: scores = [${fileAnalyses.map(f => `${f.fileName}:org${f.orgRelevance}/kb${f.kbRelevance}`).join(', ')}]`);

  const scored = fileAnalyses
    .map((analysis, i) => ({ analysis, file: relevantFiles[i] }))
    .sort((a, b) => b.analysis.orgRelevance - a.analysis.orgRelevance);

  const highValue = scored.filter(s => s.analysis.orgRelevance >= 3);

  const capped = highValue.slice(0, 15);

  let totalChars = 0;
  const finalFiles: { fileName: string; content: string }[] = [];
  for (const item of capped) {
    const charLimit = 8000;
    const contentToSend = item.file.content.slice(0, charLimit);
    if (totalChars + contentToSend.length > 80000) break;
    totalChars += contentToSend.length;
    finalFiles.push({ fileName: item.file.fileName, content: contentToSend });
  }

  const analyzedFileCount = finalFiles.length;
  console.log(`[Setup AI] Stage 1.5 filtering: ${totalFileCount} total → ${relevantFiles.length} after filename → ${highValue.length} org-relevant (orgRelevance≥3) → ${analyzedFileCount} sent to Opus (${totalChars} chars)`);

  console.log(`[Setup AI] Stage 2: Opus deep analysis on ${analyzedFileCount} files...`);
  const profile = await synthesizeWithOpus(allAnalyses, finalFiles);
  console.log(`[Setup AI] Stage 2 complete: ${profile.departments.length} depts, ${profile.jobRoles.length} roles, ${profile.members.length} members`);

  return { ...profile, analyzedFileCount, totalFileCount };
}

```

---

## ===== 文件路径: server/services/briefing/briefingGenerator.ts (228 行) =====

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../../storage';
import { aggregateBriefingData, BriefingData } from './dataAggregator';

async function briefingComplete(params: { model: string; max_tokens: number; temperature?: number; messages: { role: string; content: string }[] }): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemMsg = params.messages.find(m => m.role === 'system');
    const nonSystem = params.messages.filter(m => m.role !== 'system');
    const resp = await client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: nonSystem.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });
    return resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }
  const aiClient = new OpenAI({
    baseURL: 'https://vip.aipro.love/v1',
    apiKey: process.env.CLAUDE_SIMPLE_API_KEY || '',
    timeout: 30000,
  });
  const resp = await aiClient.chat.completions.create({
    model: params.model,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    messages: params.messages as any,
  });
  return resp.choices[0]?.message?.content || '';
}

export interface BriefingAction {
  type: 'reassign' | 'change_priority' | 'remind';
  description: string;
  taskId?: number;
  taskTitle?: string;
  fromUserId?: number;
  toUserId?: number;
  toUserName?: string;
  priority?: string;
}

export async function getTodayBriefing(orgId: number, userId: number): Promise<{
  content: string;
  isNew: boolean;
  date: string;
  actions: BriefingAction[];
}> {
  const today = new Date().toISOString().slice(0, 10);

  const data = await aggregateBriefingData(orgId, userId);
  const actions = generateActions(data);

  const cached = await storage.getBriefing(orgId, userId, today);
  if (cached) {
    return { content: cached.content, isNew: false, date: today, actions };
  }

  const content = await generateBriefingWithAI(data, today);

  try {
    await storage.createBriefing({
      orgId,
      userId,
      date: today,
      content,
      dataSnapshot: JSON.stringify(data),
      model: 'claude-haiku-4-5-20251001',
      tokenCount: 0,
    });
  } catch (err: any) {
    console.warn('[Briefing] Failed to cache:', err.message);
  }

  return { content, isNew: true, date: today, actions };
}

function generateActions(data: BriefingData): BriefingAction[] {
  const actions: BriefingAction[] = [];

  for (const t of data.tasksOverdue) {
    if (t.daysOverdue >= 3) {
      actions.push({
        type: 'change_priority',
        description: `"${t.title}" 已逾期 ${t.daysOverdue} 天，建议提升优先级为紧急`,
        taskId: t.id,
        taskTitle: t.title,
        priority: 'urgent',
      });
    }
    actions.push({
      type: 'remind',
      description: `提醒 ${t.assigneeName} 跟进逾期任务 "${t.title}"`,
      taskId: t.id,
      taskTitle: t.title,
      toUserId: t.assigneeId,
      toUserName: t.assigneeName,
    });
  }

  if (data.busiestMember && data.busiestMember.activeTaskCount >= 5) {
    const busiestName = data.busiestMember.name;
    const busiestUserId = data.busiestMember.userId;
    for (const t of data.tasksDueToday) {
      if (t.assigneeName === busiestName) {
        actions.push({
          type: 'reassign',
          description: `${busiestName} 负载较高(${data.busiestMember.activeTaskCount}个任务)，建议转派 "${t.title}"`,
          taskId: t.id,
          taskTitle: t.title,
          fromUserId: busiestUserId,
        });
        break;
      }
    }
  }

  for (const t of data.tasksDueToday) {
    actions.push({
      type: 'remind',
      description: `"${t.title}" 今日到期，提醒 ${t.assigneeName} 按时完成`,
      taskId: t.id,
      taskTitle: t.title,
      toUserId: t.assigneeId,
      toUserName: t.assigneeName,
    });
  }

  return actions.slice(0, 5);
}

async function generateBriefingWithAI(data: BriefingData, dateStr: string): Promise<string> {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(dateStr).getDay()];

  const dataBlock = `
当前日期：${dateStr}（周${weekday}）
用户：${data.userName}
组织：${data.orgName}
团队人数：${data.memberCount}

活跃任务总数：${data.totalActiveTasks}

今日到期任务（${data.tasksDueToday.length}个）：
${data.tasksDueToday.length > 0 ? data.tasksDueToday.map(t => `- 「${t.title}」负责人：${t.assigneeName}`).join('\n') : '无'}

逾期任务（${data.tasksOverdue.length}个）：
${data.tasksOverdue.length > 0 ? data.tasksOverdue.map(t => `- 「${t.title}」已逾期${t.daysOverdue}天，负责人：${t.assigneeName}`).join('\n') : '无'}

昨日完成任务（${data.tasksCompletedYesterday.length}个）：
${data.tasksCompletedYesterday.length > 0 ? data.tasksCompletedYesterday.map(t => `- 「${t.title}」完成者：${t.completedBy}`).join('\n') : '无'}

昨日新建任务数：${data.tasksCreatedYesterday}

团队负载最高：${data.busiestMember ? `${data.busiestMember.name}（${data.busiestMember.activeTaskCount}个进行中任务）` : '无数据'}

知识库文档数：${data.kbDocCount}
最近上传：${data.kbRecentUploads.length > 0 ? data.kbRecentUploads.map(d => d.title).join('、') : '无'}
`.trim();

  try {
    const content = await briefingComplete({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: `你是一个企业管理AI助手，每天早上给老板生成一份简洁的工作简报。

要求：
- 用 Markdown 格式
- 语气亲切专业，像一个靠谱的助理在汇报
- 以"早安"开头，包含日期和星期
- 分为以下几个板块（如果某个板块没有数据就跳过，不要写"无"）：
  📋 今日重点（今日到期的任务，最多5个）
  ⚠️ 需要关注（逾期任务，语气要有紧迫感但不吓人）
  ✅ 昨日成果（完成的任务，表扬一下）
  💡 AI建议（根据数据给1-2条具体建议，比如"建议协调XX的任务负载"或"XX任务已逾期3天建议重新评估"）
- 整体控制在 200-400 字
- 不要编造数据中没有的信息
- 如果今天没什么特别的，就说"今天没有紧急事项，适合推进重点项目"`
        },
        {
          role: 'user',
          content: `请根据以下数据生成今日简报：\n\n${dataBlock}`
        }
      ],
    });

    return content || generateFallbackBriefing(data, dateStr, weekday);
  } catch (err: any) {
    console.error('[Briefing] AI generation failed:', err.message);
    return generateFallbackBriefing(data, dateStr, weekday);
  }
}

function generateFallbackBriefing(data: BriefingData, dateStr: string, weekday: string): string {
  const lines: string[] = [];
  lines.push(`## 🌅 早安，${data.userName}！`);
  lines.push(`今天是 ${dateStr} 周${weekday}\n`);

  if (data.tasksDueToday.length > 0) {
    lines.push(`### 📋 今日到期`);
    data.tasksDueToday.forEach(t => lines.push(`- ${t.title}（${t.assigneeName}）`));
    lines.push('');
  }

  if (data.tasksOverdue.length > 0) {
    lines.push(`### ⚠️ 逾期提醒`);
    data.tasksOverdue.forEach(t => lines.push(`- ${t.title} — 已逾期${t.daysOverdue}天`));
    lines.push('');
  }

  if (data.tasksCompletedYesterday.length > 0) {
    lines.push(`### ✅ 昨日完成`);
    data.tasksCompletedYesterday.forEach(t => lines.push(`- ${t.title}（${t.completedBy}）`));
    lines.push('');
  }

  if (data.totalActiveTasks === 0 && data.tasksOverdue.length === 0) {
    lines.push('今天没有紧急事项，适合推进重点项目。');
  }

  lines.push(`\n---\n*活跃任务 ${data.totalActiveTasks} 个 · 团队 ${data.memberCount} 人 · 知识库 ${data.kbDocCount} 份文档*`);
  return lines.join('\n');
}

```

---

## ===== 文件路径: server/routes.ts (4675 行) =====

```typescript
import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { chat as aiChat, chatStream as aiChatStream, codeToolChatStream, generateProjectTasks, extractMemories, generateConversationTitle } from "./services/ai/index";
import { executeAction, executeBatchActions } from "./services/ai/actionExecutor";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authMiddleware, generateToken, getTokenExpiry } from './middleware/auth';
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import adminRouter, { adminOrOwnerMiddleware } from './routes/admin';
import {
  insertOrganizationSchema,
  insertDepartmentSchema,
  insertUserSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertTaskDependencySchema,
  insertTaskCommentSchema,
  insertTaskParticipantSchema,
  insertJobRoleSchema,
  insertConversationSchema,
  insertChatMessageSchema,
  insertUserMemorySchema,
  insertKbDocumentSchema,
} from "@shared/schema";
import { processDocument } from './services/kb/processDocument';
import { searchKnowledge } from './services/kb/search';
import { judgeTaskAssignment } from "./services/ai/verdictService";
import { searchWeb } from "./services/ai/webSearch";
import { generateInviteCode } from "./utils/inviteCode";

function getActivityUserId(body: any, fallback: number = 1): number {
  return body?.userId ?? body?.creatorId ?? fallback;
}

export async function registerRoutes(server: Server, app: Express) {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: Date.now() });
  });

  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/api/admin", authMiddleware, adminOrOwnerMiddleware, adminRouter);

  app.get("/api/auth/oidc/complete", async (req: any, res) => {
    try {
      if (!req.user || !req.user.claims) {
        return res.redirect('/login');
      }

      const claims = req.user.claims;
      const sub = claims.sub;
      const email = claims.email;
      const firstName = claims.first_name || '';
      const lastName = claims.last_name || '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || 'User';
      const avatarUrl = claims.profile_image_url || null;

      let user = await storage.getUserByProvider('oidc', sub);

      if (!user && email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, { authProvider: 'oidc', authProviderId: sub, avatarUrl: avatarUrl || user.avatarUrl } as any);
        }
      }

      if (!user) {
        const org = await storage.createOrganization({ name: displayName + '的团队' });
        user = await storage.createUser({
          orgId: org.id,
          email: email || `oidc_${sub}@placeholder.local`,
          displayName,
          avatarUrl,
          role: 'owner',
          isActive: true,
          authProvider: 'oidc',
          authProviderId: sub,
        } as any);
        await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date(), avatarUrl: avatarUrl || user.avatarUrl } as any);

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });

      return res.redirect(`/login?token=${encodeURIComponent(token)}`);
    } catch (e: any) {
      console.error('OIDC complete error:', e);
      return res.redirect('/login?error=auth_failed');
    }
  });

  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const { hash, ...userData } = req.body;

      if (!hash || !userData.id || !userData.auth_date) {
        return res.status(400).json({ error: 'Missing required Telegram auth fields' });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ error: 'Telegram bot token not configured' });
      }

      const authDate = Number(userData.auth_date);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 86400) {
        return res.status(401).json({ error: 'Telegram auth data is expired' });
      }

      const dataCheckString = Object.keys(userData)
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');

      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (hmac !== hash) {
        return res.status(401).json({ error: 'Invalid Telegram auth hash' });
      }

      const telegramId = String(userData.id);
      const firstName = userData.first_name || '';
      const lastName = userData.last_name || '';
      const username = userData.username || '';
      const photoUrl = userData.photo_url || null;
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Telegram User';

      let user = await storage.getUserByProvider('telegram', telegramId);

      if (!user) {
        const org = await storage.createOrganization({ name: displayName + '的团队' });
        user = await storage.createUser({
          orgId: org.id,
          email: `telegram_${telegramId}@placeholder.local`,
          displayName,
          avatarUrl: photoUrl,
          role: 'owner',
          isActive: true,
          authProvider: 'telegram',
          authProviderId: telegramId,
        } as any);
        await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date(), avatarUrl: photoUrl || user.avatarUrl } as any);

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId, avatarUrl: user.avatarUrl },
      });
    } catch (e: any) {
      console.error('Telegram auth error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  async function generateTeamNotifications(
    triggeredByUserId: number,
    entityType: 'task' | 'project',
    entityId: number,
    entityTitle: string,
    orgId: number,
    type: string,
    message: string
  ) {
    const recipientIds = new Set<number>();

    if (entityType === 'task') {
      const task = await storage.getTaskById(entityId);
      if (task) {
        if (task.assigneeId && task.assigneeId !== triggeredByUserId) recipientIds.add(task.assigneeId);
        if (task.creatorId !== triggeredByUserId) recipientIds.add(task.creatorId);
        const participants = await storage.getTaskParticipants(entityId);
        for (const p of participants) {
          if (p.userId !== triggeredByUserId) recipientIds.add(p.userId);
        }
      }
    } else if (entityType === 'project') {
      const project = await storage.getProjectById(entityId);
      if (project) {
        if (project.ownerId !== triggeredByUserId) recipientIds.add(project.ownerId);
        const projectTasks = await storage.getTasks({ projectId: entityId });
        for (const t of projectTasks) {
          if (t.assigneeId && t.assigneeId !== triggeredByUserId) recipientIds.add(t.assigneeId);
          if (t.creatorId !== triggeredByUserId) recipientIds.add(t.creatorId);
        }
      }
    }

    // Team vs Personal: Only notify superiors if there are already other recipients
    // (meaning it's a team event, not a purely personal task)
    if (recipientIds.size > 0) {
      const triggerUser = await storage.getUserById(triggeredByUserId);
      if (triggerUser && triggerUser.deptId) {
        const allUsers = await storage.getUsers();
        const heads = allUsers.filter(u => u.deptId === triggerUser.deptId && (u.role === 'head' || u.role === 'admin' || u.role === 'owner') && u.id !== triggeredByUserId);
        for (const h of heads) {
          recipientIds.add(h.id);
        }
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggeredByUserId);
        for (const o of ownerUsers) {
          recipientIds.add(o.id);
        }
      }
    }

    if (recipientIds.size === 0) return;

    const notificationData = Array.from(recipientIds).map(userId => ({
      orgId,
      userId,
      type,
      entityType,
      entityId,
      entityTitle,
      message,
      triggeredBy: triggeredByUserId,
      isRead: false,
    }));

    await storage.createManyNotifications(notificationData);
  }

  // ===================== Auth =====================
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, displayName } = req.body;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: '请输入有效的邮箱地址' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: '密码至少需要8个字符' });
      }
      if (!displayName) {
        return res.status(400).json({ error: '请输入显示名称' });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const org = await storage.createOrganization({ name: displayName + '的团队' });
      const user = await storage.createUser({
        orgId: org.id,
        email,
        passwordHash,
        displayName,
        role: 'owner',
        isActive: true,
      } as any);

      await storage.createOrgMembership({ userId: user.id, orgId: org.id, role: 'owner', isActive: true });

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId, avatarUrl: user.avatarUrl },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: '请先注册账户' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      const token = generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, orgId: user.orgId, avatarUrl: user.avatarUrl },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUserById(req.currentUserId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const org = user.orgId ? await storage.getOrganizationById(user.orgId) : undefined;

      let activeInviteCode: string | undefined;
      if (user.orgId) {
        const orgInvitations = await storage.getOrgInvitations(user.orgId);
        if (orgInvitations.length > 0) {
          activeInviteCode = orgInvitations[0].inviteCode;
        }
      }

      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
      const isSuperAdmin = user.isSuperAdmin || adminEmails.includes(user.email);

      const userData = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        orgId: user.orgId,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted ?? false,
        orgName: org?.name,
        orgType: org?.type || 'project',
        orgDescription: org?.description,
        activeInviteCode,
        isSuperAdmin,
      };

      const authHeader = req.headers.authorization;
      const currentToken = authHeader?.split(' ')[1];
      let refreshedToken: string | undefined;

      if (currentToken) {
        const expiry = getTokenExpiry(currentToken);
        if (expiry) {
          const remainingSec = expiry - Math.floor(Date.now() / 1000);
          if (remainingSec < 86400) {
            refreshedToken = generateToken({
              userId: user.id,
              orgId: user.orgId,
              role: user.role,
            });
          }
        }
      }

      return res.json({
        user: userData,
        ...(refreshedToken ? { token: refreshedToken } : {}),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/auth/profile", authMiddleware, async (req, res) => {
    try {
      const { displayName, avatarUrl } = req.body;
      const data: any = {};
      if (displayName !== undefined) data.displayName = displayName;
      if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

      const updated = await storage.updateUser(req.currentUserId, data);
      return res.json({ user: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/auth/password", authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: '新密码至少需要8个字符' });
      }

      const user = await storage.getUserById(req.currentUserId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      if (!user.passwordHash) {
        return res.status(400).json({ error: '当前账户未设置密码' });
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: '当前密码错误' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.currentUserId, { passwordHash } as any);

      return res.json({ message: '密码修改成功' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Multi-Org & Invitations =====================
  app.get("/api/user/orgs", authMiddleware, async (req: any, res) => {
    try {
      const orgs = await storage.getUserOrgsWithDetails(req.currentUserId);
      res.json({ data: orgs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/user/switch-org", authMiddleware, async (req: any, res) => {
    try {
      const { orgId } = req.body;
      if (!orgId) return res.status(400).json({ error: 'orgId is required' });

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !membership.isActive) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
      }

      const user = await storage.switchActiveOrg(req.currentUserId, orgId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const org = await storage.getOrganizationById(orgId);
      const token = generateToken({ userId: user.id, orgId: user.orgId, role: membership.role });

      res.json({
        data: {
          token,
          user: {
            id: user.id, email: user.email, displayName: user.displayName,
            role: membership.role, orgId: user.orgId, avatarUrl: user.avatarUrl,
            orgName: org?.name,
            orgType: org?.type || 'project',
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/org/members", authMiddleware, async (req: any, res) => {
    try {
      const members = await storage.getOrgMembers(req.orgId);
      res.json({ data: members });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations", authMiddleware, async (req: any, res) => {
    try {
      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, req.orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Only owner or admin can create invitations' });
      }

      const inviteCode = crypto.randomBytes(6).toString('hex');
      const { role, maxUses, expiresInDays } = req.body;

      const invitation = await storage.createInvitation({
        orgId: req.orgId,
        inviteCode,
        role: role || 'member',
        createdBy: req.currentUserId,
        maxUses: maxUses || null,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
        isActive: true,
      });

      res.json({ data: invitation });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/invitations", authMiddleware, async (req: any, res) => {
    try {
      const orgInvitations = await storage.getOrgInvitations(req.orgId);
      res.json({ data: orgInvitations });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/invitations/:id", authMiddleware, async (req: any, res) => {
    try {
      const result = await storage.deactivateInvitation(Number(req.params.id));
      res.json({ data: result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/invitations/verify/:code", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByCode(req.params.code);
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(410).json({ error: 'Invitation has expired' });
      }
      if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
        return res.status(410).json({ error: 'Invitation has reached maximum uses' });
      }

      const org = await storage.getOrganizationById(invitation.orgId);
      res.json({ data: { orgName: org?.name, orgType: org?.type, role: invitation.role } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.2 POST /api/organizations — 创建组织 ====================
  app.post("/api/organizations", authMiddleware, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: '组织名称不能为空' });
      }

      const org = await storage.createOrganization({ name: name.trim(), description: description || null });

      let inviteCode = '';
      for (let i = 0; i < 5; i++) {
        const code = generateInviteCode(name);
        const existing = await storage.getInvitationByCode(code);
        if (!existing) {
          inviteCode = code;
          break;
        }
      }
      if (!inviteCode) {
        inviteCode = generateInviteCode(name) + Math.floor(Math.random() * 100);
      }

      await storage.createInvitation({
        orgId: org.id,
        inviteCode,
        role: 'member',
        createdBy: req.currentUserId,
        isActive: true,
        maxUses: 0,
        usedCount: 0,
      });

      await storage.updateUser(req.currentUserId, {
        orgId: org.id,
        role: 'owner',
        onboardingCompleted: true,
      } as any);

      await storage.createOrgMembership({
        userId: req.currentUserId,
        orgId: org.id,
        role: 'owner',
      });

      const newToken = generateToken({ userId: req.currentUserId, orgId: org.id, role: 'owner' });

      res.json({ data: { organization: org, inviteCode, token: newToken } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.3 GET /api/organizations/search — 通过邀请码搜索组织 ====================
  app.get("/api/organizations/search", authMiddleware, async (req: any, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).json({ error: '请提供邀请码' });
      }

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ error: '未找到该邀请码对应的组织' });
      }

      const org = await storage.getOrganizationById(invitation.orgId);
      if (!org) {
        return res.status(404).json({ error: '未找到该邀请码对应的组织' });
      }

      const memberCount = await storage.countOrgMembers(org.id);

      res.json({ data: { id: org.id, name: org.name, description: org.description, memberCount } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.4 POST /api/organizations/:id/join-requests — 提交加入申请 ====================
  app.post("/api/organizations/:id/join-requests", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);
      const { inviteCode: code, message } = req.body;

      if (!code) {
        return res.status(400).json({ error: '请提供邀请码' });
      }

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation || !invitation.isActive || invitation.orgId !== orgId) {
        return res.status(400).json({ error: '邀请码无效或不属于该组织' });
      }

      if (invitation.maxUses && invitation.maxUses > 0 && invitation.usedCount >= invitation.maxUses) {
        return res.status(400).json({ error: '该邀请码已达到使用上限' });
      }

      const user = await storage.getUserById(req.currentUserId);
      if (user && user.orgId === orgId) {
        return res.status(400).json({ error: '你已经是该组织的成员' });
      }

      const existingRequest = await storage.getPendingJoinRequestByUserId(req.currentUserId, orgId);
      if (existingRequest) {
        return res.status(400).json({ error: '你已有待审批的加入申请' });
      }

      const org = await storage.getOrganizationById(orgId);
      if (org && org.maxMembers) {
        const memberCount = await storage.countOrgMembers(orgId);
        if (memberCount >= org.maxMembers) {
          return res.status(400).json({ error: '该组织已达到最大成员数' });
        }
      }

      const joinRequest = await storage.createJoinRequest({
        orgId,
        userId: req.currentUserId,
        message: message || null,
        inviteCode: code,
        status: 'pending',
      });

      res.json({ data: joinRequest });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.5 GET /api/organizations/:id/join-requests — 获取申请列表 ====================
  app.get("/api/organizations/:id/join-requests", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: '仅组织 owner 或 admin 可查看申请列表' });
      }

      const status = req.query.status as string | undefined;
      const requests = await storage.getJoinRequestsByOrgId(orgId, status);

      res.json({ data: requests });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.6 PUT /api/organizations/:id/join-requests/:requestId — 审批 ====================
  app.put("/api/organizations/:id/join-requests/:requestId", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);
      const requestId = Number(req.params.requestId);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: '仅组织 owner 或 admin 可审批申请' });
      }

      const joinRequest = await storage.getJoinRequestById(requestId);
      if (!joinRequest) {
        return res.status(404).json({ error: '申请不存在' });
      }

      if (joinRequest.status !== 'pending') {
        return res.status(400).json({ error: '该申请已处理' });
      }

      const { status, reviewNote } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status 必须为 approved 或 rejected' });
      }

      const updated = await storage.updateJoinRequest(requestId, {
        status,
        reviewedBy: req.currentUserId,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      });

      if (status === 'approved') {
        let assignedRole = 'member';
        if (joinRequest.inviteCode) {
          const invitation = await storage.getInvitationByCode(joinRequest.inviteCode);
          if (invitation) {
            assignedRole = invitation.role || 'member';
            await storage.incrementInvitationUsedCount(invitation.id);
          }
        }

        await storage.updateUser(joinRequest.userId, {
          orgId,
          role: assignedRole,
          onboardingCompleted: true,
        } as any);

        await storage.createOrgMembership({
          userId: joinRequest.userId,
          orgId,
          role: assignedRole,
        });

        await storage.cancelOtherPendingJoinRequests(joinRequest.userId, orgId, requestId);

        const newUser = await storage.getUserById(joinRequest.userId);
        if (newUser) {
          const pendingProfiles = await storage.getPendingProfilesByOrg(orgId);
          let suggestedProfile = null;
          for (const profile of pendingProfiles) {
            if (profile.email && newUser.email && profile.email.toLowerCase() === newUser.email.toLowerCase()) {
              suggestedProfile = profile;
              break;
            }
            if (profile.fullName === newUser.displayName) {
              suggestedProfile = profile;
              break;
            }
            let aliases: string[] = [];
            try { aliases = profile.aliases ? JSON.parse(profile.aliases) : []; } catch {}
            if (aliases.some((alias: string) => alias.toLowerCase() === newUser.displayName.toLowerCase())) {
              suggestedProfile = profile;
              break;
            }
          }
          if (suggestedProfile) {
            return res.json({ data: { ...updated, suggestedProfile } });
          }
        }
      }

      res.json({ data: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.7 GET /api/organizations/:id/invite-code — 获取邀请码 ====================
  app.get("/api/organizations/:id/invite-code", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: '仅组织 owner 或 admin 可查看邀请码' });
      }

      const orgInvitations = await storage.getOrgInvitations(orgId);
      if (orgInvitations.length === 0) {
        return res.status(404).json({ error: '该组织没有活跃的邀请码' });
      }

      const latest = orgInvitations[0];
      res.json({ data: { inviteCode: latest.inviteCode, createdAt: latest.createdAt, maxUses: latest.maxUses, usedCount: latest.usedCount } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== 3.8 POST /api/organizations/:id/invite-code/regenerate — 重新生成 ====================
  app.post("/api/organizations/:id/invite-code/regenerate", authMiddleware, async (req: any, res) => {
    try {
      const orgId = Number(req.params.id);

      const membership = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, orgId);
      if (!membership || membership.role !== 'owner') {
        return res.status(403).json({ error: '仅组织 owner 可重新生成邀请码' });
      }

      await storage.deactivateOrgInvitations(orgId);

      const org = await storage.getOrganizationById(orgId);
      let inviteCode = '';
      for (let i = 0; i < 5; i++) {
        const code = generateInviteCode(org?.name || 'ORG');
        const existing = await storage.getInvitationByCode(code);
        if (!existing) {
          inviteCode = code;
          break;
        }
      }
      if (!inviteCode) {
        inviteCode = generateInviteCode(org?.name || 'ORG') + Math.floor(Math.random() * 100);
      }

      await storage.createInvitation({
        orgId,
        inviteCode,
        role: 'member',
        createdBy: req.currentUserId,
        isActive: true,
        maxUses: 0,
        usedCount: 0,
      });

      res.json({ data: { inviteCode } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations/accept/:code", authMiddleware, async (req: any, res) => {
    try {
      const invitation = await storage.getInvitationByCode(req.params.code);
      if (!invitation || !invitation.isActive) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(410).json({ error: 'Invitation has expired' });
      }
      if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
        return res.status(410).json({ error: 'Invitation has reached maximum uses' });
      }

      const existing = await storage.getOrgMembershipByUserAndOrg(req.currentUserId, invitation.orgId);
      if (existing && existing.isActive) {
        return res.status(409).json({ error: 'You are already a member of this organization' });
      }

      await storage.createOrgMembership({
        userId: req.currentUserId,
        orgId: invitation.orgId,
        role: invitation.role,
        isActive: true,
      });

      await storage.incrementInvitationUsedCount(invitation.id);

      const user = await storage.switchActiveOrg(req.currentUserId, invitation.orgId);
      const org = await storage.getOrganizationById(invitation.orgId);
      const token = generateToken({ userId: req.currentUserId, orgId: invitation.orgId, role: invitation.role });

      res.json({
        data: {
          token,
          user: {
            id: user!.id, email: user!.email, displayName: user!.displayName,
            role: invitation.role, orgId: invitation.orgId, avatarUrl: user!.avatarUrl,
            orgName: org?.name,
            orgType: org?.type || 'project',
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===================== Organizations =====================
  app.get("/api/organizations", authMiddleware, async (req: any, res) => {
    try {
      const all = await storage.getOrganizations();
      const data = all.filter((o: any) => o.id === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/organizations", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertOrganizationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const org = await storage.createOrganization(parsed.data);
      await storage.createActivityLog({
        orgId: org.id,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "organization",
        entityId: org.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: org });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/organizations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id !== req.orgId) return res.status(403).json({ error: "Cannot modify another organization" });
      const existing = await storage.getOrganizationById(id);
      if (!existing) return res.status(404).json({ error: "Organization not found" });
      const updated = await storage.updateOrganization(id, req.body);
      await storage.createActivityLog({
        orgId: id,
        userId: req.currentUserId,
        entityType: "organization",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Departments =====================
  app.get("/api/departments", authMiddleware, async (req: any, res) => {
    try {
      const all = await storage.getDepartments();
      const data = all.filter((d: any) => d.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/departments", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertDepartmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const dept = await storage.createDepartment(parsed.data);
      await storage.createActivityLog({
        orgId: dept.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: dept.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: dept });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/departments/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDepartmentById(id);
      if (!existing) return res.status(404).json({ error: "Department not found" });
      const updated = await storage.updateDepartment(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/departments/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDepartmentById(id);
      if (!existing) return res.status(404).json({ error: "Department not found" });
      await storage.deleteDepartment(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, name: existing.name }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Department Stats =====================
  app.get("/api/departments/stats", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const tasks = allTasks.filter((t: any) => t.orgId === req.orgId);
      const allUsers = await storage.getUsers();
      const orgUsers = allUsers.filter((u: any) => u.orgId === req.orgId);
      const now = new Date();
      const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const deptStatsMap: Record<number, { total: number; active: number; done: number; overdue: number; dueSoon: number; blocked: number; urged: number }> = {};

      const userDeptMap: Record<number, number> = {};
      for (const u of orgUsers) {
        if (u.deptId) userDeptMap[u.id] = u.deptId;
      }

      for (const task of tasks) {
        const deptId = task.assigneeId ? userDeptMap[task.assigneeId] : undefined;
        if (!deptId) continue;

        if (!deptStatsMap[deptId]) {
          deptStatsMap[deptId] = { total: 0, active: 0, done: 0, overdue: 0, dueSoon: 0, blocked: 0, urged: 0 };
        }
        const s = deptStatsMap[deptId];
        s.total++;
        if (task.status === "done") { s.done++; }
        else if (task.status === "in_progress" || task.status === "todo") { s.active++; }
        if (task.status === "blocked") { s.blocked++; }
        if (task.status !== "done" && task.status !== "cancelled" && task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < now) { s.overdue++; s.urged++; }
          else if (due < soon) { s.dueSoon++; }
        }
      }

      return res.json(deptStatsMap);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== User Stats =====================
  app.get("/api/users/stats", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const tasks = allTasks.filter((t: any) => t.orgId === req.orgId);
      const now = new Date();
      const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const userStatsMap: Record<number, { total: number; active: number; done: number; overdue: number; dueSoon: number; blocked: number; urged: number }> = {};

      for (const task of tasks) {
        if (!task.assigneeId) continue;
        const uid = task.assigneeId;
        if (!userStatsMap[uid]) {
          userStatsMap[uid] = { total: 0, active: 0, done: 0, overdue: 0, dueSoon: 0, blocked: 0, urged: 0 };
        }
        const s = userStatsMap[uid];
        s.total++;
        if (task.status === "done") { s.done++; }
        else if (task.status === "in_progress" || task.status === "todo") { s.active++; }
        if (task.status === "blocked") { s.blocked++; }
        if (task.status !== "done" && task.status !== "cancelled" && task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < now) { s.overdue++; s.urged++; }
          else if (due < soon) { s.dueSoon++; }
        }
      }

      return res.json(userStatsMap);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Users =====================
  app.get("/api/users", authMiddleware, async (req: any, res) => {
    try {
      const all = await storage.getUsers();
      const data = all.filter((u: any) => u.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const user = await storage.createUser(parsed.data);
      await storage.createActivityLog({
        orgId: user.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: user.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: user });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const updated = await storage.deleteUser(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, displayName: existing.displayName }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Projects =====================
  app.get("/api/projects", authMiddleware, async (req: any, res) => {
    try {
      const projects = await storage.getProjects();
      const users = await storage.getUsers();
      const departments = await storage.getDepartments();
      const allTasks = await storage.getTasks({});
      const orgProjects = projects.filter((p: any) => p.orgId === req.orgId);
      const data = orgProjects.map(p => {
        const projectTasks = allTasks.filter((t: any) => t.projectId === p.id);
        const taskCount = projectTasks.length;
        const doneCount = projectTasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
        return {
          ...p,
          owner: users.find(u => u.id === p.ownerId) || null,
          department: departments.find(d => d.id === p.deptId) || null,
          taskCount,
          doneCount,
        };
      });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProjectById(id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (project.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });
      const tasks = await storage.getTasks({ projectId: id });
      return res.json({ data: { ...project, tasks } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const project = await storage.createProject(parsed.data);
      await storage.createActivityLog({
        orgId: project.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "project",
        entityId: project.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: project });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });
      const updated = await storage.updateProject(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "project",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      if (req.body.status && req.body.status !== existing.status) {
        const triggerUserId = getActivityUserId(req.body, req.currentUserId);
        const triggerUser = await storage.getUserById(triggerUserId);
        const triggerName = triggerUser?.displayName || '某人';
        const statusLabels: Record<string, string> = {
          active: '进行中', paused: '已暂停', completed: '已完成', archived: '已归档'
        };
        const newStatusLabel = statusLabels[req.body.status] || req.body.status;
        await generateTeamNotifications(
          triggerUserId, 'project', id, existing.name, existing.orgId,
          req.body.status === 'completed' ? 'completed' : 'status_change',
          `${triggerName} 将项目「${existing.name}」状态更改为「${newStatusLabel}」`
        );
      }
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });

      const triggerUserId = getActivityUserId(req.body, req.currentUserId);
      const recipientIds = new Set<number>();
      if (existing.ownerId !== triggerUserId) recipientIds.add(existing.ownerId);
      const projectTasks = await storage.getTasks({ projectId: id });
      for (const t of projectTasks) {
        if (t.assigneeId && t.assigneeId !== triggerUserId) recipientIds.add(t.assigneeId);
        if (t.creatorId !== triggerUserId) recipientIds.add(t.creatorId);
      }
      const triggerUser = await storage.getUserById(triggerUserId);
      if (triggerUser && recipientIds.size > 0) {
        const allUsers = await storage.getUsers();
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggerUserId);
        for (const o of ownerUsers) recipientIds.add(o.id);
      }

      await storage.deleteProject(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: triggerUserId,
        entityType: "project",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, name: existing.name }),
        source: "manual",
      });

      if (recipientIds.size > 0) {
        const triggerName = triggerUser?.displayName || '某人';
        const notifs = Array.from(recipientIds).map(userId => ({
          orgId: existing.orgId,
          userId,
          type: 'deleted' as const,
          entityType: 'project' as const,
          entityId: id,
          entityTitle: existing.name,
          message: `${triggerName} 删除了项目「${existing.name}」`,
          triggeredBy: triggerUserId,
          isRead: false,
        }));
        await storage.createManyNotifications(notifs);
      }

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Tasks =====================
  app.get("/api/tasks", authMiddleware, async (req: any, res) => {
    try {
      const filters: { projectId?: number; assigneeId?: number; status?: string[]; parentTaskId?: number | null } = {};

      if (req.query.projectId) filters.projectId = parseInt(req.query.projectId as string);
      if (req.query.assigneeId) filters.assigneeId = parseInt(req.query.assigneeId as string);
      if (req.query.status) filters.status = (req.query.status as string).split(",");
      if (req.query.parentTaskId !== undefined) {
        const val = req.query.parentTaskId as string;
        filters.parentTaskId = val === "null" ? null : parseInt(val);
      }

      const allTasks = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
      const tasksData = allTasks.filter((t: any) => t.orgId === req.orgId);
      const taskIds = tasksData.map(t => t.id);
      const allParticipants = await storage.getTaskParticipantsByTaskIds(taskIds);
      const allUsers = await storage.getUsers();
      const data = tasksData.map(t => ({
        ...t,
        participants: allParticipants
          .filter(p => p.taskId === t.id)
          .map(p => ({ ...p, user: allUsers.find(u => u.id === p.userId) || null })),
      }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });
      const [subtasks, dependencies, comments, participantsRaw] = await Promise.all([
        storage.getTasks({ parentTaskId: id }),
        storage.getTaskDependencies(id),
        storage.getTaskComments(id),
        storage.getTaskParticipants(id),
      ]);
      const allUsers = await storage.getUsers();
      const participants = participantsRaw.map(p => ({
        ...p,
        user: allUsers.find(u => u.id === p.userId) || null,
      }));
      return res.json({ data: { ...task, subtasks, dependencies, comments, participants } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertTaskSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const task = await storage.createTask(parsed.data);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: task.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: task });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });
      const updated = await storage.updateTask(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      if (req.body.status && req.body.status !== existing.status) {
        const triggerUserId = getActivityUserId(req.body, req.currentUserId);
        const statusLabels: Record<string, string> = {
          todo: '待办', in_progress: '进行中', in_review: '审核中', done: '已完成', cancelled: '已取消'
        };
        const newStatusLabel = statusLabels[req.body.status] || req.body.status;
        const triggerUser = await storage.getUserById(triggerUserId);
        const triggerName = triggerUser?.displayName || '某人';
        await generateTeamNotifications(
          triggerUserId, 'task', id, existing.title, existing.orgId,
          req.body.status === 'done' ? 'completed' : 'status_change',
          `${triggerName} 将任务「${existing.title}」状态更改为「${newStatusLabel}」`
        );
      }
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });

      const triggerUserId = getActivityUserId(req.body, req.currentUserId);
      const participants = await storage.getTaskParticipants(id);
      const recipientIds = new Set<number>();
      if (existing.assigneeId && existing.assigneeId !== triggerUserId) recipientIds.add(existing.assigneeId);
      if (existing.creatorId !== triggerUserId) recipientIds.add(existing.creatorId);
      for (const p of participants) {
        if (p.userId !== triggerUserId) recipientIds.add(p.userId);
      }
      const triggerUser = await storage.getUserById(triggerUserId);
      if (triggerUser && recipientIds.size > 0) {
        const allUsers = await storage.getUsers();
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggerUserId);
        for (const o of ownerUsers) recipientIds.add(o.id);
      }

      await storage.deleteTask(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: triggerUserId,
        entityType: "task",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, title: existing.title }),
        source: "manual",
      });

      if (recipientIds.size > 0) {
        const triggerName = triggerUser?.displayName || '某人';
        const notifs = Array.from(recipientIds).map(userId => ({
          orgId: existing.orgId,
          userId,
          type: 'deleted' as const,
          entityType: 'task' as const,
          entityId: id,
          entityTitle: existing.title,
          message: `${triggerName} 删除了任务「${existing.title}」`,
          triggeredBy: triggerUserId,
          isRead: false,
        }));
        await storage.createManyNotifications(notifs);
      }

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Dependencies =====================
  app.get("/api/tasks/:id/dependencies", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getTaskDependencies(id);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/task-dependencies", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertTaskDependencySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const dep = await storage.createTaskDependency(parsed.data);
      const task = await storage.getTaskById(dep.taskId);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_dependency",
        entityId: dep.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: dep });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/task-dependencies/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTaskById(id);
      await storage.deleteTaskDependency(id);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_dependency",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Comments =====================
  app.get("/api/tasks/:id/comments", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getTaskComments(id);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/comments", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const body = { ...req.body, taskId };
      const parsed = insertTaskCommentSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const comment = await storage.createTaskComment(parsed.data);
      const task = await storage.getTaskById(taskId);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_comment",
        entityId: comment.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: comment });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Participants =====================
  app.get("/api/tasks/:id/participants", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const participants = await storage.getTaskParticipants(taskId);
      const users = await storage.getUsers();
      const data = participants.map(p => ({
        ...p,
        user: users.find(u => u.id === p.userId) || null,
      }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/participants", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const parsed = insertTaskParticipantSchema.safeParse({ ...req.body, taskId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const participant = await storage.addTaskParticipant(parsed.data);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: taskId,
        action: "add_participant",
        changes: JSON.stringify({ userId: parsed.data.userId, role: parsed.data.role }),
        source: "manual",
      });
      return res.status(201).json({ data: participant });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:taskId/participants/:userId", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const userId = parseInt(req.params.userId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      await storage.removeTaskParticipantByTaskAndUser(taskId, userId);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: taskId,
        action: "remove_participant",
        changes: JSON.stringify({ userId }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Deliverables =====================
  const express = (await import('express')).default;
  app.use('/uploads', express.static('uploads'));

  const multer = (await import('multer')).default;
  const pathModule = await import('path');
  const uploadStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, 'uploads/'),
    filename: (_req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = pathModule.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  });
  const upload = multer({ storage: uploadStorage, limits: { fileSize: 50 * 1024 * 1024 } });

  app.post("/api/tasks/:taskId/deliverables", upload.single('file'), async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const orgId = req.orgId || task.orgId;
      const userId = req.currentUserId;
      if (task.orgId !== orgId) return res.status(403).json({ error: "无权访问该任务" });

      let deliverableData: any = {
        taskId,
        orgId,
        submittedBy: userId,
      };

      if (req.file) {
        deliverableData.type = 'file';
        deliverableData.title = req.body.title || req.file.originalname;
        deliverableData.description = req.body.description || null;
        deliverableData.fileUrl = `/uploads/${req.file.filename}`;
        deliverableData.fileName = req.file.originalname;
        deliverableData.fileSize = req.file.size;
        deliverableData.fileMimeType = req.file.mimetype;
      } else {
        const { type, title, description, linkUrl, content } = req.body;
        if (!type || !title) return res.status(400).json({ error: "type 和 title 为必填项" });
        deliverableData.type = type;
        deliverableData.title = title;
        deliverableData.description = description || null;
        if (type === 'link') deliverableData.linkUrl = linkUrl;
        if (type === 'text') deliverableData.content = content;
      }

      const existing = await storage.getDeliverablesByTaskId(taskId);
      const sameTitle = existing.filter(d => d.title === deliverableData.title && d.type === deliverableData.type);
      const maxVersion = sameTitle.length > 0 ? Math.max(...sameTitle.map(d => d.version)) : 0;
      deliverableData.version = maxVersion + 1;

      if (maxVersion > 0) {
        await storage.markPreviousVersions(taskId, deliverableData.type, deliverableData.title);
      }

      const deliverable = await storage.createDeliverable(deliverableData);

      await storage.createActivityLog({
        orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: "add_deliverable",
        changes: JSON.stringify({ deliverableId: deliverable.id, type: deliverable.type, title: deliverable.title }),
        source: "manual",
      });

      return res.json({ data: deliverable });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:taskId/deliverables/from-chat", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { messageId, title, format } = req.body;
      const userId = req.currentUserId;
      const orgId = req.orgId;

      if (!messageId) return res.status(400).json({ error: "messageId 为必填项" });

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });
      if (task.orgId !== orgId) return res.status(403).json({ error: "无权访问该任务" });

      const isAssignee = task.assigneeId === userId;
      const isCreator = task.creatorId === userId;
      const userRole = req.userRole;
      const isAdminOrOwner = userRole === 'owner' || userRole === 'admin';
      if (!isAssignee && !isCreator && !isAdminOrOwner) {
        return res.status(403).json({ error: "只有任务的指派人、创建者或管理员可以操作" });
      }

      const chatMessage = await storage.getChatMessageById(messageId);
      if (!chatMessage) return res.status(404).json({ error: "聊天消息不存在" });

      const conversation = await storage.getConversationById(chatMessage.conversationId);
      if (!conversation || conversation.orgId !== orgId || conversation.userId !== userId) {
        return res.status(403).json({ error: "无权访问该聊天消息" });
      }

      const content = chatMessage.content;
      const deliverableTitle = title || content.slice(0, 30).replace(/\n/g, ' ') || 'AI 生成内容';

      const existing = await storage.getDeliverablesByTaskId(taskId);
      const sameTitle = existing.filter(d => d.title === deliverableTitle && d.type === 'text');
      const maxVersion = sameTitle.length > 0 ? Math.max(...sameTitle.map(d => d.version)) : 0;

      if (maxVersion > 0) {
        await storage.markPreviousVersions(taskId, 'text', deliverableTitle);
      }

      const deliverable = await storage.createDeliverable({
        taskId,
        orgId,
        type: 'text',
        title: deliverableTitle,
        description: `来源: AI 对话 (消息 #${messageId}, 格式: ${format || 'markdown'})`,
        content,
        submittedBy: userId,
        version: maxVersion + 1,
      });

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: "task",
        entityId: taskId,
        action: "add_deliverable",
        changes: JSON.stringify({ deliverableId: deliverable.id, type: 'text', title: deliverableTitle, source: 'ai_chat', messageId }),
        source: "ai",
      });

      return res.json({ data: deliverable });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:taskId/deliverables", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const onlyLatest = req.query.latest === 'true';
      const data = await storage.getDeliverablesByTaskId(taskId, onlyLatest);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:taskId/deliverables/:id", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const id = parseInt(req.params.id);
      const deliverable = await storage.getDeliverableById(id);
      if (!deliverable) return res.status(404).json({ error: "交付物不存在" });
      if (deliverable.taskId !== taskId) return res.status(400).json({ error: "交付物不属于该任务" });

      const userId = req.currentUserId;
      const orgId = req.orgId;
      const user = await storage.getUserById(userId);
      if (deliverable.submittedBy !== userId && user?.role !== 'owner' && user?.role !== 'admin') {
        return res.status(403).json({ error: "无权删除该交付物" });
      }

      if (deliverable.fileUrl) {
        try {
          const fs = await import('fs');
          const filePath = (await import('path')).join(process.cwd(), deliverable.fileUrl);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      await storage.deleteDeliverable(id);

      await storage.createActivityLog({
        orgId: orgId || deliverable.orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: "delete_deliverable",
        changes: JSON.stringify({ deliverableId: id, title: deliverable.title }),
        source: "manual",
      });

      return res.json({ data: { success: true } });
    } catch (e: any) {
      if (e.message.includes('已关联')) return res.status(400).json({ error: e.message });
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Submissions =====================
  app.post("/api/tasks/:taskId/submissions", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const userId = req.currentUserId;
      const orgId = req.orgId || task.orgId;

      if (task.assigneeId !== userId) {
        return res.status(403).json({ error: "只有任务负责人才能提交审核" });
      }

      if (!['in_progress', 'revision_requested'].includes(task.status)) {
        return res.status(400).json({ error: `当前任务状态为「${task.status}」，只有「进行中」或「需要修改」的任务可以提交审核` });
      }

      const { note, deliverableIds } = req.body;
      if (!deliverableIds || !Array.isArray(deliverableIds) || deliverableIds.length === 0) {
        return res.status(400).json({ error: "请选择至少一个交付物" });
      }

      const deliverables = await storage.getDeliverablesByTaskId(taskId);
      const validIds = new Set(deliverables.map(d => d.id));
      const invalidIds = deliverableIds.filter((id: number) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `以下交付物不属于该任务: ${invalidIds.join(', ')}` });
      }

      const submission = await storage.createSubmission({
        taskId,
        orgId,
        submittedBy: userId,
        note: note || null,
        deliverableIds,
        status: 'pending',
      });

      await storage.updateTask(taskId, { status: 'submitted' } as any);

      await storage.createActivityLog({
        orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: "submit_for_review",
        changes: JSON.stringify({ submissionId: submission.id, deliverableCount: deliverableIds.length }),
        source: "manual",
      });

      return res.json({ data: submission });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:taskId/submissions", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const data = await storage.getSubmissionsByTaskId(taskId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/organizations/:orgId/pending-reviews", authMiddleware, async (req: any, res) => {
    try {
      const orgId = parseInt(req.params.orgId);
      const userId = req.currentUserId;
      const user = await storage.getUserById(userId);
      if (!user || (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'head')) {
        return res.status(403).json({ error: "无权查看待审核列表" });
      }

      const data = await storage.getPendingSubmissionsByOrgId(orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/tasks/:taskId/submissions/:submissionId/review", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const submissionId = parseInt(req.params.submissionId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "任务不存在" });

      const userId = req.currentUserId;
      const user = await storage.getUserById(userId);
      if (!user || (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'head')) {
        return res.status(403).json({ error: "无权审核" });
      }

      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) return res.status(404).json({ error: "提交记录不存在" });
      if (submission.taskId !== taskId) return res.status(400).json({ error: "提交记录不属于该任务" });
      if (submission.status !== 'pending') return res.status(400).json({ error: "该提交已被审核" });

      const { status, reviewNote, overallScore } = req.body;
      if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
        return res.status(400).json({ error: "无效的审核状态" });
      }

      const updated = await storage.updateSubmission(submissionId, {
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
        overallScore: overallScore || null,
      });

      if (status === 'approved') {
        await storage.updateTask(taskId, { status: 'done', completedAt: new Date() } as any);
      } else if (status === 'rejected' || status === 'revision_requested') {
        await storage.updateTask(taskId, { status: 'in_progress' } as any);
      }

      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, userId),
        entityType: "task",
        entityId: taskId,
        action: status === 'approved' ? 'approve_submission' : status === 'rejected' ? 'reject_submission' : 'request_revision',
        changes: JSON.stringify({ submissionId, status, score: overallScore }),
        source: "manual",
      });

      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Activity Logs =====================
  app.get("/api/activity-logs", authMiddleware, async (req: any, res) => {
    try {
      const filters: { entityType?: string; entityId?: number } = {};
      if (req.query.entityType) filters.entityType = req.query.entityType as string;
      if (req.query.entityId) filters.entityId = parseInt(req.query.entityId as string);
      const allLogs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      const data = allLogs.filter((l: any) => l.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Graph Visualization =====================
  app.get("/api/graph/data", authMiddleware, async (req: any, res) => {
    try {
      const { projectId, deptId, status } = req.query;

      const projectColors = [
        '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
      ];

      const defaultDeptColor = '#9ca3af';

      // Get all tasks with filters
      const taskFilters: any = {};
      if (projectId) taskFilters.projectId = parseInt(projectId as string);
      if (status) {
        // status is comma-separated
      }

      const rawTasks = await storage.getTasks(taskFilters);
      const allTasks = rawTasks.filter((t: any) => t.orgId === req.orgId);
      
      // Get all projects for color mapping
      const rawProjects = await storage.getProjects();
      const allProjects = rawProjects.filter((p: any) => p.orgId === req.orgId);
      const projectMap = new Map(allProjects.map(p => [p.id, p]));

      // Get all departments for color mapping
      const rawDepartments = await storage.getDepartments();
      const allDepartments = rawDepartments.filter((d: any) => d.orgId === req.orgId);
      const deptMap = new Map(allDepartments.map(d => [d.id, d]));

      // Get all users for assignee names
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      // Get all dependencies
      const allDeps = await storage.getAllTaskDependencies();

      // Filter by status if provided
      const statusFilter = status ? (status as string).split(',') : null;

      // Filter: only top-level tasks (parentTaskId === null), apply filters
      let filteredTasks = allTasks.filter(t => t.parentTaskId === null);
      if (deptId) {
        const deptIdNum = parseInt(deptId as string);
        const projectsInDept = allProjects.filter(p => p.deptId === deptIdNum).map(p => p.id);
        filteredTasks = filteredTasks.filter(t => projectsInDept.includes(t.projectId));
      }
      if (statusFilter) {
        filteredTasks = filteredTasks.filter(t => statusFilter.includes(t.status));
      }

      // Check which tasks have subtasks
      const tasksWithSubtasks = new Set(
        allTasks.filter(t => t.parentTaskId !== null).map(t => t.parentTaskId)
      );

      const now = new Date();
      const filteredIds = new Set(filteredTasks.map(t => t.id));

      const projectColorMap = new Map<number, string>();
      const projectIds = Array.from(new Set(filteredTasks.map(t => t.projectId)));
      projectIds.forEach((pid, idx) => {
        projectColorMap.set(pid, projectColors[idx % projectColors.length]);
      });

      const nodes = filteredTasks.map(t => {
        const project = projectMap.get(t.projectId);
        const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
        const nodeDeptId = project?.deptId ?? null;
        const dept = nodeDeptId ? deptMap.get(nodeDeptId) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          weight: t.weight,
          progress: t.progress,
          projectId: t.projectId,
          projectName: project?.name ?? '',
          projectColor: projectColorMap.get(t.projectId) ?? defaultDeptColor,
          deptId: nodeDeptId,
          deptColor: dept?.color ?? defaultDeptColor,
          assigneeId: t.assigneeId,
          assigneeName: assignee?.displayName ?? null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isOverdue: !!(t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'),
          type: t.type,
          parentTaskId: t.parentTaskId,
          hasSubtasks: tasksWithSubtasks.has(t.id),
        };
      });

      // Build a map of task statuses for isBlocking calculation
      const taskStatusMap = new Map(allTasks.map(t => [t.id, t.status]));

      const links = allDeps
        .filter(d => filteredIds.has(d.taskId) && filteredIds.has(d.dependsOnTaskId))
        .map(d => ({
          source: d.dependsOnTaskId,
          target: d.taskId,
          type: d.type,
          isBlocking: taskStatusMap.get(d.dependsOnTaskId) !== 'done',
        }));

      const projectsUsed = Array.from(new Set(filteredTasks.map(t => t.projectId)));
      const projectsInfo = projectsUsed.map((pid, idx) => ({
        id: pid,
        name: projectMap.get(pid)?.name ?? '',
        color: projectColors[idx % projectColors.length],
      }));

      const deptIds = new Set(nodes.map(n => n.deptId).filter(Boolean));
      const departmentsInfo = Array.from(deptIds).map(did => {
        const d = deptMap.get(did!);
        return { id: did!, name: d?.name ?? '', color: d?.color ?? defaultDeptColor };
      });

      return res.json({ data: { nodes, links, projects: projectsInfo, departments: departmentsInfo } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/graph/subtasks/:taskId", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const allTasks = await storage.getTasks({ parentTaskId: taskId });
      const allProjects = await storage.getProjects();
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const allDeps = await storage.getAllTaskDependencies();
      const allTasksAll = await storage.getTasks({});
      const tasksWithSubtasks = new Set(
        allTasksAll.filter(t => t.parentTaskId !== null).map(t => t.parentTaskId)
      );
      const now = new Date();
      const subtaskIds = new Set(allTasks.map(t => t.id));
      const taskStatusMap = new Map(allTasksAll.map(t => [t.id, t.status]));

      const nodes = allTasks.map(t => {
        const project = projectMap.get(t.projectId);
        const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          weight: t.weight,
          progress: t.progress,
          projectId: t.projectId,
          projectName: project?.name ?? '',
          deptId: project?.deptId ?? null,
          assigneeId: t.assigneeId,
          assigneeName: assignee?.displayName ?? null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isOverdue: !!(t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'),
          type: t.type,
          parentTaskId: t.parentTaskId,
          hasSubtasks: tasksWithSubtasks.has(t.id),
        };
      });

      const links = allDeps
        .filter(d => subtaskIds.has(d.taskId) && subtaskIds.has(d.dependsOnTaskId))
        .map(d => ({
          source: d.dependsOnTaskId,
          target: d.taskId,
          type: d.type,
          isBlocking: taskStatusMap.get(d.dependsOnTaskId) !== 'done',
        }));

      const projectColors = [
        '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
      ];
      const projectsUsed = Array.from(new Set(allTasks.map(t => t.projectId)));
      const projectsInfo = projectsUsed.map((pid, idx) => ({
        id: pid,
        name: projectMap.get(pid)?.name ?? '',
        color: projectColors[idx % projectColors.length],
      }));

      return res.json({ data: { nodes, links, projects: projectsInfo } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Cross-Department Collaboration Health =====================
  app.get("/api/graph/collaboration-health", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const allProjects = await storage.getProjects();
      const allUsers = await storage.getUsers();
      const allDepartments = await storage.getDepartments();

      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const userDeptMap = new Map<number, number | null>();
      for (const u of allUsers) {
        userDeptMap.set(u.id, u.deptId ?? null);
      }

      const crossDeptPairs = new Map<string, {
        deptA: number;
        deptB: number;
        total: number;
        completed: number;
        overdue: number;
        blocked: number;
        active: number;
      }>();

      const now = new Date();

      for (const task of allTasks) {
        const project = projectMap.get(task.projectId);
        const projectDeptId = project?.deptId ?? null;
        const assigneeDeptId = task.assigneeId ? userDeptMap.get(task.assigneeId) ?? null : null;

        if (projectDeptId === null || assigneeDeptId === null) continue;
        if (projectDeptId === assigneeDeptId) continue;

        const dA = Math.min(projectDeptId, assigneeDeptId);
        const dB = Math.max(projectDeptId, assigneeDeptId);
        const key = `${dA}-${dB}`;

        if (!crossDeptPairs.has(key)) {
          crossDeptPairs.set(key, { deptA: dA, deptB: dB, total: 0, completed: 0, overdue: 0, blocked: 0, active: 0 });
        }
        const pair = crossDeptPairs.get(key)!;
        pair.total++;

        if (task.status === 'done') pair.completed++;
        if (task.status === 'blocked') pair.blocked++;
        if (task.status !== 'done' && task.status !== 'cancelled') pair.active++;
        if (task.dueDate && task.dueDate < now && task.status !== 'done' && task.status !== 'cancelled') pair.overdue++;
      }

      const results = Array.from(crossDeptPairs.values()).map(pair => {
        const volumeScore = Math.min(pair.total / 10, 1);
        const completionScore = pair.total > 0 ? pair.completed / pair.total : 0;
        const timelinessScore = pair.total > 0 ? 1 - (pair.overdue / pair.total) : 1;
        const flowScore = pair.active > 0 ? 1 - (pair.blocked / pair.active) : 1;

        const healthScore = 0.15 * volumeScore + 0.30 * completionScore + 0.25 * timelinessScore + 0.30 * flowScore;

        return {
          deptA: pair.deptA,
          deptB: pair.deptB,
          healthScore: Math.round(healthScore * 1000) / 1000,
          taskCount: pair.total,
          metrics: {
            volume: Math.round(volumeScore * 1000) / 1000,
            completion: Math.round(completionScore * 1000) / 1000,
            timeliness: Math.round(timelinessScore * 1000) / 1000,
            flow: Math.round(flowScore * 1000) / 1000,
          },
        };
      });

      const deptIds = new Set<number>();
      results.forEach(r => { deptIds.add(r.deptA); deptIds.add(r.deptB); });
      const deptMap = new Map(allDepartments.map(d => [d.id, d]));
      const allDeptIds = new Set(allDepartments.map(d => d.id));

      allDeptIds.forEach(id => deptIds.add(id));

      for (const dA of deptIds) {
        for (const dB of deptIds) {
          if (dA >= dB) continue;
          const key = `${dA}-${dB}`;
          if (!crossDeptPairs.has(key)) {
            results.push({
              deptA: dA,
              deptB: dB,
              healthScore: 0.55,
              taskCount: 0,
              metrics: { volume: 0, completion: 0, timeliness: 1, flow: 1 },
            });
          }
        }
      }

      return res.json({ data: results });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/graph/ai-analysis", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const allDeps = await storage.getAllTaskDependencies();
      const allUsers = await storage.getUsers();
      const allProjects = await storage.getProjects();

      const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
      const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.email || `User ${u.id}`]));
      const projectMap = new Map(allProjects.map(p => [p.id, p.name]));

      const depsByTask = new Map<number, number[]>();
      for (const dep of allDeps) {
        if (!depsByTask.has(dep.taskId)) depsByTask.set(dep.taskId, []);
        depsByTask.get(dep.taskId)!.push(dep.dependsOnTaskId);
      }

      const taskSummaries = activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress ?? 0,
        assignee: t.assigneeId ? userMap.get(t.assigneeId) || 'Unknown' : 'Unassigned',
        project: projectMap.get(t.projectId) || 'Unknown',
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
        isOverdue: t.dueDate ? new Date(t.dueDate) < new Date() : false,
        dependsOn: depsByTask.get(t.id) || [],
        blocksOthers: allDeps.filter(d => d.dependsOnTaskId === t.id).map(d => d.taskId),
      }));

      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        baseURL: 'https://api.anthropic.com/v1/',
        apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
        timeout: 30000,
      });

      const systemPrompt = `You are a project management analyst. Analyze the following active tasks and identify:

1. **followUp**: Tasks that most urgently need follow-up action (e.g., overdue, stalled, low progress with approaching deadline)
2. **important**: The most strategically important tasks (e.g., milestones, high-weight tasks, tasks that many others depend on)
3. **bottleneck**: Tasks that are blocking progress or are bottleneck/chokepoints (e.g., blocked tasks, tasks with many downstream dependencies that are not progressing)

Today's date: ${new Date().toISOString().split('T')[0]}

Return a JSON object with exactly this structure (no markdown, no code fence):
{
  "followUp": [{ "id": <taskId>, "reason": "<brief reason in Chinese>" }],
  "important": [{ "id": <taskId>, "reason": "<brief reason in Chinese>" }],
  "bottleneck": [{ "id": <taskId>, "reason": "<brief reason in Chinese>" }]
}

Each array should have 2-5 items. A task can appear in multiple categories. Keep reasons concise (under 20 chars).`;

      const response = await client.chat.completions.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(taskSummaries, null, 2) },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
      const analysis = JSON.parse(cleaned);

      return res.json({ data: analysis });
    } catch (e: any) {
      console.error('AI graph analysis error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Job Roles =====================
  app.get("/api/job-roles", authMiddleware, async (req: any, res) => {
    try {
      const allRoles = await storage.getJobRoles();
      const data = allRoles.filter((r: any) => r.orgId === req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-roles", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertJobRoleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const role = await storage.createJobRole(parsed.data);
      await storage.createActivityLog({
        orgId: role.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: role.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: role });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/job-roles/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobRoleById(id);
      if (!existing) return res.status(404).json({ error: "Job role not found" });
      const updated = await storage.updateJobRole(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/job-roles/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobRoleById(id);
      if (!existing) return res.status(404).json({ error: "Job role not found" });
      await storage.deleteJobRole(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, title: existing.title }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id/job-role", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const { jobRoleId } = req.body;
      const updated = await storage.updateUser(id, { jobRoleId });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "assign_job_role",
        changes: JSON.stringify({ jobRoleId }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Verdicts =====================
  app.post("/api/verdicts/judge", authMiddleware, async (req: any, res) => {
    try {
      const { taskId, userId, requestedBy } = req.body;
      if (!taskId || !userId) return res.status(400).json({ error: "taskId and userId are required" });

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });

      const orgId = req.orgId;
      const reqUserId = requestedBy || req.currentUserId;
      const verdictResult = await judgeTaskAssignment(taskId, userId, req.orgId);

      const verdict = await storage.createVerdict({
        orgId,
        taskId,
        userId,
        verdict: verdictResult.verdict,
        confidence: verdictResult.confidence,
        reasoning: verdictResult.reasoning,
        matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
        suggestedAssignee: verdictResult.suggestedAssigneeId,
        suggestedReason: verdictResult.suggestedReason,
        requestedBy: reqUserId,
        status: 'completed',
      });

      if (verdictResult.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(verdictResult.tokenUsage.model, verdictResult.tokenUsage.promptTokens, verdictResult.tokenUsage.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: reqUserId,
            model: verdictResult.tokenUsage.model,
            promptTokens: verdictResult.tokenUsage.promptTokens,
            completionTokens: verdictResult.tokenUsage.completionTokens,
            totalTokens: verdictResult.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'verdict',
          });
        } catch (tokenErr) {
          console.error('Failed to record verdict token usage:', tokenErr);
        }
      }

      const suggestedUser = verdictResult.suggestedAssigneeId
        ? await storage.getUserById(verdictResult.suggestedAssigneeId)
        : null;

      await storage.createActivityLog({
        orgId,
        userId: reqUserId,
        entityType: "verdict",
        entityId: verdict.id,
        action: "judge",
        changes: JSON.stringify({ taskId, userId, verdict: verdictResult.verdict }),
        source: "system",
      });

      return res.json({
        data: {
          verdict: {
            id: verdict.id,
            verdict: verdict.verdict,
            confidence: verdict.confidence,
            reasoning: verdict.reasoning,
            matchedResponsibilities: verdictResult.matchedResponsibilities,
            suggestedAssignee: suggestedUser ? {
              id: suggestedUser.id,
              name: suggestedUser.displayName,
              reason: verdictResult.suggestedReason,
            } : undefined,
          },
        },
      });
    } catch (e: any) {
      console.error('Verdict judge error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/verdicts/judge-assignment", authMiddleware, async (req: any, res) => {
    try {
      const { taskId, userId, requestedBy } = req.body;
      if (!taskId || !userId) return res.status(400).json({ error: "taskId and userId are required" });

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });

      const orgId = req.orgId;
      const reqUserId = requestedBy || req.currentUserId;
      const verdictResult = await judgeTaskAssignment(taskId, userId, req.orgId);

      const verdict = await storage.createVerdict({
        orgId,
        taskId,
        userId,
        verdict: verdictResult.verdict,
        confidence: verdictResult.confidence,
        reasoning: verdictResult.reasoning,
        matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
        suggestedAssignee: verdictResult.suggestedAssigneeId,
        suggestedReason: verdictResult.suggestedReason,
        requestedBy: reqUserId,
        status: 'completed',
      });

      if (verdictResult.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(verdictResult.tokenUsage.model, verdictResult.tokenUsage.promptTokens, verdictResult.tokenUsage.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: reqUserId,
            model: verdictResult.tokenUsage.model,
            promptTokens: verdictResult.tokenUsage.promptTokens,
            completionTokens: verdictResult.tokenUsage.completionTokens,
            totalTokens: verdictResult.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'verdict',
          });
        } catch (tokenErr) {
          console.error('Failed to record verdict token usage:', tokenErr);
        }
      }

      return res.json({ data: verdict });
    } catch (e: any) {
      console.error('Verdict judge-assignment error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/task/:taskId", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = await storage.getVerdictsByTaskId(taskId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/user/:userId", authMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const data = await storage.getVerdictsByUserId(userId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/verdicts/:id/accept", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVerdictById(id);
      if (!existing) return res.status(404).json({ error: "Verdict not found" });
      const updated = await storage.updateVerdict(id, { status: 'accepted' });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "verdict",
        entityId: id,
        action: "accept",
        changes: JSON.stringify({ status: 'accepted' }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/verdicts/:id/override", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVerdictById(id);
      if (!existing) return res.status(404).json({ error: "Verdict not found" });
      const { overrideReason } = req.body;
      if (!overrideReason) return res.status(400).json({ error: "overrideReason is required" });
      const updated = await storage.updateVerdict(id, { status: 'overridden', overrideReason });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "verdict",
        entityId: id,
        action: "override",
        changes: JSON.stringify({ status: 'overridden', overrideReason }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/stats", authMiddleware, async (req: any, res) => {
    try {
      const allVerdicts = await storage.getAllVerdicts();
      const allUsers = await storage.getUsers();
      const orgUserIds = new Set(allUsers.filter((u: any) => u.orgId === req.orgId).map(u => u.id));
      const orgVerdicts = allVerdicts.filter(v => orgUserIds.has(v.userId));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const statsByUser: Record<number, { displayName: string; in_scope: number; stretch: number; out_of_scope: number; shared: number; total: number }> = {};

      for (const v of orgVerdicts) {
        if (!statsByUser[v.userId]) {
          const user = userMap.get(v.userId);
          statsByUser[v.userId] = {
            displayName: user?.displayName ?? 'Unknown',
            in_scope: 0,
            stretch: 0,
            out_of_scope: 0,
            shared: 0,
            total: 0,
          };
        }
        const s = statsByUser[v.userId];
        if (v.verdict === 'in_scope') s.in_scope++;
        else if (v.verdict === 'stretch') s.stretch++;
        else if (v.verdict === 'out_of_scope') s.out_of_scope++;
        else if (v.verdict === 'shared') s.shared++;
        s.total++;
      }

      return res.json({ data: Object.entries(statsByUser).map(([userId, stats]) => ({ userId: parseInt(userId), ...stats })) });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Notifications =====================
  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || req.currentUserId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const data = await storage.getNotificationsByUserId(userId, limit);
      const allUsers = await storage.getUsers();
      const enriched = data.map(n => ({
        ...n,
        triggeredByUser: allUsers.find(u => u.id === n.triggeredBy) || null,
      }));
      return res.json({ data: enriched });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || req.currentUserId;
      const count = await storage.getUnreadNotificationCount(userId);
      return res.json({ data: { count } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationRead(id);
      return res.json({ data: notification });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/mark-all-read", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.body.userId || req.currentUserId;
      await storage.markAllNotificationsRead(userId);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Stats Overview =====================
  app.get("/api/stats/overview", authMiddleware, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasks({});
      const tasks = allTasks.filter((t: any) => t.orgId === req.orgId);
      const now = new Date();

      const totalTasks = tasks.length;
      const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
      const completedCount = tasks.filter(t => t.status === "done").length;
      const overdueCount = tasks.filter(t => {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < now;
      }).length;
      const needsReviewCount = tasks.filter(t => t.needsReview).length;
      const decisionStats = await storage.getDecisionTaskStats(req.orgId);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(todayStart);
      const dayOfWeek = weekStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - mondayOffset);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayNew = tasks.filter(t => new Date(t.createdAt) >= todayStart).length;
      const weekNew = tasks.filter(t => new Date(t.createdAt) >= weekStart).length;
      const monthNew = tasks.filter(t => new Date(t.createdAt) >= monthStart).length;

      return res.json({
        data: {
          totalTasks,
          inProgressCount,
          completedCount,
          overdueCount,
          needsReviewCount,
          pendingDecisionCount: decisionStats.pendingCount,
          todayNew,
          weekNew,
          monthNew,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Decision Tasks =====================
  app.get("/api/tasks/:id/decisions", authMiddleware, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
      const task = await storage.getTaskById(taskId);
      if (!task || task.orgId !== req.orgId) {
        return res.status(404).json({ error: "Task not found" });
      }
      const decisions = await storage.getDecisionTasksForTask(taskId);
      return res.json({ data: decisions });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/decision-tasks/pending", authMiddleware, async (req: any, res) => {
    try {
      const pending = await storage.getPendingDecisionTasksForUser(req.currentUserId, req.orgId);
      return res.json({ data: pending });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Conversations =====================
  app.get("/api/conversations", authMiddleware, async (req: any, res) => {
    try {
      const data = await storage.getConversationsByOrg(req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/conversations/search", authMiddleware, async (req: any, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ data: [] });
      const data = await storage.searchConversations(req.orgId, q);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/chat-messages/recent-assistant", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.currentUserId;
      const orgId = req.orgId;
      const limit = parseInt(req.query.limit as string) || 50;

      const userConvs = await storage.getConversationsByUser(orgId, userId);
      const convIds = userConvs.map(c => c.id);

      if (convIds.length === 0) return res.json({ data: [] });

      const allMessages: any[] = [];
      for (const convId of convIds.slice(0, 20)) {
        const msgs = await storage.getChatMessages(convId);
        const assistantMsgs = msgs
          .filter(m => m.role === 'assistant' && m.content && m.content.length > 100)
          .map(m => ({
            id: m.id,
            conversationId: convId,
            content: m.content,
            createdAt: m.createdAt,
            preview: m.content.slice(0, 80).replace(/\n/g, ' '),
          }));
        allMessages.push(...assistantMsgs);
      }

      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ data: allMessages.slice(0, limit) });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/conversations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getConversationById(id);
      if (!data) return res.status(404).json({ error: "Conversation not found" });
      if (data.orgId !== req.orgId) return res.status(403).json({ error: "Access denied" });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations", authMiddleware, async (req: any, res) => {
    try {
      const parsed = insertConversationSchema.parse(req.body);
      const data = await storage.createConversation(parsed);
      return res.json({ data });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/conversations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.updateConversation(id, req.body);
      if (!data) return res.status(404).json({ error: "Conversation not found" });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/conversations/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Chat Messages =====================
  app.get("/api/conversations/:id/messages", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const data = await storage.getChatMessages(conversationId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations/:id/messages", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messageData = { ...req.body, conversationId };
      const parsed = insertChatMessageSchema.parse(messageData);
      const data = await storage.createChatMessage(parsed);
      return res.json({ data });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/conversations/:id/messages/after/:messageId", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const afterMessageId = parseInt(req.params.messageId);
      if (isNaN(conversationId) || isNaN(afterMessageId)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }
      const deletedCount = await storage.deleteChatMessagesAfter(conversationId, afterMessageId);
      return res.json({ data: { deletedCount } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations/:id/messages/truncate", authMiddleware, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { keepCount } = req.body;
      if (isNaN(conversationId) || typeof keepCount !== 'number' || keepCount < 0) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }
      const deletedCount = await storage.truncateChatMessages(conversationId, keepCount);
      return res.json({ data: { deletedCount } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Suggest Task =====================
  app.post("/api/ai/suggest-task", authMiddleware, async (req: any, res) => {
    try {
      const { title, projectId } = req.body;
      const orgId = req.orgId || parseInt(req.headers['x-org-id'] as string) || 1;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }

      let projectInfo = '';
      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (project) {
          projectInfo = `Project: "${project.name}" - ${project.description || 'No description'}. Status: ${project.status}.`;
        }
      }

      const allUsers = await storage.getUsers();
      const orgUsers = allUsers.filter(u => u.orgId === orgId && u.isActive !== false);
      const allJobRoles = await storage.getJobRoles();
      const jobRoleMap = new Map(allJobRoles.map(r => [r.id, r]));

      const allTasks = await storage.getTasks();
      const activeStatuses = ['todo', 'in_progress', 'in_review'];
      const taskCountByUser = new Map<number, number>();
      for (const t of allTasks) {
        if (t.assigneeId && activeStatuses.includes(t.status)) {
          taskCountByUser.set(t.assigneeId, (taskCountByUser.get(t.assigneeId) || 0) + 1);
        }
      }

      const usersContext = orgUsers.map(u => {
        const role = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
        return {
          id: u.id,
          name: u.displayName,
          jobTitle: role?.title || 'N/A',
          responsibilities: role?.responsibilities || 'N/A',
          activeTaskCount: taskCountByUser.get(u.id) || 0,
        };
      });

      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        baseURL: 'https://vip.aipro.love/v1',
        apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
        timeout: 90000,
      });

      const systemPrompt = `You are a project management assistant. Given a task title and team context, suggest appropriate task fields.

${projectInfo}

Team members:
${JSON.stringify(usersContext, null, 2)}

Today's date: ${new Date().toISOString().split('T')[0]}

Based on the task title, return a JSON object (no markdown, no code fence) with:
{
  "description": "<suggested task description in Chinese, 2-3 sentences>",
  "priority": "<one of: low, medium, high, urgent>",
  "assigneeId": <user id number or null if unclear>,
  "assigneeReason": "<brief reason for assignee suggestion in Chinese>",
  "dueDays": <estimated number of days to complete, integer>,
  "confidence": <0.0 to 1.0, your confidence in these suggestions>
}

When choosing assigneeId:
1. Match the task to a user whose job responsibilities are most relevant
2. Among equally relevant users, prefer the one with fewer active tasks
3. If no user clearly matches, set assigneeId to null`;

      const response = await client.chat.completions.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Task title: "${title}"` },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
      const suggestion = JSON.parse(cleaned);

      const dueDays = suggestion.dueDays || 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      return res.json({
        data: {
          description: suggestion.description || '',
          priority: suggestion.priority || 'medium',
          assigneeId: suggestion.assigneeId || null,
          assigneeReason: suggestion.assigneeReason || '',
          dueDate: dueDate.toISOString().split('T')[0],
          confidence: suggestion.confidence || 0.5,
        },
      });
    } catch (e: any) {
      console.error('AI suggest-task error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Suggest Dependencies =====================
  app.post("/api/ai/suggest-dependencies", authMiddleware, async (req: any, res) => {
    try {
      const { taskId } = req.body;
      const orgId = parseInt(req.headers['x-org-id'] as string) || 1;

      if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
      }

      const targetTask = await storage.getTaskById(taskId);
      if (!targetTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const projectTasks = await storage.getTasks({ projectId: targetTask.projectId });
      const otherTasks = projectTasks.filter(t => t.id !== taskId);

      if (otherTasks.length === 0) {
        return res.json({ data: [] });
      }

      const { claudeComplete } = await import('./services/ai/index');

      const taskListStr = otherTasks.map(t =>
        `- ID: ${t.id}, Title: "${t.title}", Status: ${t.status}, Description: "${t.description || 'N/A'}"`
      ).join('\n');

      const prompt = `You are a project management expert. Analyze the following target task and determine which of the other tasks in the same project should be its prerequisites (dependencies that must be completed before the target task can start).

Target Task:
- ID: ${targetTask.id}
- Title: "${targetTask.title}"
- Description: "${targetTask.description || 'N/A'}"

Other tasks in the same project:
${taskListStr}

Return a JSON array of suggested dependencies. Each element should have:
- taskId: number (the ID of the prerequisite task)
- taskTitle: string (the title of the prerequisite task)
- reason: string (brief explanation in Chinese why this should be a prerequisite)
- confidence: number (0-100, how confident you are)

Only suggest tasks that logically should be completed before the target task. If no dependencies are needed, return an empty array.
Return ONLY the JSON array, no other text.`;

      const completion = await claudeComplete({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });

      const raw = completion.content || '[]';
      let suggestions: Array<{ taskId: number; taskTitle: string; reason: string; confidence: number }> = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        suggestions = [];
      }

      const validTaskIds = new Set(otherTasks.map(t => t.id));
      suggestions = suggestions.filter(s => validTaskIds.has(s.taskId));

      return res.json({ data: suggestions });
    } catch (e: any) {
      console.error('AI suggest-dependencies error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Review Submission =====================
  app.post("/api/ai/review-submission", authMiddleware, async (req: any, res) => {
    try {
      const { taskId, submissionId } = req.body;
      const orgId = parseInt(req.headers['x-org-id'] as string) || req.orgId || 1;

      if (!taskId || !submissionId) {
        return res.status(400).json({ error: 'taskId and submissionId are required' });
      }

      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const submission = await storage.getSubmissionById(submissionId);
      if (!submission) return res.status(404).json({ error: 'Submission not found' });
      if (submission.taskId !== taskId) return res.status(400).json({ error: 'Submission does not belong to this task' });

      const deliverableIds = (submission.deliverableIds as number[]) || [];
      const allDeliverables = await storage.getDeliverablesByTaskId(taskId);
      const deliverables = allDeliverables.filter(d => deliverableIds.includes(d.id));

      const deliverableDescriptions: string[] = [];
      for (const d of deliverables) {
        let contentStr = '';
        if (d.type === 'text' && d.content) {
          contentStr = d.content;
        } else if (d.type === 'file' && d.fileUrl) {
          try {
            const fs = await import('fs');
            const path = await import('path');
            const uploadsDir = path.resolve(process.cwd(), 'uploads');
            const filePath = path.resolve(process.cwd(), d.fileUrl);
            if (!filePath.startsWith(uploadsDir)) {
              contentStr = `[File: ${d.fileName || d.fileUrl}]`;
            } else if (fs.existsSync(filePath)) {
              const buf = fs.readFileSync(filePath, 'utf-8');
              contentStr = buf.slice(0, 3000);
            } else {
              contentStr = `[File: ${d.fileName || d.fileUrl}]`;
            }
          } catch {
            contentStr = `[File: ${d.fileName || d.fileUrl}]`;
          }
        } else if (d.type === 'link' && d.linkUrl) {
          contentStr = `[Link: ${d.linkUrl}]`;
        }
        deliverableDescriptions.push(
          `Deliverable #${d.id} (${d.type}): Title="${d.title}"${d.description ? `, Description="${d.description}"` : ''}\nContent: ${contentStr || '(empty)'}`
        );
      }

      const prompt = `You are a task submission reviewer. Evaluate the following submission for a task.

Task:
- Title: "${task.title}"
- Description: "${task.description || 'N/A'}"

Submission Note: "${submission.note || 'N/A'}"

Deliverables:
${deliverableDescriptions.join('\n\n')}

Please evaluate and return a JSON object with:
- "summary": string - A brief content summary of all deliverables combined (in Chinese)
- "relevanceScore": number (1-5) - How well the deliverables match the task description
- "qualityAssessment": string - A brief quality assessment (in Chinese)
- "suggestions": string[] - Array of improvement suggestions (in Chinese)

Return ONLY the JSON object, no other text.`;

      const { claudeComplete } = await import('./services/ai/index');

      const completion = await claudeComplete({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });

      const raw = completion.content || '{}';
      let result: { summary: string; relevanceScore: number; qualityAssessment: string; suggestions: string[] };
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { summary: raw, relevanceScore: 3, qualityAssessment: raw, suggestions: [] };
        }
      } catch {
        result = { summary: raw, relevanceScore: 3, qualityAssessment: raw, suggestions: [] };
      }

      return res.json({ data: result });
    } catch (e: any) {
      console.error('AI review-submission error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Guided Options =====================
  app.get("/api/ai/available-models", authMiddleware, async (_req: any, res) => {
    const DEFAULT_CHAT_MODELS = [
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: '日常任务首选' },
      { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: '深度分析模式' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', desc: '快速响应' },
      { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'OpenAI 最新旗舰' },
      { id: 'deepseek-chat', label: 'DeepSeek V3.2', desc: '高性价比' },
    ];
    try {
      const val = await storage.getSystemConfig('chat_visible_models');
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((m: any) => m.id && m.label)) {
            return res.json({ data: parsed });
          }
        } catch {}
      }
      res.json({ data: DEFAULT_CHAT_MODELS });
    } catch (e: any) {
      res.json({ data: DEFAULT_CHAT_MODELS });
    }
  });

  app.get("/api/ai/guided-options", authMiddleware, async (req: any, res) => {
    try {
      const { type, projectId } = req.query;

      if (type === 'parentTasks' && projectId) {
        const tasks = await storage.getTasks({ projectId: Number(projectId) });
        const topLevelTasks = tasks.filter(t => !t.parentTaskId && t.status !== 'cancelled');
        const options = topLevelTasks.map(t => ({
          label: t.title,
          value: t.id,
          description: `${t.status} | 优先级: ${t.priority}`,
        }));
        return res.json({ data: options });
      }

      if (type === 'departments') {
        const departments = await storage.getDepartments();
        const options = departments.map(d => ({
          label: d.name,
          value: d.id,
        }));
        return res.json({ data: options });
      }

      if (type === 'users') {
        const users = await storage.getUsers();
        const jobRoles = await storage.getJobRoles();
        const roleMap = new Map(jobRoles.map(r => [r.id, r]));
        const options = users.filter(u => u.isActive).map(u => {
          const role = u.jobRoleId ? roleMap.get(u.jobRoleId) : null;
          return {
            label: u.displayName,
            value: u.id,
            description: role?.title || '',
          };
        });
        return res.json({ data: options });
      }

      if (type === 'projects') {
        const projects = await storage.getProjects();
        const options = projects.filter(p => p.status !== 'cancelled').map(p => ({
          label: p.name,
          value: p.id,
          description: p.status,
        }));
        return res.json({ data: options });
      }

      return res.status(400).json({ error: 'Invalid type parameter' });
    } catch (e: any) {
      console.error('Guided options error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Decompose Project =====================
  app.post("/api/ai/decompose-project", authMiddleware, async (req: any, res) => {
    try {
      const { projectId, projectName, projectDescription } = req.body;

      const orgId = req.orgId || parseInt(req.headers['x-org-id'] as string) || 1;

      let name = projectName || '';
      let description = projectDescription || '';
      let existingTaskTitles: string[] = [];

      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        name = project.name;
        description = project.description || '';

        const existingTasks = await storage.getTasks({ projectId });
        existingTaskTitles = existingTasks.map(t => t.title);
      }

      if (!name) {
        return res.status(400).json({ error: 'projectName or projectId is required' });
      }

      const orgUsers = await storage.getUsers();
      const filteredUsers = orgUsers.filter(u => u.orgId === orgId && u.isActive);
      const jobRoles = await storage.getJobRoles();
      const jobRoleMap = new Map(jobRoles.map(r => [r.id, r]));

      const teamInfo = filteredUsers.map(u => {
        const role = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
        return {
          id: u.id,
          name: u.displayName,
          jobTitle: role?.title || '',
          responsibilities: role?.responsibilities || '',
          requiredSkills: role?.requiredSkills || '',
        };
      });

      const teamBlock = teamInfo.length > 0
        ? teamInfo.map(m => `- ID:${m.id} ${m.name} | ${m.jobTitle} | ${m.responsibilities} | ${m.requiredSkills}`).join('\n')
        : '(no team members)';

      const existingBlock = existingTaskTitles.length > 0
        ? existingTaskTitles.map(t => `- ${t}`).join('\n')
        : '(none)';

      const OpenAI = (await import('openai')).default;
      const claudeClient = new OpenAI({
        baseURL: 'https://vip.aipro.love/v1',
        apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
        timeout: 90000,
      });
      const genModel = 'claude-sonnet-4-6';

      const response = await claudeClient.chat.completions.create({
        model: genModel,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: `You are a project management expert. Given a project and team info, generate a Work Breakdown Structure (WBS).

Output pure JSON (no markdown wrapping):
{
  "tasks": [
    {
      "title": "task title (Chinese preferred)",
      "description": "brief description",
      "priority": "medium",
      "estimatedDays": 3,
      "suggestedAssigneeId": null,
      "suggestedAssigneeName": ""
    }
  ],
  "dependencies": [
    { "fromIndex": 0, "toIndex": 1, "reason": "brief reason" }
  ]
}

Rules:
- Generate 4-10 tasks covering major work areas
- Order tasks logically
- priority: critical/high/medium/low
- estimatedDays: realistic estimate (1-30)
- suggestedAssigneeId: pick from team members by matching skills/responsibilities, or null if unclear
- suggestedAssigneeName: the name of the suggested assignee
- dependencies: fromIndex task must finish before toIndex task starts. Use 0-based indices into the tasks array.
- Do NOT duplicate any existing tasks
- Task titles and descriptions should be in Chinese`
          },
          {
            role: 'user',
            content: `Project: ${name}
Description: ${description || 'No description'}

Team members:
${teamBlock}

Existing tasks (do not duplicate):
${existingBlock}`
          }
        ],
      });

      const usage = response.usage;
      const tokenInfo = usage ? {
        model: genModel,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      } : undefined;

      if (tokenInfo) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(tokenInfo.model, tokenInfo.promptTokens, tokenInfo.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: req.currentUserId,
            conversationId: null,
            model: tokenInfo.model,
            promptTokens: tokenInfo.promptTokens,
            completionTokens: tokenInfo.completionTokens,
            totalTokens: tokenInfo.totalTokens,
            costUsd: cost,
            purpose: 'chat',
          });
        } catch (tokenErr) {
          console.error('Failed to record token usage:', tokenErr);
        }
      }

      let aiText = response.choices[0]?.message?.content || '';
      const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        aiText = codeBlockMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(aiText);
        return res.json({
          data: {
            tasks: parsed.tasks || [],
            dependencies: parsed.dependencies || [],
          }
        });
      } catch {
        return res.json({ data: { tasks: [], dependencies: [] } });
      }
    } catch (e: any) {
      console.error('Project decompose error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== User Memories =====================
  app.get("/api/user-memories", authMiddleware, async (req, res) => {
    try {
      const userId = req.currentUserId;
      const orgId = req.orgId || 1;
      const memories = await storage.getUserMemories(userId, orgId);
      return res.json({ data: memories });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/user-memories", authMiddleware, async (req, res) => {
    try {
      const userId = req.currentUserId;
      const orgId = req.orgId || 1;
      const parsed = insertUserMemorySchema.safeParse({ ...req.body, userId, orgId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const memory = await storage.createUserMemory(parsed.data);
      return res.status(201).json({ data: memory });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/user-memories/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUserMemory(id);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Chat Stream =====================
  app.post("/api/ai/chat/stream", authMiddleware, async (req: any, res) => {
    try {
      const { message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking, replyStyle, webSearchEnabled, codeContextEnabled, knowledgeBaseEnabled, attachments } = req.body;
      if ((!message || typeof message !== 'string') && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message is required' });
      }

      const orgId = req.orgId || 1;
      const userId = currentUserId || req.currentUserId || 1;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';
      const msgText = message || '';

      let activeConvId = conversationId || null;
      let isNewConversation = false;

      if (!activeConvId) {
        isNewConversation = true;
        const tempTitle = (msgText || '附件消息').slice(0, 30) + ((msgText || '附件消息').length > 30 ? '...' : '');
        const newConv = await storage.createConversation({
          title: tempTitle,
          orgId,
          userId,
        });
        activeConvId = newConv.id;
      }

      let history = conversationHistory || [];
      if (activeConvId && history.length === 0) {
        const conv = await storage.getConversationById(activeConvId);
        if (conv && conv.orgId !== orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        const dbMessages = await storage.getChatMessages(activeConvId);
        history = dbMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      res.write(`data: ${JSON.stringify({ type: 'start', conversationId: activeConvId })}\n\n`);

      let fullText = '';
      let aborted = false;
      req.on('close', () => { aborted = true; });

      if (attachments && attachments.length > 0) {
        try {
          const attachmentHashes = attachments.map((att: any) => ({
            name: att.name || 'unknown',
            hash: crypto.createHash('md5').update(Buffer.from(att.base64 || '', 'base64')).digest('hex'),
          }));

          const recentWithHashes = await storage.findRecentAttachmentMessages(orgId, 7);

          for (const attHash of attachmentHashes) {
            for (const row of recentWithHashes) {
              try {
                const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                if (meta?.attachmentHashes?.some((ah: any) => ah.hash === attHash.hash)) {
                  const uploadTime = new Date(row.createdAt).toLocaleString('zh-CN');
                  res.write(`data: ${JSON.stringify({
                    type: 'token',
                    content: `> **注意**: 文件「${attHash.name}」在 ${uploadTime} 已被上传过（对话 #${row.conversationId}）。如果这不是重复文件，我将继续处理。\n\n`
                  })}\n\n`);
                  fullText += `> **注意**: 文件「${attHash.name}」在 ${uploadTime} 已被上传过（对话 #${row.conversationId}）。如果这不是重复文件，我将继续处理。\n\n`;
                  break;
                }
              } catch {}
            }
          }

          setImmediate(async () => {
            try {
              await storage.createChatMessage({
                conversationId: activeConvId,
                role: 'system',
                content: '[attachment_hashes]',
                type: 'metadata',
                metadata: JSON.stringify({ attachmentHashes }),
              });
            } catch {}
          });
        } catch (hashErr) {
          console.error('Attachment hash check failed:', hashErr);
        }
      }

      let effectiveSystemPrompt = systemPrompt || '';
      if (replyStyle && replyStyle !== 'normal') {
        const styleMap: Record<string, string> = {
          concise: '请用简短直接的方式回答，避免冗长的解释。',
          detailed: '请提供深入全面的解释，包含更多细节和背景信息。',
          professional: '请用正式的商务语气回复，保持专业和严谨。',
          casual: '请用轻松友好的语气对话，像朋友之间聊天一样。',
        };
        effectiveSystemPrompt = (effectiveSystemPrompt ? effectiveSystemPrompt + '\n' : '') + (styleMap[replyStyle] || '');
      }

      if (webSearchEnabled) {
        try {
          const searchResults = await searchWeb(msgText);
          if (searchResults.results.length > 0 || searchResults.answer) {
            let searchContext = `\n\n## 网页搜索结果\n用户开启了网页搜索，以下是与用户问题相关的网页搜索结果，请参考这些信息回答：\n`;
            if (searchResults.answer) {
              searchContext += `\n搜索摘要: ${searchResults.answer}\n`;
            }
            if (searchResults.results.length > 0) {
              searchContext += `\n来源:\n`;
              searchResults.results.forEach((r, i) => {
                searchContext += `${i + 1}. ${r.title} - ${r.url}\n   ${r.content}\n`;
              });
            }
            searchContext += `\n请在回答中适当引用这些来源，并注明信息来自网络搜索。`;
            effectiveSystemPrompt = (effectiveSystemPrompt || '') + searchContext;

            if (searchResults.results.length > 0) {
              res.write(`data: ${JSON.stringify({ type: 'search_results', results: searchResults.results })}\n\n`);
            }
          }
        } catch (searchErr) {
          console.error('Web search failed:', searchErr);
        }
      }

      if (codeContextEnabled) {
        try {
          const { buildCodeContextBlock } = await import('./services/ai/codeContext');
          const { contextBlock, loadedFiles, failedFiles } = buildCodeContextBlock(msgText, true);
          effectiveSystemPrompt = (effectiveSystemPrompt || '') + '\n\n' + contextBlock;
          if (loadedFiles.length > 0 || failedFiles.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'code_files', files: loadedFiles, failedFiles })}\n\n`);
          }
        } catch (codeErr) {
          console.error('Code context failed:', codeErr);
        }
      }

      const useCodeTools = codeContextEnabled === true;
      const generator = useCodeTools
        ? codeToolChatStream(msgText, history, effectiveSystemPrompt || '', model || undefined)
        : aiChatStream(
            msgText,
            history,
            { currentUserId: userId, currentUserName: userName, customSystemPrompt: effectiveSystemPrompt || undefined, model: model || undefined, extendedThinking: extendedThinking || false, orgId, knowledgeBaseEnabled: knowledgeBaseEnabled || false, userRole: user?.role || 'member', userDeptId: user?.deptId || null },
            attachments
          );

      for await (const chunk of generator) {
        if (aborted || req.socket?.destroyed) break;

        if (chunk.type === 'tool_use' && (chunk as any).toolName) {
          const toolChunk = chunk as any;
          const toolLabel = toolChunk.toolName === 'read_file' ? `Reading ${toolChunk.toolInput?.file_path}...`
            : toolChunk.toolName === 'list_directory' ? `Browsing ${toolChunk.toolInput?.directory || 'project root'}...`
            : toolChunk.toolName === 'search_code' ? `Searching "${toolChunk.toolInput?.query}"...`
            : toolChunk.toolName === 'web_search' ? `Searching the web...`
            : `Using ${toolChunk.toolName}...`;
          const toolType = toolChunk.toolName === 'web_search' ? 'search'
            : (toolChunk.toolName === 'read_file' || toolChunk.toolName === 'list_directory') ? 'file'
            : toolChunk.toolName === 'search_code' ? 'search'
            : 'code';
          res.write(`data: ${JSON.stringify({ type: 'tool_use', toolName: toolChunk.toolName, toolInput: toolChunk.toolInput, label: toolLabel, toolType })}\n\n`);
        } else if ((chunk as any).type === 'tool_result_event') {
          const trChunk = chunk as any;
          const completedLabel = trChunk.toolName === 'read_file' ? `Read file: ${trChunk.result?.slice(0, 60) || 'done'}`
            : trChunk.toolName === 'list_directory' ? `Listed directory`
            : trChunk.toolName === 'search_code' ? `Search complete`
            : trChunk.toolName === 'web_search' ? `Searched the web`
            : `${trChunk.toolName} complete`;
          res.write(`data: ${JSON.stringify({ type: 'tool_result', toolName: trChunk.toolName, completedLabel, detail: trChunk.result || '' })}\n\n`);
        } else if (chunk.type === 'thinking' && chunk.content) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'token' && chunk.content) {
          fullText += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'done') {
          if (chunk.tokenUsage) {
            const { calculateCost } = await import('./services/ai/tokenCost');
            const cost = calculateCost(
              chunk.tokenUsage.model,
              chunk.tokenUsage.promptTokens,
              chunk.tokenUsage.completionTokens
            );
            try {
              await storage.createTokenUsage({
                orgId,
                userId,
                conversationId: activeConvId || null,
                model: chunk.tokenUsage.model,
                promptTokens: chunk.tokenUsage.promptTokens,
                completionTokens: chunk.tokenUsage.completionTokens,
                totalTokens: chunk.tokenUsage.totalTokens,
                costUsd: cost,
                purpose: knowledgeBaseEnabled ? 'knowledge_qa' : 'chat',
              });
            } catch (tokenErr) {
              console.error('Failed to record token usage:', tokenErr);
            }
          }
          let displayText = fullText;
          const actionMatch = fullText.match(/<<<ACTIONS>>>\s*([\s\S]*?)\s*<<<END_ACTIONS>>>\s*$/);
          if (actionMatch) {
            displayText = fullText.slice(0, fullText.indexOf('<<<ACTIONS>>>')).trim();
            try {
              const actionData = JSON.parse(actionMatch[1].trim());
              if (actionData && actionData.type === 'interactive_input' && actionData.questions) {
                res.write(`data: ${JSON.stringify({ type: 'interactive_input', questions: actionData.questions })}\n\n`);
              } else if (actionData && (actionData.action || actionData.actions)) {
                res.write(`data: ${JSON.stringify({ type: 'action', ...actionData })}\n\n`);
              }
            } catch (parseErr) {
              console.error('Failed to parse action block:', parseErr);
            }
          }

          const donePayload: any = { type: 'done', fullText: displayText };
          if (chunk.tokenUsage) {
            donePayload.tokenUsage = {
              promptTokens: chunk.tokenUsage.promptTokens,
              completionTokens: chunk.tokenUsage.completionTokens,
              totalTokens: chunk.tokenUsage.totalTokens,
            };
          }
          res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
        } else if (chunk.type === 'error') {
          const errContent = chunk.content || '';
          let errorCode = 'unknown';
          if (errContent.includes('rate') || errContent.includes('429') || errContent.includes('quota') || errContent.includes('Too Many')) {
            errorCode = 'rate_limit';
          } else if (errContent.includes('context') || errContent.includes('token') || errContent.includes('too long') || errContent.includes('max_tokens') || errContent.includes('context_length')) {
            errorCode = 'context_too_long';
          } else if (errContent.includes('overloaded') || errContent.includes('503') || errContent.includes('unavailable') || errContent.includes('capacity')) {
            errorCode = 'service_unavailable';
          } else if (errContent.includes('network') || errContent.includes('ECONNREFUSED') || errContent.includes('ETIMEDOUT') || errContent.includes('ENOTFOUND')) {
            errorCode = 'network';
          }
          res.write(`data: ${JSON.stringify({ type: 'error', content: errContent, errorCode })}\n\n`);
        }
      }

      if (isNewConversation && activeConvId && fullText && !aborted) {
        try {
          const title = await Promise.race([
            generateConversationTitle(msgText, fullText),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
          ]);
          await storage.updateConversation(activeConvId!, { title });
          res.write(`data: ${JSON.stringify({ type: 'title', title })}\n\n`);
        } catch (err) {
          console.error('Title generation error:', err);
        }
      }

      res.end();

      extractMemories(
        [...history, { role: 'user', content: msgText }, { role: 'assistant', content: fullText }],
        userId,
        orgId
      ).catch(err => console.error('Memory extraction error:', err));
    } catch (e: any) {
      console.error('AI Chat Stream error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
      try {
        const errContent = e.message || '';
        let errorCode = 'unknown';
        if (errContent.includes('rate') || errContent.includes('429') || errContent.includes('quota') || errContent.includes('Too Many')) {
          errorCode = 'rate_limit';
        } else if (errContent.includes('context') || errContent.includes('token') || errContent.includes('too long') || errContent.includes('max_tokens') || errContent.includes('context_length')) {
          errorCode = 'context_too_long';
        } else if (errContent.includes('overloaded') || errContent.includes('503') || errContent.includes('unavailable') || errContent.includes('capacity')) {
          errorCode = 'service_unavailable';
        } else if (errContent.includes('network') || errContent.includes('ECONNREFUSED') || errContent.includes('ETIMEDOUT') || errContent.includes('ENOTFOUND')) {
          errorCode = 'network';
        }
        res.write(`data: ${JSON.stringify({ type: 'error', content: errContent, errorCode })}\n\n`);
        res.end();
      } catch {}
    }
  });

  // ===================== AI Chat =====================
  app.post("/api/ai/chat", authMiddleware, async (req: any, res) => {
    try {
      const { message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      const orgId = req.orgId || 1;
      const userId = currentUserId || req.currentUserId || 1;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';

      let activeConvId = conversationId || null;
      let isNewConversation = false;

      if (!activeConvId) {
        isNewConversation = true;
        const tempTitle = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        const newConv = await storage.createConversation({
          title: tempTitle,
          orgId,
          userId,
        });
        activeConvId = newConv.id;
      }

      let history = conversationHistory || [];
      if (activeConvId && history.length === 0) {
        const conv = await storage.getConversationById(activeConvId);
        if (conv && conv.orgId !== orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        const dbMessages = await storage.getChatMessages(activeConvId);
        history = dbMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      }

      const result = await aiChat(
        message,
        history,
        { currentUserId: userId, currentUserName: userName, customSystemPrompt: systemPrompt || undefined, model: model || undefined, extendedThinking: extendedThinking || false, orgId }
      );

      if (isNewConversation && activeConvId && result.message) {
        generateConversationTitle(message, result.message)
          .then(async (title) => {
            await storage.updateConversation(activeConvId!, { title });
          })
          .catch(err => console.error('Title generation error:', err));
      }

      if (result.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(
          result.tokenUsage.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens
        );
        try {
          await storage.createTokenUsage({
            orgId,
            userId,
            conversationId: activeConvId || null,
            model: result.tokenUsage.model,
            promptTokens: result.tokenUsage.promptTokens,
            completionTokens: result.tokenUsage.completionTokens,
            totalTokens: result.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'chat',
          });
        } catch (tokenErr) {
          console.error('Failed to record token usage:', tokenErr);
        }
      }

      return res.json({ data: { ...result, conversationId: activeConvId } });
    } catch (e: any) {
      console.error('AI Chat error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/confirm", authMiddleware, async (req: any, res) => {
    try {
      const { actionType, data, currentUserId, conversationId, forceCreate } = req.body;
      if (!actionType || !data) {
        return res.status(400).json({ error: 'actionType and data are required' });
      }

      const userId = currentUserId || req.currentUserId;
      const orgId = req.orgId || 1;
      const result = await executeAction(actionType, data, userId, orgId, { forceCreate: !!forceCreate });

      if (result.error === 'duplicate_suspected') {
        return res.json({ data: result });
      }

      if (!result.success && result.entity?.conflict) {
        return res.status(409).json({ error: result.message, data: result });
      }

      if (result.success && result.entity) {
        try {
          if (actionType === 'create_task' || actionType === 'update_task') {
            const taskEntity = result.entity;
            const notifType = actionType === 'create_task' ? 'task_created' : 'task_updated';
            const notifMsg = actionType === 'create_task'
              ? `通过 AI 创建了任务「${taskEntity.title}」`
              : `通过 AI 更新了任务「${taskEntity.title}」`;
            await generateTeamNotifications(userId, 'task', taskEntity.id, taskEntity.title, orgId, notifType, notifMsg);
          }
        } catch (notifErr) {
          console.error('Failed to generate notifications:', notifErr);
        }
      }

      if (conversationId) {
        const conv = await storage.getConversationById(conversationId);
        if (conv && conv.orgId !== req.orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        try {
          const summaryParts = [];
          if (actionType === 'create_task') summaryParts.push(`创建任务「${data.title || ''}」`);
          else if (actionType === 'update_task') summaryParts.push(`更新任务 #${data.taskId || ''}`);
          else if (actionType === 'create_project') summaryParts.push(`创建项目「${data.name || ''}」`);
          else if (actionType === 'add_comment') summaryParts.push(`添加评论`);
          else if (actionType === 'create_user') summaryParts.push(`创建成员「${data.displayName || ''}」`);
          else if (actionType === 'update_user') summaryParts.push(`更新成员 #${data.userId || ''}`);
          else if (actionType === 'create_department') summaryParts.push(`创建部门「${data.name || ''}」`);
          else summaryParts.push(`执行操作: ${actionType}`);

          await storage.createChatMessage({
            conversationId,
            role: 'system',
            content: `[操作已执行] ${summaryParts.join('，')}`,
            type: 'action_result',
            metadata: JSON.stringify({ actionType, result }),
          });
        } catch (msgErr) {
          console.error('Failed to save system message:', msgErr);
        }
      }

      return res.json({ data: result });
    } catch (e: any) {
      console.error('AI Confirm error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/confirm-batch", authMiddleware, async (req: any, res) => {
    try {
      const { actions, currentUserId, conversationId } = req.body;
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ error: 'actions array is required' });
      }

      const userId = currentUserId || req.currentUserId;
      const orgId = req.orgId || 1;
      const batchResult = await executeBatchActions(actions, userId, orgId);

      for (let i = 0; i < batchResult.results.length; i++) {
        const r = batchResult.results[i];
        if (r.success && r.entity) {
          try {
            const actionType = actions[i]?.actionType || 'create_task';
            if (actionType === 'create_task' || actionType === 'update_task') {
              const notifType = actionType === 'create_task' ? 'task_created' : 'task_updated';
              const notifMsg = actionType === 'create_task'
                ? `通过 AI 创建了任务「${r.entity.title}」`
                : `通过 AI 更新了任务「${r.entity.title}」`;
              await generateTeamNotifications(userId, 'task', r.entity.id, r.entity.title || '', orgId, notifType, notifMsg);
            }
          } catch (notifErr) {
            console.error('Failed to generate batch notification:', notifErr);
          }
        }
      }

      if (conversationId) {
        try {
          const summaryParts = batchResult.results
            .filter(r => r.success)
            .map(r => r.message);

          if (summaryParts.length > 0) {
            await storage.createChatMessage({
              conversationId,
              role: 'system',
              content: `[批量操作已执行] ${summaryParts.join('；')}`,
              type: 'action_result',
              metadata: JSON.stringify({ batch: true, results: batchResult.results }),
            });
          }
        } catch (msgErr) {
          console.error('Failed to save batch system message:', msgErr);
        }
      }

      return res.json({ data: batchResult });
    } catch (e: any) {
      console.error('AI Confirm Batch error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Token Budget Balance =====================
  app.get("/api/token-usage/balance", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ error: 'Organization not found' });

      const budget = org.tokenBudgetUsd ? parseFloat(org.tokenBudgetUsd) : null;
      const resetDay = org.budgetResetDay || 1;

      const now = new Date();
      let cycleStart: Date;
      if (now.getDate() >= resetDay) {
        cycleStart = new Date(now.getFullYear(), now.getMonth(), resetDay);
      } else {
        cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, resetDay);
      }

      const stats = await storage.getTokenUsageStats(orgId, cycleStart);
      const used = parseFloat(stats.totalCostUsd);

      return res.json({
        data: {
          budgetUsd: budget,
          usedUsd: used,
          remainingUsd: budget !== null ? Math.max(0, budget - used) : null,
          percentUsed: budget !== null && budget > 0 ? Math.min(100, (used / budget) * 100) : null,
          cycleStart: cycleStart.toISOString(),
          resetDay,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/organization/budget", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const currentUserId = req.currentUserId;
      const userOrg = await storage.getOrgMembershipByUserAndOrg(currentUserId, orgId);
      if (!userOrg || (userOrg.role !== 'owner' && userOrg.role !== 'admin')) {
        return res.status(403).json({ error: 'Only owner/admin can update budget' });
      }
      const { tokenBudgetUsd, budgetResetDay } = req.body;
      const updates: Record<string, any> = {};
      if (tokenBudgetUsd !== undefined) updates.tokenBudgetUsd = String(tokenBudgetUsd);
      if (budgetResetDay !== undefined) updates.budgetResetDay = budgetResetDay;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
      await storage.updateOrganization(orgId, updates);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Token Usage Stats =====================
  app.get("/api/token-usage/stats", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const period = (req.query.period as string) || '30d';

      let since: Date | undefined;
      const now = new Date();
      if (period === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (period === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (period === '90d') since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const stats = await storage.getTokenUsageStats(orgId, since);
      return res.json({ data: stats });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Smart Setup =====================

  app.post("/api/setup/analyze-kb", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可使用智能初始化" });
      }

      const { documentIds } = req.body;
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "请选择至少一个知识库文档" });
      }

      const { analyzeKbDocuments } = await import('./services/setup/setupService');
      const result = await analyzeKbDocuments({
        orgId: req.orgId,
        documentIds: documentIds.map(Number),
      });

      return res.json({ data: result });
    } catch (e: any) {
      console.error('[Setup] Analyze KB error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/setup/confirm", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可使用智能初始化" });
      }

      const { confirmAndSetup } = await import('./services/setup/setupService');
      const { profile, extractedFiles } = req.body;

      if (!profile) {
        return res.status(400).json({ error: "缺少组织信息" });
      }

      const result = await confirmAndSetup({
        orgId: req.orgId,
        userId: req.currentUserId,
        profile,
        extractedFiles: extractedFiles || [],
      });

      return res.json({ data: result });
    } catch (e: any) {
      console.error('[Setup] Confirm error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Member Profiles =====================

  app.get("/api/member-profiles", authMiddleware, async (req: any, res) => {
    try {
      const profiles = await storage.getMemberProfilesByOrg(req.orgId);
      res.json({ data: profiles });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/member-profiles", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可创建成员档案" });
      }
      const { fullName, aliases, deptId, jobRoleId, employeeId, phone, email, title, hireDate, contractInfo } = req.body;
      if (!fullName) return res.status(400).json({ error: "姓名不能为空" });

      const profile = await storage.createMemberProfile({
        orgId: req.orgId,
        fullName,
        aliases: aliases ? (typeof aliases === 'string' ? aliases : JSON.stringify(aliases)) : null,
        deptId: deptId || null,
        jobRoleId: jobRoleId || null,
        employeeId: employeeId || null,
        phone: phone || null,
        email: email || null,
        title: title || null,
        hireDate: hireDate || null,
        contractInfo: contractInfo || null,
        status: 'manual',
        sourceDocument: null,
      });
      res.json({ data: profile });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/member-profiles/:id", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可修改成员档案" });
      }
      const profileId = Number(req.params.id);
      const existing = await storage.getMemberProfileById(profileId);
      if (!existing || existing.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      const updateData: any = {};
      const allowedFields = ['fullName', 'aliases', 'deptId', 'jobRoleId', 'employeeId', 'phone', 'email', 'title', 'hireDate', 'contractInfo'];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === 'aliases' && Array.isArray(req.body[field])) {
            updateData[field] = JSON.stringify(req.body[field]);
          } else {
            updateData[field] = req.body[field];
          }
        }
      }
      const updated = await storage.updateMemberProfile(profileId, updateData);
      res.json({ data: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/member-profiles/:id", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可删除成员档案" });
      }
      const profileId = Number(req.params.id);
      const existing = await storage.getMemberProfileById(profileId);
      if (!existing || existing.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      await storage.deleteMemberProfile(profileId);
      res.json({ data: { success: true } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/member-profiles/match", authMiddleware, async (req: any, res) => {
    try {
      const profiles = await storage.getPendingProfilesByOrg(req.orgId);
      const user = await storage.getUserById(req.currentUserId);
      if (!user) return res.json({ data: null });

      let matched = null;
      for (const profile of profiles) {
        if (profile.email && user.email && profile.email.toLowerCase() === user.email.toLowerCase()) {
          matched = profile;
          break;
        }
        if (profile.fullName === user.displayName) {
          matched = profile;
          break;
        }
        let aliases: string[] = [];
        try { aliases = profile.aliases ? JSON.parse(profile.aliases) : []; } catch {}
        if (aliases.some((alias: string) => alias.toLowerCase() === user.displayName.toLowerCase())) {
          matched = profile;
          break;
        }
      }

      if (matched) {
        const taskCount = await storage.getTaskCountByMemberProfile(matched.id);
        res.json({ data: { ...matched, pendingTaskCount: taskCount } });
      } else {
        res.json({ data: null });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/member-profiles/:id/claim", authMiddleware, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getMemberProfileById(profileId);
      if (!profile || profile.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      if (profile.status === 'claimed') {
        return res.status(400).json({ error: "该档案已被认领" });
      }

      const userId = req.currentUserId;

      const existingClaim = await storage.getMemberProfilesByOrg(req.orgId);
      const alreadyBound = existingClaim.find(p => p.userId === userId && p.status === 'claimed');
      if (alreadyBound) {
        return res.status(400).json({ error: "你已经认领了另一个档案" });
      }

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "用户不存在" });

      let isMatch = false;
      if (profile.email && user.email && profile.email.toLowerCase() === user.email.toLowerCase()) isMatch = true;
      if (profile.fullName === user.displayName) isMatch = true;
      let aliases: string[] = [];
      try { aliases = profile.aliases ? JSON.parse(profile.aliases) : []; } catch {}
      if (aliases.some((a: string) => a.toLowerCase() === user.displayName.toLowerCase())) isMatch = true;
      if (!isMatch) {
        return res.status(403).json({ error: "该档案与你的信息不匹配，请联系管理员绑定" });
      }

      await storage.updateUser(userId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      } as any);

      await storage.updateOrgMembership(req.orgId, userId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      });

      const migratedCount = await storage.migrateTasksFromProfile(profileId, userId);

      await storage.updateMemberProfile(profileId, {
        status: 'claimed',
        userId,
        claimedAt: new Date(),
      } as any);

      await storage.createActivityLog({
        orgId: req.orgId,
        userId,
        entityType: 'member_profile',
        entityId: profileId,
        action: 'claim',
        changes: JSON.stringify({ profileName: profile.fullName, userId, migratedTasks: migratedCount }),
        source: 'user',
      });

      res.json({ data: { success: true, migratedTasks: migratedCount, profile } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/member-profiles/:id/bind/:userId", authMiddleware, async (req: any, res) => {
    try {
      if (!['owner', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: "仅管理员可手动绑定" });
      }
      const profileId = Number(req.params.id);
      const targetUserId = Number(req.params.userId);

      const profile = await storage.getMemberProfileById(profileId);
      if (!profile || profile.orgId !== req.orgId) {
        return res.status(404).json({ error: "档案不存在" });
      }
      if (profile.status === 'claimed') {
        return res.status(400).json({ error: "该档案已被认领" });
      }

      const targetUser = await storage.getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "目标用户不存在" });
      }

      const allProfiles = await storage.getMemberProfilesByOrg(req.orgId);
      const alreadyBound = allProfiles.find(p => p.userId === targetUserId && p.status === 'claimed');
      if (alreadyBound) {
        return res.status(400).json({ error: "该用户已绑定了另一个档案" });
      }

      await storage.updateUser(targetUserId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      } as any);

      await storage.updateOrgMembership(req.orgId, targetUserId, {
        deptId: profile.deptId,
        jobRoleId: profile.jobRoleId,
      });

      const migratedCount = await storage.migrateTasksFromProfile(profileId, targetUserId);

      await storage.updateMemberProfile(profileId, {
        status: 'claimed',
        userId: targetUserId,
        claimedAt: new Date(),
      } as any);

      await storage.createActivityLog({
        orgId: req.orgId,
        userId: req.currentUserId,
        entityType: 'member_profile',
        entityId: profileId,
        action: 'bind',
        changes: JSON.stringify({ profileName: profile.fullName, targetUserId, migratedTasks: migratedCount }),
        source: 'user',
      });

      res.json({ data: { success: true, migratedTasks: migratedCount, profile } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===================== Knowledge Base =====================

  const fsKb = await import('fs');
  if (!fsKb.existsSync('uploads/kb')) {
    fsKb.mkdirSync('uploads/kb', { recursive: true });
  }

  const kbUploadStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, 'uploads/kb/'),
    filename: (_req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = pathModule.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  });
  const kbUpload = multer({
    storage: kbUploadStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.xls', '.csv', '.pptx', '.html', '.htm', '.rtf', '.json'];
      const ext = pathModule.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`不支持的文件类型: ${ext}。支持格式: PDF/Word/Excel/PPT/TXT/CSV/HTML/MD/RTF/JSON`));
      }
    },
  });

  app.post("/api/kb/documents/upload", authMiddleware, kbUpload.single('file'), async (req: any, res) => {
    try {
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: '仅管理员可上传知识库文档' });
      }

      if (!req.file) {
        return res.status(400).json({ error: '请选择要上传的文件' });
      }

      const orgId = req.orgId;
      const userId = req.currentUserId;
      const file = req.file;
      const ext = pathModule.extname(file.originalname).toLowerCase().replace('.', '');

      const fileBuffer = fsKb.readFileSync(file.path);
      const contentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

      const forceUpload = req.body.forceUpload === 'true' || req.body.forceUpload === true;
      const replaceDocId = req.body.replaceDocId ? parseInt(req.body.replaceDocId) : null;

      if (replaceDocId) {
        const oldDoc = await storage.getKbDocumentById(replaceDocId);
        if (oldDoc && oldDoc.orgId === orgId) {
          try {
            const oldFilePath = oldDoc.fileUrl.startsWith('/') ? oldDoc.fileUrl.slice(1) : oldDoc.fileUrl;
            if (fsKb.existsSync(oldFilePath)) fsKb.unlinkSync(oldFilePath);
          } catch {}
          await storage.deleteKbChunksByDocument(replaceDocId);
          await storage.deleteKbDocument(replaceDocId);
        }
      }

      if (!forceUpload) {
        const existingByName = await storage.findKbDocByFileName(orgId, file.originalname);
        if (existingByName) {
          try { fsKb.unlinkSync(file.path); } catch {}
          if (existingByName.fileSize === file.size) {
            return res.status(409).json({
              error: 'duplicate_detected',
              duplicateType: 'same_name_same_size',
              existingDoc: { id: existingByName.id, title: existingByName.title, fileName: existingByName.fileName, createdAt: existingByName.createdAt },
              message: `知识库中已有同名同大小的文件「${existingByName.title}」`,
            });
          } else {
            return res.status(409).json({
              error: 'duplicate_detected',
              duplicateType: 'same_name_diff_size',
              existingDoc: { id: existingByName.id, title: existingByName.title, fileName: existingByName.fileName, fileSize: existingByName.fileSize, createdAt: existingByName.createdAt },
              message: `知识库中有同名文件「${existingByName.title}」（大小不同，可能是新版本）`,
            });
          }
        }

        const existingByHash = await storage.findKbDocByHash(orgId, contentHash);
        if (existingByHash) {
          try { fsKb.unlinkSync(file.path); } catch {}
          return res.status(409).json({
            error: 'duplicate_detected',
            duplicateType: 'same_content',
            existingDoc: { id: existingByHash.id, title: existingByHash.title, fileName: existingByHash.fileName, createdAt: existingByHash.createdAt },
            message: `知识库中已有内容完全相同的文件「${existingByHash.title}」`,
          });
        }
      }

      const docData = {
        orgId,
        uploadedBy: userId,
        title: req.body.title || file.originalname.replace(/\.[^/.]+$/, ''),
        fileName: file.originalname,
        fileType: ext,
        fileSize: file.size,
        fileUrl: `/uploads/kb/${file.filename}`,
        category: req.body.category || 'general',
        visibility: req.body.visibility || 'org',
        visibleDeptIds: req.body.visibleDeptIds || null,
        status: 'pending',
        chunkCount: 0,
        contentHash,
      };

      const doc = await storage.createKbDocument(docData);

      await storage.createActivityLog({
        orgId,
        userId,
        entityType: 'kb_document',
        entityId: doc.id,
        action: 'upload',
        changes: JSON.stringify({ title: doc.title, fileName: doc.fileName, fileType: doc.fileType }),
        source: 'manual',
      });

      setImmediate(() => {
        processDocument(doc.id).catch(err => {
          console.error(`[KB] Async processing failed for document ${doc.id}:`, err);
        });
      });

      return res.status(201).json({ data: doc });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents", authMiddleware, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const docs = await storage.getKbDocumentsByOrg(orgId);

      const userRole = req.userRole || 'member';
      const filteredDocs = ['owner', 'admin'].includes(userRole)
        ? docs
        : docs.filter((d: any) => d.visibility === 'org');

      return res.json({ data: filteredDocs });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole) && doc.visibility !== 'org') {
        return res.status(403).json({ error: '无权访问' });
      }
      return res.json({ data: doc });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents/:id/chunks", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole) && doc.visibility !== 'org') {
        return res.status(403).json({ error: '无权访问' });
      }

      const chunks = await storage.getKbChunksByDocument(id);
      return res.json({ data: chunks });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/documents/:id/status", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });

      return res.json({
        data: {
          status: doc.status,
          chunkCount: doc.chunkCount,
          errorMessage: doc.errorMessage,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/kb/documents/:id", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: '仅管理员可删除知识库文档' });
      }

      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });

      const fs = await import('fs');
      const filePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await storage.deleteKbDocument(id);

      await storage.createActivityLog({
        orgId: req.orgId,
        userId: req.currentUserId,
        entityType: 'kb_document',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({ title: doc.title, fileName: doc.fileName }),
        source: 'manual',
      });

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/kb/documents/:id/reprocess", authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userRole = req.userRole || 'member';
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: '仅管理员可操作' });
      }

      const doc = await storage.getKbDocumentById(id);
      if (!doc) return res.status(404).json({ error: '文档不存在' });
      if (doc.orgId !== req.orgId) return res.status(403).json({ error: '无权访问' });

      await storage.updateKbDocument(id, { status: 'pending', errorMessage: null, chunkCount: 0 });

      setImmediate(() => {
        processDocument(id).catch(err => {
          console.error(`[KB] Reprocess failed for document ${id}:`, err);
        });
      });

      return res.json({ data: { success: true, message: '已开始重新处理' } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kb/search", authMiddleware, async (req: any, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ data: [] });

      const topK = Math.min(parseInt(req.query.topK as string) || 5, 10);

      const results = await searchKnowledge({
        orgId: req.orgId,
        query: q,
        topK,
        userRole: req.userRole || 'member',
        userDeptId: req.userDeptId || null,
      });

      return res.json({ data: results });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Daily Briefing =====================

  app.get("/api/briefing/today", authMiddleware, async (req: any, res) => {
    try {
      const { getTodayBriefing } = await import('./services/briefing/briefingGenerator');
      const result = await getTodayBriefing(req.orgId, req.currentUserId);
      return res.json({ data: result });
    } catch (e: any) {
      console.error('[Briefing] Error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/briefing/refresh", authMiddleware, async (req: any, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await storage.deleteBriefing(req.orgId, req.currentUserId, today);
      const { getTodayBriefing } = await import('./services/briefing/briefingGenerator');
      const result = await getTodayBriefing(req.orgId, req.currentUserId);
      return res.json({ data: result });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}

```

---

## ===== 文件路径: server/services/kb/chunkText.ts (91 行) =====

```typescript
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

```

---

## ===== 文件路径: server/services/kb/embedding.ts (116 行) =====

```typescript
import { sql } from 'drizzle-orm';
import { storage } from '../../storage';

const EMBEDDING_AVAILABLE = false;
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

```

---

## ===== 文件路径: server/services/kb/processDocument.ts (123 行) =====

```typescript
import { storage } from '../../storage';
import { extractText } from './extractText';
import { chunkText } from './chunkText';
import { analyzeFileWithHaiku } from '../setup/aiExtractor';

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

    try {
      const classification = await analyzeFileWithHaiku(doc.fileName, rawText.slice(0, 500));
      const updateData: any = {
        orgRelevance: classification.orgRelevance,
        kbRelevance: classification.kbRelevance,
        sensitivity: classification.sensitivity,
        aiSummary: classification.summary,
      };
      if (doc.category === 'general' && classification.category !== 'general') {
        updateData.category = classification.category;
      }
      if (classification.sensitivity === 'high' && doc.visibility !== 'admin') {
        updateData.visibility = 'admin';
      }
      await storage.updateKbDocument(documentId, updateData);
      console.log(`[KB] AI classified: ${doc.fileName} → ${classification.category} (org:${classification.orgRelevance} kb:${classification.kbRelevance} sensitivity:${classification.sensitivity})`);
    } catch (classifyErr: any) {
      console.warn(`[KB] AI classification failed (non-fatal): ${classifyErr.message}`);
    }

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

```

---

## ===== 文件路径: server/services/kb/search.ts (164 行) =====

```typescript
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


```

---

## ===== 文件路径: server/services/kb/extractText.ts (96 行) =====

```typescript
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

    case 'docx':
    case 'doc': {
      const result = await mammoth.extractRawText({ path: absolutePath });
      return result.value || '';
    }

    case 'txt':
    case 'md':
    case 'csv': {
      return fs.readFileSync(absolutePath, 'utf-8');
    }

    case 'xlsx':
    case 'xls': {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(absolutePath);
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim().length > 10) {
          sheets.push(`=== 工作表: ${sheetName} ===\n${csv}`);
        }
      }
      return sheets.join('\n\n');
    }

    case 'pptx': {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(absolutePath);
      const texts: string[] = [];
      const entries = zip.getEntries();
      const slideEntries = entries
        .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
        .sort((a, b) => {
          const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || '0');
          const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || '0');
          return numA - numB;
        });
      for (const entry of slideEntries) {
        const xml = entry.getData().toString('utf-8');
        const matches = xml.match(/<a:t>(.*?)<\/a:t>/g) || [];
        const slideText = matches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
        if (slideText.trim()) {
          texts.push(slideText);
        }
      }
      return texts.join('\n\n');
    }

    case 'html':
    case 'htm': {
      const cheerio = await import('cheerio');
      const html = fs.readFileSync(absolutePath, 'utf-8');
      const $ = cheerio.load(html);
      $('script, style, nav, header, footer').remove();
      return $('body').text().trim();
    }

    case 'rtf': {
      const rtf = fs.readFileSync(absolutePath, 'utf-8');
      return rtf
        .replace(/\\par\b/g, '\n')
        .replace(/\{\\[^{}]*\}/g, '')
        .replace(/\\[a-z]+\d* ?/gi, '')
        .replace(/[{}]/g, '')
        .trim();
    }

    case 'json': {
      return fs.readFileSync(absolutePath, 'utf-8');
    }

    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

```

---

## ===== 文件路径: shared/schema.ts (1068 行) =====

```typescript
import { pgTable, serial, varchar, text, integer, boolean, timestamp, numeric, jsonb, customType, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

// ============================================================
// 1. organizations（组织/公司）
// ============================================================
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('project'),
  tokenBudgetUsd: numeric('token_budget_usd', { precision: 10, scale: 4 }),
  budgetResetDay: integer('budget_reset_day').default(1),
  maxMembers: integer('max_members').default(50),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 2. departments（部门）
// ============================================================
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }),
  parentDeptId: integer('parent_dept_id').references((): AnyPgColumn => departments.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 3. job_roles（岗位职责）
// ============================================================
export const jobRoles = pgTable('job_roles', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  responsibilities: text('responsibilities').notNull(),
  boundaries: text('boundaries'),
  requiredSkills: text('required_skills'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 4. users（用户）
// ============================================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  jobRoleId: integer('job_role_id').references(() => jobRoles.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  authProvider: varchar('auth_provider', { length: 50 }),
  authProviderId: varchar('auth_provider_id', { length: 255 }),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// org_memberships（组织成员关系）
// ============================================================
export const orgMemberships = pgTable('org_memberships', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  deptId: integer('dept_id').references(() => departments.id),
  jobRoleId: integer('job_role_id').references(() => jobRoles.id),
  isActive: boolean('is_active').default(true).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// ============================================================
// invitations（组织邀请）
// ============================================================
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  inviteCode: varchar('invite_code', { length: 50 }).notNull().unique(),
  type: text('type').default('code'),
  email: text('email'),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at'),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').default(true).notNull(),
  status: text('status').default('pending'),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: integer('accepted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// organizationJoinRequests（组织加入申请）
// ============================================================
export const organizationJoinRequests = pgTable('organization_join_requests', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message'),
  inviteCode: varchar('invite_code', { length: 50 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 5. projects（项目）
// ============================================================
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  startDate: timestamp('start_date'),
  targetDate: timestamp('target_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 5. tasks（任务）— 核心表
// ============================================================
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  parentTaskId: integer('parent_task_id').references((): AnyPgColumn => tasks.id),

  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('task'),

  // status 可选值：todo | in_progress | submitted | reviewing | done | cancelled
  status: varchar('status', { length: 50 }).notNull().default('todo'),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),

  creatorId: integer('creator_id').references(() => users.id).notNull(),
  assigneeId: integer('assignee_id').references(() => users.id),
  memberProfileId: integer('member_profile_id'),

  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),

  weight: integer('weight').default(1).notNull(),
  progress: integer('progress').default(0).notNull(),

  tags: text('tags'),

  needsReview: boolean('needs_review').default(false).notNull(),
  warnings: text('warnings'),

  starred: boolean('starred').default(false).notNull(),

  isDecisionTask: boolean('is_decision_task').default(false).notNull(),
  decisionForTaskId: integer('decision_for_task_id').references((): AnyPgColumn => tasks.id),
  decisionType: varchar('decision_type', { length: 50 }),
  decisionStatus: varchar('decision_status', { length: 50 }).default('pending'),
  decisionDeadline: timestamp('decision_deadline'),
  escalationDeadline: timestamp('escalation_deadline'),
  escalatedToId: integer('escalated_to_id').references(() => users.id),

  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 5b. task_deliverables（任务交付物）
// ============================================================
export const taskDeliverables = pgTable("task_deliverables", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizations.id),

  type: varchar("type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),

  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  fileMimeType: varchar("file_mime_type", { length: 200 }),

  linkUrl: text("link_url"),

  content: text("content"),

  submittedBy: integer("submitted_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),

  version: integer("version").default(1).notNull(),
  isLatest: boolean("is_latest").default(true).notNull(),

  reviewStatus: varchar("review_status", { length: 50 }).default("pending"),
  reviewScore: integer("review_score"),
  reviewFeedback: text("review_feedback"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// 5c. task_submissions（任务提交记录）
// ============================================================
export const taskSubmissions = pgTable("task_submissions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  submittedBy: integer("submitted_by").notNull().references(() => users.id),

  note: text("note"),
  deliverableIds: jsonb("deliverable_ids").$type<number[]>().default([]),

  status: varchar("status", { length: 50 }).default("pending").notNull(),

  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  overallScore: integer("overall_score"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// 6. task_dependencies（任务依赖关系）
// ============================================================
export const taskDependencies = pgTable('task_dependencies', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  dependsOnTaskId: integer('depends_on_task_id').references(() => tasks.id).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('finish_to_start'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 7. activity_logs（操作日志）
// ============================================================
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  changes: text('changes'),
  source: varchar('source', { length: 50 }).notNull().default('manual'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 8. task_comments（任务评论）
// ============================================================
export const taskComments = pgTable('task_comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 9. task_participants（任务参与人）
// ============================================================
export const taskParticipants = pgTable('task_participants', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('participant'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 10. verdicts（权责判定记录）
// ============================================================
export const verdicts = pgTable('verdicts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  verdict: varchar('verdict', { length: 50 }).notNull(),
  confidence: integer('confidence').notNull(),
  reasoning: text('reasoning').notNull(),
  matchedResponsibilities: text('matched_responsibilities'),
  suggestedAssignee: integer('suggested_assignee').references(() => users.id),
  suggestedReason: text('suggested_reason'),
  requestedBy: integer('requested_by').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  overrideReason: text('override_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 11. notifications（通知）
// ============================================================
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  entityTitle: varchar('entity_title', { length: 500 }).notNull(),
  message: text('message').notNull(),
  triggeredBy: integer('triggered_by').references(() => users.id).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 12. conversations（AI 对话）
// ============================================================
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull().default(1),
  userId: integer('user_id').references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  starred: boolean('starred').default(false).notNull(),
  projectId: integer('project_id').references(() => projects.id),
  projectName: varchar('project_name', { length: 255 }),
  visibility: varchar('visibility', { length: 50 }).notNull().default('private'),
  systemPrompt: text('system_prompt'),
  isArchived: boolean('is_archived').default(false).notNull(),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 14. token_usage（Token 用量记录）
// ============================================================
export const tokenUsage = pgTable('token_usage', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  conversationId: integer('conversation_id').references(() => conversations.id),
  model: varchar('model', { length: 100 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costUsd: varchar('cost_usd', { length: 20 }),
  purpose: varchar('purpose', { length: 50 }).notNull().default('chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 15. user_memories（用户记忆）
// ============================================================
export const userMemories = pgTable('user_memories', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  content: text('content').notNull(),
  source: varchar('source', { length: 20 }).default('auto'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 13. chat_messages（对话消息）
// ============================================================
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('text'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Relations 定义
// ============================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  departments: many(departments),
  users: many(users),
  projects: many(projects),
  memberships: many(orgMemberships),
  invitations: many(invitations),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.orgId],
    references: [organizations.id],
  }),
  parentDept: one(departments, {
    fields: [departments.parentDeptId],
    references: [departments.id],
    relationName: 'parentChild',
  }),
  childDepts: many(departments, { relationName: 'parentChild' }),
  users: many(users),
  projects: many(projects),
}));

export const jobRolesRelations = relations(jobRoles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobRoles.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [jobRoles.deptId],
    references: [departments.id],
  }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [users.deptId],
    references: [departments.id],
  }),
  jobRole: one(jobRoles, {
    fields: [users.jobRoleId],
    references: [jobRoles.id],
  }),
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  comments: many(taskComments),
  participatedTasks: many(taskParticipants),
  memberships: many(orgMemberships),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [projects.deptId],
    references: [departments.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'taskHierarchy',
  }),
  subtasks: many(tasks, { relationName: 'taskHierarchy' }),
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
    relationName: 'taskCreator',
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  memberProfile: one(memberProfiles, {
    fields: [tasks.memberProfileId],
    references: [memberProfiles.id],
  }),
  comments: many(taskComments),
  participants: many(taskParticipants),
  deliverables: many(taskDeliverables),
  submissions: many(taskSubmissions),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: 'dependentTask',
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: 'prerequisiteTask',
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const taskParticipantsRelations = relations(taskParticipants, ({ one }) => ({
  task: one(tasks, {
    fields: [taskParticipants.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskParticipants.userId],
    references: [users.id],
  }),
}));

export const taskDeliverablesRelations = relations(taskDeliverables, ({ one }) => ({
  task: one(tasks, { fields: [taskDeliverables.taskId], references: [tasks.id] }),
  organization: one(organizations, { fields: [taskDeliverables.orgId], references: [organizations.id] }),
  submitter: one(users, { fields: [taskDeliverables.submittedBy], references: [users.id], relationName: 'deliverableSubmitter' }),
  reviewer: one(users, { fields: [taskDeliverables.reviewedBy], references: [users.id], relationName: 'deliverableReviewer' }),
}));

export const taskSubmissionsRelations = relations(taskSubmissions, ({ one }) => ({
  task: one(tasks, { fields: [taskSubmissions.taskId], references: [tasks.id] }),
  organization: one(organizations, { fields: [taskSubmissions.orgId], references: [organizations.id] }),
  submitter: one(users, { fields: [taskSubmissions.submittedBy], references: [users.id], relationName: 'submissionSubmitter' }),
  reviewer: one(users, { fields: [taskSubmissions.reviewedBy], references: [users.id], relationName: 'submissionReviewer' }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const verdictsRelations = relations(verdicts, ({ one }) => ({
  task: one(tasks, {
    fields: [verdicts.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [verdicts.userId],
    references: [users.id],
    relationName: 'verdictUser',
  }),
  suggestedUser: one(users, {
    fields: [verdicts.suggestedAssignee],
    references: [users.id],
    relationName: 'suggestedAssignee',
  }),
  requestedByUser: one(users, {
    fields: [verdicts.requestedBy],
    references: [users.id],
    relationName: 'verdictRequester',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'notificationRecipient',
  }),
  triggeredByUser: one(users, {
    fields: [notifications.triggeredBy],
    references: [users.id],
    relationName: 'notificationTrigger',
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  messages: many(chatMessages),
  tokenUsages: many(tokenUsage),
}));

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  organization: one(organizations, {
    fields: [tokenUsage.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [tokenUsage.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [tokenUsage.conversationId],
    references: [conversations.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [chatMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const userMemoriesRelations = relations(userMemories, ({ one }) => ({
  user: one(users, {
    fields: [userMemories.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userMemories.orgId],
    references: [organizations.id],
  }),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, {
    fields: [orgMemberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [orgMemberships.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [orgMemberships.deptId],
    references: [departments.id],
  }),
  jobRole: one(jobRoles, {
    fields: [orgMemberships.jobRoleId],
    references: [jobRoles.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [invitations.createdBy],
    references: [users.id],
    relationName: 'invitationCreator',
  }),
  acceptedByUser: one(users, {
    fields: [invitations.acceptedBy],
    references: [users.id],
    relationName: 'invitationAcceptor',
  }),
}));

export const organizationJoinRequestsRelations = relations(organizationJoinRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationJoinRequests.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationJoinRequests.userId],
    references: [users.id],
    relationName: 'joinRequestUser',
  }),
  reviewer: one(users, {
    fields: [organizationJoinRequests.reviewedBy],
    references: [users.id],
    relationName: 'joinRequestReviewer',
  }),
}));

// ============================================================
// Insert Schemas & Types
// ============================================================

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

export const insertJobRoleSchema = createInsertSchema(jobRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobRole = z.infer<typeof insertJobRoleSchema>;
export type JobRole = typeof jobRoles.$inferSelect;

export const insertTaskParticipantSchema = createInsertSchema(taskParticipants).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskParticipant = z.infer<typeof insertTaskParticipantSchema>;
export type TaskParticipant = typeof taskParticipants.$inferSelect;

export const insertVerdictSchema = createInsertSchema(verdicts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVerdict = z.infer<typeof insertVerdictSchema>;
export type Verdict = typeof verdicts.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertTokenUsageSchema = createInsertSchema(tokenUsage).omit({
  id: true,
  createdAt: true,
});
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenUsage = typeof tokenUsage.$inferSelect;

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertUserMemorySchema = createInsertSchema(userMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type UserMemory = typeof userMemories.$inferSelect;

export const insertOrgMembershipSchema = createInsertSchema(orgMemberships).omit({
  id: true,
  joinedAt: true,
});
export type InsertOrgMembership = z.infer<typeof insertOrgMembershipSchema>;
export type OrgMembership = typeof orgMemberships.$inferSelect;

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  usedCount: true,
});
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export const insertOrganizationJoinRequestSchema = createInsertSchema(organizationJoinRequests);
export type OrganizationJoinRequest = typeof organizationJoinRequests.$inferSelect;
export type InsertOrganizationJoinRequest = typeof organizationJoinRequests.$inferInsert;

export const insertTaskDeliverableSchema = createInsertSchema(taskDeliverables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
});
export type InsertTaskDeliverable = z.infer<typeof insertTaskDeliverableSchema>;
export type TaskDeliverable = typeof taskDeliverables.$inferSelect;

export const insertTaskSubmissionSchema = createInsertSchema(taskSubmissions).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskSubmission = z.infer<typeof insertTaskSubmissionSchema>;
export type TaskSubmission = typeof taskSubmissions.$inferSelect;

// ============================================================
// Knowledge Base — kb_documents（知识库文档）
// ============================================================
export const kbDocuments = pgTable('kb_documents', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  uploadedBy: integer('uploaded_by').references(() => users.id).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(),
  fileSize: integer('file_size').notNull(),
  fileUrl: text('file_url').notNull(),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  visibility: varchar('visibility', { length: 50 }).notNull().default('org'),
  visibleDeptIds: text('visible_dept_ids'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  chunkCount: integer('chunk_count').notNull().default(0),
  errorMessage: text('error_message'),
  orgRelevance: integer('org_relevance'),
  kbRelevance: integer('kb_relevance'),
  sensitivity: varchar('sensitivity', { length: 20 }),
  aiSummary: text('ai_summary'),
  contentHash: varchar('content_hash', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// Knowledge Base — kb_chunks（知识库切片）
// ============================================================
export const kbChunks = pgTable('kb_chunks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').references(() => kbDocuments.id, { onDelete: 'cascade' }).notNull(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  embedding: vector('embedding'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const kbDocumentsRelations = relations(kbDocuments, ({ one, many }) => ({
  organization: one(organizations, { fields: [kbDocuments.orgId], references: [organizations.id] }),
  uploader: one(users, { fields: [kbDocuments.uploadedBy], references: [users.id] }),
  chunks: many(kbChunks),
}));

export const kbChunksRelations = relations(kbChunks, ({ one }) => ({
  document: one(kbDocuments, { fields: [kbChunks.documentId], references: [kbDocuments.id] }),
  organization: one(organizations, { fields: [kbChunks.orgId], references: [organizations.id] }),
}));

export const insertKbDocumentSchema = createInsertSchema(kbDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKbDocument = z.infer<typeof insertKbDocumentSchema>;
export type KbDocument = typeof kbDocuments.$inferSelect;

export const insertKbChunkSchema = createInsertSchema(kbChunks).omit({
  id: true,
  createdAt: true,
});
export type InsertKbChunk = z.infer<typeof insertKbChunkSchema>;
export type KbChunk = typeof kbChunks.$inferSelect;

// ============================================================
// Briefings — briefings（每日简报）
// ============================================================
export const briefings = pgTable('briefings', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  content: text('content').notNull(),
  dataSnapshot: text('data_snapshot'),
  model: varchar('model', { length: 50 }).notNull().default('claude-haiku-4-5-20251001'),
  tokenCount: integer('token_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const briefingsRelations = relations(briefings, ({ one }) => ({
  organization: one(organizations, { fields: [briefings.orgId], references: [organizations.id] }),
  user: one(users, { fields: [briefings.userId], references: [users.id] }),
}));

export const insertBriefingSchema = createInsertSchema(briefings).omit({
  id: true,
  createdAt: true,
});
export type InsertBriefing = z.infer<typeof insertBriefingSchema>;
export type Briefing = typeof briefings.$inferSelect;

// ============================================================
// Member Profiles — member_profiles（成员档案）
// ============================================================
export const memberProfiles = pgTable('member_profiles', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  aliases: text('aliases'),
  deptId: integer('dept_id').references(() => departments.id),
  jobRoleId: integer('job_role_id').references(() => jobRoles.id),
  employeeId: varchar('employee_id', { length: 50 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  title: varchar('title', { length: 100 }),
  hireDate: varchar('hire_date', { length: 20 }),
  contractInfo: text('contract_info'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  userId: integer('user_id').references(() => users.id),
  claimedAt: timestamp('claimed_at'),
  sourceDocument: varchar('source_document', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const memberProfilesRelations = relations(memberProfiles, ({ one }) => ({
  organization: one(organizations, { fields: [memberProfiles.orgId], references: [organizations.id] }),
  department: one(departments, { fields: [memberProfiles.deptId], references: [departments.id] }),
  jobRole: one(jobRoles, { fields: [memberProfiles.jobRoleId], references: [jobRoles.id] }),
  user: one(users, { fields: [memberProfiles.userId], references: [users.id] }),
}));

export const insertMemberProfileSchema = createInsertSchema(memberProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMemberProfile = z.infer<typeof insertMemberProfileSchema>;
export type MemberProfile = typeof memberProfiles.$inferSelect;

// ============================================================
// AI Providers — ai_providers（AI 服务提供商配置）
// ============================================================
export const aiProviders = pgTable('ai_providers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('proxy'),
  baseUrl: text('base_url').notNull(),
  apiKeyEnvVar: varchar('api_key_env_var', { length: 100 }).notNull(),
  models: text('models').array().notNull(),
  timeout: integer('timeout').notNull().default(90000),
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertAiProviderSchema = createInsertSchema(aiProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type AiProvider = typeof aiProviders.$inferSelect;

// ============================================================
// System Config — system_config（系统级键值配置）
// ============================================================
export const systemConfig = pgTable('system_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export type SystemConfig = typeof systemConfig.$inferSelect;

// AI Model Providers — ai_model_providers（按模型分组的 API 配置）
// ============================================================
export const aiModelProviders = pgTable('ai_model_providers', {
  id: serial('id').primaryKey(),
  modelId: varchar('model_id', { length: 100 }).notNull(),
  providerName: varchar('provider_name', { length: 255 }).notNull(),
  baseUrl: text('base_url'),
  apiKeyEnvVar: varchar('api_key_env_var', { length: 255 }),
  apiKey: text('api_key'),
  timeout: integer('timeout').notNull().default(90000),
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertAiModelProviderSchema = createInsertSchema(aiModelProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiModelProvider = z.infer<typeof insertAiModelProviderSchema>;
export type AiModelProvider = typeof aiModelProviders.$inferSelect;

export * from "./models/auth";

```

---

## ===== 文件路径: server/storage.ts (1374 行) =====

```typescript
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, or, inArray, notInArray, sql, ilike, gte } from "drizzle-orm";
import * as schema from "@shared/schema";
import {
  organizations,
  departments,
  users,
  projects,
  tasks,
  taskDependencies,
  activityLogs,
  taskComments,
  taskParticipants,
  jobRoles,
  verdicts,
  notifications,
  conversations,
  chatMessages,
  type Organization,
  type Department,
  type User,
  type Project,
  type Task,
  type TaskDependency,
  type ActivityLog,
  type TaskComment,
  type TaskParticipant,
  type JobRole,
  type Verdict,
  type InsertOrganization,
  type InsertDepartment,
  type InsertUser,
  type InsertProject,
  type InsertTask,
  type InsertTaskDependency,
  type InsertActivityLog,
  type InsertTaskComment,
  type InsertTaskParticipant,
  type InsertJobRole,
  type InsertVerdict,
  type Notification,
  type InsertNotification,
  type Conversation,
  type ChatMessage,
  type InsertConversation,
  type InsertChatMessage,
  tokenUsage,
  type TokenUsage,
  type InsertTokenUsage,
  userMemories,
  type UserMemory,
  type InsertUserMemory,
  orgMemberships,
  invitations,
  type OrgMembership,
  type InsertOrgMembership,
  type Invitation,
  type InsertInvitation,
  organizationJoinRequests,
  memberProfiles,
  type MemberProfile,
  type InsertMemberProfile,
  type OrganizationJoinRequest,
  type InsertOrganizationJoinRequest,
  taskDeliverables,
  taskSubmissions,
  type TaskDeliverable,
  type InsertTaskDeliverable,
  type TaskSubmission,
  type InsertTaskSubmission,
  kbDocuments,
  kbChunks,
  briefings,
  aiProviders,
  type AiProvider,
  type InsertAiProvider,
  aiModelProviders,
  type AiModelProvider,
  type InsertAiModelProvider,
  systemConfig,
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export class DatabaseStorage {
  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations);
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [result] = await db.insert(organizations).values(data).returning();
    return result;
  }

  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments);
  }

  async getDepartmentsByOrg(orgId: number): Promise<Department[]> {
    return db.select().from(departments).where(eq(departments.orgId, orgId));
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [result] = await db.select().from(departments).where(eq(departments.id, id));
    return result;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [result] = await db.insert(departments).values(data).returning();
    return result;
  }

  async updateDepartment(id: number, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [result] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return result;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.email, email));
    return result;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(data).returning();
    return result;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [result] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result;
  }

  async deleteUser(id: number): Promise<User | undefined> {
    const [result] = await db.update(users).set({ isActive: false }).where(eq(users.id, id)).returning();
    return result;
  }

  async getUserByProvider(provider: string, providerId: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(
      and(eq(users.authProvider, provider), eq(users.authProviderId, providerId))
    );
    return result;
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  async getProjectById(id: number): Promise<Project | undefined> {
    const [result] = await db.select().from(projects).where(eq(projects.id, id));
    return result;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [result] = await db.insert(projects).values(data).returning();
    return result;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [result] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return result;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getTasks(filters?: { projectId?: number; assigneeId?: number; status?: string[]; parentTaskId?: number | null }): Promise<Task[]> {
    if (!filters) {
      return db.select().from(tasks);
    }
    const conditions = [];
    if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters.status?.length) conditions.push(inArray(tasks.status, filters.status));
    if (filters.parentTaskId === null) conditions.push(sql`${tasks.parentTaskId} IS NULL`);
    else if (filters.parentTaskId) conditions.push(eq(tasks.parentTaskId, filters.parentTaskId));

    if (conditions.length === 0) {
      return db.select().from(tasks);
    }
    return db.select().from(tasks).where(and(...conditions));
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const [result] = await db.select().from(tasks).where(eq(tasks.id, id));
    return result;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(data).returning();
    return result;
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [result] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return result;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async updateTaskWithVersion(id: number, expectedVersion: number, data: Partial<InsertTask>): Promise<Task | null> {
    const [result] = await db
      .update(tasks)
      .set({ ...data, version: sql`${tasks.version} + 1`, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.version, expectedVersion)))
      .returning();
    return result ?? null;
  }

  async createTaskWithDependencies(
    taskData: InsertTask,
    dependsOnIds: number[],
    orgId: number,
    userId: number
  ): Promise<Task> {
    return await db.transaction(async (tx) => {
      const [task] = await tx.insert(tasks).values(taskData).returning();
      for (const depId of dependsOnIds) {
        await tx.insert(taskDependencies).values({
          taskId: task.id,
          dependsOnTaskId: depId,
          type: 'finish_to_start',
        });
      }
      await tx.insert(activityLogs).values({
        orgId,
        userId,
        entityType: 'task',
        entityId: task.id,
        action: 'create',
        changes: JSON.stringify({ title: task.title, projectId: task.projectId }),
        source: 'ai_chat',
      });
      return task;
    });
  }

  async batchCreateTasks(
    taskItems: Array<{ data: InsertTask; ref?: string; dependsOn?: number[]; dependsOnRef?: string[] }>,
    orgId: number,
    userId: number
  ): Promise<Task[]> {
    return await db.transaction(async (tx) => {
      const refToId = new Map<string, number>();
      const createdTasks: Task[] = [];

      for (const item of taskItems) {
        const [task] = await tx.insert(tasks).values(item.data).returning();
        createdTasks.push(task);

        if (item.ref) {
          refToId.set(item.ref, task.id);
        }

        const allDepIds: number[] = [...(item.dependsOn || [])];
        if (item.dependsOnRef) {
          for (const ref of item.dependsOnRef) {
            const resolvedId = refToId.get(ref);
            if (resolvedId) allDepIds.push(resolvedId);
          }
        }

        for (const depId of allDepIds) {
          await tx.insert(taskDependencies).values({
            taskId: task.id,
            dependsOnTaskId: depId,
            type: 'finish_to_start',
          });
        }

        await tx.insert(activityLogs).values({
          orgId,
          userId,
          entityType: 'task',
          entityId: task.id,
          action: 'create',
          changes: JSON.stringify({ title: task.title, projectId: task.projectId }),
          source: 'ai_chat',
        });
      }

      return createdTasks;
    });
  }

  async checkDuplicateTask(orgId: number, title: string, assigneeId?: number | null, memberProfileId?: number | null): Promise<Task | null> {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const conditions = [
      eq(tasks.orgId, orgId),
      eq(tasks.title, title),
      gte(tasks.createdAt, tenMinAgo),
    ];
    if (assigneeId) {
      conditions.push(eq(tasks.assigneeId, assigneeId));
    } else if (memberProfileId) {
      conditions.push(eq(tasks.memberProfileId, memberProfileId));
    }
    const [result] = await db.select().from(tasks).where(and(...conditions)).limit(1);
    return result ?? null;
  }

  async getActiveTasksByOrg(orgId: number): Promise<Task[]> {
    return db.select().from(tasks).where(
      and(
        eq(tasks.orgId, orgId),
        notInArray(tasks.status, ['done', 'cancelled'])
      )
    );
  }

  async getTaskDependencies(taskId: number): Promise<TaskDependency[]> {
    return db.select().from(taskDependencies).where(
      or(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnTaskId, taskId))
    );
  }

  async createTaskDependency(data: InsertTaskDependency): Promise<TaskDependency> {
    const [result] = await db.insert(taskDependencies).values(data).returning();
    return result;
  }

  async deleteTaskDependency(id: number): Promise<void> {
    await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
  }

  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(desc(taskComments.createdAt));
  }

  async createTaskComment(data: InsertTaskComment): Promise<TaskComment> {
    const [result] = await db.insert(taskComments).values(data).returning();
    return result;
  }

  async getTaskParticipants(taskId: number): Promise<TaskParticipant[]> {
    return db.select().from(taskParticipants).where(eq(taskParticipants.taskId, taskId));
  }

  async getTaskParticipantsByTaskIds(taskIds: number[]): Promise<TaskParticipant[]> {
    if (taskIds.length === 0) return [];
    return db.select().from(taskParticipants).where(inArray(taskParticipants.taskId, taskIds));
  }

  async addTaskParticipant(data: InsertTaskParticipant): Promise<TaskParticipant> {
    const [result] = await db.insert(taskParticipants).values(data).returning();
    return result;
  }

  async removeTaskParticipant(id: number): Promise<void> {
    await db.delete(taskParticipants).where(eq(taskParticipants.id, id));
  }

  async removeTaskParticipantByTaskAndUser(taskId: number, userId: number): Promise<void> {
    await db.delete(taskParticipants).where(
      and(eq(taskParticipants.taskId, taskId), eq(taskParticipants.userId, userId))
    );
  }

  async getAllTaskDependencies(): Promise<TaskDependency[]> {
    return await db.select().from(taskDependencies);
  }

  async getActivityLogs(filters?: { entityType?: string; entityId?: number }): Promise<ActivityLog[]> {
    if (!filters) {
      return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
    }
    const conditions = [];
    if (filters.entityType) conditions.push(eq(activityLogs.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(activityLogs.entityId, filters.entityId));

    if (conditions.length === 0) {
      return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
    }
    return db.select().from(activityLogs).where(and(...conditions)).orderBy(desc(activityLogs.createdAt));
  }

  async createActivityLog(data: InsertActivityLog): Promise<ActivityLog> {
    const [result] = await db.insert(activityLogs).values(data).returning();
    return result;
  }

  async getJobRoles(): Promise<JobRole[]> {
    return db.select().from(jobRoles);
  }

  async getJobRolesByOrg(orgId: number): Promise<JobRole[]> {
    return db.select().from(jobRoles).where(eq(jobRoles.orgId, orgId));
  }

  async getJobRoleById(id: number): Promise<JobRole | undefined> {
    const [result] = await db.select().from(jobRoles).where(eq(jobRoles.id, id));
    return result;
  }

  async createJobRole(data: InsertJobRole): Promise<JobRole> {
    const [result] = await db.insert(jobRoles).values(data).returning();
    return result;
  }

  async updateJobRole(id: number, data: Partial<InsertJobRole>): Promise<JobRole | undefined> {
    const [result] = await db.update(jobRoles).set(data).where(eq(jobRoles.id, id)).returning();
    return result;
  }

  async deleteJobRole(id: number): Promise<void> {
    await db.delete(jobRoles).where(eq(jobRoles.id, id));
  }

  async getVerdictsByTaskId(taskId: number): Promise<Verdict[]> {
    return db.select().from(verdicts).where(eq(verdicts.taskId, taskId)).orderBy(desc(verdicts.createdAt));
  }

  async getVerdictsByUserId(userId: number): Promise<Verdict[]> {
    return db.select().from(verdicts).where(eq(verdicts.userId, userId)).orderBy(desc(verdicts.createdAt));
  }

  async getVerdictById(id: number): Promise<Verdict | undefined> {
    const [result] = await db.select().from(verdicts).where(eq(verdicts.id, id));
    return result;
  }

  async createVerdict(data: InsertVerdict): Promise<Verdict> {
    const [result] = await db.insert(verdicts).values(data).returning();
    return result;
  }

  async updateVerdict(id: number, data: Partial<InsertVerdict>): Promise<Verdict | undefined> {
    const [result] = await db.update(verdicts).set(data).where(eq(verdicts.id, id)).returning();
    return result;
  }

  async getAllVerdicts(): Promise<Verdict[]> {
    return db.select().from(verdicts).orderBy(desc(verdicts.createdAt));
  }

  async getNotificationsByUserId(userId: number, limit?: number): Promise<Notification[]> {
    const q = db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
    if (limit) return q.limit(limit);
    return q;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count ?? 0;
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [result] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return result;
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(data).returning();
    return result;
  }

  async createManyNotifications(dataList: InsertNotification[]): Promise<Notification[]> {
    if (dataList.length === 0) return [];
    return db.insert(notifications).values(dataList).returning();
  }
  // ==================== Conversations ====================
  async getConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.updatedAt));
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [result] = await db.select().from(conversations).where(eq(conversations.id, id));
    return result;
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const [result] = await db.insert(conversations).values(data).returning();
    return result;
  }

  async updateConversation(id: number, data: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [result] = await db.update(conversations).set({ ...data, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
    return result;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(tokenUsage).where(eq(tokenUsage.conversationId, id));
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async searchConversations(orgId: number, query: string): Promise<(Conversation & { matchSnippets?: string[] })[]> {
    const pattern = `%${query}%`;
    const matchingByTitle = await db.select().from(conversations).where(
      and(
        eq(conversations.orgId, orgId),
        eq(conversations.isArchived, false),
        ilike(conversations.title, pattern)
      )
    );

    const matchingMessages = await db
      .select({
        conversationId: chatMessages.conversationId,
        content: chatMessages.content,
        role: chatMessages.role,
      })
      .from(chatMessages)
      .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.isArchived, false),
          ilike(chatMessages.content, pattern)
        )
      )
      .orderBy(desc(chatMessages.createdAt));

    const convIdsFromMessages = [...new Set(matchingMessages.map(m => m.conversationId))];
    const convsByContent = convIdsFromMessages.length > 0
      ? await db.select().from(conversations).where(
          and(
            inArray(conversations.id, convIdsFromMessages),
            eq(conversations.isArchived, false)
          )
        )
      : [];

    const snippetMap = new Map<number, string[]>();
    for (const msg of matchingMessages) {
      const existing = snippetMap.get(msg.conversationId) || [];
      if (existing.length < 3) {
        const lowerContent = msg.content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const idx = lowerContent.indexOf(lowerQuery);
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(msg.content.length, idx + query.length + 30);
          const snippet = (start > 0 ? '...' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '...' : '');
          existing.push(snippet);
        }
        snippetMap.set(msg.conversationId, existing);
      }
    }

    const allMap = new Map<number, Conversation & { matchSnippets?: string[] }>();
    for (const c of matchingByTitle) allMap.set(c.id, { ...c, matchSnippets: snippetMap.get(c.id) });
    for (const c of convsByContent) {
      if (!allMap.has(c.id)) allMap.set(c.id, { ...c, matchSnippets: snippetMap.get(c.id) });
      else if (snippetMap.has(c.id)) allMap.get(c.id)!.matchSnippets = snippetMap.get(c.id);
    }

    return Array.from(allMap.values()).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // ==================== Chat Messages ====================
  async getChatMessages(conversationId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
  }

  async getChatMessageById(id: number): Promise<ChatMessage | undefined> {
    const [result] = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1);
    return result;
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [result] = await db.insert(chatMessages).values(data).returning();
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, data.conversationId));
    return result;
  }

  async findRecentAttachmentMessages(orgId: number, days: number = 7) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.select({
      id: chatMessages.id,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
      conversationId: chatMessages.conversationId,
    })
    .from(chatMessages)
    .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.orgId, orgId),
        gte(chatMessages.createdAt, cutoff),
        sql`${chatMessages.metadata} IS NOT NULL AND ${chatMessages.metadata}::text LIKE '%attachmentHashes%'`
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(50);
  }

  async deleteChatMessagesByConversation(conversationId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  }

  async deleteChatMessagesAfter(conversationId: number, afterMessageId: number): Promise<number> {
    const result = await db.delete(chatMessages)
      .where(and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.id} > ${afterMessageId}`
      ))
      .returning();
    return result.length;
  }

  async truncateChatMessages(conversationId: number, keepCount: number): Promise<number> {
    const allMessages = await db.select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);

    if (allMessages.length <= keepCount) return 0;

    const idsToDelete = allMessages.slice(keepCount).map(m => m.id);
    const result = await db.delete(chatMessages)
      .where(and(
        eq(chatMessages.conversationId, conversationId),
        inArray(chatMessages.id, idsToDelete)
      ))
      .returning();
    return result.length;
  }

  // ==================== Token Usage ====================
  async createTokenUsage(data: InsertTokenUsage): Promise<TokenUsage> {
    const [result] = await db.insert(tokenUsage).values(data).returning();
    return result;
  }

  async getTokenUsageByOrg(orgId: number, since?: Date): Promise<TokenUsage[]> {
    const conditions = [eq(tokenUsage.orgId, orgId)];
    if (since) {
      conditions.push(sql`${tokenUsage.createdAt} >= ${since}`);
    }
    return db.select().from(tokenUsage).where(and(...conditions)).orderBy(desc(tokenUsage.createdAt));
  }

  async getTokenUsageStats(orgId: number, since?: Date): Promise<{
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: string;
    byPurpose: Record<string, { tokens: number; cost: string }>;
    byUser: Record<number, { tokens: number; cost: string }>;
  }> {
    const conditions = [eq(tokenUsage.orgId, orgId)];
    if (since) {
      conditions.push(sql`${tokenUsage.createdAt} >= ${since}`);
    }
    const rows = await db.select().from(tokenUsage).where(and(...conditions));

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const byPurpose: Record<string, { tokens: number; cost: number }> = {};
    const byUser: Record<number, { tokens: number; cost: number }> = {};

    for (const row of rows) {
      totalPromptTokens += row.promptTokens;
      totalCompletionTokens += row.completionTokens;
      totalTokens += row.totalTokens;
      const cost = parseFloat(row.costUsd || '0');
      totalCost += cost;

      if (!byPurpose[row.purpose]) byPurpose[row.purpose] = { tokens: 0, cost: 0 };
      byPurpose[row.purpose].tokens += row.totalTokens;
      byPurpose[row.purpose].cost += cost;

      if (row.userId) {
        if (!byUser[row.userId]) byUser[row.userId] = { tokens: 0, cost: 0 };
        byUser[row.userId].tokens += row.totalTokens;
        byUser[row.userId].cost += cost;
      }
    }

    const formatPurpose: Record<string, { tokens: number; cost: string }> = {};
    for (const [k, v] of Object.entries(byPurpose)) {
      formatPurpose[k] = { tokens: v.tokens, cost: v.cost.toFixed(6) };
    }
    const formatUser: Record<number, { tokens: number; cost: string }> = {};
    for (const [k, v] of Object.entries(byUser)) {
      formatUser[Number(k)] = { tokens: v.tokens, cost: v.cost.toFixed(6) };
    }

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd: totalCost.toFixed(6),
      byPurpose: formatPurpose,
      byUser: formatUser,
    };
  }

  // ==================== Conversations (org-scoped) ====================
  async getConversationsByOrg(orgId: number): Promise<Conversation[]> {
    return db.select().from(conversations).where(
      and(eq(conversations.orgId, orgId), eq(conversations.isArchived, false))
    ).orderBy(desc(conversations.updatedAt));
  }

  async getConversationsByUser(orgId: number, userId: number): Promise<Conversation[]> {
    return db.select().from(conversations).where(
      and(eq(conversations.orgId, orgId), eq(conversations.userId, userId), eq(conversations.isArchived, false))
    ).orderBy(desc(conversations.updatedAt));
  }

  // ==================== User Memories ====================
  async getUserMemories(userId: number, orgId: number): Promise<UserMemory[]> {
    return db.select().from(userMemories).where(
      and(eq(userMemories.userId, userId), eq(userMemories.orgId, orgId))
    ).orderBy(desc(userMemories.updatedAt));
  }

  async createUserMemory(data: InsertUserMemory): Promise<UserMemory> {
    const [result] = await db.insert(userMemories).values(data).returning();
    return result;
  }

  async deleteUserMemory(id: number): Promise<void> {
    await db.delete(userMemories).where(eq(userMemories.id, id));
  }

  // ==================== Org Memberships ====================
  async getOrgMemberships(userId: number): Promise<OrgMembership[]> {
    return db.select().from(orgMemberships).where(
      and(eq(orgMemberships.userId, userId), eq(orgMemberships.isActive, true))
    );
  }

  async getUserOrgsWithDetails(userId: number): Promise<(OrgMembership & { orgName: string; orgType: string })[]> {
    const result = await db
      .select({
        id: orgMemberships.id,
        userId: orgMemberships.userId,
        orgId: orgMemberships.orgId,
        role: orgMemberships.role,
        deptId: orgMemberships.deptId,
        jobRoleId: orgMemberships.jobRoleId,
        isActive: orgMemberships.isActive,
        joinedAt: orgMemberships.joinedAt,
        orgName: organizations.name,
        orgType: organizations.type,
      })
      .from(orgMemberships)
      .innerJoin(organizations, eq(orgMemberships.orgId, organizations.id))
      .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.isActive, true)));
    return result;
  }

  async createOrgMembership(data: InsertOrgMembership): Promise<OrgMembership> {
    const [result] = await db.insert(orgMemberships).values(data).returning();
    return result;
  }

  async getOrgMembershipByUserAndOrg(userId: number, orgId: number): Promise<OrgMembership | undefined> {
    const [result] = await db.select().from(orgMemberships).where(
      and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, orgId))
    );
    return result;
  }

  async getOrgMembers(orgId: number): Promise<(OrgMembership & { displayName: string; email: string; avatarUrl: string | null })[]> {
    const result = await db
      .select({
        id: orgMemberships.id,
        userId: orgMemberships.userId,
        orgId: orgMemberships.orgId,
        role: orgMemberships.role,
        deptId: orgMemberships.deptId,
        jobRoleId: orgMemberships.jobRoleId,
        isActive: orgMemberships.isActive,
        joinedAt: orgMemberships.joinedAt,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(orgMemberships.userId, users.id))
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.isActive, true)));
    return result;
  }

  async switchActiveOrg(userId: number, orgId: number): Promise<User | undefined> {
    const [result] = await db.update(users).set({ orgId }).where(eq(users.id, userId)).returning();
    return result;
  }

  // ==================== Invitations ====================
  async createInvitation(data: InsertInvitation): Promise<Invitation> {
    const [result] = await db.insert(invitations).values(data).returning();
    return result;
  }

  async getInvitationByCode(code: string): Promise<Invitation | undefined> {
    const [result] = await db.select().from(invitations).where(eq(invitations.inviteCode, code));
    return result;
  }

  async getOrgInvitations(orgId: number): Promise<Invitation[]> {
    return db.select().from(invitations).where(
      and(eq(invitations.orgId, orgId), eq(invitations.isActive, true))
    ).orderBy(desc(invitations.createdAt));
  }

  async deactivateInvitation(id: number): Promise<Invitation | undefined> {
    const [result] = await db.update(invitations).set({ isActive: false }).where(eq(invitations.id, id)).returning();
    return result;
  }

  async incrementInvitationUsedCount(id: number): Promise<void> {
    await db.update(invitations).set({ usedCount: sql`${invitations.usedCount} + 1` }).where(eq(invitations.id, id));
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async updateOrganization(id: number, data: Partial<{ name: string; type: string; description: string | null; tokenBudgetUsd: string | null; budgetResetDay: number }>): Promise<Organization | undefined> {
    const [result] = await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
    return result;
  }

  // ==================== Organization Join Requests ====================
  async createJoinRequest(data: InsertOrganizationJoinRequest): Promise<OrganizationJoinRequest> {
    const [result] = await db.insert(organizationJoinRequests).values(data).returning();
    return result;
  }

  async getJoinRequestsByOrgId(orgId: number, status?: string): Promise<Array<OrganizationJoinRequest & { user: { id: number; displayName: string; email: string; avatarUrl: string | null } }>> {
    const conditions = [eq(organizationJoinRequests.orgId, orgId)];
    if (status) {
      conditions.push(eq(organizationJoinRequests.status, status));
    }
    const results = await db.select({
      id: organizationJoinRequests.id,
      orgId: organizationJoinRequests.orgId,
      userId: organizationJoinRequests.userId,
      message: organizationJoinRequests.message,
      inviteCode: organizationJoinRequests.inviteCode,
      status: organizationJoinRequests.status,
      reviewedBy: organizationJoinRequests.reviewedBy,
      reviewedAt: organizationJoinRequests.reviewedAt,
      reviewNote: organizationJoinRequests.reviewNote,
      createdAt: organizationJoinRequests.createdAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(organizationJoinRequests)
    .innerJoin(users, eq(organizationJoinRequests.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(organizationJoinRequests.createdAt));
    return results;
  }

  async getJoinRequestById(id: number): Promise<OrganizationJoinRequest | undefined> {
    const [result] = await db.select().from(organizationJoinRequests).where(eq(organizationJoinRequests.id, id));
    return result;
  }

  async updateJoinRequest(id: number, data: Partial<OrganizationJoinRequest>): Promise<OrganizationJoinRequest | undefined> {
    const [result] = await db.update(organizationJoinRequests).set(data).where(eq(organizationJoinRequests.id, id)).returning();
    return result;
  }

  async getPendingJoinRequestByUserId(userId: number, orgId: number): Promise<OrganizationJoinRequest | undefined> {
    const [result] = await db.select().from(organizationJoinRequests)
      .where(and(
        eq(organizationJoinRequests.userId, userId),
        eq(organizationJoinRequests.orgId, orgId),
        eq(organizationJoinRequests.status, 'pending')
      ));
    return result;
  }

  async cancelOtherPendingJoinRequests(userId: number, orgId: number, excludeId: number): Promise<void> {
    await db.update(organizationJoinRequests)
      .set({ status: 'cancelled' })
      .where(and(
        eq(organizationJoinRequests.userId, userId),
        eq(organizationJoinRequests.orgId, orgId),
        eq(organizationJoinRequests.status, 'pending'),
        sql`${organizationJoinRequests.id} != ${excludeId}`
      ));
  }

  async deactivateOrgInvitations(orgId: number): Promise<void> {
    await db.update(invitations).set({ isActive: false }).where(
      and(eq(invitations.orgId, orgId), eq(invitations.isActive, true))
    );
  }

  async countOrgMembers(orgId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(orgMemberships)
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.isActive, true)));
    return result[0]?.count ?? 0;
  }

  async createDeliverable(data: InsertTaskDeliverable): Promise<TaskDeliverable> {
    const [deliverable] = await db.insert(taskDeliverables).values(data).returning();
    return deliverable;
  }

  async getDeliverablesByTaskId(taskId: number, onlyLatest = false): Promise<Array<TaskDeliverable & { submitter: { id: number; displayName: string | null; avatarUrl: string | null } }>> {
    const conditions = [eq(taskDeliverables.taskId, taskId)];
    if (onlyLatest) conditions.push(eq(taskDeliverables.isLatest, true));

    const rows = await db
      .select({
        deliverable: taskDeliverables,
        submitterId: users.id,
        submitterName: users.displayName,
        submitterAvatar: users.avatarUrl,
      })
      .from(taskDeliverables)
      .leftJoin(users, eq(taskDeliverables.submittedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(taskDeliverables.version), desc(taskDeliverables.createdAt));

    return rows.map(r => ({
      ...r.deliverable,
      submitter: { id: r.submitterId!, displayName: r.submitterName, avatarUrl: r.submitterAvatar },
    }));
  }

  async getDeliverableById(id: number): Promise<TaskDeliverable | null> {
    const [row] = await db.select().from(taskDeliverables).where(eq(taskDeliverables.id, id));
    return row ?? null;
  }

  async updateDeliverable(id: number, data: Partial<TaskDeliverable>): Promise<TaskDeliverable> {
    const [updated] = await db.update(taskDeliverables).set({ ...data, updatedAt: new Date() }).where(eq(taskDeliverables.id, id)).returning();
    return updated;
  }

  async deleteDeliverable(id: number): Promise<void> {
    const allSubmissions = await db.select().from(taskSubmissions);
    const linked = allSubmissions.some(s => {
      const ids = s.deliverableIds as number[] | null;
      return ids && ids.includes(id);
    });
    if (linked) throw new Error('该交付物已关联提交记录，无法删除');
    await db.delete(taskDeliverables).where(eq(taskDeliverables.id, id));
  }

  async markPreviousVersions(taskId: number, type: string, title: string): Promise<void> {
    await db.update(taskDeliverables)
      .set({ isLatest: false, updatedAt: new Date() })
      .where(and(
        eq(taskDeliverables.taskId, taskId),
        eq(taskDeliverables.type, type),
        eq(taskDeliverables.title, title),
        eq(taskDeliverables.isLatest, true),
      ));
  }

  async createSubmission(data: InsertTaskSubmission): Promise<TaskSubmission> {
    const [submission] = await db.insert(taskSubmissions).values(data).returning();
    return submission;
  }

  async getSubmissionsByTaskId(taskId: number): Promise<Array<TaskSubmission & { submitter: { id: number; displayName: string | null; avatarUrl: string | null }; deliverables: TaskDeliverable[] }>> {
    const rows = await db
      .select({
        submission: taskSubmissions,
        submitterId: users.id,
        submitterName: users.displayName,
        submitterAvatar: users.avatarUrl,
      })
      .from(taskSubmissions)
      .leftJoin(users, eq(taskSubmissions.submittedBy, users.id))
      .where(eq(taskSubmissions.taskId, taskId))
      .orderBy(desc(taskSubmissions.createdAt));

    const results = [];
    for (const r of rows) {
      const ids = (r.submission.deliverableIds as number[] | null) || [];
      let deliverables: TaskDeliverable[] = [];
      if (ids.length > 0) {
        deliverables = await db.select().from(taskDeliverables).where(inArray(taskDeliverables.id, ids));
      }
      results.push({
        ...r.submission,
        submitter: { id: r.submitterId!, displayName: r.submitterName, avatarUrl: r.submitterAvatar },
        deliverables,
      });
    }
    return results;
  }

  async getSubmissionById(id: number): Promise<TaskSubmission | null> {
    const [row] = await db.select().from(taskSubmissions).where(eq(taskSubmissions.id, id));
    return row ?? null;
  }

  async updateSubmission(id: number, data: Partial<TaskSubmission>): Promise<TaskSubmission> {
    const [updated] = await db.update(taskSubmissions).set(data).where(eq(taskSubmissions.id, id)).returning();
    return updated;
  }

  async getPendingSubmissionsByOrgId(orgId: number): Promise<Array<TaskSubmission & { task: { id: number; title: string }; submitter: { id: number; displayName: string | null } }>> {
    const rows = await db
      .select({
        submission: taskSubmissions,
        taskId: tasks.id,
        taskTitle: tasks.title,
        submitterId: users.id,
        submitterName: users.displayName,
      })
      .from(taskSubmissions)
      .innerJoin(tasks, eq(taskSubmissions.taskId, tasks.id))
      .innerJoin(users, eq(taskSubmissions.submittedBy, users.id))
      .where(and(
        eq(taskSubmissions.orgId, orgId),
        eq(taskSubmissions.status, 'pending'),
      ))
      .orderBy(taskSubmissions.createdAt);

    return rows.map(r => ({
      ...r.submission,
      task: { id: r.taskId, title: r.taskTitle },
      submitter: { id: r.submitterId, displayName: r.submitterName },
    }));
  }

  // ===================== Knowledge Base =====================

  async getKbDocumentsByOrg(orgId: number) {
    return await db.select().from(kbDocuments).where(eq(kbDocuments.orgId, orgId)).orderBy(desc(kbDocuments.createdAt));
  }

  async getKbDocumentById(id: number) {
    const [doc] = await db.select().from(kbDocuments).where(eq(kbDocuments.id, id));
    return doc || null;
  }

  async createKbDocument(data: typeof kbDocuments.$inferInsert) {
    const [doc] = await db.insert(kbDocuments).values(data).returning();
    return doc;
  }

  async updateKbDocument(id: number, data: Partial<typeof kbDocuments.$inferInsert>) {
    const [doc] = await db.update(kbDocuments).set({ ...data, updatedAt: new Date() }).where(eq(kbDocuments.id, id)).returning();
    return doc;
  }

  async findKbDocByHash(orgId: number, contentHash: string) {
    const [doc] = await db.select().from(kbDocuments).where(
      and(eq(kbDocuments.orgId, orgId), eq(kbDocuments.contentHash, contentHash))
    ).limit(1);
    return doc || null;
  }

  async findKbDocByFileName(orgId: number, fileName: string) {
    const [doc] = await db.select().from(kbDocuments).where(
      and(eq(kbDocuments.orgId, orgId), eq(kbDocuments.fileName, fileName))
    ).limit(1);
    return doc || null;
  }

  async deleteKbDocument(id: number) {
    await db.delete(kbDocuments).where(eq(kbDocuments.id, id));
  }

  async createKbChunks(chunks: (typeof kbChunks.$inferInsert)[]) {
    if (chunks.length === 0) return [];
    return await db.insert(kbChunks).values(chunks).returning();
  }

  async getKbChunksByDocument(documentId: number) {
    return await db.select().from(kbChunks).where(eq(kbChunks.documentId, documentId)).orderBy(kbChunks.chunkIndex);
  }

  async deleteKbChunksByDocument(documentId: number) {
    await db.delete(kbChunks).where(eq(kbChunks.documentId, documentId));
  }

  async executeRaw(query: any) {
    return await db.execute(query);
  }

  // ===================== Briefings =====================

  async getBriefing(orgId: number, userId: number, date: string) {
    const [b] = await db.select().from(briefings)
      .where(and(eq(briefings.orgId, orgId), eq(briefings.userId, userId), eq(briefings.date, date)));
    return b || null;
  }

  async createBriefing(data: typeof briefings.$inferInsert) {
    const [b] = await db.insert(briefings).values(data).returning();
    return b;
  }

  async deleteBriefing(orgId: number, userId: number, date: string) {
    await db.delete(briefings).where(
      and(eq(briefings.orgId, orgId), eq(briefings.userId, userId), eq(briefings.date, date))
    );
  }

  // ===================== Member Profiles =====================

  async createMemberProfile(data: InsertMemberProfile): Promise<MemberProfile> {
    const [result] = await db.insert(memberProfiles).values(data).returning();
    return result;
  }

  async getMemberProfilesByOrg(orgId: number): Promise<MemberProfile[]> {
    return db.select().from(memberProfiles).where(eq(memberProfiles.orgId, orgId));
  }

  async getPendingProfilesByOrg(orgId: number): Promise<MemberProfile[]> {
    return db.select().from(memberProfiles).where(
      and(eq(memberProfiles.orgId, orgId), or(eq(memberProfiles.status, 'pending'), eq(memberProfiles.status, 'manual')))
    );
  }

  async getMemberProfileById(id: number): Promise<MemberProfile | undefined> {
    const [result] = await db.select().from(memberProfiles).where(eq(memberProfiles.id, id));
    return result;
  }

  async updateMemberProfile(id: number, data: Partial<InsertMemberProfile>): Promise<MemberProfile | undefined> {
    const [result] = await db.update(memberProfiles).set({ ...data, updatedAt: new Date() }).where(eq(memberProfiles.id, id)).returning();
    return result;
  }

  async deleteMemberProfile(id: number): Promise<void> {
    await db.delete(memberProfiles).where(eq(memberProfiles.id, id));
  }

  async migrateTasksFromProfile(profileId: number, userId: number): Promise<number> {
    const result = await db.update(tasks)
      .set({ assigneeId: userId, memberProfileId: null })
      .where(eq(tasks.memberProfileId, profileId))
      .returning();
    return result.length;
  }

  async updateOrgMembership(orgId: number, userId: number, data: { deptId?: number | null; jobRoleId?: number | null; role?: string }): Promise<OrgMembership | undefined> {
    const [result] = await db.update(orgMemberships)
      .set(data)
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)))
      .returning();
    return result;
  }

  async getTaskCountByMemberProfile(profileId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.memberProfileId, profileId));
    return result[0]?.count ?? 0;
  }

  async getAiProviders(): Promise<AiProvider[]> {
    return db.select().from(aiProviders).orderBy(aiProviders.priority);
  }

  async getAiProvider(id: number): Promise<AiProvider | undefined> {
    const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, id));
    return provider;
  }

  async createAiProvider(data: InsertAiProvider): Promise<AiProvider> {
    const [provider] = await db.insert(aiProviders).values(data).returning();
    return provider;
  }

  async updateAiProvider(id: number, data: Partial<InsertAiProvider>): Promise<AiProvider> {
    const [provider] = await db.update(aiProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiProviders.id, id))
      .returning();
    return provider;
  }

  async deleteAiProvider(id: number): Promise<void> {
    await db.delete(aiProviders).where(eq(aiProviders.id, id));
  }

  async reorderAiProviders(ids: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(aiProviders)
          .set({ priority: i, updatedAt: new Date() })
          .where(eq(aiProviders.id, ids[i]));
      }
    });
  }

  async getModelProviders(): Promise<AiModelProvider[]> {
    return db.select().from(aiModelProviders).orderBy(aiModelProviders.modelId, aiModelProviders.priority);
  }

  async getModelProvidersByModel(modelId: string): Promise<AiModelProvider[]> {
    return db.select().from(aiModelProviders)
      .where(eq(aiModelProviders.modelId, modelId))
      .orderBy(aiModelProviders.priority);
  }

  async getModelProvider(id: number): Promise<AiModelProvider | undefined> {
    const [provider] = await db.select().from(aiModelProviders).where(eq(aiModelProviders.id, id));
    return provider;
  }

  async createModelProvider(data: InsertAiModelProvider): Promise<AiModelProvider> {
    const [provider] = await db.insert(aiModelProviders).values(data).returning();
    return provider;
  }

  async updateModelProvider(id: number, data: Partial<InsertAiModelProvider>): Promise<AiModelProvider> {
    const [provider] = await db.update(aiModelProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiModelProviders.id, id))
      .returning();
    return provider;
  }

  async deleteModelProvider(id: number): Promise<void> {
    await db.delete(aiModelProviders).where(eq(aiModelProviders.id, id));
  }

  async reorderModelProviders(modelId: string, ids: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(aiModelProviders)
          .set({ priority: i, updatedAt: new Date() })
          .where(and(eq(aiModelProviders.id, ids[i]), eq(aiModelProviders.modelId, modelId)));
      }
    });
  }

  async createDecisionTask(data: {
    orgId: number;
    projectId: number;
    title: string;
    description: string;
    creatorId: number;
    assigneeId: number;
    decisionForTaskId: number;
    decisionType: string;
    decisionDeadline: Date;
    escalationDeadline: Date;
  }): Promise<Task> {
    const [result] = await db.insert(tasks).values({
      ...data,
      type: 'decision',
      status: 'todo',
      priority: 'high',
      isDecisionTask: true,
      decisionStatus: 'pending',
      weight: 1,
      progress: 0,
      needsReview: false,
    }).returning();
    return result;
  }

  async resolveDecisionTask(
    decisionTaskId: number,
    updates: Partial<InsertTask>
  ): Promise<{ decisionTask: Task; originalTask: Task | undefined }> {
    const decisionTask = await this.getTaskById(decisionTaskId);
    if (!decisionTask || !decisionTask.isDecisionTask || !decisionTask.decisionForTaskId) {
      throw new Error(`Decision task #${decisionTaskId} not found or invalid`);
    }

    const [updatedDecision] = await db.update(tasks).set({
      decisionStatus: 'resolved',
      status: 'done',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tasks.id, decisionTaskId)).returning();

    const originalTask = await db.update(tasks).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(tasks.id, decisionTask.decisionForTaskId)).returning().then(r => r[0]);

    const remainingDecisions = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(
        eq(tasks.decisionForTaskId, decisionTask.decisionForTaskId),
        eq(tasks.isDecisionTask, true),
        eq(tasks.decisionStatus, 'pending')
      ));

    if (Number(remainingDecisions[0]?.count) === 0 && originalTask) {
      await db.update(tasks).set({
        needsReview: false,
        updatedAt: new Date(),
      }).where(eq(tasks.id, decisionTask.decisionForTaskId));
    }

    return { decisionTask: updatedDecision, originalTask };
  }

  async getPendingDecisionTasksForUser(userId: number, orgId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(
      eq(tasks.orgId, orgId),
      eq(tasks.assigneeId, userId),
      eq(tasks.isDecisionTask, true),
      eq(tasks.decisionStatus, 'pending')
    )).orderBy(desc(tasks.createdAt));
  }

  async getPendingDecisionTasksForTask(taskId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(
      eq(tasks.decisionForTaskId, taskId),
      eq(tasks.isDecisionTask, true),
      eq(tasks.decisionStatus, 'pending')
    ));
  }

  async getDecisionTaskStats(orgId: number): Promise<{ pendingCount: number }> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(
        eq(tasks.orgId, orgId),
        eq(tasks.isDecisionTask, true),
        eq(tasks.decisionStatus, 'pending')
      ));
    return { pendingCount: Number(result?.count || 0) };
  }

  async getDecisionTasksForTask(taskId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(
      eq(tasks.decisionForTaskId, taskId),
      eq(tasks.isDecisionTask, true)
    )).orderBy(desc(tasks.createdAt));
  }

  async getSystemConfig(key: string): Promise<string | null> {
    const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return row?.value ?? null;
  }

  async setSystemConfig(key: string, value: string): Promise<void> {
    await db.insert(systemConfig)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

export const storage = new DatabaseStorage();

```

---

## 补充说明

### 意图分类
当前项目的意图分类逻辑集成在 `server/services/ai/index.ts` 的 `classifyTask()` 函数中（约第 359 行），没有独立的意图分类层或 specialist handler 文件。分类结果通过 `getConfigForTask()` 映射到不同模型配置。

### 知识库 / RAG
项目有完整的 RAG 实现：`server/services/kb/` 目录包含文本提取、分块、embedding 生成、向量搜索的完整管线。使用 pgvector 扩展存储 1536 维向量，embedding 模型为 OpenAI text-embedding-3-small。
