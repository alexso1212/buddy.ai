# 侧边栏交互 + 企业数据联动 — 完整详情文档

> 文档版本: 2026-02-26  
> 适用范围: App.tsx 侧边栏组件、企业管理模块、AI 数据联动、认证系统  
> 目的: 供外部审核侧边栏交互体验和企业数据联动机制的完整性

---

## 1. 侧边栏布局架构

### 1.1 桌面端

```
┌──────────────┬──────────────────────────────────┐
│   Sidebar    │         Main Content             │
│   260px      │         ml-[260px]               │
│   fixed      │                                  │
│              │                                  │
│ ┌──────────┐ │                                  │
│ │ 企业管理 │ │  (Dashboard/Agent/Graph/等)       │
│ │ Collapse │ │                                  │
│ ├──────────┤ │                                  │
│ │ Buddy AI │ │                                  │
│ │ 对话列表 │ │                                  │
│ │ Collapse │ │                                  │
│ ├──────────┤ │                                  │
│ │          │ │                                  │
│ │ [+ 新建] │ │                                  │
│ └──────────┘ │                                  │
└──────────────┴──────────────────────────────────┘
```

- **宽度**: 固定 `260px`, 使用 `md:!w-[260px]`
- **定位**: `fixed`, 始终可见
- **主内容偏移**: `md:ml-[260px]` 让出侧边栏空间
- **不支持拖拽调宽**: 桌面端侧边栏宽度固定, 无 resize handle

### 1.2 移动端

```
┌──────────────┬──────────────────────┐
│   Sidebar    │   Main Content      │
│   82vw       │   (被推移到右侧)     │
│   max 340px  │   translateX(w)     │
│              │                     │
│   overlay    │                     │
│   behind     │                     │
└──────────────┴──────────────────────┘
```

- **宽度**: `82vw`, 最大 `340px`
- **初始状态**: `translateX(-100%)` 隐藏在屏幕左侧
- **触发**: 顶部汉堡菜单按钮 (`<Menu />` 图标) 切换 `sidebarOpen` 状态

---

## 2. 移动端手势交互系统

### 2.1 手势触发区域

```
              ← 25px →
 ┌────────────────────────────────────┐
 │█████│                              │  开启手势: 触摸左边缘 25px 内
 │█████│                              │
 │█████│      Main Content            │
 │█████│                              │
 │█████│                              │
 └────────────────────────────────────┘

 ┌──────────────┬─────────────────────┐
 │   Sidebar    │████████│            │  关闭手势: 触摸侧边栏区域
 │   (打开状态) │████████│            │  或其右边缘附近
 └──────────────┴─────────────────────┘
```

### 2.2 Touch 事件处理流程

#### handleTouchStart
```
触摸开始
  ├─ 侧边栏关闭 && 触摸 x < 25px → 标记 gesture = 'open'
  ├─ 侧边栏打开 && 触摸在侧边栏区域 → 标记 gesture = 'close'
  └─ 否则 → 不处理
  
记录初始位置: startX, startY, startTime
初始化 dragRef: { active: true, startX, startY, dx: 0, locked: false }
```

#### handleTouchMove (方向锁定)
```
手指移动
  ├─ 计算 dx (水平) 和 dy (垂直)
  ├─ 如果未锁定 && |dy| > |dx| && 移动 > 8px
  │   └─ 锁定为垂直滚动, 禁用侧边栏拖拽 → return
  ├─ 如果未锁定 && |dx| > |dy| && 移动 > 8px
  │   └─ 锁定为水平拖拽, preventDefault 阻止页面滚动
  └─ 水平拖拽:
      ├─ 实时更新 sidebar.style.transform
      ├─ 实时更新 content.style.transform (推移效果)
      └─ 实时更新 overlay.style.opacity (联动透明度)
```

**方向锁定阈值**: `8px` — 移动超过 8px 后锁定方向, 避免对角线滑动导致误操作

#### handleTouchEnd (速度 + 距离判断)
```
手指抬起
  ├─ 计算速度 velocity = dx / (endTime - startTime)
  ├─ 完成条件 (二选一):
  │   ├─ 距离 > 侧边栏宽度 × 30%
  │   └─ 速度 > 0.5 px/ms
  ├─ 条件满足 → 完成开/关动画
  └─ 条件不满足 → 回弹到原始位置
```

