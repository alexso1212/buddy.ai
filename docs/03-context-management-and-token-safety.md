# 上下文管理与 Token 安全 — 完整详情文档

> 文档版本: 2026-02-26  
> 适用范围: AI 系统提示词构建、上下文分层、对话历史管理、Token 追踪、用户记忆系统  
> 目的: 供外部审核上下文管理策略和 Token 爆炸风险的完整分析

---

## 1. 系统提示词构建流程

### 1.1 构建链路

```
用户发送消息
  → buildContextualSystemPrompt(userId, orgId, model)
      ├─ 加载静态模板 (SYSTEM_PROMPT from prompts.ts)
      ├─ loadBusinessContext()
      │   ├─ storage.getUsers()        → 团队
      │   ├─ storage.getProjects()     → 项目
      │   ├─ storage.getTasks({})      → 全部任务 (再按 status 分类)
      │   ├─ storage.getDepartments()  → 部门
      │   └─ storage.getJobRoles()     → 岗位角色
      ├─ buildContextBlock(users, projects, tasks, userId)
      │   ├─ 当前用户信息 (ID, 姓名, 角色)
      │   ├─ 当前时间
      │   ├─ 模型名称
      │   ├─ 团队成员表
      │   ├─ 项目列表
      │   └─ formatTaskList(tasks, userId)  → 分层任务列表
      ├─ storage.getUserMemories(userId, orgId) → 用户记忆
      └─ 拼接: 静态模板 + 上下文块 + 记忆块
```

### 1.2 最终提示词结构

```markdown
[静态模板: 角色设定、行为规则、动作 Schema 定义]

---
## 组织上下文

### 当前用户
- ID: 3, 姓名: 张三, 角色: admin

### 当前时间
2026-02-26 14:32:00

### 团队成员 (15人)
| ID | 姓名 | 角色 | 邮箱 | 部门 |
...

### 项目 (8个)
- [ID:1] 前端重构 (进行中): ...
...

### 活跃任务
[我的任务]
- [ID:12] 实现登录页面 | 进行中 | 高 | 截止:03-01 | 进度:60%
...
[紧急/重要任务]
- [ID:7] 修复崩溃 | blocked | critical | 负责人:李四
...
[其他活跃任务 (精简)]
- [ID:15] 编写测试 | 进行中 | 中 | 王五
... (最多40条)

---
## 关于当前用户的记忆
- [preference] 用户喜欢简洁的回复风格
- [work_style] 通常在晚上处理代码审查
- [fact] 负责前端团队, 熟悉 React 和 TypeScript
```

---

## 2. 上下文分层策略

### 2.1 任务分层 (formatTaskList)

AI 看到的任务按三个优先级分层, 使用不同详细程度:

#### 第一层: 我的任务 (`myTasks`)
```
筛选条件: assigneeId === currentUserId
格式: 完整 (formatOne)
字段: ID, 标题, 状态, 优先级, 截止日期, 进度, 描述摘要, 依赖关系
数量限制: 无
```

#### 第二层: 紧急/重要任务 (`urgentOthers`)
```
筛选条件: 非我的任务 + 满足以下任一:
  - priority = 'critical' 或 'high'
  - status = 'blocked'
  - dueDate < now (已逾期)
格式: 完整 (formatOne)
字段: 同上
数量限制: 无
```

#### 第三层: 其他活跃任务 (`normalOthers`)
```
筛选条件: 非我的 + 非紧急
格式: 精简 (formatCompact)
字段: 仅 ID, 标题, 状态, 优先级, 负责人
数量限制: 最多 40 条 (MAX_NORMAL = 40)
超出提示: "共 N 个其他任务, 仅显示前 40 个。如需查看更多, 请让用户使用 query_tasks"
```

### 2.2 格式对比

