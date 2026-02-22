# 第四步：AI 对话入口技术规格 v1.0

## 目标

在应用中接入 Claude API，实现自然语言交互的任务管理入口。用户说一句话就能创建任务、查询任务、更新状态、查看进度，取代传统的表单填写和页面跳转。

**核心原则（必须严格遵守）：**

1. AI 是翻译器，不是执行器 — 修改操作必须经过用户确认
1. AI 输出强制遵循 JSON schema — 保证数据一致性
1. 流式追问而非一次性填完 — 缺少信息时追问，不要猜测

## 技术要求

- AI 模型: Claude (Anthropic API)
- SDK: `@anthropic-ai/sdk`
- API Key: 存储在 Replit Secrets 中，key 名称 `ANTHROPIC_API_KEY`
- 模型选择: 日常解析用 `claude-haiku-4-5-20241022`，复杂判断用 `claude-sonnet-4-5-20250514`
- 安装: `npm install @anthropic-ai/sdk`

-----

## 一、前端：AI 对话组件

### 1.1 对话入口位置

**全局悬浮按钮**，固定在页面右下角：

```
┌──────────────────────────────────┐
│                                  │
│        （当前页面内容）            │
│                                  │
│                                  │
│                           [💬]   │  ← 悬浮按钮, 56px 圆形
└──────────────────────────────────┘
```

点击后展开对话面板：

```
┌──────────────────────────────────┐
│                    ┌────────────┐│
│                    │ AI 助手     ││
│   （当前页面）      │            ││
│                    │ 对话消息... ││
│                    │            ││
│                    │            ││
│                    │ [输入框]   ││
│                    └────────────┘│
└──────────────────────────────────┘
```

- 面板宽度: 400px（桌面端），移动端全屏
- 面板高度: 70vh
- 可拖拽调整大小（预留，当前不实现）
- 点击外部区域不关闭面板（用户可能需要参考其他页面）
- 面板顶部有最小化按钮和关闭按钮

### 1.2 文件结构

```
client/src/
  components/
    ai/
      AiChatButton.tsx      ← 悬浮按钮
      AiChatPanel.tsx       ← 对话面板主容器
      AiMessageList.tsx     ← 消息列表
      AiMessageBubble.tsx   ← 单条消息气泡
      AiConfirmCard.tsx     ← 操作确认卡片（关键组件）
      AiInputBar.tsx        ← 底部输入栏
```

### 1.3 消息类型

对话中有四种消息类型：

**1. 用户消息（user）**

```
┌─────────────────────────────┐
│                    你好，帮我 │
│            创建一个新任务     │  ← 右对齐，蓝色背景
└─────────────────────────────┘
```

**2. AI 文本回复（assistant）**

```
┌─────────────────────────────┐
│ 好的，请告诉我任务的标题     │
│ 和大概的截止时间。           │  ← 左对齐，灰色背景
└─────────────────────────────┘
```

**3. AI 操作确认卡片（confirm）— 最重要的组件**

```
┌─────────────────────────────┐
│ 📋 创建任务                  │
│                              │
│ 标题: 完成Q1课程大纲          │
│ 项目: AI知识库Bot开发         │
│ 负责人: Michael              │
│ 优先级: 🔴 高                │
│ 截止: 2026-03-15             │
│ 权重: 5                      │
│                              │
│    [✅ 确认执行]  [❌ 取消]    │
│    [✏️ 修改]                  │
└─────────────────────────────┘
```

用户点击”确认执行”后才会真正写入数据库。
用户点击”修改”后可以在对话中说要改什么。

**4. 系统状态消息（system）**

```
┌─────────────────────────────┐
│ ✅ 任务「完成Q1课程大纲」    │
│ 已成功创建                   │  ← 居中，绿色小字
└─────────────────────────────┘
```

### 1.4 AiInputBar.tsx

```
┌─────────────────────────────┐
│ [📎] [输入消息...      ] [➤] │
└─────────────────────────────┘
```

- 输入框支持多行（Shift+Enter 换行，Enter 发送）
- 📎 按钮预留（将来用于上传文件，当前不实现功能）
- 发送按钮在输入为空时禁用
- 发送后输入框清空，显示 loading 状态（三个跳动的点）

-----

## 二、后端：AI Service 层

### 2.1 文件结构

```
server/
  services/
    ai/
      index.ts              ← AI service 主入口
      prompts.ts            ← System prompt 定义
      actionSchemas.ts      ← AI 输出的 JSON schema 定义
      actionExecutor.ts     ← 执行确认后的数据库操作
```

