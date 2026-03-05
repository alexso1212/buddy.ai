# BuddyAI 架构摘要（供知识库模块设计用）
> 自动生成于 2026-03-05
> 用途：提供给产品经理（Claude）设计知识库 Builder 功能

---

## Part 1：数据库 Schema 关键表

> 来源：`shared/schema.ts`（850 行）

### 1.1 完整定义的关键表

#### organizations（组织/公司）
```typescript
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
```

#### departments（部门）
```typescript
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
```

#### users（用户）
```typescript
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### job_roles（岗位职责）
```typescript
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
```

#### conversations（AI 对话）
```typescript
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
```

#### chat_messages（对话消息）
```typescript
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('text'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### verdicts（权责判定记录）
```typescript
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
```

#### token_usage（Token 用量记录）
```typescript
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
```

### 1.2 其他表（表名 + 主键）

| 表名 | 主键 | 用途 |
|------|------|------|
| `org_memberships` | `id: serial` | 组织成员关系（多对多） |
| `invitations` | `id: serial` | 组织邀请码 |
| `organization_join_requests` | `id: serial` | 组织加入申请 |
| `projects` | `id: serial` | 项目 |
| `tasks` | `id: serial` | 任务（核心表，含 parentTaskId 支持子任务） |
| `task_deliverables` | `id: serial` | 任务交付物（含版本管理） |
| `task_submissions` | `id: serial` | 任务提交记录 |
| `task_dependencies` | `id: serial` | 任务依赖关系 |
| `activity_logs` | `id: serial` | 操作日志 |
| `task_comments` | `id: serial` | 任务评论 |
| `task_participants` | `id: serial` | 任务参与人 |
| `notifications` | `id: serial` | 通知 |
| `user_memories` | `id: serial` | 用户记忆（AI 自动提取） |

---

## Part 2：AI 核心接口

> 来源：`server/services/ai/index.ts`（1536 行）

### 2.1 文件顶部 import 语句

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';
import { CODE_TOOLS, executeCodeTool } from './codeTools';
```

### 2.2 客户端初始化与模型路由

```typescript
const openrouterClient = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  timeout: 30000,
});

const claudeComplexClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_COMPLEX_API_KEY,
  timeout: 180000,
});

const claudeSimpleClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
  timeout: 90000,
});

const COMPLEX_MODELS = ['claude-opus-4-6'];
const SIMPLE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

function getClientForModel(model: string): OpenAI {
  if (COMPLEX_MODELS.includes(model)) return claudeComplexClient;
  if (SIMPLE_MODELS.includes(model)) return claudeSimpleClient;
  return openrouterClient;
}
```

### 2.3 任务分类类型与模型配置

```typescript
type TaskCategory = 'title_generation' | 'auto_judgment' | 'quick_reply' | 'general_chat' | 'code_generation' | 'complex_analysis' | 'document_processing';

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
};

