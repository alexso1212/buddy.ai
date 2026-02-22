# 数据模型技术规格 v1.0

## 项目背景

AI驱动的企业任务管理工具。本文档定义核心数据模型，是所有后续开发（CRUD界面、图谱可视化、AI对话、权责判定）的基础。

## 技术要求

- ORM: Drizzle ORM
- 数据库: PostgreSQL (Replit DB)
- 语言: TypeScript
- Schema 文件位置: `shared/schema.ts`（前后端共享类型）
- 所有表名使用英文，字段名使用 snake_case
- 所有表必须包含 `created_at` 和 `updated_at` 时间戳
- ID 使用自增整数（serial），预留将来切换 UUID 的空间

-----

## 数据表定义

### 1. organizations（组织/公司）

用途：多租户预留，当前阶段只有一条记录（Deltapex Education）。

```typescript
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 2. departments（部门）

用途：组织下的部门划分，用于图谱可视化中的聚类分组。

```typescript
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentDeptId: integer('parent_dept_id').references(() => departments.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 3. users（用户）

用途：系统用户，关联 Replit Auth 或自建认证。

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  // role 取值: 'owner' | 'admin' | 'manager' | 'member'
  // owner: 组织拥有者(CEO)，全部权限
  // admin: 管理员，可管理所有项目和任务
  // manager: 部门/项目经理，可管理所属范围内的任务
  // member: 普通成员，只能管理自己的任务
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 4. projects（项目）

用途：顶层项目容器，图谱可视化中的聚类单元。

```typescript
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  // status 取值: 'active' | 'paused' | 'completed' | 'archived'
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  startDate: timestamp('start_date'),
  targetDate: timestamp('target_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5. tasks（任务）— 核心表

用途：系统的核心数据实体。通过 `parent_task_id` 实现任务→子任务的层级结构。

**关键设计决策：**

- 不单独建 milestones 表，里程碑就是一种特殊的 task（type=‘milestone’）
- 层级关系通过 parent_task_id 自引用实现，理论上支持无限层级，实际建议不超过3层
- 每个字段的设计都对应图谱可视化中的一个视觉维度

```typescript
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  parentTaskId: integer('parent_task_id').references(() => tasks.id),
  // null = 顶层任务, 有值 = 子任务

  // --- 基本信息 ---
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('task'),
  // type 取值: 'milestone' | 'task' | 'subtask' | 'bug' | 'request'

  // --- 状态与优先级（对应图谱节点颜色）---
  status: varchar('status', { length: 50 }).notNull().default('todo'),
  // status 取值: 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled'
  // 图谱颜色映射: todo=灰 | in_progress=黄 | in_review=蓝 | blocked=红 | done=绿 | cancelled=深灰
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),
  // priority 取值: 'critical' | 'high' | 'medium' | 'low'

  // --- 人员 ---
  creatorId: integer('creator_id').references(() => users.id).notNull(),
  assigneeId: integer('assignee_id').references(() => users.id),
  // assignee 可以为空，表示未分配

  // --- 时间 ---
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),

  // --- 权重（对应图谱节点大小）---
  weight: integer('weight').default(1).notNull(),
  // 1-10 的整数，表示任务的工作量/重要性
  // 图谱中节点大小与此值正相关

  // --- 进度 ---
  progress: integer('progress').default(0).notNull(),
  // 0-100 的整数，表示完成百分比
  // 有子任务时由系统根据子任务完成情况自动计算

  // --- 元数据 ---
  tags: text('tags'),
  // JSON 字符串存储标签数组，如 '["紧急","Q1","交易策略"]'
  // 未来可拆成独立的 tags 表，当前阶段简化处理

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 6. task_dependencies（任务依赖关系）

用途：定义任务之间的前置/后置关系，对应图谱中的连线。

```typescript
export const taskDependencies = pgTable('task_dependencies', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  // 当前任务（被阻塞的任务）
  dependsOnTaskId: integer('depends_on_task_id').references(() => tasks.id).notNull(),
  // 前置任务（必须先完成的任务）
  type: varchar('type', { length: 50 }).notNull().default('finish_to_start'),
  // type 取值:
  // 'finish_to_start' — 前置任务完成后，当前任务才能开始（最常见）
  // 'start_to_start' — 前置任务开始后，当前任务才能开始
  // 'finish_to_finish' — 前置任务完成后，当前任务才能完成
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

图谱连线逻辑：

- 从 `depends_on_task_id` 指向 `task_id`（箭头方向 = 工作流方向）
- 如果 `depends_on_task_id` 的状态不是 `done`，连线显示为红色（阻塞中）
- 如果 `depends_on_task_id` 的状态是 `done`，连线显示为绿色（已解除）

### 7. activity_logs（操作日志）

用途：记录所有数据变更，用于审计追溯和AI操作的安全保障。

```typescript
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  // 执行操作的用户
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  // 'task' | 'project' | 'user' | 'department'
  entityId: integer('entity_id').notNull(),
  // 被操作的实体 ID
  action: varchar('action', { length: 50 }).notNull(),
  // 'create' | 'update' | 'delete' | 'assign' | 'status_change' | 'comment'
  changes: text('changes'),
  // JSON 字符串，记录变更前后的值
  // 格式: '{"field": "status", "from": "todo", "to": "in_progress"}'
  source: varchar('source', { length: 50 }).notNull().default('manual'),
  // 'manual' | 'ai_chat' | 'system' | 'api'
  // 标记操作来源，区分人工操作和AI操作
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 8. task_comments（任务评论）

