# 第二步：最小可用 CRUD 界面技术规格 v1.0

## 目标

构建一个极简但功能完整的管理界面，用于：

1. 初始化组织、部门、用户数据
1. 创建和管理项目
1. 创建和管理任务（核心功能）
1. 设置任务之间的依赖关系

**设计原则：功能优先，UI 简洁。** 这个界面将来会退居为”高级管理视图”，主交互入口是 AI 对话（第四步）。所以现在不追求美观，只追求能用、数据能正确录入。

## 技术要求

- 前端: React + Tailwind CSS (已有)
- 后端: Express + Drizzle ORM (已有)
- 路由: 使用 wouter 或 react-router（取决于项目已有的路由方案）
- API 风格: RESTful JSON API
- 数据表: 使用 `shared/schema.ts` 中已定义的表和类型

-----

## 一、后端 API 路由

所有 API 路由前缀: `/api`

### 1.1 组织 Organizations

|方法  |路径                  |功能    |
|----|--------------------|------|
|GET |`/api/organizations`|获取所有组织|
|POST|`/api/organizations`|创建组织  |

### 1.2 部门 Departments

|方法    |路径                    |功能    |
|------|----------------------|------|
|GET   |`/api/departments`    |获取所有部门|
|POST  |`/api/departments`    |创建部门  |
|PATCH |`/api/departments/:id`|更新部门  |
|DELETE|`/api/departments/:id`|删除部门  |

### 1.3 用户 Users

|方法    |路径              |功能                        |
|------|----------------|--------------------------|
|GET   |`/api/users`    |获取所有用户                    |
|POST  |`/api/users`    |创建用户                      |
|PATCH |`/api/users/:id`|更新用户                      |
|DELETE|`/api/users/:id`|删除用户（软删除，设 isActive=false）|

### 1.4 项目 Projects

|方法    |路径                 |功能                |
|------|-------------------|------------------|
|GET   |`/api/projects`    |获取所有项目（含 owner 信息）|
|GET   |`/api/projects/:id`|获取单个项目详情（含任务列表）   |
|POST  |`/api/projects`    |创建项目              |
|PATCH |`/api/projects/:id`|更新项目              |
|DELETE|`/api/projects/:id`|删除项目              |

### 1.5 任务 Tasks（核心）

|方法    |路径              |功能                                          |
|------|----------------|--------------------------------------------|
|GET   |`/api/tasks`    |获取任务列表（支持按 projectId, assigneeId, status 筛选）|
|GET   |`/api/tasks/:id`|获取单个任务详情（含子任务、依赖关系、评论）                      |
|POST  |`/api/tasks`    |创建任务                                        |
|PATCH |`/api/tasks/:id`|更新任务（状态、优先级、负责人等）                           |
|DELETE|`/api/tasks/:id`|删除任务                                        |

**任务列表查询参数：**

- `?projectId=1` — 按项目筛选
- `?assigneeId=2` — 按负责人筛选
- `?status=todo,in_progress` — 按状态筛选（逗号分隔多个状态）
- `?parentTaskId=null` — 只查顶层任务（不含子任务）

### 1.6 任务依赖 Task Dependencies

|方法    |路径                           |功能        |
|------|-----------------------------|----------|
|GET   |`/api/tasks/:id/dependencies`|获取某任务的依赖关系|
|POST  |`/api/task-dependencies`     |创建依赖关系    |
|DELETE|`/api/task-dependencies/:id` |删除依赖关系    |

### 1.7 任务评论 Task Comments

|方法  |路径                       |功能        |
|----|-------------------------|----------|
|GET |`/api/tasks/:id/comments`|获取某任务的评论列表|
|POST|`/api/tasks/:id/comments`|添加评论      |

### 1.8 操作日志 Activity Logs

|方法 |路径                  |功能                                 |
|---|--------------------|-----------------------------------|
|GET|`/api/activity-logs`|获取操作日志（支持按 entityType, entityId 筛选）|

**注意：操作日志由后端在执行增删改操作时自动写入，不需要前端手动调用 POST。**

-----

## 二、后端实现规范

### 2.1 路由文件结构

```
server/
  routes/
    organizations.ts
    departments.ts
    users.ts
    projects.ts
    tasks.ts
    taskDependencies.ts
    taskComments.ts
    activityLogs.ts
  index.ts          ← 注册所有路由
```

如果项目已有路由注册方式，遵循现有模式。如果没有，在 `server/index.ts` 或 `server/routes.ts` 中统一注册。

### 2.2 操作日志中间件

每次 POST/PATCH/DELETE 成功后，自动写入 `activity_logs` 表。示例：

```typescript
// 在创建任务成功后
await db.insert(activityLogs).values({
  orgId: task.orgId,
  userId: currentUserId, // 当前操作用户
  entityType: 'task',
  entityId: newTask.id,
  action: 'create',
  changes: JSON.stringify({ title: task.title, status: task.status }),
  source: 'manual', // 手动操作，将来AI操作时为 'ai_chat'
});
```

### 2.3 数据验证

使用 `shared/schema.ts` 中已导出的 Zod schema 验证请求体：

```typescript
import { insertTaskSchema } from '../shared/schema';

// 在路由处理函数中
const parsed = insertTaskSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: parsed.error.format() });
}
```

### 2.4 错误处理

所有 API 返回统一格式：

- 成功: `{ data: ... }`
- 失败: `{ error: "错误信息" }`
- HTTP 状态码: 200(成功), 201(创建成功), 400(参数错误), 404(未找到), 500(服务器错误)

-----

## 三、前端页面

### 3.1 页面结构