const USER_MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6': 64000,
  'claude-sonnet-4-6': 8192,
  'claude-haiku-4-5-20251001': 2048,
  'gpt-4o': 16384,
  'deepseek-chat': 8192,
};
```

### 2.4 `classifyTask()` 完整代码

```typescript
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
    const client = getClientForModel('claude-haiku-4-5-20251001');
    const response = await client.chat.completions.create({
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
    const result = (response.choices[0]?.message?.content || '').trim().toLowerCase();
    const validCategories: TaskCategory[] = ['quick_reply', 'general_chat', 'code_generation', 'complex_analysis', 'document_processing'];
    if (validCategories.includes(result as TaskCategory)) return result as TaskCategory;
    return 'general_chat';
  } catch {
    return 'general_chat';
  }
}
```

### 2.5 `chatStream()` 签名 + 前 30 行

```typescript
export async function* chatStream(
  message: string,
  conversationHistory: { role: string; content: string | any[] }[],
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; extendedThinking?: boolean; orgId?: number },
  attachments?: { type: string; name: string; mimeType: string; base64: string }[]
): AsyncGenerator<{ type: 'token' | 'done' | 'error'; content?: string; tokenUsage?: ChatResponse['tokenUsage'] }> {
  const hasAttachments = !!(attachments && attachments.length > 0);
  const taskCategory = await classifyTask(message, hasAttachments);
  const config = getConfigForTask(taskCategory, context.model, context.extendedThinking);
  const modelName = config.model;
  const { prompt: systemPrompt } = await buildContextualSystemPrompt({ ...context, model: modelName }, 'streaming');
  const aiClient = getClientForModel(modelName);

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
          // ... mammoth 解析 .docx
        } else if (['txt', 'csv', 'json', 'md', ...].includes(ext)) {
          fileText = buffer.toString('utf-8');
        } else {
          fileText = `[不支持直接解析的文件格式: .${ext}]`;
        }
        // ... 组装 contentParts
      }
    }
    // ... 构建请求参数、处理 Extended Thinking、流式输出
  }
}
```

### 2.6 `buildOptimizedContext()` 签名与核心逻辑

```typescript
async function buildOptimizedContext(
  conversationHistory: { role: string; content: string | any[] }[],
  task: TaskCategory,
): Promise<{ role: string; content: string | any[] }[]>
```

**核心逻辑：**
1. 根据 `CONTEXT_LIMITS[task]` 获取该任务类型的上下文消息数限制（4-20 条）
2. 如果消息数 ≤ 限制，直接返回全部
3. 如果超出限制，将消息拆分为"较旧消息"和"最近消息"两部分
4. 使用 Haiku 模型将较旧消息压缩为 200 字以内的摘要
5. 将摘要注入为 `[前期对话摘要]` 前缀，与最近消息合并返回
6. 压缩失败时降级返回最近消息

**上下文消息数限制表：**
```typescript
const CONTEXT_LIMITS: Record<TaskCategory, number> = {
  title_generation: 4,
  auto_judgment: 4,
  quick_reply: 4,
  general_chat: 20,
  code_generation: 10,
  complex_analysis: 20,
  document_processing: 6,
};
```

### 2.7 `extractMemories()` 签名

```typescript
export async function extractMemories(
  conversationMessages: { role: string; content: string }[],
  userId: number,
  orgId: number
): Promise<void>
```

### 2.8 所有 export 函数名列表

| 函数名 | 类型 | 行号 |
|--------|------|------|
| `buildContextualSystemPrompt` | `async function` | 700 |
| `chat` | `async function` | 966 |
| `chatStream` | `async function*` | 1158 |
| `generateProjectTasks` | `async function` | 1273 |
| `extractMemories` | `async function` | 1334 |
| `generateConversationTitle` | `async function` | 1404 |
| `codeToolChatStream` | `async function*` | 1436 |

---

## Part 3：System Prompt

> 来源：`server/services/ai/prompts.ts`（191 行，完整复制）

```typescript
export const SYSTEM_PROMPT = `你是 Deltapex Education 的企业任务管理 AI 助手。你的工作是帮助团队成员用自然语言管理任务。

## 你的能力
你可以帮助用户执行以下操作：
1. create_task — 创建新任务
2. update_task — 更新任务（状态、优先级、负责人、截止日期等）
3. create_project — 创建新项目
4. add_comment — 给任务添加评论
5. 回答查询类问题（任务列表、项目进展、工作概览等）
6. judge_assignment — 判定任务分配是否合理（权责判定），用户说"判断一下"、"合不合理"、"应该谁做"时触发
7. query_verdicts — 查询某人的权责判定历史和统计，用户说"权责分布"、"分外工作"时触发

## 当前系统上下文
- 组织: Deltapex Education（金融教育公司）
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

### 规则5: 永远不要
- 永远不要编造不存在的项目或用户
- 永远不要在 JSON 之外输出额外内容
- 永远不要用 markdown 代码块包裹 JSON
- 永远不要对查询请求返回 confirm 类型
`;
```

---

## Part 4：路由模式

> 来源：`server/routes.ts`（3297 行）

### 4.1 文件顶部 import 语句

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
} from "@shared/schema";
import { judgeTaskAssignment } from "./services/ai/verdictService";
import { searchWeb } from "./services/ai/webSearch";
import { generateInviteCode } from "./utils/inviteCode";
```