### 2.3 主内容推移 (Parallax) 效果

当侧边栏打开/拖拽时, 主内容区域 (`contentRef`) 同步向右平移:

```
拖拽中:
  sidebar.transform = translateX(deltaX)       // 从 -100% 开始, 向右拖出
  content.transform = translateX(deltaX)       // 主内容同步右移
  overlay.opacity = deltaX / sidebarWidth      // 背景遮罩渐显

完全打开后:
  sidebar.transform = translateX(0)            // 完全展开
  content.transform = translateX(340px)        // 主内容右移一个侧边栏宽度
  overlay.opacity = 0.4                        // 遮罩半透明
```

**效果**: 类似 iOS 的 "推挤" 动画, 而非简单的覆盖叠加

### 2.4 CSS 过渡动画

| 属性 | 时长 | 缓动函数 | 用途 |
|------|------|---------|------|
| transform | 350ms | `cubic-bezier(0.32, 0.72, 0, 1)` | 侧边栏 + 主内容滑动 |
| opacity | 350ms | `cubic-bezier(0.32, 0.72, 0, 1)` | overlay 遮罩显隐 |
| opacity (关闭) | 300ms | 同上 | 关闭时略快 |

**缓动特征**: 快速启动 + 平滑减速, 模拟 iOS 原生手势的物理感

**拖拽时**: 移除 CSS transition (直接操作 style), 实现零延迟跟手
**释放后**: 恢复 CSS transition, 播放完成动画

---

## 3. 触摸高亮反馈

### 3.1 makeTouchHighlight 工具函数

```
用途: 为侧边栏菜单项提供触摸按压视觉反馈

流程:
  touchstart → 等待 60ms (排除滑动误触)
    ├─ 60ms 后仍未取消 → 添加 .sidebar-touch-hl class (背景变亮)
    └─ 期间如果发生:
        ├─ 手指移动 > 6px → 取消高亮 (用户在滑动, 不是点击)
        ├─ 容器滚动 → 取消高亮
        └─ touchend → 移除高亮 class
```

**设计意图**:
- 60ms 延迟: 避免快速滑动时每个经过的项都闪烁
- 6px 容差: 手指在触屏上微颤不会误取消
- 滚动取消: 滚动列表时不应有项被高亮

---

## 4. 遮罩层 (Overlay)

### 4.1 结构

```html
<div class="sidebar-overlay"
     style="position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:..."
     onClick={onClose} />
```

### 4.2 交互行为

| 状态 | overlay opacity | 点击行为 |
|------|----------------|---------|
| 侧边栏关闭 | 0, `pointer-events: none` | 不可点击 |
| 拖拽中 | 跟随 `deltaX / sidebarWidth` 线性变化 | 不可点击 (拖拽拦截) |
| 侧边栏打开 | 0.4 | 点击 → 关闭侧边栏 |

### 4.3 拖拽联动

overlay 的 opacity 在手指拖拽过程中实时更新, 与侧边栏位移成正比:
```
opacity = Math.min(deltaX / sidebarWidth, 0.4)
```
创造从全透明到半透明的渐进效果, 暗示 "主内容正在被遮挡"

---

## 5. 滚动锁定

当侧边栏打开时, 防止背景内容滚动:

```
侧边栏打开:
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'     // 防止 iOS Safari 回弹
  document.addEventListener('touchmove', preventScroll, { passive: false })
    └─ preventScroll: 如果触摸不在侧边栏内, 则 preventDefault()

侧边栏关闭:
  恢复 document.body.style
  移除 preventScroll 监听器
```

**为什么需要 position:fixed**: iOS Safari 的 `overflow:hidden` 在 body 上不完全生效, 需要配合 `position:fixed` 才能真正阻止页面弹性滚动

---

## 6. 折叠区段 (CollapsibleContent)

### 6.1 区段结构

侧边栏内有两个可折叠区段:
1. **企业管理** (`enterpriseOpen` state) — 组织/部门/项目/任务导航
2. **Buddy AI** (`buddyAiOpen` state) — 对话列表

### 6.2 展开/折叠动画