### 2.2 API 路由

|方法  |路径               |功能           |
|----|-----------------|-------------|
|POST|`/api/ai/chat`   |发送消息给 AI，获取回复|
|POST|`/api/ai/confirm`|用户确认后执行操作    |

### 2.3 POST `/api/ai/chat` — 对话接口

**请求体：**

```typescript
interface ChatRequest {
  message: string;           // 用户输入
  conversationHistory: {     // 对话历史（前端维护）
    role: 'user' | 'assistant';
    content: string;
  }[];
  currentUserId: number;     // 当前用户ID
}
```

**返回体：**

```typescript
interface ChatResponse {
  type: 'text' | 'confirm' | 'multi_confirm';
  message?: string;            // type=text 时的文本回复
  action?: ActionPayload;      // type=confirm 时的操作数据
  actions?: ActionPayload[];   // type=multi_confirm 时的批量操作
}

interface ActionPayload {
  actionType: string;          // 操作类型
  data: Record<string, any>;   // 操作数据
  summary: string;             // 人类可读的操作摘要
  confidence: number;          // AI 置信度 0-1
  missingFields?: string[];    // 缺失字段
  followUpQuestion?: string;   // 追问问题
}
```

### 2.4 POST `/api/ai/confirm` — 执行确认接口

**请求体：**

```typescript
interface ConfirmRequest {
  actionType: string;
  data: Record<string, any>;
  currentUserId: number;
}
```

**返回体：**

```typescript
interface ConfirmResponse {
  success: boolean;
  message: string;
  entity?: any;  // 创建/更新后的实体数据
}
```

### 2.5 System Prompt（prompts.ts）

这是核心资产，决定了 AI 的行为质量。

```typescript
export const SYSTEM_PROMPT = `你是 Deltapex Education 的企业任务管理 AI 助手。你的工作是帮助团队成员用自然语言管理任务。

## 你的能力
你可以帮助用户执行以下操作：
1. create_task — 创建新任务
2. update_task — 更新任务（状态、优先级、负责人、截止日期等）
3. query_tasks — 查询任务（按项目、状态、负责人等筛选）
4. create_project — 创建新项目
5. query_projects — 查询项目列表和状态
6. add_comment — 给任务添加评论
7. query_overview — 查询整体概览（各状态任务数量、逾期任务等）

## 当前系统上下文
- 组织: Deltapex Education（金融教育公司）
- 当前用户ID: {{currentUserId}}
- 当前用户名: {{currentUserName}}
- 当前时间: {{currentTime}}

## 团队成员
{{teamMembers}}

## 项目列表
{{projectList}}

## 重要规则

### 规则1: 输出格式
你必须以 JSON 格式回复，严格遵循以下结构：

当需要执行操作时（创建/更新/删除）：
{
  "type": "confirm",
  "action": {
    "actionType": "create_task",
    "data": { ... },
    "summary": "创建任务「完成Q1课程大纲」，分配给Michael，截止3月15日",
    "confidence": 0.9
  }
}

当信息不足需要追问时：
{
  "type": "text",
  "message": "好的，我来帮你创建任务。请问这个任务属于哪个项目？截止日期是什么时候？"
}

当回答查询时：
{
  "type": "text",
  "message": "当前有3个进行中的任务：\\n1. 阶段二验收准备（截止2/25）\\n2. CEO决策-双主体定价（截止2/25）\\n3. 重构销售KPI（截止2/21）"
}

当需要批量操作时：
{
  "type": "multi_confirm",
  "actions": [
    { "actionType": "create_task", "data": { ... }, "summary": "..." },
    { "actionType": "create_task", "data": { ... }, "summary": "..." }
  ]
}

### 规则2: 流式追问
当用户提供的信息不足以完成操作时，不要猜测，要追问。
必填字段：
- create_task: title（标题必须有），projectId（必须确认项目）
- 其他字段如果用户没提供，使用合理默认值：
  - priority: "medium"
  - status: "todo"
  - weight: 3
  - assigneeId: 当前用户

追问示例：
用户说"帮我建个任务"→ 追问标题和项目
用户说"帮我建个任务，下周完成课程"→ 追问属于哪个项目
用户说"在AI知识库项目里建个任务，下周完成转录校对"→ 信息足够，直接生成确认卡片

