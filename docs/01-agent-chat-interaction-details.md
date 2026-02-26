# Buddy Agent 聊天界面 — 完整交互详情文档

> 文档版本: 2026-02-26  
> 适用范围: `/agent` 全屏 AI 聊天页 + GraphChatFloat 图谱浮动聊天面板  
> 目的: 供外部审核所有 UI/UX 细节的完整性和一致性

---

## 1. 页面结构与布局

### 1.1 Agent 全屏聊天页 (`/agent`)

```
┌─────────────────────────────────────────────────┐
│ [顶部栏] 模型选择器 | 对话标题 | 设置按钮        │
│  (绝对定位 + 渐变遮罩, 内容可在其后方滑过)        │
├─────────────────────────────────────────────────┤
│                                                 │
│  消息区域 (flex-1, overflow-y: auto)             │
│  - 用户消息 → 右对齐, 黑色气泡, 圆角 18px        │
│  - AI 回复 → 左对齐, 无气泡, BrandLogo + 内容    │
│  - 系统消息 → 居中, 小字灰色, 含重试按钮(如有)   │
│  - 确认卡片 → 左对齐, 带边框的结构化卡片          │
│                                                 │
│  [滚到底部按钮] (距底部 >120px 时出现, 圆形)      │
│                                                 │
├─────────────────────────────────────────────────┤
│ [底部浮动输入区] (三层结构)                       │
│  Layer 1: 渐变遮罩 (内容在下方隐约可见)           │
│  Layer 2: 附件预览区 (如有粘贴/拖拽的文件)        │
│  Layer 3: 输入栏 AiInputBar                      │
│    [+按钮] [textarea] [发送/停止按钮]             │
└─────────────────────────────────────────────────┘
```

### 1.2 GraphChatFloat 图谱浮动聊天面板

```
┌──────────────────────────────┐
│ [标题栏] Sparkles AI图谱分析 [X] │  固定宽度 min(420px, 100vw-32px)
├──────────────────────────────┤   高度 40vh, min 280px
│  消息区域                     │  底部居中, 毛玻璃背景
│  [滚到底部按钮]               │  rgba(20,19,18,0.88) + blur(24px)
├──────────────────────────────┤
│ [附件预览] [截图预览]          │
│ [截图按钮] [textarea] [发送/停止]│
└──────────────────────────────┘
```

---

## 2. 消息输入交互

### 2.1 输入方式

| 输入方式 | Agent页 | GraphChatFloat | 行为详情 |
|---------|---------|---------------|---------|
| 键盘输入 | ✅ | ✅ | textarea, 自动高度调整 (Agent max 120px, Graph max 80px) |
| Enter 发送 | ✅ | ✅ | Enter 发送, Shift+Enter 换行 |
| Ctrl+V 粘贴文件 | ✅ | ✅ | 拦截 paste 事件, 提取 `file` 类型项, FileReader → base64 |
| 拖拽文件 | ✅ | ✅ | onDragOver/onDragLeave/onDrop, 拖拽时虚线边框指示 |
| 文件按钮 | ✅ (+ 按钮) | ❌ | Agent 的 "+" 按钮展开底部Sheet, 含相机/图片/文件三种输入 |
| 截图按钮 | ❌ | ✅ | 截取当前 SVG 图谱画面, 转 base64 附加到消息 |

### 2.2 附件处理