用途：任务下的讨论和沟通记录。

```typescript
export const taskComments = pgTable('task_comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

-----

## 关系总览

```
organization (1) ──→ (N) departments
organization (1) ──→ (N) users
organization (1) ──→ (N) projects
department   (1) ──→ (N) users
department   (1) ──→ (N) projects
department   (1) ──→ (N) departments (自引用，子部门)
project      (1) ──→ (N) tasks
user          (1) ──→ (N) tasks (as creator)
user          (1) ──→ (N) tasks (as assignee)
task          (1) ──→ (N) tasks (自引用，子任务)
task          (N) ←──→ (N) tasks (通过 task_dependencies，依赖关系)
task          (1) ──→ (N) task_comments
```

-----

## Drizzle Relations 定义

在 schema.ts 中同时定义 relations，便于类型安全的查询：

```typescript
import { relations } from 'drizzle-orm';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  departments: many(departments),
  users: many(users),
  projects: many(projects),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [users.deptId],
    references: [departments.id],
  }),
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  comments: many(taskComments),
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
  comments: many(taskComments),
  // 依赖关系需要通过 task_dependencies 表查询
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

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));
```

-----

## 枚举值速查表（供 AI 解析和前端校验使用）

|字段                    |允许值                                                               |默认值              |
|----------------------|------------------------------------------------------------------|-----------------|
|users.role            |`owner`, `admin`, `manager`, `member`                             |`member`         |
|projects.status       |`active`, `paused`, `completed`, `archived`                       |`active`         |
|tasks.type            |`milestone`, `task`, `subtask`, `bug`, `request`                  |`task`           |
|tasks.status          |`todo`, `in_progress`, `in_review`, `blocked`, `done`, `cancelled`|`todo`           |
|tasks.priority        |`critical`, `high`, `medium`, `low`                               |`medium`         |
|tasks.weight          |`1` - `10` (整数)                                                   |`1`              |
|tasks.progress        |`0` - `100` (整数)                                                  |`0`              |
|task_dependencies.type|`finish_to_start`, `start_to_start`, `finish_to_finish`           |`finish_to_start`|
|activity_logs.action  |`create`, `update`, `delete`, `assign`, `status_change`, `comment`|-                |
|activity_logs.source  |`manual`, `ai_chat`, `system`, `api`                              |`manual`         |

-----

## 图谱可视化字段映射（预览，第三步使用）

|视觉维度|数据来源                                                                  |
|----|----------------------------------------------------------------------|
|节点大小|`tasks.weight`                                                        |
|节点颜色|`tasks.status` (todo=灰, in_progress=黄, in_review=蓝, blocked=红, done=绿)|
|节点聚类|`tasks.projectId` 或 `projects.deptId`                                 |
|连线存在|`task_dependencies` 表中有记录                                             |
|连线方向|`depends_on_task_id` → `task_id`                                      |
|连线颜色|前置任务 status≠done → 红(阻塞) / status=done → 绿(已解除)                       |
|节点层级|`tasks.parentTaskId`（点击可下钻）                                           |

-----

## AI JSON Schema（预览，第四步使用）

AI 解析用户自然语言后必须输出以下格式：

```json
{
  "action": "create_task",
  "data": {
    "title": "完成Q1课程大纲",
    "projectId": 1,
    "assigneeId": 3,
    "priority": "high",
    "dueDate": "2025-03-15T00:00:00Z",
    "weight": 5,
    "parentTaskId": null,
    "description": "包含5个模块的课程大纲初稿"
  },
  "confidence": 0.9,
  "missingFields": ["tags"],
  "followUpQuestion": "需要给这个任务添加标签吗？"
}
```

-----

## 验收标准

完成本步骤后，项目应满足：

1. ✅ `shared/schema.ts` 中包含以上所有表定义和关系定义
1. ✅ 运行 `npx drizzle-kit generate` 能成功生成迁移文件
1. ✅ 运行 `npx drizzle-kit push` 能成功在数据库中创建所有表
1. ✅ 所有外键关系正确建立
1. ✅ TypeScript 类型自动推导正常（可以通过 `typeof tasks.$inferSelect` 获取类型）

-----

## 给 Replit Agent 的指令

请按照本文档的规格在 `shared/schema.ts` 中实现所有数据表定义。具体要求：

1. 在文件顶部从 `drizzle-orm/pg-core` 导入所需的类型（pgTable, serial, varchar, text, integer, boolean, timestamp）
1. 从 `drizzle-orm` 导入 relations
1. 按照文档中的顺序定义每张表，字段名称、类型、默认值必须与文档一致
1. 在表定义之后定义所有 relations
1. 导出所有表和关系定义
1. 不要添加文档中没有定义的额外字段或表
1. 完成后运行 drizzle-kit generate 和 push 确保数据库同步