| 格式 | 每条估算 Token | 示例 |
|------|-------------|------|
| formatOne (完整) | ~50-80 tokens | `[ID:12] 实现登录页面 \| 状态:进行中 \| 优先级:高 \| 负责人:张三 \| 截止:2026-03-01 \| 进度:60% \| 描述:包含用户名密码表单和OAuth集成` |
| formatCompact (精简) | ~15-25 tokens | `[ID:15] 编写测试 \| 进行中 \| 中 \| 王五` |

### 2.3 全局过滤

在分层之前, 已经过滤掉:
- `status = 'done'` 的任务
- `status = 'cancelled'` 的任务

只有活跃任务进入上下文

---

## 3. 模型配置与输出限制

### 3.1 max_tokens 配置 (输出上限)

| 模型 | max_tokens | 说明 |
|------|-----------|------|
| `claude-opus-4-6` | 128,000 | Anthropic Direct API |
| `claude-sonnet-4-6` | 64,000 | Anthropic Direct API |
| `claude-haiku-4-5-20251001` | 8,192 | Anthropic Direct API |
| `claude-sonnet-4-20250514` | 16,384 | Anthropic Direct API |
| `gpt-4o` | 16,384 | OpenRouter |
| 其他/默认 | 16,384 | — |

**注意**: 这是 max_tokens 参数, 控制 AI **输出**的最大长度, 不是输入上下文窗口大小

### 3.2 模型原生上下文窗口

| 模型 | 输入上下文窗口 | 备注 |
|------|-------------|------|
| Claude Opus 4.6 | ~200K tokens | Anthropic Direct |
| Claude Sonnet 4.6 | ~200K tokens | Anthropic Direct |
| Claude Haiku 4.5 | ~200K tokens | Anthropic Direct |
| GPT-4o | ~128K tokens | OpenRouter |
| 其他 OpenRouter 模型 | 取决于具体模型 | 按默认 max_tokens=16384 配置 |

### 3.3 Extended Thinking (扩展思维)

Claude 模型支持 Extended Thinking 模式, 启用后 AI 在输出前进行内部推理:

| 模型 | budget_tokens |
|------|--------------|
| `claude-opus-4-6` | 32,000 |
| `claude-sonnet-4-6` / 其他 Claude | 16,000 |

启用条件: 前端 `extendedThinking` 开关打开 + 模型为 Claude 系列

### 3.4 API 客户端路由

```
模型选择 → getMaxTokensForModel(model) → 决定输出限制
         → getClientForModel(model) → 选择 API 客户端:
             ├─ COMPLEX_MODELS: ['claude-opus-4-6']
             │   → claudeComplexClient (Anthropic Direct, timeout 180s)
             ├─ SIMPLE_MODELS: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514']
             │   → claudeSimpleClient (Anthropic Direct, timeout 90s)
             └─ 其他 (gpt-4o, deepseek 等)
                 → openrouterClient (OpenRouter, timeout 30s)
```

---

## 4. 对话历史管理

### 4.1 前端: conversationHistory.current

```
类型: useRef<Array<{ role: string, content: string }>>

生命周期:
  1. 新对话: 空数组 []
  2. 加载已有对话:
     GET /api/conversations/:id/messages
       → 过滤 role='user' 和 role='assistant'
       → 映射为 { role, content } 数组
  3. 发送消息: push({ role: 'user', content: text })
  4. 收到回复: push({ role: 'assistant', content: fullText })
  5. 确认动作: push({ role: 'user', content: '[系统] 操作已执行: ...' })
  6. 编辑消息: 截断到编辑位置, rebuildHistoryFromMessages
  7. 重新生成: 移除最后的 assistant, 不重建
```

### 4.2 发送给 AI 的消息数组

```
最终发给 AI API 的 messages 数组:

[
  { role: "system", content: systemPrompt },          // 系统提示词 (含上下文)
  { role: "user", content: "历史消息1" },              // 第1轮用户消息
  { role: "assistant", content: "历史回复1" },         // 第1轮AI回复
  { role: "user", content: "[系统] 操作已执行: ..." }, // 中间的动作结果
  { role: "user", content: "历史消息2" },              // 第2轮用户消息
  { role: "assistant", content: "历史回复2" },         // 第2轮AI回复
  ...
  { role: "user", content: "当前消息" }                // 最新用户消息
]
```