```
折叠状态: height = 0, overflow = hidden
展开触发:
  1. requestAnimationFrame → 读取 children.scrollHeight
  2. 设置 height = scrollHeight + 'px'
  3. CSS transition: height 300ms ease
  4. transitionEnd 后设置 height = 'auto' (允许内容动态变化)

折叠触发:
  1. 读取当前 scrollHeight
  2. 设置 height = scrollHeight (从 auto 变为固定值)
  3. requestAnimationFrame → 设置 height = 0
  4. CSS transition 播放折叠动画
```

### 6.3 状态持久化

- 折叠状态保存在 `localStorage`
- 页面刷新后恢复上次的展开/折叠状态
- key 格式: `sidebar_enterprise_open`, `sidebar_buddyai_open`

---

## 7. 对话列表管理

### 7.1 数据来源

- **API**: `GET /api/conversations` → React Query 缓存
- **分类**:
  - **星标对话** (`starredConvs`): `starred === true`, 排在顶部
  - **最近对话** (`recentConvs`): 非星标, 按 `updatedAt` 降序

### 7.2 搜索功能

- 输入框位于对话列表顶部
- 搜索字段: 对话标题 + 关联项目名称
- 实时过滤, 无需按回车
- 匹配高亮: 无 (纯过滤)

### 7.3 右键菜单 / 长按菜单

```
长按侧边栏对话项 (移动端) / 右键点击 (桌面端)
  弹出自定义上下文菜单:
  ┌───────────────────┐
  │ 📁 移动到项目      │  → 展开 ProjectPickerSheet, 选择目标项目
  │ ⭐ 星标 / 取消星标  │  → PATCH /api/conversations/:id { starred }
  │ ✏️ 重命名          │  → 弹出重命名 Modal, 输入新标题
  │ 🗑️ 删除           │  → 确认弹窗后 DELETE /api/conversations/:id
  └───────────────────┘
```

**移动端长按实现**: 使用 setTimeout 模拟 press timer, 约 500ms 触发

### 7.4 新建对话

- **位置**: 侧边栏底部右下角, 浮动按钮 (FAB)
- **图标**: `MessageSquarePlus`
- **行为**: 
  1. 关闭移动端侧边栏 (`onClose()`)
  2. 导航到 `/agent` (不带 `?conv=` 参数)
  3. Agent 页检测到无 `activeConvId`, 显示空白欢迎页

---

## 8. 认证系统

### 8.1 三重认证方式

#### 方式 1: 邮箱/密码
```
用户提交 email + password
  → POST /api/auth/login
  → bcryptjs.compare(password, hashedPassword)
  → 成功: 生成 JWT (payload: userId, orgId, role)
  → 返回 { token, user }
```

#### 方式 2: Replit Auth OIDC
```
用户点击 "Replit 登录"
  → GET /api/login → 重定向到 Replit OIDC issuer
  → 用户在 Replit 授权
  → 回调 /api/callback → passport-openid-connect 处理
  → /api/auth/oidc/complete:
      → 从 OIDC claims 提取 email, name, sub
      → 查找或创建本地用户
      → 生成 JWT
      → 重定向到前端, URL 携带 token
```

#### 方式 3: Telegram Login Widget
```
前端注入 telegram-widget.js
  → 用户在 Telegram 弹窗中授权
  → 回调 onTelegramAuth(userData)
  → POST /api/post/auth/telegram
  → 服务端验证:
      1. 将所有字段 (除 hash) 排序拼接
      2. 用 TELEGRAM_BOT_TOKEN 的 SHA256 作为密钥
      3. 计算 HMAC-SHA256, 与 hash 比对
  → 匹配: 查找或创建用户, 返回 JWT
```

### 8.2 JWT 机制

| 属性 | 值 |
|------|-----|
| 签名密钥 | `JWT_SECRET` 环境变量 |
| 有效期 | 7 天 |
| Payload | `{ userId, orgId, role }` |
| 自动续期 | `/api/auth/me` 检测 < 24h 剩余时返回新 token |
| 传递方式 | `Authorization: Bearer <token>` 请求头 |

### 8.3 orgIsolation 中间件

```
每个 API 请求经过 orgIsolation 中间件:
  1. 从 Authorization 头提取 Bearer token
  2. jwt.verify(token, JWT_SECRET) → { userId, orgId }
  3. 写入 req.orgId, req.currentUserId
  4. 如果 token 无效或缺失 → 默认 orgId=0, userId=0
  5. 后续路由根据这两个值过滤数据 (多租户隔离)
```

