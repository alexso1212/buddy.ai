# 基础架构加固：对话持久化 + Token 计费 + 多租户隔离 v1.0

## 背景

产品计划商用，需要在功能迭代前先加固基础层，避免后期大改。

## 改造范围

1. 对话持久化（conversations + messages 表）
1. Token 用量追踪（token_usage 表）
1. 多租户数据隔离中间件
1. 前端对话面板改造（历史对话列表）

-----

## 一、数据模型新增

### 1.1 conversations 表

```typescript
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 255 }),
  // 对话标题，自动取用户第一条消息的前20个字符
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.2 messages 表

```typescript
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  // 消息的文本内容
  messageType: varchar('message_type', { length: 20 }).notNull().default('text'),
  // 'text' — 普通文本消息
  // 'confirm' — 单个操作确认卡片
  // 'multi_confirm' — 批量操作确认卡片
  // 'follow_up' — 结构化追问（带按钮选项）
  // 'system' — 系统状态消息（如"任务已创建"）
  actionData: text('action_data'),
  // 非 text 类型时存储 JSON 数据（确认卡片数据、追问选项等）
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.3 token_usage 表

```typescript
export const tokenUsage = pgTable('token_usage', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  conversationId: integer('conversation_id').references(() => conversations.id),
  model: varchar('model', { length: 100 }).notNull(),
  // 使用的模型名称，如 'claude-sonnet-4-20250514'
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  estimatedCost: real('estimated_cost'),
  // 按模型价格估算的成本（美元）
  // claude-sonnet-4: input $3/MTok, output $15/MTok
  // claude-haiku-4.5: input $0.80/MTok, output $4/MTok
  purpose: varchar('purpose', { length: 50 }).notNull(),
  // 'chat' — 普通对话
  // 'verdict' — 权责判定
  // 'parse_meeting' — 会议纪要解析
  // 'onboarding' — 组织架构建档
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.4 Relations

```typescript
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
  tokenUsages: many(tokenUsage),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
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
```

运行 `npx drizzle-kit generate` 和 `npx drizzle-kit push` 同步数据库。

-----

## 二、后端 API 改造

### 2.1 对话管理 API

|方法    |路径                               |功能                                 |
|------|---------------------------------|-----------------------------------|
|GET   |`/api/conversations`             |当前用户的对话列表（按 lastMessageAt 倒序，最多50条）|
|GET   |`/api/conversations/:id/messages`|获取某对话的所有消息                         |
|POST  |`/api/conversations`             |创建新对话（可选，chat 接口会自动创建）             |
|DELETE|`/api/conversations/:id`         |归档对话（设 isArchived=true，软删除）        |
|GET   |`/api/token-usage/stats`         |Token 用量统计                         |

### 2.2 Token 用量统计接口

**GET `/api/token-usage/stats`**

查询参数：

- `?period=today|week|month|all` — 统计周期
- `?userId=1` — 指定用户（管理者可查看全部）

返回：

```typescript
{
  data: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    byPurpose: {
      chat: { tokens: number; cost: number; count: number };
      verdict: { tokens: number; cost: number; count: number };
      // ...
    };
    byUser: {  // 仅管理者可见
      userId: number;
      userName: string;
      totalTokens: number;
      estimatedCost: number;
    }[];
  }
}
```

### 2.3 修改 `/api/ai/chat` 接口

**请求体变更：**

```typescript
interface ChatRequest {
  message: string;
  conversationId?: number;  // 新增：可选，为空则自动创建新对话
  currentUserId: number;
  // 移除 conversationHistory — 改为从数据库读取
}
```

**处理流程变更：**

```
1. 如果 conversationId 为空：
   → 创建新 conversation 记录
   → 标题 = message.slice(0, 20)

2. 如果 conversationId 有值：
   → 验证该对话属于当前用户
   → 从 messages 表读取该对话的历史消息（最近20条）

3. 将用户消息写入 messages 表：
   → role: 'user', content: message, messageType: 'text'

4. 调用 AI API（与之前相同）

5. 从 AI API response 中提取 token 用量：
   → response.usage.prompt_tokens
   → response.usage.completion_tokens
   → 写入 token_usage 表

6. 将 AI 回复写入 messages 表：
   → role: 'assistant'
   → content: AI 回复的文本
   → messageType: 根据 AI 回复类型设置
   → actionData: 如果是 confirm/follow_up，存 JSON

7. 更新 conversation.lastMessageAt

8. 返回响应时附带 conversationId：
   {
     conversationId: number,  // 新增
     type: 'text' | 'confirm' | 'follow_up' | ...,
     message?: string,
     action?: ActionPayload,
     // ...
   }
```

### 2.4 修改 `/api/ai/confirm` 接口

确认执行成功后，将系统消息写入 messages 表：

```
role: 'system'
content: '✅ 任务「xxx」已成功创建'
messageType: 'system'
```

### 2.5 同样修改权责判定的 AI 调用

`verdictService.ts` 中调用 AI 后，也要记录 token_usage：

```typescript
await db.insert(tokenUsage).values({
  orgId: ...,
  userId: ...,
  model: 'claude-sonnet-4-20250514',
  inputTokens: response.usage.prompt_tokens,
  outputTokens: response.usage.completion_tokens,
  totalTokens: response.usage.total_tokens,
  estimatedCost: calculateCost(response.usage, 'claude-sonnet-4-20250514'),
  purpose: 'verdict',
});
```

### 2.6 成本计算函数

```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },     // $/MTok
  'claude-haiku-4-5-20241022': { input: 0.80, output: 4.0 },    // $/MTok
};