### 4.3 截断策略: 当前状态

**⚠️ 目前没有对话历史截断机制**

| 维度 | 当前实现 | 状态 |
|------|---------|------|
| 消息条数限制 | 无 | ❌ 全量发送 |
| Token 计数预检 | 无 | ❌ 不计算请求 token 数 |
| 滑动窗口 | 无 | ❌ 无 |
| 摘要压缩 | 无 | ❌ 无 |
| 旧消息丢弃 | 无 | ❌ 无 |

对话历史完整保留在 `conversationHistory.current` 中, 全量发送给 AI

### 4.4 唯一的截断场景: 标题生成

```
generateConversationTitle(userMsg, assistantMsg):
  truncatedUser = userMsg.slice(0, 500)         // 截取前 500 字符
  truncatedAssistant = assistantMsg.slice(0, 500)
  
  发送给轻量模型 (Haiku) 生成 10 字以内标题
  不使用完整对话历史, 仅用首轮对话的前 500 字符
```

---

## 5. Token 爆炸风险分析

### 5.1 Token 消耗构成

```
总 Token = System Prompt + 对话历史 + 当前消息 + AI 输出

各部分估算:
┌─────────────────────────┬──────────────┬───────────────┐
│ 组成部分                │ 基础估算      │ 最坏情况       │
├─────────────────────────┼──────────────┼───────────────┤
│ 静态模板 (角色+规则)     │ ~2,000 tok   │ ~2,000 tok    │
│ 团队成员 (15人)         │ ~300 tok     │ ~2,000 tok    │
│                         │              │ (100人组织)    │
│ 项目列表 (8个)          │ ~200 tok     │ ~1,000 tok    │
│                         │              │ (50个项目)     │
│ 我的任务 (5条, 完整)     │ ~400 tok     │ ~4,000 tok    │
│                         │              │ (50条)         │
│ 紧急任务 (3条, 完整)     │ ~240 tok     │ ~4,000 tok    │
│                         │              │ (50条紧急)     │
│ 其他任务 (40条, 精简)    │ ~800 tok     │ ~800 tok      │
│                         │              │ (MAX_NORMAL限) │
│ 用户记忆 (5条)          │ ~100 tok     │ ~500 tok      │
│                         │              │ (50条记忆)     │
├─────────────────────────┼──────────────┼───────────────┤
│ System Prompt 合计      │ ~4,000 tok   │ ~14,300 tok   │
├─────────────────────────┼──────────────┼───────────────┤
│ 对话历史 (10轮)         │ ~5,000 tok   │ ~50,000 tok   │
│                         │              │ (100轮长对话)  │
│ 附件 (图片/文件)        │ ~0 tok       │ ~20,000 tok   │
│                         │              │ (多张图片+大文件)│
│ Web Search 结果         │ ~500 tok     │ ~3,000 tok    │
├─────────────────────────┼──────────────┼───────────────┤
│ 输入合计                │ ~9,500 tok   │ ~87,300 tok   │
│ AI 输出 (max_tokens)    │ ~2,000 tok   │ ~128,000 tok  │
├─────────────────────────┼──────────────┼───────────────┤
│ 单次请求总消耗          │ ~11,500 tok  │ ~215,300 tok  │
└─────────────────────────┴──────────────┴───────────────┘
```

### 5.2 风险场景分析

#### 场景 1: 长对话 (高风险 ⚠️)

```
风险: 对话超过 50 轮后, 历史消息可能消耗 25K-50K tokens
触发: 用户在同一对话中持续聊天, 不新建对话

Token 增长曲线:
  10轮: ~5K tokens (安全)
  30轮: ~15K tokens (注意)
  50轮: ~25K tokens (警告)
  100轮: ~50K tokens (危险)
  
结果: Claude 200K 窗口仍有余量, 但 GPT-4o 128K 可能在极端情况下接近上限
费用: 每次请求的输入 token 持续增长, 导致费用线性上升
```