**特点**: 不立即 403, 而是设置默认值, 让具体路由决定是否要求认证

---

## 9. AI 与企业数据的联动

### 9.1 数据读取: AI 如何"看到"企业数据

```
用户发送消息 → POST /api/ai/chat/stream
  → loadBusinessContext():
      ├─ storage.getUsers()        → 团队成员列表
      ├─ storage.getProjects()     → 项目列表
      ├─ storage.getTasks({})      → 所有任务 (再按 status 分类)
      ├─ storage.getDepartments()  → 部门结构
      └─ storage.getJobRoles()     → 岗位角色
  → buildContextBlock(users, projects, tasks):
      生成 Markdown 格式的上下文块
  → buildContextualSystemPrompt(contextBlock, memories):
      将上下文嵌入系统提示词
```

**注入内容示例**:
```markdown
## 当前组织: Deltapex Education

### 团队成员 (15人)
| ID | 姓名 | 角色 | 邮箱 |
|----|------|------|------|
| 1  | 张三 | owner | zhang@deltapex.com |
| 2  | 李四 | admin | li@deltapex.com |
...

### 项目 (8个)
- [ID:1] 前端重构 (进行中): React 迁移...
- [ID:2] 后端 API v2 (规划中): RESTful 重构...
...

### 活跃任务 (45个)
[我的任务 - 详细格式]
- [ID:12] 实现登录页面 | 状态:进行中 | 优先级:高 | 截止:2026-03-01 | 进度:60%

[紧急任务 - 详细格式]
- [ID:7] 修复生产环境崩溃 | 状态:blocked | 优先级:critical | 负责人:李四

[其他任务 - 精简格式, 最多40条]
- [ID:15] 编写测试用例 | 进行中 | 中 | 王五
```

### 9.2 数据写入: AI 动作执行后的联动

#### 缓存刷新链路
```
用户点击 "确认" 按钮
  → POST /api/ai/confirm { action }
  → 服务端 executeAction(action):
      ├─ create_task → storage.createTask(data)
      ├─ update_task → storage.updateTaskWithVersion(data) (乐观锁)
      ├─ delete_task → storage.deleteTask(id)
      └─ query_tasks → storage.queryTasks(filters)
  → 服务端返回 { success: true, entity: {...} }
  → 前端 handleConfirm:
      ├─ queryClient.invalidateQueries(["/api/tasks"])
      ├─ queryClient.invalidateQueries(["/api/projects"])
      ├─ queryClient.invalidateQueries(["/api/stats/overview"])
      └─ 这些页面自动重新拉取最新数据:
          ├─ Dashboard 统计数字更新
          ├─ 任务列表/看板刷新
          └─ 项目详情页更新
```

#### 上下文注入 (Post-Action Context)
```
确认动作后, 前端将结果注入对话历史:
  conversationHistory.current.push({
    role: "user",
    content: "[系统] 操作已执行: create_task 成功, 任务ID=123"
  })

效果: AI 的下一次回复能感知到 "我建议的任务已经创建了, ID 是 123"
```

### 9.3 乐观锁 (Optimistic Locking)

```
任务更新时的并发保护:

  AI 建议更新任务 (附带 version=5)
  → 用户确认
  → 服务端 UPDATE tasks SET ... WHERE id=12 AND version=5
  ├─ 成功 (version 匹配) → version 自增为 6, 返回新数据
  └─ 失败 (version 不匹配) → 返回 { success: false, conflict: true }
      → 前端显示: "⚠️ 任务已被其他人修改, 请刷新后重试"
```

### 9.4 批量操作与事务

```
AI 建议创建 3 个关联任务:
  → 用户点击 "全部确认"
  → POST /api/ai/confirm-batch { actions: [...] }
  → 服务端 storage.batchCreateTasks(tasks):
      BEGIN TRANSACTION
        INSERT task A → 获得 id=101
        INSERT task B (dependsOn: ref_A) → 解析 ref_A → id=101
        INSERT task C (dependsOn: ref_A) → 解析 ref_A → id=101
      COMMIT
  → 任何一个失败 → ROLLBACK 全部回滚
```

**跨引用**: 批量任务中可以用临时 `ref` ID 互相引用, 服务端在同一事务中解析