### 4.2 CRUD 模式参考：`/api/departments`

```typescript
app.get("/api/departments", async (_req, res) => {
  try {
    const data = await storage.getDepartments();
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/departments", async (req, res) => {
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

app.patch("/api/departments/:id", async (req, res) => {
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

app.delete("/api/departments/:id", async (req, res) => {
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
```

### 4.3 AI 对话相关路由完整代码

#### `/api/conversations/*` 路由

```typescript
// ===================== Conversations =====================
app.get("/api/conversations", async (req, res) => {
  try {
    const data = await storage.getConversationsByOrg(req.orgId);
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/conversations/search", async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const data = await storage.searchConversations(req.orgId, q);
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await storage.getConversationById(id);
    if (!data) return res.status(404).json({ error: "Conversation not found" });
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/conversations", async (req, res) => {
  try {
    const parsed = insertConversationSchema.parse(req.body);
    const data = await storage.createConversation(parsed);
    return res.json({ data });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

app.patch("/api/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await storage.updateConversation(id, req.body);
    if (!data) return res.status(404).json({ error: "Conversation not found" });
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/api/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteConversation(id);
    return res.json({ data: { success: true } });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ===================== Chat Messages =====================
app.get("/api/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const data = await storage.getChatMessages(conversationId);
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/conversations/:id/messages", async (req, res) => {
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
```

#### `/api/ai/*` 路由

```typescript
// ===================== AI Guided Options =====================
app.get("/api/ai/guided-options", async (req, res) => {
  // 返回 parentTasks / departments / users / projects 选项列表
  // 用于 follow_up 引导创建时的下拉选择
});

// ===================== AI Decompose Project =====================
app.post("/api/ai/decompose-project", async (req, res) => {
  // 接收 projectName, projectDescription
  // 调用 generateProjectTasks() 返回 3-8 个建议任务
  // 记录 token 用量
});

// ===================== AI Chat Stream =====================
app.post("/api/ai/chat/stream", async (req, res) => {
  // 主要的流式 AI 对话端点
  // 接收: message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking, replyStyle, webSearchEnabled, codeContextEnabled, attachments
  // 流程:
  //   1. 自动创建新对话（如无 conversationId）
  //   2. 从 DB 加载历史（如 history 为空）
  //   3. 设置 SSE 响应头
  //   4. 处理 webSearch（Tavily API）
  //   5. 处理 codeContext（注入代码上下文到系统 prompt）
  //   6. 选择 generator: codeToolChatStream（Anthropic native + tool use）或 aiChatStream（OpenAI-compatible streaming）
  //   7. 流式输出: start → search_results → code_files → thinking → token → tool_use → tool_result → action → interactive_input → done
  //   8. 异步生成对话标题（新对话）
  //   9. 异步提取记忆
  //   10. 记录 token 用量
  // 错误分类: rate_limit / context_too_long / service_unavailable / network / unknown
});

// ===================== AI Chat (非流式) =====================
app.post("/api/ai/chat", async (req, res) => {
  // 非流式 AI 对话端点，返回完整 JSON 响应
  // 接收: message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking
});

// ===================== AI Confirm =====================
app.post("/api/ai/confirm", async (req, res) => {
  // 执行 AI 建议的操作（create_task, update_task, create_project 等）
  // 接收: actionType, data, currentUserId, conversationId
  // 执行后保存系统消息到对话历史
  // 冲突返回 409
});

// ===================== AI Confirm Batch =====================
app.post("/api/ai/confirm-batch", async (req, res) => {
  // 批量执行 AI 建议的操作
  // 接收: actions[], currentUserId, conversationId
});
```