### 规则3: 智能匹配
用户说"Michael"或"michael"→ 匹配到 Michael 用户
用户说"AI项目"或"知识库"→ 匹配到 AI知识库Bot开发 项目
用户说"人事"或"架构"→ 匹配到 人事协议与组织架构调整 项目
用户说"销售"或"运营"→ 匹配到 销售运营与内容体系优化 项目
模糊匹配时 confidence 降低，并在 summary 中说明匹配结果让用户确认。

### 规则4: 查询能力
当用户问"现在有什么任务"、"项目进展怎么样"、"谁在做什么"等查询类问题时：
- 直接返回 type="text" 的回复
- 不需要确认卡片
- 用简洁清晰的格式列出信息

### 规则5: 永远不要
- 永远不要直接执行数据库操作，必须通过确认卡片
- 永远不要编造不存在的项目或用户
- 永远不要在 JSON 之外输出内容
`;
```

### 2.6 Action Schemas（actionSchemas.ts）

定义每种操作的数据结构，用于验证 AI 输出：

```typescript
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1),
  projectId: z.number(),
  description: z.string().optional(),
  type: z.enum(['milestone', 'task', 'subtask', 'bug', 'request']).default('task'),
  status: z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']).default('todo'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  assigneeId: z.number().optional(),
  dueDate: z.string().optional(),  // ISO 日期字符串
  weight: z.number().min(1).max(10).default(3),
  parentTaskId: z.number().optional(),
  tags: z.string().optional(),
});

export const updateTaskSchema = z.object({
  taskId: z.number(),
  title: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assigneeId: z.number().optional(),
  dueDate: z.string().optional(),
  weight: z.number().min(1).max(10).optional(),
  progress: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
});

export const queryTasksSchema = z.object({
  projectId: z.number().optional(),
  assigneeId: z.number().optional(),
  status: z.string().optional(),  // 逗号分隔多个状态
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  deptId: z.number().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
});

export const addCommentSchema = z.object({
  taskId: z.number(),
  content: z.string().min(1),
});

export const ACTION_SCHEMAS: Record<string, z.ZodSchema> = {
  create_task: createTaskSchema,
  update_task: updateTaskSchema,
  query_tasks: queryTasksSchema,
  create_project: createProjectSchema,
  add_comment: addCommentSchema,
};
```