- **支持的文件类型**: 图片 (image/*), PDF, TXT, CSV, JSON, MD, DOCX 等
- **预览**: 图片显示缩略图 (200x200 max); 非图片显示文件后缀名色块
- **内存管理**: 每个附件的 `previewUrl` 使用 `URL.createObjectURL`, 移除时调用 `URL.revokeObjectURL` 防止内存泄漏
- **发送后清理**: 发送消息后自动清空附件列表和预览

### 2.3 "+" 添加到聊天 Sheet (仅 Agent 页)

点击输入栏左侧 "+" 按钮展开底部 Sheet, 包含:
- **相机**: `<input accept="image/*" capture="environment">`
- **图片库**: `<input accept="image/*" multiple>`
- **文件**: 支持 pdf/txt/csv/json/md/docx 等
- **深度研究 (Extended Thinking) 开关**: 切换后影响 AI 回复包含思考过程
- **网页搜索 (Web Search) 开关**: 启用后消息发送前先搜索 Tavily
- **添加到项目**: 将当前对话关联到某个项目
- **回复风格**: 切换 AI 回复的简洁度

---

## 3. 消息显示与交互

### 3.1 用户消息气泡

```
结构: group flex justify-end
┌────────────────────────┐
│ [编辑按钮 ✏️]  [黑色气泡] │  编辑按钮 hover 时才显示 (opacity-0 group-hover:opacity-100)
│                [附件区]  │  图片: 圆角缩略图; 文件: 图标+文件名
│                [文字]    │
│              [时间戳 HH:MM]│  右下角灰色小字
└────────────────────────┘
```

**编辑消息流程**:
1. hover 消息 → 出现铅笔图标编辑按钮
2. 点击 → 气泡变为 textarea 编辑模式
3. 修改后点击 "发送" → 截断该消息之后的所有历史, 用新内容重发
4. 点击 "取消" → 恢复原始内容

### 3.2 AI 回复消息

```
结构: group flex justify-start
[BrandLogo 28px] [时间戳 HH:MM]
[ThinkingBlock]         ← 如有思考过程
[SearchSourcesBar]      ← 如有网搜结果
[Markdown 内容]
  - 标题 (h1/h2/h3)
  - 列表 (ul/ol)
  - 代码块 (语法高亮 highlight.js)
  - 表格 / 引用 / 链接
[操作按钮区]            ← hover 时才显示 (opacity-0 → opacity-100)
  [复制] [重新生成*] [分享] [👍] [👎]
  [Token 用量徽章]      ← "1.2K tokens"
```

**操作按钮详情**:
- **复制**: `navigator.clipboard.writeText`, 显示勾号反馈 2s
- **重新生成**: 仅最后一条 AI 消息显示, 删除当前回复后用相同上下文重发
- **分享**: 支持 Web Share API, 否则 fallback 到复制
- **点赞/踩**: 本地状态切换, 带颜色反馈 (赞=品牌色, 踩=红色)
- **Token 用量**: 格式 "X.XK tokens", hover 显示详细 Prompt/Completion/Total

### 3.3 ThinkingBlock (思考过程展示)

- **流式阶段**: 自动展开, 内容实时追加, 自动滚动到底部
- **完成后**: 自动折叠为一行, 显示 "思考完成 (X.Xs)"
- **交互**: 点击 chevron 可手动展开/折叠
- **样式**: 左边框 2px 品牌色, 半透明背景, 斜体

### 3.4 代码块 (语法高亮)

- **引擎**: highlight.js, 按需加载 (tree-shaking)
- **支持语言**: JavaScript/TypeScript, Python, CSS, SQL, JSON, Bash, HTML/XML, YAML, Go, Java, Rust, Markdown (共 13 种)
- **高亮策略**: 
  1. 如果 markdown 指定语言 (如 \`\`\`python), 使用指定语言高亮
  2. 如果未指定或为 "code", 使用 `highlightAuto`, relevance > 5 时才应用
  3. 否则 fallback 到单色渲染
- **配色**: GitHub Dark 风格 (keywords=红, strings=蓝, comments=灰斜体, functions=紫)
- **代码块头**: 显示语言名 + Copy 按钮
- **复制**: 点击 Copy → 显示 "Copied!" 2s 后恢复

### 3.5 确认卡片 (Action Confirmation)

单个动作:
```
┌─────────────────────────────┐
│ [图标] 创建任务               │  ACTION_CONFIG 映射图标和标签
│                             │
│ 标题: xxx                    │  DATA_LABELS 映射键名
│ 负责人: xxx                  │  displayData 解析 ID → 名称
│ 优先级: high                 │
│ ...                         │
│                             │
│ [✓ 确认] [✗ 取消]            │  确认后 Spinner 旋转
└─────────────────────────────┘
```

批量动作 (multi_confirm):
```
┌──────────────────────────────┐
│ 发现 3 个操作                 │
│                              │
│ [卡片1] ✓ 确认  ✗ 取消  ⊘ 跳过│
│ [卡片2] ✓ 确认  ✗ 取消  ⊘ 跳过│
│ [卡片3] ✓ 确认  ✗ 取消  ⊘ 跳过│
│                              │
│ [✓✓ 全部确认]                 │  仅当存在未决卡片时显示
└──────────────────────────────┘
```

**确认流程**:
1. 用户点击 "确认" → 按钮显示 Spinner 旋转动画
2. POST `/api/ai/confirm` → 服务端执行操作 (create_task 等)
3. 成功 → 卡片状态变为 confirmed, 追加系统消息 "[系统] 操作已执行"
4. 失败 (409 版本冲突) → 显示 "任务已被其他人修改" 错误
5. 确认后注入上下文: 将操作结果 push 到 conversationHistory, AI 下次回复知道操作已完成

### 3.6 系统消息

```
居中灰色文字, 不带气泡
如果有 retryPayload:
  [错误信息] [🔄 重试按钮]
  errorType 分类:
    network → "网络连接失败，请检查网络后重试"
    timeout → "响应超时，请重试"
    rate_limit → "AI 服务繁忙，请稍等片刻后重试"
    unknown → 原始错误信息
```

### 3.7 智能建议卡片

当对话为空 (欢迎页) 时, 根据用户任务数据动态生成:
- **优先级 1**: 逾期任务提示 (如 "你有 3 个任务已逾期")
- **优先级 2**: 进行中任务提示
- **优先级 3**: 待办任务提示
- **Fallback**: 默认建议 ("帮我整理今天的工作安排" 等)
- 最多显示 4 张卡片, 点击直接发送对应文字

### 3.8 消息时间戳

- **格式**: HH:MM (24小时制)
- **位置**: 用户消息在气泡右下角; AI 回复在 BrandLogo 旁
- **来源**: 新消息用 `Date.now()`; 加载历史消息用 DB `createdAt`
- **条件渲染**: `timestamp != null` (避免 falsy 值误判)

---

## 4. 流式输出与性能优化

### 4.1 SSE 流式传输架构

```
Client (fetch + ReadableStream)
  ↓ POST /api/ai/chat/stream
Server (Express)
  ↓ res.write(`data: ${JSON.stringify(event)}\n\n`)
  
事件类型:
  { type: "start", conversationId: 123 }
  { type: "thinking", content: "让我分析..." }    ← Extended Thinking 模式
  { type: "token", content: "你" }                ← 逐 token 推送
  { type: "search_results", results: [...] }      ← Web Search 结果
  { type: "action", action: {...} }               ← 解析到动作
  { type: "done", fullText: "...", tokenUsage: {...} }
  { type: "title", title: "对话标题" }             ← 自动生成标题
  { type: "error", content: "错误信息" }
```

### 4.2 50ms Token 缓冲

- **问题**: 逐 token 更新 React state 导致过多 re-render
- **方案**: 50ms `setTimeout` 批量合并 token, 一次性 flush 到 state
- **实现**: 
  ```
  收到 token → 追加到 buffer 字符串
  如果没有 pending timer → 设置 50ms setTimeout
  Timer 触发 → 将整个 buffer flush 到 message state
  流结束 → try/finally 中清除 timer 和 interval
  ```

### 4.3 45 秒超时检测

- **机制**: `setInterval(5000)` 每 5 秒检查 `Date.now() - lastEventTime`
- **阈值**: 45 秒无新事件
- **触发**: 设置 `isTimeoutAbort = true`, 调用 `abortController.abort()`
- **UI**: catch 块检测到 `AbortError + isTimeoutAbort` → 显示超时错误 + 重试按钮
- **清理**: finally 块中 `clearInterval`

---

## 5. 错误恢复与重试

### 5.1 错误分类逻辑

```javascript
catch(err) {
  if (err.name === 'AbortError' && isTimeoutAbort) → 'timeout'
  else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) → 'network'
  else if (msg.includes('rate') || msg.includes('429')) → 'rate_limit'
  else → 'unknown'
}
```

### 5.2 重试流程

1. 错误发生 → 移除未完成的 assistant 消息
2. 追加 system 消息, 携带 `retryPayload: { text, attachments }`
3. 用户点击 "重试" → `handleRetry(messageId)`:
   - 从 messages 中找到对应系统消息
   - 移除该消息
   - 用 retryPayload 中的 text/attachments 重新调用 `handleSend`
4. **历史保护**: 失败的 assistant 回复不会加入 conversationHistory, 确保重试时上下文正确

### 5.3 错误状态 (Agent vs GraphChatFloat 一致性)

| 行为 | Agent | GraphChatFloat |
|------|-------|---------------|
| 错误分类 | ✅ 4种 | ✅ 4种 (一致) |
| 重试按钮 | ✅ | ✅ |
| retryPayload 保存 | ✅ text + attachments | ✅ text + attachments |
| 45s 超时检测 | ✅ | ✅ |
| isTimeoutAbort 标记 | ✅ | ✅ |
| 移除失败消息 | ✅ | ✅ |

---

## 6. 滚动行为

### 6.1 Agent 页

| 行为 | 实现 |
|------|------|
| 自动滚动 | 新消息到达时, 如果用户在底部 120px 内, 自动跟随 |
| 滚到底部按钮 | 超过 120px 阈值时出现, 点击 smooth scroll |
| 按钮样式 | 圆形, 毛玻璃背景 `blur(8px)`, ArrowDown 图标 |
| 流式时跟随 | 50ms buffer flush 触发 messages 更新 → useEffect 检查 isNearBottom |
| 停止按钮 | AiInputBar loading 时显示, 调用 abortController.abort() |

### 6.2 GraphChatFloat

| 行为 | 实现 |
|------|------|
| 自动滚动 | 新消息/loading 变化时, 如在底部 100px 内, 自动滚到底 |
| 滚到底部按钮 | 超过 100px 时出现, 绝对定位在消息区右下角 |
| 按钮更新 | onScroll + messages/loading useEffect 双重更新确保按钮及时出现 |
| 停止按钮 | loading 时替换发送按钮, 红色方块图标, 调用 abortControllerRef.abort() |

---

## 7. 页面切换与流式中断行为

### 7.1 当前行为 (已知问题)

| 场景 | 行为 | 说明 |
|------|------|------|
| **发送新消息** | ✅ 中断旧流 | handleSend 开头调用 abort() |
| **切换对话 (URL ?conv= 变化)** | ⚠️ 不中断 | useEffect 中 `if (isStreamingRef.current) return` 跳过加载 |
| **导航离开 /agent** | ⚠️ 不中断 | 无 useEffect cleanup, fetch 在后台继续直到服务端完成 |
| **手动停止** | ✅ 中断 | handleStop 调用 abort() |
| **编辑消息/重新生成** | ✅ 中断旧流 | handleRegenerate/handleEditMessage 先 abort 再重发 |

**潜在风险**: 
- 切换对话时如果旧流未结束, 新对话消息不会加载 (被 guard 阻止)
- 导航离开后服务端仍在消耗 token 生成回复, 但前端不再接收

### 7.2 GraphChatFloat 的行为

- 关闭面板: 不会中断流 (abortController 未在 close 中调用)
- 重新打开: 如果流仍在进行, loading 状态可能导致 UI 不一致

---

## 8. 模型选择与配置

### 8.1 模型选择器

- **位置**: App.tsx 顶部控制栏
- **存储**: `localStorage.getItem('buddy_model')`
- **可选模型**: Claude Sonnet 4.6, Claude Opus 4.6, GPT-4o, DeepSeek 等
- **路由**: 服务端根据模型名决定用 Anthropic Direct API 还是 OpenRouter

### 8.2 Extended Thinking (深度研究)

- **开关位置**: 模型选择器内 + "添加到聊天" Sheet
- **存储**: `localStorage.getItem('buddy_extended_thinking')`
- **通知机制**: `CustomEvent('extended-thinking-changed')` 跨组件同步
- **效果**: 
  - 请求体携带 `extendedThinking: true`
  - 服务端开启 Claude thinking 模式
  - 前端收到 `type: 'thinking'` 事件, 渲染 ThinkingBlock
  - AI 先展示思考过程, 再输出最终回答

### 8.3 Web Search (网页搜索)

- **开关**: AiInputBar Sheet 内 Globe 图标开关
- **指示器**: 启用后输入栏显示橙色 "搜索" 徽章
- **存储**: React state (非 localStorage, 刷新后重置为关)
- **流程**:
  1. 发送消息时 `webSearchEnabled: true` 传给服务端
  2. 服务端调用 Tavily API (`searchWeb`)
  3. 搜索结果注入 system prompt 作为上下文
  4. 搜索结果通过 SSE `search_results` 事件发回前端
  5. AiMessageBubble 渲染 SearchSourcesBar (可展开的来源列表)

---

## 9. 对话持久化

### 9.1 对话生命周期

```
用户首次发消息 (无 activeConvId)
  → POST /api/ai/chat/stream (无 conversationId)
  → 服务端创建新对话 (临时标题 = 消息前 30 字)
  → SSE 发回 { type: "start", conversationId: 123 }
  → 前端更新 URL 为 /agent?conv=123
  → 流完成后, 服务端异步生成对话标题
  → SSE 发回 { type: "title", title: "关于任务分配的讨论" }
  → 前端更新标题, 刷新侧边栏对话列表
```

### 9.2 消息存储

- **表**: `chat_messages`
- **保存时机**:
  - 用户消息: 服务端确认对话创建后立即保存
  - AI 回复: 流式完成 (`done` 事件) 后保存
  - 系统消息 (操作结果): 操作执行后立即保存
- **metadata 字段**: JSON 存储 AI 特有数据:
  ```json
  {
    "action": { "actionType": "create_task", "data": {...}, "summary": "..." },
    "confirmed": true,
    "actionConfirmed": [true, false, null],
    "followUp": { "steps": [...], "currentStep": 0 },
    "followUpSubmitted": true
  }
  ```

### 9.3 加载历史消息

- 切换到已有对话 → `GET /api/conversations/:id/messages`
- 将 DB 记录转换为前端 Message 对象
- 解析 metadata 恢复交互状态 (确认按钮、引导式创建步骤等)
- 时间戳从 DB `createdAt` 字段提取

### 9.4 侧边栏对话管理

- **分类**: 星标对话 / 最近对话
- **搜索**: 按标题和项目名过滤
- **操作 (长按/右键菜单)**:
  - 移动到项目
  - 星标/取消星标
  - 重命名
  - 删除
- **新建对话**: 底部 "+" 按钮, 导航到 `/agent` (无 conv 参数)

---

## 10. Token 用量追踪

### 10.1 消息级显示

- **来源 (Agent)**: `done` 事件中的 `event.tokenUsage`
- **来源 (GraphChatFloat)**: `done` 事件中的 `event.tokenUsage` (已修复, 原先监听独立 `usage` 事件导致永远为空)
- **显示**: 消息底部灰色小字 "X.XK tokens"
- **Tooltip**: hover 显示 `Prompt: X | Completion: X | Total: X`

### 10.2 设置页统计

- **位置**: `/settings` 页面 "AI 用量统计" 卡片
- **API**: `GET /api/token-usage/stats?period=7d|30d|90d`
- **展示**: 
  - 总 Token / 输入 Token / 输出 Token
  - 估算费用 (USD)
  - 按用途分类 (chat, verdict)
- **周期切换**: 7天 / 30天 / 90天 按钮

### 10.3 服务端记录

- **表**: `token_usage`
- **记录时机**: 每次 AI 调用完成后
- **字段**: orgId, userId, conversationId, model, promptTokens, completionTokens, costUsd, purpose
- **费用计算**: `tokenCost.ts` 中按模型定价 (每 1000 token 单价)

---

## 11. GraphChatFloat 与 Agent 页的差异对比

| 特性 | Agent 页 | GraphChatFloat | 备注 |
|------|---------|---------------|------|
| 布局 | 全屏 | 浮动面板 420px | 底部居中 |
| 消息持久化 | ✅ 完整 | ✅ 完整 | 独立 conversationId |
| 文件上传 (+按钮) | ✅ Sheet 形式 | ❌ 仅粘贴/拖拽 | GraphChatFloat 空间有限 |
| 截图功能 | ❌ | ✅ Camera 按钮 | 截取 SVG 图谱 |
| 模型选择 | ✅ (顶部选择器) | ❌ 使用默认 | — |
| Web Search | ✅ | ❌ | — |
| Extended Thinking | ✅ | ❌ | — |
| 对话历史列表 | ✅ 侧边栏 | ❌ 单会话 | GraphChatFloat 使用 conversationHistory ref |
| 消息编辑 | ✅ | ❌ | — |
| 重新生成 | ✅ | ❌ | — |
| 引导式创建 | ✅ | ❌ | — |
| 滚到底部按钮 | ✅ | ✅ | — |
| 停止生成 | ✅ | ✅ | — |
| Token 用量 | ✅ | ✅ | — |
| 错误分类+重试 | ✅ | ✅ | — |
| 时间戳 | ✅ | ✅ | — |
| hover 操作按钮 | ✅ | ✅ (复用 AiMessageBubble) | — |
| 50ms Token 缓冲 | ✅ | ✅ | — |
| 45s 超时检测 | ✅ | ✅ | — |

---

## 12. 已知问题与待优化项

1. **页面切换不中断流**: 离开 /agent 或切换对话时, 旧的流式请求不会被中断, 服务端继续消耗 token
2. **GraphChatFloat 关闭不中断流**: 关闭浮动面板不会 abort 正在进行的请求
3. **Web Search 状态不持久化**: 刷新页面后 webSearchEnabled 重置为 false
4. **GraphChatFloat 功能子集**: 不支持文件按钮上传、模型选择、Web Search、Extended Thinking、消息编辑、重新生成、引导式创建
5. **代码高亮语言有限**: 仅支持 13 种常用语言, 不支持 C/C++, PHP, Ruby, Swift 等