#### 场景 2: 大规模组织 (中等风险)

```
风险: 100+ 人的组织, 50+ 项目, 200+ 活跃任务

估算:
  团队 (100人): ~2,000 tokens
  项目 (50个): ~1,000 tokens
  我的任务 (20条): ~1,600 tokens
  紧急任务 (30条): ~2,400 tokens
  其他任务 (40条上限): ~800 tokens
  合计: ~7,800 tokens (可控)

缓解: MAX_NORMAL=40 上限有效限制了其他任务的膨胀
```

#### 场景 3: 大文件附件 (中等风险)

```
风险: 用户粘贴大图片或上传大文件

图片: 通过 base64 编码, 一张 1MB 图片约 1.3M base64 字符
      Claude Vision 处理: 按 tile 计费, 约 1000-3000 tokens/image
文件: mammoth 提取 docx 纯文本, 但长文档可能有 10K+ 字符
      → 约 5K-10K tokens

缓解: mammoth 仅提取纯文本 (无格式/图片), 减少 docx 的 token 消耗
缺陷: 无文件大小限制或文本截断
```

#### 场景 4: 流中断 + 页面导航 (费用泄漏 ⚠️)

```
风险: 用户在 AI 生成过程中离开 /agent 页面
行为: 服务端继续生成, 消耗 output token, 但前端已不再接收
结果: 无用的 token 消耗, 费用浪费

影响: max_tokens 上限 (如 128K) 决定了单次最大浪费量
缓解: 无 (当前没有服务端超时机制)
```

---

## 6. 用户记忆系统 (user_memories)

### 6.1 数据模型

```sql
CREATE TABLE user_memories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  org_id INTEGER REFERENCES organizations(id),
  category VARCHAR(50),  -- 'preference' | 'fact' | 'work_style' | 'context'
  content TEXT,
  source VARCHAR DEFAULT 'auto',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 6.2 自动提取流程

```
AI 回复流式完成后 (不阻塞用户):
  → extractMemories(conversationHistory, userId, orgId)
      异步执行 (.catch() 静默失败)
      
  → 将完整对话发给轻量模型 (Claude Haiku 4.5):
      System Prompt: "从以下对话中提取值得记住的用户偏好、事实、工作习惯..."
      要求返回 JSON: [{ category, content }]
      
  → 解析返回的 JSON
  → 逐条 storage.createUserMemory({ userId, orgId, category, content, source: 'auto' })
```

**成本控制**: 使用最便宜的 Haiku 模型做提取, 避免用 Opus 增加成本

### 6.3 注入系统提示词

```markdown
## 关于当前用户的记忆
以下是你通过之前对话了解到的关于当前用户的信息：
- [preference] 用户偏好简洁直接的回复, 不要过多解释
- [work_style] 每天上午集中处理任务, 下午做代码审查
- [fact] 是前端团队负责人, 精通 React/TypeScript
- [context] 正在推进 Q2 OKR, 重点关注性能优化
```

### 6.4 记忆去重与管理

- **当前**: 无自动去重, 可能积累重复记忆
- **管理**: 用户可在设置页手动查看和删除记忆
- **上限**: 无硬性数量限制

---

## 7. Token 用量追踪系统

### 7.1 数据模型

```sql
CREATE TABLE token_usage (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  user_id INTEGER REFERENCES users(id),
  conversation_id INTEGER REFERENCES conversations(id),
  model VARCHAR,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd VARCHAR,      -- 精度到 6 位小数
  purpose VARCHAR DEFAULT 'chat',  -- 'chat' | 'verdict' | 'decompose'
  created_at TIMESTAMP
);
```

### 7.2 费用计算 (tokenCost.ts)

```javascript
MODEL_PRICING = {
  'claude-opus-4-6':   { prompt: 0.015, completion: 0.075 },  // per 1K tokens
  'claude-sonnet-4-6': { prompt: 0.003, completion: 0.015 },
  'claude-haiku-4-5':  { prompt: 0.001, completion: 0.005 },
  'gpt-4o':            { prompt: 0.005, completion: 0.015 },
  'deepseek-chat':     { prompt: 0.0003, completion: 0.0012 },
  默认:                { prompt: 0.003, completion: 0.015 }
}