### 4.4 所有路由列表（按分组）

#### Auth（认证）
| Method | Path |
|--------|------|
| GET | `/api/auth/oidc/complete` |
| POST | `/api/auth/telegram` |
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |
| PUT | `/api/auth/profile` |
| PUT | `/api/auth/password` |

#### User / Org Switch
| Method | Path |
|--------|------|
| GET | `/api/user/orgs` |
| POST | `/api/user/switch-org` |

#### Org Members & Invitations
| Method | Path |
|--------|------|
| GET | `/api/org/members` |
| POST | `/api/invitations` |
| GET | `/api/invitations` |
| DELETE | `/api/invitations/:id` |
| GET | `/api/invitations/verify/:code` |
| POST | `/api/invitations/accept/:code` |

#### Organizations
| Method | Path | 备注 |
|--------|------|------|
| POST | `/api/organizations` (L513) | authMiddleware，onboarding 创建组织 |
| GET | `/api/organizations/search` | 搜索公开组织 |
| POST | `/api/organizations/:id/join-requests` | 申请加入组织 |
| GET | `/api/organizations/:id/join-requests` | 查看加入申请列表 |
| PUT | `/api/organizations/:id/join-requests/:requestId` | 审核加入申请 |
| GET | `/api/organizations/:id/invite-code` | 获取邀请码 |
| POST | `/api/organizations/:id/invite-code/regenerate` | 重新生成邀请码 |
| GET | `/api/organizations` (L834) | 基础 CRUD 列表 |
| POST | `/api/organizations` (L843) | 基础 CRUD 创建（无 auth） |

#### Departments
| Method | Path |
|--------|------|
| GET | `/api/departments` |
| POST | `/api/departments` |
| PATCH | `/api/departments/:id` |
| DELETE | `/api/departments/:id` |

#### Users
| Method | Path |
|--------|------|
| GET | `/api/users` |
| POST | `/api/users` |
| PATCH | `/api/users/:id` |
| DELETE | `/api/users/:id` |

#### Projects
| Method | Path |
|--------|------|
| GET | `/api/projects` |
| GET | `/api/projects/:id` |
| POST | `/api/projects` |
| PATCH | `/api/projects/:id` |
| DELETE | `/api/projects/:id` |

#### Tasks
| Method | Path |
|--------|------|
| GET | `/api/tasks` |
| GET | `/api/tasks/:id` |
| POST | `/api/tasks` |
| PATCH | `/api/tasks/:id` |
| DELETE | `/api/tasks/:id` |

#### Task Dependencies
| Method | Path |
|--------|------|
| GET | `/api/tasks/:id/dependencies` |
| POST | `/api/task-dependencies` |
| DELETE | `/api/task-dependencies/:id` |

#### Task Comments
| Method | Path |
|--------|------|
| GET | `/api/tasks/:id/comments` |
| POST | `/api/tasks/:id/comments` |

#### Task Participants
| Method | Path |
|--------|------|
| GET | `/api/tasks/:id/participants` |
| POST | `/api/tasks/:id/participants` |
| DELETE | `/api/tasks/:taskId/participants/:userId` |

#### Task Deliverables
| Method | Path |
|--------|------|
| POST | `/api/tasks/:taskId/deliverables` (multer upload) |
| GET | `/api/tasks/:taskId/deliverables` |
| DELETE | `/api/tasks/:taskId/deliverables/:id` |

#### Task Submissions & Reviews
| Method | Path |
|--------|------|
| POST | `/api/tasks/:taskId/submissions` |
| GET | `/api/tasks/:taskId/submissions` |
| GET | `/api/organizations/:orgId/pending-reviews` |
| PUT | `/api/tasks/:taskId/submissions/:submissionId/review` |