### 2.7 AI Service 主入口（index.ts）

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chat(
  message: string,
  conversationHistory: { role: string; content: string }[],
  context: { currentUserId: number; currentUserName: string }
): Promise<ChatResponse> {

  // 1. 从数据库获取动态上下文（团队成员列表、项目列表）
  const teamMembers = await getTeamMembers();
  const projectList = await getProjectList();

  // 2. 构建 system prompt，替换模板变量
  const systemPrompt = SYSTEM_PROMPT
    .replace('{{currentUserId}}', String(context.currentUserId))
    .replace('{{currentUserName}}', context.currentUserName)
    .replace('{{currentTime}}', new Date().toISOString())
    .replace('{{teamMembers}}', formatTeamMembers(teamMembers))
    .replace('{{projectList}}', formatProjectList(projectList));

  // 3. 调用 Claude API
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20241022',  // 日常解析用 Haiku
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ],
  });

  // 4. 解析 AI 回复
  const aiText = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // 5. 尝试解析 JSON
  try {
    const parsed = JSON.parse(aiText);

    // 如果是确认操作，验证数据结构
    if (parsed.type === 'confirm' && parsed.action) {
      const schema = ACTION_SCHEMAS[parsed.action.actionType];
      if (schema) {
        const validation = schema.safeParse(parsed.action.data);
        if (!validation.success) {
          // 数据验证失败，要求 AI 重新处理
          return {
            type: 'text',
            message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。',
          };
        }
      }
    }

    return parsed;
  } catch {
    // JSON 解析失败，当作普通文本回复
    return { type: 'text', message: aiText };
  }
}
```

### 2.8 Action Executor（actionExecutor.ts）

用户点击”确认执行”后调用：

```typescript
import { db } from '../../db';
import { tasks, projects, taskComments, activityLogs } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export async function executeAction(
  actionType: string,
  data: Record<string, any>,
  userId: number
): Promise<{ success: boolean; message: string; entity?: any }> {

  switch (actionType) {
    case 'create_task': {
      const newTask = await db.insert(tasks).values({
        orgId: 1,
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        type: data.type || 'task',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        creatorId: userId,
        assigneeId: data.assigneeId || userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        weight: data.weight || 3,
        parentTaskId: data.parentTaskId || null,
        tags: data.tags || null,
      }).returning();

      // 写入操作日志，标记来源为 ai_chat
      await db.insert(activityLogs).values({
        orgId: 1,
        userId: userId,
        entityType: 'task',
        entityId: newTask[0].id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',  // 关键：标记为AI操作
      });

      return {
        success: true,
        message: `任务「${data.title}」已成功创建`,
        entity: newTask[0],
      };
    }

    case 'update_task': {
      const { taskId, ...updateFields } = data;

      // 获取更新前的数据用于日志
      const oldTask = await db.select().from(tasks).where(eq(tasks.id, taskId));
      if (!oldTask.length) {
        return { success: false, message: '未找到该任务' };
      }

      // 构建更新对象
      const updateData: Record<string, any> = {};
      if (updateFields.title) updateData.title = updateFields.title;
      if (updateFields.status) updateData.status = updateFields.status;
      if (updateFields.priority) updateData.priority = updateFields.priority;
      if (updateFields.assigneeId) updateData.assigneeId = updateFields.assigneeId;
      if (updateFields.dueDate) updateData.dueDate = new Date(updateFields.dueDate);
      if (updateFields.weight) updateData.weight = updateFields.weight;
      if (updateFields.progress !== undefined) updateData.progress = updateFields.progress;
      if (updateFields.description) updateData.description = updateFields.description;
      updateData.updatedAt = new Date();

      // 如果状态改为 done，自动设置 completedAt
      if (updateFields.status === 'done') {
        updateData.completedAt = new Date();
      }

      const updated = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, taskId))
        .returning();

      // 写入操作日志
      await db.insert(activityLogs).values({
        orgId: 1,
        userId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'update',
        changes: JSON.stringify({
          before: oldTask[0],
          after: updateFields,
        }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `任务「${updated[0].title}」已更新`,
        entity: updated[0],
      };
    }

    case 'create_project': {
      const newProject = await db.insert(projects).values({
        orgId: 1,
        name: data.name,
        description: data.description || null,
        deptId: data.deptId || null,
        ownerId: userId,
        status: 'active',
        startDate: data.startDate ? new Date(data.startDate) : null,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      }).returning();

      await db.insert(activityLogs).values({
        orgId: 1,
        userId: userId,
        entityType: 'project',
        entityId: newProject[0].id,
        action: 'create',
        changes: JSON.stringify(data),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: `项目「${data.name}」已成功创建`,
        entity: newProject[0],
      };
    }

    case 'add_comment': {
      const newComment = await db.insert(taskComments).values({
        taskId: data.taskId,
        userId: userId,
        content: data.content,
      }).returning();

      await db.insert(activityLogs).values({
        orgId: 1,
        userId: userId,
        entityType: 'task',
        entityId: data.taskId,
        action: 'comment',
        changes: JSON.stringify({ content: data.content }),
        source: 'ai_chat',
      });

      return {
        success: true,
        message: '评论已添加',
        entity: newComment[0],
      };
    }

    default:
      return { success: false, message: `不支持的操作类型: ${actionType}` };
  }
}
```

-----

## 三、对话流程示例

### 示例1: 创建任务（信息充足）

```
用户: 在AI知识库项目里建个任务，让Michael下周三前完成Coze插件调试，优先级高
AI: [确认卡片]
    📋 创建任务
    标题: 完成Coze插件调试
    项目: AI知识库Bot开发
    负责人: Michael
    优先级: 🔴 高
    截止: 2026-02-25
    权重: 3
    [确认执行] [取消] [修改]
用户: [点击确认]
系统: ✅ 任务「完成Coze插件调试」已成功创建
```

### 示例2: 创建任务（信息不足，追问）

```
用户: 帮我建个任务
AI: 好的，请告诉我：
    1. 任务标题是什么？
    2. 属于哪个项目？
用户: 审核新学员反馈，放在销售运营项目里
AI: [确认卡片]
    📋 创建任务
    标题: 审核新学员反馈
    项目: 销售运营与内容体系优化
    负责人: Alexso（你自己）
    优先级: 中
    状态: 待办
    [确认执行] [取消] [修改]
```

### 示例3: 更新任务状态

```
用户: 把阶段二验收标记为已完成
AI: [确认卡片]
    ✏️ 更新任务
    任务: 阶段二验收准备 — 需亲自审内容
    变更: 状态 进行中 → 已完成
           进度 30% → 100%
    [确认执行] [取消]
```

### 示例4: 查询

```
用户: 现在有哪些逾期的任务？
AI: 当前有2个逾期任务：
    1. 🔴 重构销售团队KPI考核体系 — 截止2/21，负责人安洲
    2. 🔴 CEO决策-双主体关联交易定价 — 截止2/25，负责人Alexso
    需要我帮你调整截止日期或状态吗？
```

### 示例5: 批量操作

```
用户: 帮我在AI知识库项目里批量创建3个任务：校对转录文稿、整理术语表、设计课程封面
AI: [批量确认卡片]
    📋 批量创建 3 个任务（项目: AI知识库Bot开发）
    1. 校对转录文稿 | 负责人: Alexso | 优先级: 中
    2. 整理术语表 | 负责人: Alexso | 优先级: 中
    3. 设计课程封面 | 负责人: Alexso | 优先级: 中
    [全部确认] [逐个确认] [取消]
```

-----

## 四、前端状态管理

### 4.1 对话状态

```typescript
interface ChatState {
  isOpen: boolean;              // 面板是否展开
  messages: ChatMessage[];      // 消息列表
  isLoading: boolean;           // AI 是否正在回复
  pendingAction: ActionPayload | null;  // 待确认的操作
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'confirm' | 'system';
  content?: string;             // 文本消息内容
  action?: ActionPayload;       // 确认操作数据
  timestamp: Date;
}
```

### 4.2 对话历史

- 对话历史保存在前端内存中（React state）
- 发送给 API 时携带最近 20 条对话记录作为上下文
- 页面刷新后对话历史清空（当前阶段不做持久化）

-----

## 五、安全考虑

1. **API Key 安全**: 存在 Replit Secrets 中，前端永远不会接触到 API Key
1. **操作确认**: 所有写操作必须经过确认卡片，前端 → 后端 confirm 接口 → 数据库
1. **操作日志**: 所有 AI 操作记录 source=‘ai_chat’，可追溯
1. **输入验证**: AI 输出的数据通过 Zod schema 验证后才展示确认卡片
1. **当前用户绑定**: 所有操作绑定当前登录用户的 ID

-----

## 六、验收标准

1. ✅ 右下角出现 AI 对话悬浮按钮
1. ✅ 点击按钮展开对话面板
1. ✅ 可以发送消息并收到 AI 回复
1. ✅ 说”帮我创建任务”时 AI 会追问缺少的信息
1. ✅ 提供完整信息后 AI 返回确认卡片
1. ✅ 点击确认后任务成功写入数据库
1. ✅ 创建的任务在任务列表和图谱中可见
1. ✅ 说”现在有什么任务”时 AI 返回查询结果
1. ✅ 说”把xxx标记为已完成”时 AI 返回更新确认卡片
1. ✅ 所有 AI 操作在 activity_logs 中记录 source=‘ai_chat’
1. ✅ 对话历史正确维护，AI 能理解上下文

-----

## 七、给 Replit Agent 的指令

请按照本文档的规格实现 AI 对话功能。**请分三轮实现：**

### 第一轮：后端 AI Service

1. 安装 SDK: `npm install @anthropic-ai/sdk`
1. 确认 Replit Secrets 中已设置 `ANTHROPIC_API_KEY`
1. 创建 `server/services/ai/` 目录及所有文件
1. 实现 `POST /api/ai/chat` 和 `POST /api/ai/confirm` 路由
1. System prompt 必须包含动态上下文（团队成员、项目列表）
1. AI 输出通过 Zod schema 验证
1. 确认执行后写入操作日志，source 为 ‘ai_chat’

### 第二轮：前端对话组件

1. 创建 `client/src/components/ai/` 目录及所有组件
1. 实现悬浮按钮和对话面板
1. 实现消息列表、消息气泡、输入栏
1. 实现操作确认卡片（确认/取消/修改按钮）
1. 对话面板在所有页面可用（全局组件）

### 第三轮：联调测试

1. 测试创建任务流程（完整信息 + 追问流程）
1. 测试更新任务流程
1. 测试查询任务流程
1. 确认操作日志记录正确
1. 确认图谱页面能看到 AI 创建的任务

**重要：**

- 在开始之前，必须先在 Replit Secrets 中设置 `ANTHROPIC_API_KEY`
- 日常对话用 `claude-haiku-4-5-20241022` 模型
- AI 的 JSON 输出必须经过验证才能展示给用户
- 所有写操作必须经过确认卡片，禁止 AI 直接写数据库