calculateCost(model, promptTokens, completionTokens):
  cost = (promptTokens / 1000 * promptRate) + (completionTokens / 1000 * completionRate)
  return cost.toFixed(6)  // "0.001234"
```

### 7.3 记录时机

| 场景 | 记录位置 | purpose 值 |
|------|---------|-----------|
| AI 聊天 (stream) | `/api/ai/chat/stream` done 事件后 | `'chat'` |
| 任务评判 | `/api/verdicts/judge` 完成后 | `'verdict'` |
| 任务分配评判 | `/api/verdicts/judge-assignment` 完成后 | `'verdict'` |
| 项目分解 | `/api/ai/decompose-project` 完成后 | `'decompose'` |
| 记忆提取 | extractMemories 内 | ❌ **未记录** |
| 标题生成 | generateConversationTitle 内 | ❌ **未记录** |

### 7.4 前端显示

#### 消息级 Token 徽章
```
来源: SSE done 事件中的 tokenUsage 对象
显示: 消息底部 "1.2K tokens" 灰色小字
Tooltip: "Prompt: 800 | Completion: 400 | Total: 1,200"
Agent + GraphChatFloat 均支持
```

#### 统计页面
```
GET /api/token-usage/stats?period=30d

返回:
{
  totalTokens: 523400,
  totalCost: "7.851000",
  byPurpose: {
    chat: { tokens: 500000, cost: "7.500000" },
    verdict: { tokens: 23400, cost: "0.351000" }
  },
  byUser: {
    "张三": { tokens: 300000, cost: "4.500000" },
    "李四": { tokens: 223400, cost: "3.351000" }
  }
}
```

---

## 8. 文件处理优化

### 8.1 DOCX 处理

```
用户上传 .docx 文件
  → mammoth.extractRawText(buffer)
  → 返回纯文本 (无格式、无图片、无表格样式)
  → 作为用户消息的一部分发送给 AI
  
好处: 100KB 的 docx 文件, 原始约 30K 字符, mammoth 提取后可能只有 5K 字符
减少: 格式标记 (~60%), 嵌入图片 (~完全去除)
```

### 8.2 图片处理

```
用户粘贴/拖拽图片
  → FileReader.readAsDataURL → base64
  → 前端: 显示 200x200 缩略图
  → 发送到服务端: 完整 base64
  → Claude Vision: 按 tile 分析
  
未做优化: 
  - 无图片压缩
  - 无尺寸限制
  - 无文件大小限制