#### Activity Logs
| Method | Path |
|--------|------|
| GET | `/api/activity-logs` |

#### Graph View
| Method | Path |
|--------|------|
| GET | `/api/graph/data` |
| GET | `/api/graph/subtasks/:taskId` |
| GET | `/api/graph/collaboration-health` |
| POST | `/api/graph/ai-analysis` |

#### Job Roles
| Method | Path |
|--------|------|
| GET | `/api/job-roles` |
| POST | `/api/job-roles` |
| PATCH | `/api/job-roles/:id` |
| DELETE | `/api/job-roles/:id` |
| PATCH | `/api/users/:id/job-role` |

#### Verdicts（权责判定）
| Method | Path |
|--------|------|
| POST | `/api/verdicts/judge` |
| POST | `/api/verdicts/judge-assignment` |
| GET | `/api/verdicts/task/:taskId` |
| GET | `/api/verdicts/user/:userId` |
| PATCH | `/api/verdicts/:id/accept` |
| PATCH | `/api/verdicts/:id/override` |
| GET | `/api/verdicts/stats` |

#### Notifications
| Method | Path |
|--------|------|
| GET | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| PATCH | `/api/notifications/:id/read` |
| POST | `/api/notifications/mark-all-read` |

#### Stats
| Method | Path |
|--------|------|
| GET | `/api/stats/overview` |

#### Conversations
| Method | Path |
|--------|------|
| GET | `/api/conversations` |
| GET | `/api/conversations/search` |
| GET | `/api/conversations/:id` |
| POST | `/api/conversations` |
| PATCH | `/api/conversations/:id` |
| DELETE | `/api/conversations/:id` |

#### Chat Messages
| Method | Path |
|--------|------|
| GET | `/api/conversations/:id/messages` |
| POST | `/api/conversations/:id/messages` |
| DELETE | `/api/conversations/:id/messages/after/:messageId` |
| POST | `/api/conversations/:id/messages/truncate` |

#### AI
| Method | Path |
|--------|------|
| GET | `/api/ai/guided-options` |
| POST | `/api/ai/decompose-project` |
| POST | `/api/ai/chat/stream` |
| POST | `/api/ai/chat` |
| POST | `/api/ai/confirm` |
| POST | `/api/ai/confirm-batch` |

#### User Memories
| Method | Path |
|--------|------|
| GET | `/api/user-memories` |
| POST | `/api/user-memories` |
| DELETE | `/api/user-memories/:id` |

#### Token Usage & Budget
| Method | Path |
|--------|------|
| GET | `/api/token-usage/balance` |
| PATCH | `/api/organization/budget` |
| GET | `/api/token-usage/stats` |

---

## Part 5：AI 服务目录结构

### 5.1 文件列表

```
server/services/ai/actionExecutor.ts
server/services/ai/actionSchemas.ts
server/services/ai/codeContext.ts
server/services/ai/codeTools.ts
server/services/ai/index.ts
server/services/ai/prompts.ts
server/services/ai/tokenCost.ts
server/services/ai/verdictService.ts
server/services/ai/webSearch.ts
```

### 5.2 每个文件的行数

```
   392 server/services/ai/actionExecutor.ts
    98 server/services/ai/actionSchemas.ts
   302 server/services/ai/codeContext.ts
   237 server/services/ai/codeTools.ts
  1536 server/services/ai/index.ts
   191 server/services/ai/prompts.ts
    21 server/services/ai/tokenCost.ts
   297 server/services/ai/verdictService.ts
    53 server/services/ai/webSearch.ts
  3127 total
```

### 5.3 每个文件的 export 列表