### 9.5 重复检测

```
创建任务前自动检查:
  checkDuplicateTask(title, assigneeId):
    SELECT * FROM tasks
    WHERE title ILIKE $title
    AND assignee_id = $assigneeId
    AND created_at > NOW() - INTERVAL '10 minutes'

  如果找到重复:
    不阻止操作, 但在确认卡片上显示 "⚠️ 10分钟内已创建同名任务"
```

---

## 10. 通知系统

### 10.1 触发时机

AI 动作执行成功后, 服务端调用 `generateTeamNotifications`:

### 10.2 通知接收者确定逻辑

```
动作: create_task (assigneeId=5, createdBy=3, projectId=2)

确定接收者:
  1. 任务负责人 (userId=5)         → "你被分配了一个新任务"
  2. 任务创建者 (userId=3)         → (如果不是当前操作者则通知)
  3. 项目成员                      → 项目内有任务变动
  4. 部门主管 (role='head')        → 下属任务变动
  5. 管理员 (role='admin'/'owner') → 全局通知

排除: 不通知当前操作者自己
```

### 10.3 通知存储

- **表**: `notifications`
- **批量写入**: `storage.createManyNotifications(notifications[])`
- **字段**: userId, type, title, content, entityType, entityId, read
- **前端拉取**: React Query 轮询 `GET /api/notifications`

---

## 11. 已知交互问题

### 11.1 侧边栏相关

1. **桌面端无法调整宽度**: 固定 260px, 不支持拖拽 resize
2. **快速连续点击**: 连续快速切换对话可能导致加载竞态 (无 debounce)
3. **长按菜单触觉反馈**: 移动端长按仅视觉反馈, 无 `navigator.vibrate()` 触觉反馈

### 11.2 数据联动相关

1. **实时更新缺失**: 其他用户的操作不会推送到当前用户 (无 WebSocket)
2. **缓存失效范围**: `invalidateQueries(["/api/tasks"])` 可能导致所有任务列表重新拉取, 粒度较粗
3. **orgIsolation 默认值**: token 缺失时 orgId=0 而非拒绝请求, 需要路由层自行检查

### 11.3 认证相关

1. **Token 过期体验**: JWT 过期后没有无感刷新, 用户需要重新登录
2. **多标签页**: 一个标签页刷新 token 后, 其他标签页仍用旧 token

---

## 附录: 源文件索引

| 文档章节 | 关键源文件 | 核心函数/变量 |
|---------|-----------|-------------|
| 侧边栏布局 (§1) | `client/src/App.tsx` | `Sidebar` 组件, `sidebarOpen` state |
| 手势交互 (§2) | `client/src/App.tsx` | `handleTouchStart/Move/End`, `dragRef` |
| 触摸高亮 (§3) | `client/src/App.tsx` | `makeTouchHighlight()` |
| overlay (§4) | `client/src/App.tsx` | `sidebar-overlay` div, `onClose` |
| 滚动锁定 (§5) | `client/src/App.tsx` | `preventScroll` listener, `body.style` |
| 折叠区段 (§6) | `client/src/App.tsx` | `CollapsibleContent`, `enterpriseOpen/buddyAiOpen` |
| 对话列表 (§7) | `client/src/App.tsx` | `starredConvs/recentConvs`, search filter |
| 认证 JWT (§8.1) | `server/middleware/auth.ts` | `generateToken`, `authMiddleware` |
| 认证 OIDC (§8.2) | `server/replit_integrations/auth/replitAuth.ts` | passport-openid-connect strategy |
| 认证 Telegram (§8.3) | `server/routes.ts`, `client/src/pages/login.tsx` | HMAC-SHA256 verify, `TelegramLoginIcon` |
| orgIsolation (§8.3) | `server/middleware/orgIsolation.ts` | `req.orgId`, `req.currentUserId` |
| AI 数据读取 (§9.1) | `server/services/ai/index.ts` | `loadBusinessContext`, `buildContextBlock` |
| 缓存刷新 (§9.2) | `client/src/pages/agent.tsx` | `queryClient.invalidateQueries` |
| 动作执行 (§9.3-9.5) | `server/services/ai/actionExecutor.ts` | `executeAction`, `checkDuplicateTask` |
| 通知 (§10) | `server/routes.ts` | `generateTeamNotifications` |