function calculateCost(
  usage: { prompt_tokens: number; completion_tokens: number },
  model: string
): number {
  const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 };
  const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // 保留4位小数
}
```

-----

## 三、多租户隔离中间件

创建 `server/middleware/orgIsolation.ts`：

```typescript
import { Request, Response, NextFunction } from 'express';

// 从请求中获取当前用户的 orgId
// 当前阶段用硬编码（orgId=1），后续接入认证系统后从 JWT 中读取
export function orgIsolation(req: Request, res: Response, next: NextFunction) {
  // TODO: 后续从 JWT token 中解析
  // 当前阶段先从请求头或查询参数中获取
  const orgId = req.headers['x-org-id']
    ? Number(req.headers['x-org-id'])
    : 1; // 默认组织

  const userId = req.headers['x-user-id']
    ? Number(req.headers['x-user-id'])
    : 1; // 默认用户

  // 注入到 request 对象中
  (req as any).orgId = orgId;
  (req as any).currentUserId = userId;

  next();
}
```

在 Express app 中注册：

```typescript
app.use('/api', orgIsolation);
```

所有 API 路由中的数据库查询，改为使用 `(req as any).orgId` 作为过滤条件。

**重要：** 现有的所有 API 路由中如果有硬编码 `orgId: 1` 的地方，全部改为从 `req.orgId` 获取。

-----

## 四、前端改造

### 4.1 AI 对话面板重构

当前的 AI 对话面板改为两种视图：

**视图1：对话列表（默认）**

```
┌────────────────────────┐
│ AI 助手          🗑️  ✕ │
├────────────────────────┤
│ [+ 新对话]              │
│                        │
│ 📋 今天                │
│ ├ 会议纪要任务提取      │
│ ├ 创建拔河比赛任务      │
│                        │
│ 📋 昨天                │
│ ├ 查询逾期任务          │
│ ├ 销售数据分析          │
│                        │
│ 📋 更早                │
│ ├ ...                  │
└────────────────────────┘
```

- 对话按日期分组（今天、昨天、本周、更早）
- 显示对话标题（取第一条消息前20字）
- 点击某条对话进入对话详情视图

**视图2：对话详情（点击某条对话或新建对话后）**

```
┌────────────────────────┐
│ ← 返回   对话标题   🗑️ │
├────────────────────────┤
│                        │
│  （消息气泡列表）       │
│  （与现有交互一致）     │
│                        │
├────────────────────────┤
│ [输入消息...      ] [➤] │
└────────────────────────┘
```

- 顶部左侧有返回按钮，回到对话列表
- 消息从 API 加载，不再用 sessionStorage
- 其他交互（确认卡片、追问按钮等）与现有一致

### 4.2 前端状态管理改造

```typescript
interface ChatState {
  view: 'list' | 'conversation';   // 当前视图
  conversations: Conversation[];    // 对话列表
  currentConversationId: number | null;
  messages: ChatMessage[];          // 当前对话的消息
  isLoading: boolean;
}
```

**数据流变更：**

- 打开对话面板 → 调用 `GET /api/conversations` 获取对话列表
- 点击对话 → 调用 `GET /api/conversations/:id/messages` 获取消息
- 发送消息 → 调用 `POST /api/ai/chat`，附带 conversationId
- 新对话 → conversationId 传空，后端自动创建
- 删除对话 → 调用 `DELETE /api/conversations/:id`

### 4.3 移除 sessionStorage 逻辑

删除所有 sessionStorage 相关代码，完全改为 API 数据驱动。

-----

## 五、验收标准

1. ✅ conversations、messages、token_usage 三张表创建成功
1. ✅ 发送消息后，消息存入 messages 表
1. ✅ 每次 AI 调用后，token 用量写入 token_usage 表
1. ✅ 关闭对话面板再打开，历史消息从数据库加载，不丢失
1. ✅ 切换页面后对话记录仍在
1. ✅ 对话列表显示所有历史对话，按时间倒序
1. ✅ 可以点击历史对话查看完整聊天记录
1. ✅ 可以开始新对话
1. ✅ 可以归档（删除）旧对话
1. ✅ `/api/token-usage/stats` 接口返回正确的用量统计
1. ✅ 所有 API 使用 orgId 中间件，不再硬编码 orgId: 1

-----

## 六、给 Replit Agent 的指令

请按照本文档分两轮实现：

### 第一轮：后端改造

1. 在 `shared/schema.ts` 新增 conversations、messages、token_usage 三张表及 relations
1. 运行 `drizzle-kit generate` 和 `drizzle-kit push`
1. 创建 `server/middleware/orgIsolation.ts` 中间件并注册
1. 实现对话管理 API（GET/POST/DELETE conversations，GET messages）
1. 实现 token 用量统计 API
1. 修改 `/api/ai/chat`：支持 conversationId、消息持久化、token 记录
1. 修改 `/api/ai/confirm`：成功后写入系统消息
1. 修改 `verdictService.ts`：AI 调用后记录 token 用量
1. 所有现有 API 中硬编码的 orgId: 1 改为从中间件获取

### 第二轮：前端改造

1. AI 面板增加对话列表视图（视图1）
1. 对话详情视图增加返回按钮（视图2）
1. 所有对话数据从 API 获取，移除 sessionStorage 逻辑
1. 新对话/打开历史对话的交互流程
1. 归档对话功能

**重要：**

- 现有的所有对话交互（确认卡片、追问按钮、批量确认等）保持不变
- Token 用量从 AI API 的 response.usage 中读取
- estimatedCost 使用文档中的 calculateCost 函数计算