使用左侧导航 + 右侧内容区的布局：

```
┌─────────────────────────────────┐
│  TaskFlow AI（logo区域）         │
├──────────┬──────────────────────┤
│ 导航栏    │  内容区              │
│          │                      │
│ 仪表盘    │  （根据导航切换）     │
│ 项目      │                      │
│ 任务      │                      │
│ 团队      │                      │
│ 设置      │                      │
│          │                      │
└──────────┴──────────────────────┘
```

### 3.2 页面列表

**页面1: 仪表盘 `/`**

- 显示统计数据：总任务数、进行中、已完成、逾期
- 显示当前用户被分配的任务列表
- 简单的数字卡片即可，不需要复杂图表

**页面2: 项目列表 `/projects`**

- 表格形式显示所有项目：名称、状态、负责人、起止日期、任务数
- “新建项目”按钮 → 弹出表单（名称、描述、负责人下拉选、起止日期）
- 点击项目行 → 进入项目详情

**页面3: 项目详情 `/projects/:id`**

- 项目基本信息（可编辑）
- 该项目下的任务列表（表格形式）
- “新建任务”按钮
- 支持按状态筛选任务

**页面4: 任务列表 `/tasks`**

- 表格形式显示所有任务：标题、项目、状态、优先级、负责人、截止日期、权重
- 筛选栏：按项目、状态、负责人筛选
- “新建任务”按钮
- 状态列可以直接点击切换（下拉选择）
- 点击任务行 → 进入任务详情

**页面5: 任务详情 `/tasks/:id`**

- 任务基本信息（可编辑）
- 子任务列表（可新增子任务）
- 依赖关系（显示当前任务依赖的前置任务 + 依赖当前任务的后续任务）
- 评论区（可添加评论）
- 操作日志（显示该任务的变更历史）

**页面6: 团队管理 `/team`**

- 用户列表：姓名、邮箱、部门、角色
- “添加成员”按钮
- 部门管理（可折叠的部门树形结构）

**页面7: 设置 `/settings`**

- 组织信息编辑
- 当前阶段只做组织名称和描述的编辑

### 3.3 前端组件规范

**表单组件：** 使用简单的 HTML form + Tailwind 样式，不需要引入额外的 UI 库。

**表格组件：** 使用简单的 HTML table + Tailwind 样式。每列可排序（点击表头）。

**弹窗/模态框：** 新建和编辑操作使用模态框（modal），用 React state 控制显示/隐藏。

**状态标签颜色（与图谱可视化保持一致）：**

- `todo` — 灰色 (`bg-gray-200 text-gray-700`)
- `in_progress` — 黄色 (`bg-yellow-200 text-yellow-700`)
- `in_review` — 蓝色 (`bg-blue-200 text-blue-700`)
- `blocked` — 红色 (`bg-red-200 text-red-700`)
- `done` — 绿色 (`bg-green-200 text-green-700`)
- `cancelled` — 深灰色 (`bg-gray-400 text-gray-800`)

**优先级标签颜色：**

- `critical` — 红色
- `high` — 橙色
- `medium` — 蓝色
- `low` — 灰色

-----

## 四、初始化种子数据

创建一个种子脚本 `server/seed.ts`，用于初始化基础数据：

```typescript
// 1. 创建组织
const org = { name: 'Deltapex Education', description: '金融教育公司' };

// 2. 创建部门（根据实际情况调整）
const departments = [
  { name: '管理层', orgId: 1 },
  { name: '课程研发', orgId: 1 },
  { name: '市场运营', orgId: 1 },
  { name: '技术开发', orgId: 1 },
  { name: '交易策略', orgId: 1 },
];

// 3. 创建 CEO 用户
const ceoUser = {
  orgId: 1,
  deptId: 1,
  email: 'alex@deltapex.com', // 替换为真实邮箱
  displayName: 'Alexso',
  role: 'owner',
};
```

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "seed": "npx tsx server/seed.ts"
  }
}
```

-----

## 五、验收标准

完成本步骤后，项目应满足：

1. ✅ 所有 API 路由可用，返回正确的 JSON 数据
1. ✅ 可以通过界面创建组织、部门、用户
1. ✅ 可以通过界面创建项目
1. ✅ 可以通过界面创建任务和子任务
1. ✅ 可以在界面上修改任务状态、优先级、负责人
1. ✅ 可以设置任务之间的依赖关系
1. ✅ 可以添加任务评论
1. ✅ 操作日志自动记录每次数据变更
1. ✅ 种子数据脚本可运行，初始化基础数据
1. ✅ 状态颜色与文档定义一致

-----

## 六、给 Replit Agent 的指令

请按照本文档的规格实现后端 API 和前端界面。具体要求：

1. **后端优先**：先实现所有 API 路由，确保可以通过 curl 或 Postman 测试通过
1. **使用已有的 schema**：所有数据操作使用 `shared/schema.ts` 中定义的表和 Zod 验证 schema
1. **操作日志**：每次 POST/PATCH/DELETE 成功后自动写入 activity_logs 表
1. **前端布局**：左侧导航 + 右侧内容区，使用 Tailwind CSS 样式
1. **状态颜色**：严格按照文档第 3.3 节定义的颜色映射
1. **种子数据**：创建 `server/seed.ts` 并确保可运行
1. **不要引入新的 UI 组件库**，使用原生 HTML 元素 + Tailwind 即可
1. **遵循项目已有的代码风格和文件组织方式**
1. 如果项目已有路由注册方式或 API 结构，请遵循现有模式，将新路由整合进去
1. 前端请求 API 时使用 fetch，不需要引入 axios