# BuddyAI 技术交接文档

> **最后更新**: 2026-03-04
> **目标读者**: 接手开发的产品经理/开发者
> **项目状态**: 核心功能已完成，持续迭代中

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目目录结构](#3-项目目录结构)
4. [数据库 Schema](#4-数据库-schema)
5. [API 路由清单](#5-api-路由清单)
6. [AI 子系统架构](#6-ai-子系统架构)
7. [前端架构](#7-前端架构)
8. [认证与权限体系](#8-认证与权限体系)
9. [关键文件索引](#9-关键文件索引)
10. [环境变量](#10-环境变量)
11. [开发约定](#11-开发约定)
12. [已完成功能清单](#12-已完成功能清单)
13. [待办与迭代方向](#13-待办与迭代方向)
14. [iOS App 打包](#14-ios-app-打包)

---

## 1. 项目概述

### 定位

BuddyAI 是 **Deltapex Education** 的内部 AI 驱动任务管理系统。它将 Claude.ai 级别的 AI 对话体验与企业级项目/任务/团队管理深度整合，目标是通过 AI 助手提升团队协作效率。

### 核心模块

| 模块 | 功能 |
|------|------|
| **Agent (AI Chat)** | 全页面 AI 对话，支持流式输出、Extended Thinking、工具调用、代码分析、文件上传、图片分析 |
| **项目/任务管理** | 多级项目结构、任务分配、交付物管理、提交审核流程、依赖关系 |
| **团队管理** | 组织架构、部门、岗位角色、成员邀请、加入审批 |
| **Graph 视图** | D3 力导向图可视化项目/任务关系 |
| **AI 裁决 (Verdict)** | AI 判断任务是否在指定人员职责范围内 |
| **设置/通知** | 组织设置、Token 预算、个人设置、通知中心 |

### 目标用户

Deltapex Education 内部团队（10-50 人规模），角色包括 CEO（owner）、管理员（admin）、部门主管（head）、普通成员（member）。

### 测试账号

- **邮箱**: `test@buddy.dev`
- **密码**: `test123456`
- **角色**: owner

---

## 2. 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Express.js | 5.0 | HTTP 服务器框架 |
| TypeScript | 5.6 | 类型安全 |
| Drizzle ORM | 0.39 | 数据库 ORM，类型安全查询 |
| PostgreSQL | - | 主数据库（Replit 托管） |
| jsonwebtoken | 9.0 | JWT 认证 |
| bcryptjs | 3.0 | 密码哈希 |
| multer | 2.0 | 文件上传处理 |
| mammoth | 1.11 | .docx 文件解析 |
| tsx | 4.20 | TypeScript 运行时 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3 | UI 框架 |
| Vite | 7.3 | 构建工具与开发服务器 |
| TypeScript | 5.6 | 类型安全 |
| Tailwind CSS | 3.4 | 样式框架 |
| shadcn/ui | - | 组件库（基于 Radix UI） |
| wouter | 3.3 | 轻量路由 |
| TanStack React Query | 5.60 | 数据获取与缓存 |
| react-hook-form | 7.55 | 表单管理 |
| D3.js | 7.9 | 力导向图可视化 |
| Framer Motion | 11.13 | 动画 |
| highlight.js | 11.11 | 代码高亮 |
| react-markdown + remark-gfm | 10.1 | Markdown 渲染 |
| recharts | 2.15 | 图表组件 |
| Lucide React | 0.453 | 图标库 |

### AI 服务

| 服务 | 端点 | 用途 |
|------|------|------|
| Claude API (代理) | `https://vip.aipro.love/v1` | 主 AI 模型（OpenAI 兼容格式） |
| Anthropic SDK | `https://vip.aipro.love` | Code Context 模式（原生 SDK） |
| OpenRouter | `https://openrouter.ai/api/v1` | GPT-4o 和 DeepSeek V3 备用 |
| Tavily API | - | AI 网络搜索 |

### 开发工具

| 工具 | 用途 |
|------|------|
| drizzle-kit | 数据库迁移 |
| esbuild | 生产构建打包 |
| Capacitor | iOS App 封装 |

---

## 3. 项目目录结构

```
buddy/
├── client/                          # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/                  # AI 聊天相关组件
│   │   │   │   ├── AiInputBar.tsx       # 聊天输入栏（附件、搜索、代码模式）
│   │   │   │   ├── AiMessageBubble.tsx  # 消息气泡（用户/AI/系统）
│   │   │   │   ├── AIMessageContent.tsx # Markdown渲染（代码块、表格、链接）
│   │   │   │   ├── AiGuidedCreation.tsx # AI 引导式创建向导
│   │   │   │   ├── ThinkingBlock.tsx    # 思考过程展示（带计时器）
│   │   │   │   ├── ArtifactPanel.tsx    # 长文档/代码侧滑面板
│   │   │   │   └── InteractiveInputWidget.tsx # 交互式选择组件
│   │   │   ├── graph/               # 力导向图组件
│   │   │   │   ├── ForceGraph.tsx       # D3 图形引擎
│   │   │   │   ├── GraphNodeSheet.tsx   # 节点详情抽屉
│   │   │   │   └── GraphSettings.tsx    # 图形设置面板
│   │   │   ├── org/                 # 组织结构组件
│   │   │   │   ├── OrgOutline.tsx       # 层级文本视图
│   │   │   │   └── OrgMindmapSvg.tsx    # 组织脑图
│   │   │   └── ui/                  # shadcn/ui 基础组件 (50+)
│   │   ├── hooks/                   # 自定义 Hooks
│   │   │   ├── use-auth.ts              # 认证 Hook
│   │   │   └── use-toast.ts             # Toast 通知
│   │   ├── lib/                     # 工具库
│   │   │   ├── auth.tsx                 # AuthProvider 与 Token 管理
│   │   │   └── queryClient.ts           # TanStack Query 配置
│   │   ├── pages/                   # 页面组件 (15+)
│   │   │   ├── agent.tsx                # AI 聊天主页面 (2284行)
│   │   │   ├── dashboard.tsx            # 仪表盘
│   │   │   ├── graph-view.tsx           # 图形视图
│   │   │   ├── project-list.tsx         # 项目列表
│   │   │   ├── project-detail.tsx       # 项目详情
│   │   │   ├── task-list.tsx            # 任务列表
│   │   │   ├── task-detail.tsx          # 任务详情
│   │   │   ├── team.tsx                 # 团队管理
│   │   │   ├── chats.tsx                # 对话历史
│   │   │   ├── settings.tsx             # 系统设置
│   │   │   ├── notifications.tsx        # 通知中心
│   │   │   ├── login.tsx                # 登录页
│   │   │   └── OnboardingPage.tsx       # 新用户引导
│   │   ├── stores/                  # 状态管理
│   │   │   └── chatStreamStore.ts       # 多对话后台流状态
│   │   ├── App.tsx                  # 根组件 + 路由 + 侧边栏 (2095行)
│   │   └── index.css                # 全局样式 + CSS 变量
│   └── public/                      # 静态资源
│       ├── manifest.json                # PWA 配置
│       └── icons/                       # App 图标
├── server/                          # 后端应用
│   ├── services/
│   │   └── ai/                      # AI 服务核心
│   │       ├── index.ts                 # 主入口：路由、分类、流式、工具 (1536行)
│   │       ├── prompts.ts               # 系统提示词 (191行)
│   │       ├── codeTools.ts             # 代码上下文工具定义（read_file等）
│   │       ├── codeContext.ts           # 代码上下文执行逻辑
│   │       ├── actionSchemas.ts         # AI 动作 Zod 验证
│   │       ├── actionExecutor.ts        # AI 动作执行器
│   │       ├── tokenCost.ts             # Token 费用计算
│   │       ├── webSearch.ts             # Tavily 网络搜索集成
│   │       └── verdictService.ts        # 任务职责裁决
│   ├── middleware/
│   │   ├── auth.ts                      # JWT 认证中间件
│   │   └── orgIsolation.ts              # 多租户隔离中间件
│   ├── migrations/                  # 数据库迁移脚本
│   ├── replit_integrations/         # Replit 平台集成
│   │   └── auth/replitAuth.ts           # OIDC 登录
│   ├── routes.ts                    # API 路由定义 (3296行)
│   ├── storage.ts                   # 数据库 CRUD 接口 (989行)
│   ├── index.ts                     # 服务器入口
│   └── vite.ts                      # Vite 开发服务器集成
├── shared/                          # 前后端共享
│   ├── schema.ts                    # Drizzle 数据库 Schema (849行)
│   └── models/                      # 共享类型定义
├── docs/                            # 文档
│   ├── HANDOVER.md                  # 本文档
│   ├── ios-build-guide.md           # iOS 打包指南
│   ├── user-guide.md                # 用户指南
│   └── 01-03*.md                    # 技术规格文档
├── migrations/                      # Drizzle 生成的 SQL 迁移
├── script/
│   └── build.ts                     # 生产构建脚本
├── package.json                     # 依赖与脚本
├── drizzle.config.ts                # Drizzle ORM 配置
├── vite.config.ts                   # Vite 构建配置
├── tailwind.config.ts               # Tailwind CSS 配置
├── capacitor.config.ts              # iOS 打包配置
├── tsconfig.json                    # TypeScript 配置
└── replit.md                        # Replit 环境说明
```

---

## 4. 数据库 Schema

所有表定义在 `shared/schema.ts`，使用 Drizzle ORM。共 **21 张表**。

### 4.1 组织与人员

#### organizations（组织）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| name | varchar(255) NOT NULL | 组织名称 |
| description | text | 描述 |
| type | varchar(50) default 'project' | 组织类型 |
| tokenBudgetUsd | numeric(10,4) | AI Token 月预算（美元） |
| budgetResetDay | integer default 1 | 预算重置日（每月第几天） |
| maxMembers | integer default 50 | 最大成员数 |
| isPublic | boolean default false | 是否公开 |
| createdAt, updatedAt | timestamp | 时间戳 |

#### departments（部门）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| name | varchar(255) NOT NULL | 部门名称 |
| description | text | 描述 |
| color | varchar(7) | HEX 颜色代码 |
| parentDeptId | integer FK→departments | 上级部门（自引用） |
| createdAt, updatedAt | timestamp | 时间戳 |

#### job_roles（岗位角色）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| deptId | integer FK→departments | 所属部门（可选） |
| title | varchar(255) NOT NULL | 岗位名称 |
| description | text | 岗位描述 |
| responsibilities | text | 职责说明（AI Verdict 用） |
| boundaries | text | 职责边界（AI Verdict 用） |
| requiredSkills | text | 技能要求 |
| createdAt, updatedAt | timestamp | 时间戳 |

#### users（用户）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 当前所属组织 |
| deptId | integer FK→departments | 所属部门 |
| jobRoleId | integer FK→job_roles | 岗位角色 |
| email | varchar(255) UNIQUE NOT NULL | 邮箱 |
| passwordHash | text | bcrypt 密码哈希 |
| displayName | varchar(255) | 显示名称 |
| role | varchar(50) default 'member' | 角色：owner/admin/head/member |
| avatarUrl | text | 头像 URL |
| isActive | boolean default true | 是否激活 |
| onboardingCompleted | boolean default false | 是否完成新手引导 |
| lastLoginAt | timestamp | 最后登录时间 |
| authProvider | varchar(50) | 认证方式（local/replit/telegram） |
| authProviderId | varchar(255) | 第三方认证 ID |
| createdAt, updatedAt | timestamp | 时间戳 |

#### org_memberships（多组织成员关系）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| userId | integer FK→users NOT NULL | 用户 |
| orgId | integer FK→organizations NOT NULL | 组织 |
| role | varchar(50) NOT NULL default 'member' | 在该组织的角色 |
| deptId | integer FK→departments | 在该组织的部门 |
| jobRoleId | integer FK→job_roles | 在该组织的岗位 |
| isActive | boolean default true | 是否激活 |
| joinedAt | timestamp | 加入时间 |

#### invitations（邀请码）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations NOT NULL | 所属组织 |
| inviteCode | varchar(50) UNIQUE NOT NULL | 邀请码 |
| type | text default 'code' | 类型（code/email） |
| email | text | 邮箱（email 类型时） |
| role | varchar(50) default 'member' | 分配角色 |
| createdBy | integer FK→users NOT NULL | 创建者 |
| expiresAt | timestamp | 过期时间 |
| maxUses | integer | 最大使用次数 |
| usedCount | integer default 0 | 已使用次数 |
| isActive | boolean default true | 是否激活 |
| status | text default 'pending' | 状态 |
| acceptedAt | timestamp | 接受时间 |
| acceptedBy | integer FK→users | 接受者 |
| createdAt | timestamp | 创建时间 |

#### organization_join_requests（加入申请）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations NOT NULL | 目标组织 |
| userId | integer FK→users NOT NULL | 申请用户 |
| message | text | 申请消息 |
| inviteCode | varchar(50) | 使用的邀请码 |
| status | varchar(50) default 'pending' | pending/approved/rejected |
| reviewedBy | integer FK→users | 审核者 |
| reviewedAt | timestamp | 审核时间 |
| reviewNote | text | 审核备注 |
| createdAt | timestamp | 创建时间 |

### 4.2 项目与任务

#### projects（项目）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| deptId | integer FK→departments | 所属部门 |
| name | varchar(255) NOT NULL | 项目名称 |
| status | varchar(50) default 'active' | 状态 |
| ownerId | integer FK→users | 项目负责人 |
| startDate, targetDate | timestamp | 起止日期 |
| createdAt, updatedAt | timestamp | 时间戳 |

#### tasks（任务）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| projectId | integer FK→projects | 所属项目 |
| parentTaskId | integer FK→tasks | 父任务（子任务自引用） |
| title | varchar(500) NOT NULL | 任务标题 |
| description | text | 详细描述 |
| type | varchar(50) default 'task' | 类型：task/milestone |
| status | varchar(50) | todo/in_progress/submitted/reviewing/done/cancelled |
| priority | varchar(50) default 'medium' | low/medium/high/critical |
| creatorId | integer FK→users | 创建者 |
| assigneeId | integer FK→users | 负责人 |
| startDate, dueDate | timestamp | 起止日期 |
| completedAt | timestamp | 完成时间 |
| weight | integer | 权重（1-10） |
| progress | integer | 进度（0-100） |
| tags | text | 标签 |
| needsReview | boolean default false | 是否需要审核 |
| warnings | text | AI 生成的警告 |
| starred | boolean default false | 是否星标 |
| version | integer default 1 | 版本号 |
| createdAt, updatedAt | timestamp | 时间戳 |

#### task_dependencies（任务依赖）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| taskId | integer FK→tasks | 依赖方任务 |
| dependsOnTaskId | integer FK→tasks | 被依赖任务 |
| type | varchar(50) | 依赖类型（finish_to_start 等） |

#### task_deliverables（任务交付物）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| taskId | integer FK→tasks | 所属任务 |
| type | varchar(50) | file/link/text |
| content | text | 内容/URL |
| fileName | varchar(255) | 文件名 |
| uploadedBy | integer FK→users | 上传者 |
| version | integer | 版本号 |
| createdAt | timestamp | 创建时间 |

#### task_submissions（任务提交/审核）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| taskId | integer FK→tasks | 所属任务 |
| submittedBy | integer FK→users | 提交者 |
| status | varchar(50) | pending/approved/rejected |
| reviewedBy | integer FK→users | 审核者 |
| score | integer | 评分 |
| comment | text | 审核评语 |
| createdAt, reviewedAt | timestamp | 时间戳 |

### 4.3 AI 与交互

#### conversations（AI 对话）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| userId | integer FK→users | 用户 |
| title | varchar(500) | 对话标题（AI 生成） |
| starred | boolean | 是否星标 |
| projectId | integer | 关联项目 |
| projectName | varchar(255) | 项目名称 |
| visibility | varchar(50) | private/shared |
| systemPrompt | text | 自定义系统提示 |
| isArchived | boolean | 是否归档 |
| lastMessageAt | timestamp | 最后消息时间 |
| createdAt, updatedAt | timestamp | 时间戳 |

#### chat_messages（聊天消息）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| conversationId | integer FK→conversations | 所属对话 |
| role | varchar(50) | user/assistant/system |
| content | text | 消息内容 |
| type | varchar(50) | text/image/file |
| metadata | text | JSON 格式的额外数据 |
| createdAt | timestamp | 创建时间 |

#### verdicts（AI 裁决）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| taskId | integer FK→tasks | 相关任务 |
| userId | integer FK→users | 被评估用户 |
| result | varchar(50) | in_scope/stretch/out_of_scope |
| reasoning | text | AI 推理过程 |
| suggestedUserId | integer | 建议的更合适人选 |
| accepted | boolean | 是否被接受 |
| overrideReason | text | 人工覆盖原因 |
| createdAt | timestamp | 创建时间 |

#### user_memories（用户记忆）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| userId | integer FK→users | 用户 |
| category | varchar(50) | preference/fact/style |
| content | text | 记忆内容 |
| source | varchar(50) | 来源（ai_extracted/manual） |
| createdAt | timestamp | 创建时间 |

#### token_usage（Token 用量）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增主键 |
| orgId | integer FK→organizations | 所属组织 |
| userId | integer FK→users | 用户 |
| model | varchar(100) | 使用的模型 |
| promptTokens | integer | 输入 Token 数 |
| completionTokens | integer | 输出 Token 数 |
| totalCost | numeric(10,6) | 费用（美元） |
| createdAt | timestamp | 创建时间 |

### 4.4 协作

#### task_comments（任务评论）
- 任务的评论/讨论
- 字段：id, taskId, userId, content, createdAt

#### task_participants（任务参与者）
- 任务的参与者（除创建者和负责人外）
- 字段：id, taskId, userId, addedAt

### 4.5 系统支撑

#### activity_logs（操作日志）
- 记录所有 CRUD 操作的审计轨迹
- 字段：id, orgId, userId, action, entityType, entityId, details, createdAt

#### notifications（通知）
- 用户通知（任务分配、提及、状态变更等）
- 字段：id, orgId, userId, type, title, content, isRead, relatedEntityType, relatedEntityId, createdAt

---

## 5. API 路由清单

所有路由定义在 `server/routes.ts`（3296 行），按模块分组如下。

### 5.1 认证 (Auth)

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/auth/register` | 注册新用户 + 创建默认组织 |
| POST | `/api/auth/login` | 邮箱密码登录，返回 JWT |
| GET | `/api/auth/me` | 获取当前用户信息 |
| PUT | `/api/auth/profile` | 更新显示名/头像 |
| PUT | `/api/auth/password` | 修改密码 |
| GET | `/api/auth/oidc/complete` | OIDC 登录回调（Replit） |
| POST | `/api/auth/telegram` | Telegram 登录验证 |

### 5.2 组织与邀请 (Organization)

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/user/orgs` | 当前用户的所有组织 |
| POST | `/api/user/switch-org` | 切换活跃组织（返回新 JWT） |
| GET | `/api/org/members` | 当前组织成员列表 |
| POST | `/api/organizations` | 创建组织 |
| GET | `/api/organizations/search` | 按邀请码搜索组织 |
| POST | `/api/organizations/:id/join-requests` | 申请加入组织 |
| GET | `/api/organizations/:id/join-requests` | 待审批的加入申请 |
| PUT | `/api/organizations/:id/join-requests/:requestId` | 审批加入申请 |
| GET | `/api/organizations/:id/invite-code` | 获取组织邀请码 |
| POST | `/api/organizations/:id/invite-code/regenerate` | 重新生成邀请码 |
| POST | `/api/invitations` | 创建邀请码 |
| GET | `/api/invitations` | 列出邀请码 |
| DELETE | `/api/invitations/:id` | 停用邀请码 |
| GET | `/api/invitations/verify/:code` | 验证邀请码 |
| POST | `/api/invitations/accept/:code` | 接受邀请加入 |

### 5.3 部门与用户管理

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/departments` | 部门列表 |
| POST | `/api/departments` | 创建部门 |
| PATCH | `/api/departments/:id` | 更新部门 |
| DELETE | `/api/departments/:id` | 删除部门 |
| GET | `/api/users` | 用户列表 |
| POST | `/api/users` | 创建用户 |
| PATCH | `/api/users/:id` | 更新用户信息 |
| DELETE | `/api/users/:id` | 删除用户 |

### 5.4 项目管理

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:id` | 项目详情（含任务） |
| POST | `/api/projects` | 创建项目 |
| PATCH | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目及关联任务 |

### 5.5 任务管理

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/tasks` | 任务列表（支持过滤：project/assignee/status） |
| GET | `/api/tasks/:id` | 任务详情（含子任务、依赖、评论） |
| POST | `/api/tasks` | 创建任务 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/tasks/:id/dependencies` | 获取任务依赖 |
| POST | `/api/task-dependencies` | 创建依赖关系 |
| DELETE | `/api/task-dependencies/:id` | 删除依赖 |

### 5.6 任务交互（评论/参与者/交付物/提交）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/tasks/:id/comments` | 任务评论列表 |
| POST | `/api/tasks/:id/comments` | 添加评论 |
| GET | `/api/tasks/:id/participants` | 任务参与者 |
| POST | `/api/tasks/:id/participants` | 添加参与者 |
| DELETE | `/api/tasks/:taskId/participants/:userId` | 移除参与者 |
| POST | `/api/tasks/:taskId/deliverables` | 上传交付物 |
| GET | `/api/tasks/:taskId/deliverables` | 交付物列表 |
| DELETE | `/api/tasks/:taskId/deliverables/:id` | 删除交付物 |
| POST | `/api/tasks/:taskId/submissions` | 提交任务 |
| GET | `/api/tasks/:taskId/submissions` | 提交记录 |
| GET | `/api/organizations/:orgId/pending-reviews` | 待审核任务 |
| PUT | `/api/tasks/:taskId/submissions/:submissionId/review` | 审核提交 |

### 5.7 岗位角色与 AI 裁决 (Verdict)

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/job-roles` | 岗位角色列表 |
| POST | `/api/job-roles` | 创建岗位 |
| PATCH | `/api/job-roles/:id` | 更新岗位 |
| DELETE | `/api/job-roles/:id` | 删除岗位 |
| PATCH | `/api/users/:id/job-role` | 分配岗位给用户 |
| POST | `/api/verdicts/judge` | AI 判断任务职责范围 |
| POST | `/api/verdicts/judge-assignment` | AI 裁决 + 创建记录 |
| GET | `/api/verdicts/task/:taskId` | 任务的所有裁决 |
| GET | `/api/verdicts/user/:userId` | 用户的所有裁决 |
| PATCH | `/api/verdicts/:id/accept` | 接受裁决 |
| PATCH | `/api/verdicts/:id/override` | 人工覆盖裁决 |
| GET | `/api/verdicts/stats` | 裁决统计 |

### 5.8 AI 对话

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/conversations` | 对话列表 |
| GET | `/api/conversations/search` | 搜索对话 |
| GET | `/api/conversations/:id` | 对话详情 |
| POST | `/api/conversations` | 创建新对话 |
| PATCH | `/api/conversations/:id` | 更新对话（标题等） |
| DELETE | `/api/conversations/:id` | 删除对话 |
| GET | `/api/conversations/:id/messages` | 获取对话消息 |
| POST | `/api/conversations/:id/messages` | 手动添加消息 |
| DELETE | `/api/conversations/:id/messages/after/:messageId` | 删除指定消息之后的所有消息 |
| POST | `/api/conversations/:id/messages/truncate` | 截断对话历史 |
| **POST** | **`/api/ai/chat/stream`** | **核心：流式 AI 对话（SSE）** |
| POST | `/api/ai/chat` | 非流式 AI 对话 |
| POST | `/api/ai/confirm` | 执行 AI 建议的动作 |
| POST | `/api/ai/confirm-batch` | 批量执行动作 |
| GET | `/api/ai/guided-options` | 引导式创建选项 |
| POST | `/api/ai/decompose-project` | AI 分解项目为任务 |

### 5.9 用户记忆

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/user-memories` | 获取 AI 记忆列表 |
| POST | `/api/user-memories` | 手动创建记忆 |
| DELETE | `/api/user-memories/:id` | 删除记忆 |

### 5.10 图形视图与分析

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/graph/data` | 图形节点和边数据 |
| GET | `/api/graph/subtasks/:taskId` | 子任务层级 |
| GET | `/api/graph/collaboration-health` | 跨部门协作健康度 |
| POST | `/api/graph/ai-analysis` | AI 分析活跃任务 |
| GET | `/api/stats/overview` | 任务统计概览 |
| GET | `/api/activity-logs` | 操作日志 |

### 5.11 通知与预算

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/notifications` | 通知列表 |
| GET | `/api/notifications/unread-count` | 未读数量 |
| PATCH | `/api/notifications/:id/read` | 标记已读 |
| POST | `/api/notifications/mark-all-read` | 全部已读 |
| GET | `/api/token-usage/balance` | Token 预算余额 |
| PATCH | `/api/organization/budget` | 更新预算设置 |
| GET | `/api/token-usage/stats` | Token 使用统计 |

---

## 6. AI 子系统架构

AI 核心代码在 `server/services/ai/` 目录下，是项目最复杂的模块。

### 6.1 模型路由

系统使用 **三个 AI 提供商**：

```
Claude API Proxy (vip.aipro.love/v1)
├── claude-haiku-4-5-20251001    ← 轻量任务
├── claude-sonnet-4-6            ← 标准任务
└── claude-opus-4-6              ← 深度分析

OpenRouter (openrouter.ai/api/v1)
├── gpt-4o                       ← 备用模型
└── deepseek-chat                ← 备用模型
```

**API Key 分配**：
- `CLAUDE_SIMPLE_API_KEY` → Haiku 模型 + Anthropic SDK（Code Context 模式）
- `CLAUDE_COMPLEX_API_KEY` → Sonnet/Opus 模型（通过 OpenAI SDK 调用代理）

### 6.2 任务分类器 (Task Classifier)

每条用户消息发送前，先用 Haiku 快速分类：

```
用户消息 → classifyTask() → 分类结果 → 选择模型+参数
```

分类类别及对应配置：

| 分类 | 模型 | max_tokens | Extended Thinking | 温度 |
|------|------|-----------|-------------------|------|
| `quick_reply` (问候/简单问答) | Haiku | 2,048 | 关 | 0.5 |
| `general_chat` (日常对话) | Sonnet | 8,192 | 关 | 0.7 |
| `code_generation` (代码生成) | Sonnet | 16,384 | 开 (budget: 16k) | 0.3 |
| `complex_analysis` (复杂分析) | Sonnet | 32,000 | 开 (budget: 32k) | 0.5 |
| `document_processing` (文档处理) | Sonnet | 16,384 | 开 (budget: 10k) | 0.3 |
| `deep_mode` (用户手动选 Opus) | Opus | 64,000 | 开 (budget: 32k) | 0.5 |

**Extended Thinking 控制**：前端有开关，但它只是"权限标志"——即使开启，`quick_reply` 和 `general_chat` 也不会触发 thinking。

### 6.3 上下文优化

```
完整对话历史 → buildOptimizedContext() → 裁剪后的历史
```

- 每个分类保留不同数量的最近消息（4-20 条）
- 超出部分由 Haiku 生成摘要，注入为上下文前缀
- 避免超出模型 context window

### 6.4 流式输出 (`chatStream`)

```
POST /api/ai/chat/stream
  ↓
classifyTask() → 分类
  ↓
buildOptimizedContext() → 裁剪历史
  ↓
OpenAI SDK stream → SSE 推送到前端
  ↓
前端逐 token 渲染 → ThinkingBlock / MessageBubble
  ↓
流结束 → extractMemories() → 存储用户记忆
       → generateTitle() → 自动生成对话标题
       → recordTokenUsage() → 记录用量
```

SSE 事件格式：
- `data: {"type":"token","content":"..."}` — 文本 token
- `data: {"type":"thinking","content":"..."}` — 思考内容
- `data: {"type":"action","data":{...}}` — AI 建议的操作
- `data: {"type":"done"}` — 流结束

### 6.5 工具调用 (Code Context 模式)

启用"代码上下文"后，使用 Anthropic 原生 SDK 的 tool_use 循环：

```
用户消息 → codeToolChatStream()
  ↓
AI 调用工具（最多 8 轮）：
  - read_file(path) → 读取项目文件
  - list_directory(path) → 列出目录
  - search_code(pattern) → 搜索代码
  ↓
安全检查：isPathSafe() 阻止访问 .env / .pem / node_modules 等
  ↓
工具结果回传 AI → 继续推理或输出最终回复
```

### 6.6 记忆系统

```
对话结束 → extractMemories()
  ↓
Haiku 分析对话内容 → 提取用户偏好/事实/风格
  ↓
存储到 user_memories 表
  ↓
下次对话时注入 system prompt → 个性化体验
```

### 6.7 AI 动作与引导式创建

AI 可以建议执行操作（而非直接执行）：

```
用户："帮我创建一个任务"
  ↓
AI 返回 action JSON：
{
  "type": "action",
  "action": "create_task",
  "data": { title, projectId, assigneeId, ... }
}
  ↓
前端显示确认卡片 → 用户确认
  ↓
POST /api/ai/confirm → 实际执行创建
```

当信息不完整时触发**引导式创建** (`buildGuidedSteps`)：
- AI 返回 `follow_up` 类型
- 前端渲染交互式步骤向导（选择项目、人员、日期等）
- 用户逐步填写 → 最终生成完整的操作请求

### 6.8 Verdict 服务（职责裁决）

```
POST /api/verdicts/judge-assignment
  ↓
verdictService.judgeAssignment()
  ↓
读取目标用户的 jobRole.responsibilities + boundaries
  ↓
AI 判断：in_scope / stretch / out_of_scope
  ↓
如果 out_of_scope → 推荐更合适的人选
  ↓
结果存入 verdicts 表 → 前端显示裁决卡片
```

### 6.9 模型风格提示 (Style Hints)

系统 prompt 根据模型注入不同的风格指令：
- **Haiku** → 简洁精炼，直奔主题
- **Sonnet** → 平衡详略，结构清晰
- **Opus** → 深度分析，多角度思考

### 6.10 Web 搜索

通过 Tavily API 实现 AI 联网搜索能力，用户在输入栏点击搜索图标启用。

---

## 7. 前端架构

### 7.1 路由表

| 路径 | 页面组件 | 说明 |
|------|---------|------|
| `/login` | LoginPage | 登录页 |
| `/onboarding` | OnboardingPage | 新用户引导 |
| `/` | → 重定向到 `/agent` | 默认首页 |
| `/agent` | Agent | AI 聊天主页面 |
| `/chats` | ChatsPage | 对话历史 |
| `/dashboard` | Dashboard | 仪表盘 |
| `/graph` | GraphView | 力导向图视图 |
| `/projects` | ProjectList | 项目列表 |
| `/projects/:id` | ProjectDetail | 项目详情 |
| `/tasks` | TaskList | 任务列表 |
| `/tasks/:id` | TaskDetail | 任务详情 |
| `/team` | Team | 团队管理 |
| `/settings` | Settings | 系统设置 |
| `/notifications` | Notifications | 通知中心 |
| `/artifacts` | Artifacts | AI 生成文档/代码 |
| `*` | NotFound | 404 页面 |

### 7.2 核心 AI 组件层级

```
Agent (agent.tsx - 2284行，最复杂的页面)
├── ConversationSidebar          # 对话列表侧边栏
├── ChatArea
│   ├── AiMessageBubble[]        # 消息气泡列表
│   │   ├── AIMessageContent     # Markdown 渲染（代码块、表格、链接）
│   │   ├── ThinkingBlock        # 思考过程（带实时计时器）
│   │   ├── ToolCallCard         # 工具调用折叠卡片
│   │   ├── ActionConfirmCard    # AI 操作确认卡片
│   │   └── AiReplyActions       # 复制/点赞/点踩/重新生成
│   ├── InteractiveInputWidget   # 交互式选择（浮在输入栏上方）
│   └── AiGuidedCreation         # 引导式创建向导
├── AiInputBar                   # 输入栏（附件、模型选择、搜索开关等）
└── ArtifactPanel                # 侧滑面板（查看长文档/代码）
```

### 7.3 状态管理

- **TanStack React Query**: 服务端状态（API 数据获取与缓存）
- **React useState/useCallback**: 组件局部状态
- **chatStreamStore.ts**: 多对话后台流式处理状态（Zustand 风格）
- **AuthProvider (auth.tsx)**: 全局认证状态 + JWT Token 管理
- **Custom Events**: 跨组件通信（如 `toggle-sidebar`, `open-sidebar`）

### 7.4 设计系统

- **主题**: "Claude-style" 暖色调，深色模式为主
- **CSS 变量**: 定义在 `client/src/index.css` 的 `:root` 和 `.dark`
- **关键色**: `--brand`（铜橙色）, `--bg-main`, `--bg-surface`, `--text-primary` 等
- **组件**: 全部基于 shadcn/ui（Radix UI），自定义了按钮、卡片等的样式
- **图标**: Lucide React
- **动画**: Framer Motion + CSS @keyframes

### 7.5 键盘快捷键

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| `↑` (上箭头) | 召回上一条用户消息编辑 | 输入栏为空时 |
| `Escape` | 停止当前 AI 生成 | Agent 页面 |
| `Ctrl/Cmd + Shift + N` | 新建对话 | Agent 页面 |
| `Ctrl/Cmd + Shift + S` | 切换侧边栏 | Agent 页面 |

---

## 8. 认证与权限体系

### 8.1 认证流程

```
登录方式：
1. 邮箱 + 密码 → POST /api/auth/login → 返回 JWT
2. Replit OIDC → GET /api/auth/oidc/complete → 重定向 + JWT
3. Telegram → POST /api/auth/telegram → 验证 HMAC → JWT

JWT Payload:
{
  userId: number,
  orgId: number,
  role: "owner" | "admin" | "head" | "member"
}

Token 有效期：7 天
存储位置：localStorage("buddy_token")
```

### 8.2 RBAC 四角色

| 角色 | 权限 |
|------|------|
| **owner** | 所有权限，组织管理，预算设置 |
| **admin** | 成员管理，邀请码，审核提交 |
| **head** | 部门内任务管理，审核部门成员提交 |
| **member** | 查看/创建/更新自己的任务，AI 聊天 |

角色检查在路由处理函数内部进行（非中间件级别）。

### 8.3 多租户隔离

```
请求 → authMiddleware（验证 JWT，提取 userId + orgId）
     → orgIsolation（设置 req.orgId, req.currentUserId）
     → 路由处理（所有查询带 orgId 条件）
     
关键：orgId 编码在 JWT 中。
切换组织时：POST /api/user/switch-org → 返回新 JWT。
```

---

## 9. 关键文件索引

| 文件路径 | 行数 | 职责 |
|----------|------|------|
| `client/src/pages/agent.tsx` | 2,284 | AI 聊天主页面，消息管理、流式处理、工具调用 |
| `client/src/App.tsx` | 2,095 | 根组件、路由注册、侧边栏、主题、布局 |
| `server/routes.ts` | 3,296 | 所有 API 路由定义 |
| `server/services/ai/index.ts` | 1,536 | AI 核心：分类、路由、流式、工具、记忆 |
| `client/src/components/ai/AiMessageBubble.tsx` | 1,071 | 消息气泡渲染（用户/AI/工具调用/操作） |
| `server/storage.ts` | 989 | 数据库 CRUD 操作接口 |
| `client/src/components/ai/AiInputBar.tsx` | 943 | 聊天输入栏（附件、模型选择等） |
| `shared/schema.ts` | 849 | 数据库 Schema 定义（21 张表） |
| `client/src/components/ai/AIMessageContent.tsx` | 417 | Markdown 渲染（代码块、表格、链接） |
| `server/services/ai/prompts.ts` | 191 | 系统提示词（AI 的"大脑"） |
| `server/services/ai/codeTools.ts` | ~200 | 代码上下文工具定义 |
| `server/services/ai/codeContext.ts` | ~150 | 代码上下文执行逻辑 |
| `server/services/ai/verdictService.ts` | ~150 | 职责裁决 AI 服务 |
| `server/services/ai/actionSchemas.ts` | ~100 | AI 动作的 Zod 验证 Schema |
| `server/services/ai/actionExecutor.ts` | ~200 | AI 动作执行器 |
| `server/services/ai/tokenCost.ts` | ~50 | Token 费用计算 |
| `server/services/ai/webSearch.ts` | ~100 | Tavily 网络搜索集成 |
| `server/middleware/auth.ts` | ~80 | JWT 认证中间件 |
| `server/middleware/orgIsolation.ts` | ~40 | 多租户隔离中间件 |
| `client/src/lib/auth.tsx` | ~150 | 前端 AuthProvider + Token 管理 |
| `client/src/lib/queryClient.ts` | ~50 | TanStack Query 配置 |
| `client/src/stores/chatStreamStore.ts` | ~100 | 多对话后台流状态 |

---

## 10. 环境变量

| 变量名 | 必需 | 用途 |
|--------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 是 | JWT 签名密钥 |
| `CLAUDE_COMPLEX_API_KEY` | 是 | Sonnet/Opus 模型 API Key |
| `CLAUDE_SIMPLE_API_KEY` | 是 | Haiku 模型 + Anthropic SDK API Key |
| `TAVILY_API_KEY` | 是 | Tavily Web 搜索 API Key |
| `TELEGRAM_BOT_TOKEN` | 否 | Telegram 登录机器人 Token |
| `AI_BASE_URL` | 否 | Claude 代理地址（默认 `https://vip.aipro.love/v1`） |
| `AI_API_KEY` | 否 | 通用 AI Key（备用） |
| `SESSION_SECRET` | 否 | Express Session 密钥 |
| `ISSUER_URL` | 否 | OIDC 发行方地址 |
| `PORT` | 否 | 服务端口（默认 5000） |
| `NODE_ENV` | 否 | development / production |
| `REPL_ID` | 自动 | Replit 环境 ID |

---

## 11. 开发约定

### 11.1 运行命令

```bash
npm run dev        # 开发模式（tsx 热重载，前后端同端口 5000）
npm run build      # 生产构建（esbuild 打包到 dist/）
npm run start      # 生产运行
npm run db:push    # 推送 Schema 变更到数据库
npm run check      # TypeScript 类型检查
```

### 11.2 代码风格

- **语言**: TypeScript（前后端统一）
- **前端导入路径**: 使用 `@/` 别名（如 `@/components/ui/button`）、`@shared/` 别名
- **UI 组件**: 优先使用 shadcn/ui，不要引入其他 UI 库
- **路由**: 使用 `wouter`，不要用 `react-router`
- **数据获取**: 使用 TanStack React Query，不要手动 fetch
- **表单**: 使用 react-hook-form + zodResolver
- **图标**: Lucide React（功能图标）、react-icons/si（品牌 Logo）
- **测试 ID**: 所有可交互元素添加 `data-testid` 属性

### 11.3 Replit 环境注意事项

- **不要修改** `package.json` 的 scripts（除非必要）
- **不要修改** `vite.config.ts` 和 `server/vite.ts`（已正确配置）
- **不要修改** `drizzle.config.ts`
- **不要使用** Docker 或虚拟环境
- **环境变量**: 通过 Replit Secrets 管理，不要创建 `.env` 文件
- **数据库**: Schema 变更后运行 `npm run db:push`，不要手动写 SQL 迁移
- **绝对不要** 修改 ID 字段类型（serial ↔ varchar 会破坏数据）

### 11.4 AI API 调用注意事项

- Claude 模型通过 `vip.aipro.love` 代理，使用 **OpenAI 兼容格式**
- Code Context 模式用 Anthropic 原生 SDK，baseURL 为 `https://vip.aipro.love`（无 /v1）
- 前端 env 变量必须以 `VITE_` 前缀
- 所有 AI 调用都要记录 token usage（`recordTokenUsage`）

---

## 12. 已完成功能清单

### 12.1 AI 聊天 (Claude.ai 对齐)

- [x] 流式输出（SSE），逐 Token 渲染
- [x] Extended Thinking 展示（"Thinking for Xs..." → "Thought for X seconds"，英文标签）
- [x] 工具调用折叠卡片（running/complete/error 状态，类型图标）
- [x] 模型风格提示注入（Haiku/Sonnet/Opus 差异化）
- [x] 智能任务路由（Haiku 分类 → 动态选模型 + 参数）
- [x] 上下文裁剪与 Haiku 摘要
- [x] 跨对话记忆提取与注入
- [x] 代码上下文模式（read_file/list_directory/search_code）
- [x] 文件上传（图片、.docx、文本文件）
- [x] Web 搜索（Tavily API）
- [x] 对话持久化（所有消息存数据库）
- [x] 多对话后台处理（切换对话时 AI 继续生成）
- [x] AI 操作确认卡片（创建任务/项目等）
- [x] 引导式创建向导（交互式步骤填写）
- [x] 交互式输入组件（single_select/multi_select/rank_priorities）
- [x] ArtifactPanel 侧滑面板
- [x] Token 用量显示 Badge
- [x] 智能建议卡片
- [x] 消息编辑与重发
- [x] ↑ 召回上条消息、Escape 停止生成
- [x] Ctrl+Shift+N 新对话、Ctrl+Shift+S 切换侧边栏

### 12.2 AI 聊天 UI 打磨

- [x] 代码块 maxHeight 400px + 可滚动
- [x] 链接 target="_blank" 新标签页打开
- [x] 表格斑马纹样式
- [x] 表格/代码块水平拖拽滚动
- [x] 点踩反馈分类表单（5 个选项）
- [x] 操作按钮始终显示（非 hover）
- [x] 流式光标动画
- [x] 消息入场动画

### 12.3 错误处理

- [x] 网络错误自动重试（1s/3s/5s 退避）
- [x] 频率限制冷却倒计时
- [x] 上下文过长弹窗提示
- [x] 流中断恢复

### 12.4 企业功能

- [x] 项目 CRUD + 详情页
- [x] 任务 CRUD + 子任务 + 依赖关系
- [x] 任务交付物上传/管理
- [x] 任务提交/审核流程
- [x] 部门管理
- [x] 岗位角色管理
- [x] AI 职责裁决 (Verdict)
- [x] 邀请码管理
- [x] 加入请求审批
- [x] 多组织支持（切换组织）
- [x] Token 预算与余额系统
- [x] 操作日志
- [x] 通知系统
- [x] D3 力导向图视图
- [x] 仪表盘与统计
- [x] 新用户 Onboarding 流程
- [x] 移动端适配

### 12.5 iOS App

- [x] Capacitor 配置
- [x] PWA manifest.json
- [x] iOS meta tags
- [x] 打包指南文档

---

## 13. 待办与迭代方向

### 13.1 未完成项

| 项目 | 优先级 | 说明 |
|------|--------|------|
| **回复版本切换** | P2 | Claude.ai 的"回复版本轮播"功能，需要修改 chat_messages 数据结构支持版本号，前端添加版本切换 UI |
| **反馈数据持久化** | P3 | 点踩反馈目前只在前端，未发送到后端存储 |
| **App 图标替换** | P2 | 当前使用占位图标，需要设计高清 1024x1024 图标 |
| **OAuth 真实集成** | P3 | Google/Apple/GitHub 登录按钮目前用 Replit OIDC 代理，非真正 OAuth |

### 13.2 推荐迭代方向

| 方向 | 说明 |
|------|------|
| **实时协作** | WebSocket 推送任务状态变更、评论通知 |
| **文件管理** | 独立的文件存储服务，支持大文件和版本管理 |
| **报表导出** | 任务/项目进度报表 PDF/Excel 导出 |
| **日历视图** | 任务时间线和甘特图展示 |
| **API 文档** | Swagger/OpenAPI 自动生成 |
| **单元测试** | 后端 API 路由的测试覆盖 |
| **权限细化** | 更细粒度的权限控制（如按项目/部门） |
| **AI 对话分享** | 对话链接分享给团队成员 |
| **批量任务操作** | 多选任务后批量修改状态/分配人员 |

---

## 14. iOS App 打包

详细步骤参见 `docs/ios-build-guide.md`。

### 概要

- **App ID**: `com.deltapex.buddy`
- **策略**: 使用 Capacitor 包裹线上 Web App（`server.url` 指向 `.replit.app` 域名）
- **优势**: 代码更新只需重新部署 Web，无需重新构建/提交 App
- **要求**: macOS + Xcode + Apple Developer 账号
- **配置文件**: `capacitor.config.ts`

### 关键设置

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.deltapex.buddy',
  appName: 'Buddy',
  server: {
    url: 'https://your-app.replit.app',  // 指向线上部署地址
  }
};
```

---

## 附录：快速上手清单

1. **阅读本文档** — 建立全局理解
2. **查看 `shared/schema.ts`** — 理解数据模型
3. **查看 `server/services/ai/index.ts`** — 理解 AI 核心逻辑
4. **查看 `server/services/ai/prompts.ts`** — 理解 AI 行为规则
5. **查看 `client/src/pages/agent.tsx`** — 理解最复杂的前端页面
6. **查看 `server/routes.ts`** — 理解 API 结构
7. **运行 `npm run dev`** — 启动开发环境
8. **用测试账号登录** — `test@buddy.dev` / `test123456`
9. **在 Agent 页面发送消息** — 体验完整 AI 对话流程
10. **查看 `docs/` 目录其他文档** — 补充细节