```
=== server/services/ai/actionExecutor.ts ===
4:export async function executeAction(
324:export async function executeBatchActions(

=== server/services/ai/actionSchemas.ts ===
3:export const createTaskSchema = z.object({
21:export const updateTaskSchema = z.object({
34:export const queryTasksSchema = z.object({
40:export const createProjectSchema = z.object({
48:export const addCommentSchema = z.object({
53:export const judgeAssignmentSchema = z.object({
58:export const queryVerdictsSchema = z.object({
63:export const createUserSchema = z.object({
71:export const updateUserSchema = z.object({
80:export const createDepartmentSchema = z.object({
87:export const ACTION_SCHEMAS: Record<string, z.ZodSchema> = {

=== server/services/ai/codeContext.ts ===
78:export function generateFileTree(): string {
106:export function readFileContent(filePath: string, maxLines = 500): { content: string; truncated: boolean; totalLines: number } | null {
158:export function getKeyFilesContent(): { file: string; content: string }[] {
179:export function extractFileReferences(message: string): string[] {
189:export function buildCodeContextBlock(message: string, includeKeyFiles = true): { contextBlock: string; loadedFiles: string[]; failedFiles: string[] } {

=== server/services/ai/codeTools.ts ===
40:export const CODE_TOOLS = [
188:export function executeCodeTool(name: string, input: Record<string, any>): string {

=== server/services/ai/index.ts ===
700:export async function buildContextualSystemPrompt(
966:export async function chat(
1158:export async function* chatStream(
1273:export async function generateProjectTasks(
1334:export async function extractMemories(
1404:export async function generateConversationTitle(
1436:export async function* codeToolChatStream(

=== server/services/ai/prompts.ts ===
1:export const SYSTEM_PROMPT = `...`;

=== server/services/ai/tokenCost.ts ===
11:export function calculateCost(

=== server/services/ai/verdictService.ts ===
83:export interface VerdictResult {
248:export interface VerdictResultWithUsage extends VerdictResult {
257:export async function judgeTaskAssignment(

=== server/services/ai/webSearch.ts ===
12:export async function searchWeb(query: string, maxResults?: number): Promise<WebSearchResponse> {
```

---

## Part 6：现有文件上传机制

### 6.1 multer 配置代码

```typescript
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
```

**配置摘要：**
- 存储路径：`uploads/` 目录（磁盘存储）
- 文件命名：`时间戳-随机数.原始扩展名`
- 文件大小限制：50MB
- 静态文件服务：`/uploads` 路由
- 无文件类型过滤（接受所有类型）

### 6.2 文件上传路由完整代码

```typescript
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

app.get("/api/tasks/:taskId/deliverables", async (req, res) => {
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

app.delete("/api/tasks/:taskId/deliverables/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const id = parseInt(req.params.id);
    const deliverable = await storage.getDeliverableById(id);
    if (!deliverable) return res.status(404).json({ error: "交付物不存在" });
    if (deliverable.taskId !== taskId) return res.status(400).json({ error: "交付物不属于该任务" });
    // ... 删除逻辑
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});
```

### 6.3 存储目录

上传的文件存储在项目根目录下的 `uploads/` 文件夹中，通过 `express.static('uploads')` 在 `/uploads` 路径下提供静态文件服务。

---

## Part 7：环境与依赖

### 7.1 pgvector 可用性

```
  name  | default_version | installed_version |                       comment
--------+-----------------+-------------------+------------------------------------------------------
 vector | 0.8.0           |                   | vector data type and ivfflat and hnsw access methods
(1 row)
```

**结论：** pgvector v0.8.0 **可用但未安装**。可通过 `CREATE EXTENSION vector;` 启用。支持 ivfflat 和 hnsw 索引方法。

### 7.2 相关 npm 包

```
rest-express@1.0.0 /home/runner/workspace
├── mammoth@1.11.0
└── multer@2.0.2
```

**注意：** `pdf-parse` **未安装**。当前仅支持 `.docx`（mammoth）和纯文本文件的解析。

### 7.3 PostgreSQL 版本

```
PostgreSQL 16.10 on x86_64-pc-linux-gnu, compiled by clang version 19.1.7, 64-bit
```