```

---

## 9. 缓解建议 (未实施, 建议方向)

### 9.1 对话历史管理

| 策略 | 描述 | 预估效果 | 实施难度 |
|------|------|---------|---------|
| **滑动窗口** | 保留最近 N 轮 (如 20轮), 丢弃更早的 | 限制历史 ~10K tokens | 低 |
| **Token 预算** | 发送前用 tiktoken 计算, 超过阈值时截断 | 精确控制 | 中 |
| **摘要压缩** | 超过 20 轮时, 用 Haiku 压缩旧历史为摘要 | 保留语义, 减少 80% tokens | 中高 |
| **首尾保留** | 保留第1轮 + 最近 10 轮, 中间丢弃 | 保留原始意图 | 低 |

### 9.2 上下文优化

| 策略 | 描述 | 预估效果 |
|------|------|---------|
| **按需加载** | 仅在用户提到任务时注入任务列表 | 减少 ~2K tokens/request |
| **任务摘要** | 超过 100 条活跃任务时, 只注入统计数据 | 上下文可控 |
| **部门过滤** | 只注入用户所在部门的任务 | 减少 50-80% 任务数据 |
| **缓存上下文** | 同一请求周期内复用 business context | 减少 DB 查询 |

### 9.3 费用控制

| 策略 | 描述 |
|------|------|
| **用户配额** | 每用户每天/每月 token 上限 |
| **模型降级** | 超过配额后自动切换到 Haiku |
| **服务端超时** | 服务端设置 max 60s timeout, 避免费用泄漏 |
| **记忆提取计费** | 将 extractMemories 和 generateTitle 也纳入 token_usage 追踪 |

### 9.4 安全加固

| 策略 | 描述 |
|------|------|
| **文件大小限制** | 限制上传文件 ≤ 5MB |
| **图片压缩** | 上传前客户端压缩到 1024px 宽 |
| **输入长度限制** | 单条消息限制 10,000 字符 |
| **流中断清理** | 组件卸载时 abort, 服务端检测客户端断开 |

---

## 10. 风险矩阵总览

| 风险 | 严重度 | 发生概率 | 当前缓解 | 状态 |
|------|-------|---------|---------|------|
| 长对话 token 爆炸 | 🔴 高 | 中 | 无 | ❌ 未处理 |
| 页面离开流未中断 | 🟡 中 | 高 | abort 链 (Task 01 已修复) | ✅ 已处理 |
| 记忆/标题生成未计费 | 🟡 中 | 100% | 无 | ❌ 未追踪 |
| 大文件无限制上传 | 🟡 中 | 低 | mammoth 纯文本 | ⚠️ 部分缓解 |
| 图片无压缩 | 🟢 低 | 中 | 无 | ❌ 未处理 |
| 大规模组织上下文膨胀 | 🟢 低 | 低 | MAX_NORMAL=40 | ⚠️ 部分缓解 |
| 记忆无去重/无上限 | 🟢 低 | 中 | 无 | ❌ 未处理 |
| 用户无费用上限 | 🔴 高 | 中 | 无 | ❌ 未处理 |
| 对话切换竞态 | 🟢 低 | 低 | abort + 重新加载 (Task 01 已修复) | ✅ 已处理 |

---

## 附录: 源文件索引

| 文档章节 | 关键源文件 | 核心函数/变量 |
|---------|-----------|-------------|
| 系统提示词 (§1) | `server/services/ai/index.ts` | `buildContextualSystemPrompt`, `buildContextBlock` |
| 静态模板 | `server/services/ai/prompts.ts` | `SYSTEM_PROMPT` |
| 上下文分层 (§2) | `server/services/ai/index.ts` | `formatTaskList`, `formatOne`, `formatCompact`, `MAX_NORMAL` |
| 业务数据加载 | `server/services/ai/index.ts` | `loadBusinessContext` |
| 模型配置 (§3) | `server/services/ai/index.ts` | `getMaxTokensForModel` |
| 对话历史 (§4) | `client/src/pages/agent.tsx` | `conversationHistory.current`, `rebuildHistoryFromMessages` |
| 标题生成截断 | `server/services/ai/index.ts` | `generateConversationTitle`, `truncatedUser/Assistant` |
| 用户记忆 (§6) | `shared/schema.ts` | `userMemories` table |
| 记忆提取 | `server/services/ai/index.ts` | `extractMemories` |
| 记忆存储 | `server/storage.ts` | `getUserMemories`, `createUserMemory` |
| Token 用量表 (§7) | `shared/schema.ts` | `tokenUsage` table |
| 费用计算 | `server/services/ai/tokenCost.ts` | `MODEL_PRICING`, `calculateCost` |
| Token 记录 | `server/storage.ts` | `createTokenUsage`, `getTokenUsageStats` |
| 统计 API | `server/routes.ts` | `GET /api/token-usage/stats` |
| DOCX 处理 (§8) | `server/services/ai/index.ts` | `mammoth.extractRawText` |
| 图片处理 | `client/src/components/ai/AiInputBar.tsx` | `FileReader.readAsDataURL` |
