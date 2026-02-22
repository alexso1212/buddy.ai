# 第五步：AI 权责判定技术规格 v1.0

## 目标
在任务分配和管理过程中，AI 自动判定：
1. 一个任务属于某员工的**份内职责**还是**额外工作**
2. 任务分配是否**合理公平**（工作量均衡、能力匹配）
3. 当任务存在争议时，提供**客观判定依据**

这个功能解决的核心问题：团队协作中常出现"这不是我的活"、"为什么总是我做"的争议。AI 基于岗位定义和数据做出客观判断，减少人际摩擦。

## 核心设计原则
1. **判定必须有据可依** — 基于岗位职责描述、部门边界、历史数据，不是 AI 拍脑袋
2. **判定结果透明** — 给出判定理由，让员工和管理者都能理解
3. **判定不等于决策** — AI 给出建议和分析，最终决定权在管理者
4. **使用更强的模型** — 权责判定用 `claude-sonnet-4-20250514`，不用 Haiku

---

## 一、数据模型扩展

### 1.1 岗位职责表（新增）

在 `shared/schema.ts` 中新增：

```typescript
export const jobRoles = pgTable('job_roles', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  title: varchar('title', { length: 255 }).notNull(),
  // 岗位名称，如 "技术开发工程师"、"市场运营专员"
  description: text('description'),
  // 岗位概述
  responsibilities: text('responsibilities').notNull(),
  // 核心职责列表（JSON 字符串）
  // 格式: '["负责AI知识库技术开发","负责系统运维和bug修复","参与技术方案评审"]'
  boundaries: text('boundaries'),
  // 职责边界说明（JSON 字符串）—— 明确什么不在职责范围内
  // 格式: '["不负责内容创作","不负责客户销售","不负责财务审批"]'
  requiredSkills: text('required_skills'),
  // 岗位所需技能（JSON 字符串）
  // 格式: '["TypeScript","Python","AI/ML","API开发"]'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 1.2 用户表关联岗位

在 users 表中新增字段（通过 migration）：

```typescript
// 在 users 表中添加
jobRoleId: integer('job_role_id').references(() => jobRoles.id),
```

### 1.3 权责判定记录表（新增）

```typescript
export const verdicts = pgTable('verdicts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  // 被判定的用户（任务被分配给谁）

  // --- 判定结果 ---
  verdict: varchar('verdict', { length: 50 }).notNull(),
  // 'in_scope' — 份内职责
  // 'stretch' — 延伸职责（相关但不核心）
  // 'out_of_scope' — 分外工作
  // 'shared' — 跨部门协作（多人共同职责）

  confidence: integer('confidence').notNull(),
  // AI 置信度 0-100

  reasoning: text('reasoning').notNull(),
  // AI 判定理由（结构化文本）

  matchedResponsibilities: text('matched_responsibilities'),
  // 匹配到的岗位职责条目（JSON 字符串）

  suggestedAssignee: integer('suggested_assignee').references(() => users.id),
  // 如果判定 out_of_scope，AI 建议的更合适的负责人

  suggestedReason: text('suggested_reason'),
  // 建议理由

  // --- 元数据 ---
  requestedBy: integer('requested_by').references(() => users.id).notNull(),
  // 谁发起的判定请求
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  // 'pending' — 等待判定
  // 'completed' — 判定完成
  // 'accepted' — 管理者接受判定
  // 'overridden' — 管理者推翻判定
  overrideReason: text('override_reason'),
  // 如果管理者推翻，记录原因

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 1.4 Relations 补充

```typescript
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

export const verdictsRelations = relations(verdicts, ({ one }) => ({
  task: one(tasks, {
    fields: [verdicts.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [verdicts.userId],
    references: [users.id],
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
```

运行 `npx drizzle-kit generate` 和 `npx drizzle-kit push` 同步数据库。

---

## 二、后端 API

### 2.1 岗位职责管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/job-roles` | 获取所有岗位定义 |
| POST | `/api/job-roles` | 创建岗位定义 |
| PATCH | `/api/job-roles/:id` | 更新岗位定义 |
| DELETE | `/api/job-roles/:id` | 删除岗位定义 |
| PATCH | `/api/users/:id/job-role` | 给用户分配岗位 |

### 2.2 权责判定

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/verdicts/judge` | 对一个任务-用户组合发起权责判定 |
| POST | `/api/verdicts/judge-assignment` | 任务分配时自动判定（集成到分配流程中）|
| GET | `/api/verdicts/task/:taskId` | 获取某任务的判定记录 |
| GET | `/api/verdicts/user/:userId` | 获取某用户的所有判定记录 |
| PATCH | `/api/verdicts/:id/accept` | 管理者接受判定 |
| PATCH | `/api/verdicts/:id/override` | 管理者推翻判定（需提供理由）|
| GET | `/api/verdicts/stats` | 权责判定统计（各团队成员的份内/分外比例）|

### 2.3 POST `/api/verdicts/judge` — 核心判定接口

**请求体：**
```typescript
interface JudgeRequest {
  taskId: number;
  userId: number;          // 被判定的用户
  requestedBy: number;     // 发起判定的用户
}
```

**返回体：**
```typescript
interface JudgeResponse {
  verdict: {
    id: number;
    verdict: 'in_scope' | 'stretch' | 'out_of_scope' | 'shared';
    confidence: number;
    reasoning: string;
    matchedResponsibilities: string[];
    suggestedAssignee?: {
      id: number;
      name: string;
      reason: string;
    };
  };
}
```

---

## 三、AI 判定逻辑

### 3.1 判定服务（server/services/ai/verdictService.ts）

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
});

export async function judgeTaskAssignment(
  task: TaskWithDetails,
  targetUser: UserWithRole,
  allUsers: UserWithRole[],
  context: OrgContext
): Promise<VerdictResult> {

  const prompt = buildVerdictPrompt(task, targetUser, allUsers, context);

  // 权责判定用更强的模型
  const response = await client.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    temperature: 0.1,  // 低温度，确保判定一致性
    messages: [
      { role: 'system', content: VERDICT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result;
}
```

### 3.2 判定 System Prompt

```typescript
export const VERDICT_SYSTEM_PROMPT = `你是一个企业权责判定专家。你的职责是客观、公正地判断一个任务分配给某个员工是否合理。

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
```

### 3.3 构建判定 Prompt

```typescript
function buildVerdictPrompt(
  task: TaskWithDetails,
  targetUser: UserWithRole,
  allUsers: UserWithRole[],
  context: OrgContext
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
- 岗位职责: ${JSON.stringify(targetUser.responsibilities || [])}
- 职责边界（不负责的事）: ${JSON.stringify(targetUser.boundaries || [])}
- 所需技能: ${JSON.stringify(targetUser.requiredSkills || [])}
- 该员工近30天完成的任务类型: ${JSON.stringify(targetUser.recentTaskTypes || [])}

## 团队中的其他成员（用于判断是否有更合适的人选）
${allUsers.filter(u => u.id !== targetUser.id).map(u => `
- ${u.displayName} | 部门: ${u.deptName} | 岗位: ${u.jobTitle || '未定义'}
  职责: ${JSON.stringify(u.responsibilities || [])}
  技能: ${JSON.stringify(u.requiredSkills || [])}
`).join('')}

请根据以上信息，判定将该任务分配给「${targetUser.displayName}」是否合理。
`;
}
```

---

## 四、前端界面

### 4.1 权责判定入口点

判定功能出现在三个地方：

**入口1：任务详情页 — 判定按钮**

在任务详情页（`/tasks/:id`）的负责人旁边添加一个"判定"按钮：

```
👤 负责人: Michael  [⚖️ 权责判定]
```

点击后弹出判定结果面板。

**入口2：AI 对话 — 自然语言触发**

在对话中说：
- "判断一下转录校对这个任务分给Michael合不合理"
- "这个任务应该谁来做"
- "Michael最近是不是做了太多分外的事"

AI 调用判定服务后返回结果。

**入口3：任务分配时自动触发**

当通过 AI 对话创建任务并指定负责人时，在确认卡片中自动显示判定结果：

```
┌─────────────────────────────────┐
│ 📋 创建任务                      │
│                                  │
│ 标题: 设计课程封面                │
│ 负责人: Michael                  │
│ ...                              │
│                                  │
│ ⚖️ 权责判定: 延伸职责            │
│ 置信度: 72%                      │
│ 理由: Michael的核心职责是技术开发,│
│ 设计类工作属于延伸范围。建议考虑  │
│ 由市场运营部门的Apple承担。       │
│                                  │
│  [✅ 仍然分配给Michael]          │
│  [🔄 改为分配给Apple]            │
│  [❌ 取消]                       │
└─────────────────────────────────┘
```

### 4.2 判定结果展示组件（VerdictCard.tsx）

```
client/src/components/verdict/
  VerdictCard.tsx         ← 判定结果卡片
  VerdictBadge.tsx        ← 判定标签（小型，用于列表）
  VerdictStatsPanel.tsx   ← 统计面板
```

**VerdictCard 样式：**

```
┌─────────────────────────────────┐
│ ⚖️ 权责判定结果                  │
├─────────────────────────────────┤
│                                  │
│  [份内职责]     置信度: 85%       │  ← 绿色标签
│  或                              │
│  [延伸职责]     置信度: 72%       │  ← 黄色标签
│  或                              │
│  [分外工作]     置信度: 90%       │  ← 红色标签
│  或                              │
│  [跨部门协作]   置信度: 78%       │  ← 蓝色标签
│                                  │
│ 📋 判定理由:                     │
│ Michael的岗位职责中包含"负责AI    │
│ 知识库技术开发"，转录校对属于     │
│ 知识库开发流程的一部分，因此判定  │
│ 为份内职责。                     │
│                                  │
│ 匹配的职责条目:                  │
│ ✓ 负责AI知识库技术开发           │
│ ✓ 负责系统运维和bug修复          │
│                                  │
│ 💡 更合适的人选:（仅 out_of_scope）│
│ → Apple (市场运营专员)           │
│   原因: 设计类工作更匹配运营岗位  │
│                                  │
│ [✅ 接受判定] [🔄 推翻判定]      │
└─────────────────────────────────┘
```

**VerdictBadge（小型标签，用在任务列表中）：**

```
任务标题  [份内✓]   ← 绿色小标签
任务标题  [延伸~]   ← 黄色小标签
任务标题  [分外✗]   ← 红色小标签
```

### 4.3 判定颜色：

```typescript
const VERDICT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  in_scope:     { bg: 'bg-green-100', text: 'text-green-800', label: '份内职责' },
  stretch:      { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '延伸职责' },
  out_of_scope: { bg: 'bg-red-100', text: 'text-red-800', label: '分外工作' },
  shared:       { bg: 'bg-blue-100', text: 'text-blue-800', label: '跨部门协作' },
};
```

### 4.4 团队管理页面扩展（/team）

在团队管理页面增加两个功能：

**1. 岗位职责管理标签页**

```
[成员列表] [部门管理] [岗位定义]  ← 新增第三个标签页
```

岗位定义页面：
- 列表显示所有岗位：名称、部门、职责条数
- "新建岗位"按钮
- 编辑岗位表单：名称、所属部门、职责列表（可增删）、边界列表（可增删）、技能列表（可增删）

**2. 成员列表新增岗位列**

```
姓名      | 邮箱              | 部门     | 角色    | 岗位           |
Michael  | michael@...       | 技术开发  | member  | 技术开发工程师  | [编辑]
Tina     | tina@...          | 管理层   | manager | HR/行政主管    | [编辑]
```

### 4.5 权责统计面板

在仪表盘页面增加一个"权责分布"卡片：

```
┌─────────────────────────────────┐
│ ⚖️ 团队权责分布                  │
├─────────────────────────────────┤
│                                  │
│ Michael                          │
│ [████████░░] 份内80% 延伸15% 分外5% │
│                                  │
│ Tina                             │
│ [██████████] 份内95% 延伸5%       │
│                                  │
│ 安洲                             │
│ [██████░░░░] 份内60% 延伸25% 分外15% │
│                                  │
│ ⚠️ 安洲的分外工作比例偏高(15%)，   │
│ 建议检查任务分配合理性            │
└─────────────────────────────────┘
```

---

## 五、AI 对话集成

### 5.1 在 System Prompt 中新增判定能力

在 `prompts.ts` 的 SYSTEM_PROMPT 中添加：

```
8. judge_assignment — 判定任务分配是否合理（权责判定）
9. query_verdicts — 查询某人的权责判定历史和统计
```

### 5.2 新增 Action Schema

```typescript
export const judgeAssignmentSchema = z.object({
  taskId: z.number(),
  userId: z.number(),
});

export const queryVerdictsSchema = z.object({
  userId: z.number().optional(),
  taskId: z.number().optional(),
});
```

### 5.3 对话示例

```
用户: 转录校对这个任务分给Michael合理吗
AI: [调用判定服务]
    ⚖️ 权责判定结果
    任务「转录校对」→ Michael
    判定: 份内职责 (置信度85%)
    理由: Michael的岗位职责包含"负责AI知识库技术开发"，
    转录校对是知识库开发流程的组成部分。
    匹配职责: ✓ 负责AI知识库技术开发

用户: 那设计课程封面呢，也给Michael？
AI: [调用判定服务]
    ⚖️ 权责判定结果
    任务「设计课程封面」→ Michael
    判定: 分外工作 (置信度88%)
    理由: 设计工作不在Michael的技术开发职责范围内，
    且其职责边界明确标注"不负责内容创作"。
    建议: → Apple (市场运营专员)，设计类工作更匹配运营岗位。
    需要改为分配给Apple吗？

用户: 安洲最近是不是做了很多分外的事
AI: 安洲近30天的权责分布：
    - 份内职责: 60% (6个任务)
    - 延伸职责: 25% (3个任务)
    - 分外工作: 15% (2个任务)
    分外工作明细：
    1. "建立矩阵账号合规审核SOP" — 更适合运营岗位
    2. "合作方内部讨论体系化内容" — 更适合产品岗位
    建议：考虑将运营类任务重新分配给市场运营部门。
```

---

## 六、初始化岗位数据

创建种子脚本 `server/seed-job-roles.ts`，初始化 Deltapex 的岗位定义：

```typescript
const jobRolesData = [
  {
    orgId: 1,
    deptId: 1, // 管理层
    title: 'CEO / 总经理',
    description: '公司最高管理者，负责战略决策和全局管理',
    responsibilities: JSON.stringify([
      '制定公司战略方向和年度目标',
      '审批重大财务支出和人事决策',
      '管理核心团队和组织架构',
      '对外商务合作和关系维护',
      'IP内容方向把控和课程质量审核',
    ]),
    boundaries: JSON.stringify([
      '不负责日常行政事务执行',
      '不负责具体技术开发实现',
      '不负责日常客服和售后',
    ]),
    requiredSkills: JSON.stringify([
      '战略规划', '团队管理', '金融知识', '商务谈判',
    ]),
  },
  {
    orgId: 1,
    deptId: 1, // 管理层
    title: 'HR/行政主管',
    description: '负责人力资源和行政管理',
    responsibilities: JSON.stringify([
      '员工合同和协议管理',
      'KPI绩效考核制度制定和执行',
      '员工手册和制度文件编写',
      '薪酬核算和社保管理',
      '办公行政事务管理',
    ]),
    boundaries: JSON.stringify([
      '不负责业务拓展和销售',
      '不负责课程内容创作',
      '不负责技术开发',
    ]),
    requiredSkills: JSON.stringify([
      '人力资源管理', '劳动法', '行政管理', '文书写作',
    ]),
  },
  {
    orgId: 1,
    deptId: 1, // 管理层
    title: 'VP/运营总监',
    description: '负责业务运营和团队管理',
    responsibilities: JSON.stringify([
      '销售团队管理和KPI制定',
      '业务拓展和渠道开发',
      '客户转化流程优化',
      '销售数据分析和复盘',
      '商务合作谈判和执行',
    ]),
    boundaries: JSON.stringify([
      '不负责IP内容创作和课程开发',
      '不负责技术系统开发',
      '不负责财务审批（需CEO审批）',
    ]),
    requiredSkills: JSON.stringify([
      '销售管理', '数据分析', '团队管理', '商务谈判',
    ]),
  },
  {
    orgId: 1,
    deptId: 4, // 技术开发
    title: '技术开发工程师',
    description: '负责公司技术产品和系统开发',
    responsibilities: JSON.stringify([
      '负责AI知识库技术开发和维护',
      '系统架构设计和技术方案评审',
      'API开发和第三方服务集成',
      '系统运维和bug修复',
      '技术文档编写和维护',
    ]),
    boundaries: JSON.stringify([
      '不负责内容创作和课程设计',
      '不负责客户销售和商务谈判',
      '不负责视觉设计和UI美化',
      '不负责市场推广和运营活动',
    ]),
    requiredSkills: JSON.stringify([
      'TypeScript', 'Python', 'AI/ML', 'API开发', '数据库',
    ]),
  },
  {
    orgId: 1,
    deptId: 3, // 市场运营
    title: '市场运营专员',
    description: '负责市场推广、直播运营和内容分发',
    responsibilities: JSON.stringify([
      '直播活动策划和执行',
      '短视频内容策划和拍摄协调',
      '社交媒体账号矩阵运营',
      '用户增长和流量获取',
      '数据分析和运营复盘',
      '活动物料设计协调',
    ]),
    boundaries: JSON.stringify([
      '不负责核心课程内容创作',
      '不负责技术系统开发',
      '不负责财务和人事管理',
    ]),
    requiredSkills: JSON.stringify([
      '新媒体运营', '直播运营', '数据分析', '活动策划', '基础设计',
    ]),
  },
  {
    orgId: 1,
    deptId: 5, // 交易策略
    title: '交易策略分析师',
    description: '负责交易策略研究和课程内容支撑',
    responsibilities: JSON.stringify([
      '订单流交易策略研究和开发',
      '交易数据分析和回测',
      '课程技术内容审核和校对',
      '学员交易问题解答和指导',
      '市场分析报告撰写',
    ]),
    boundaries: JSON.stringify([
      '不负责技术系统开发',
      '不负责市场推广和运营',
      '不负责行政和人事管理',
    ]),
    requiredSkills: JSON.stringify([
      '订单流分析', '期货交易', '数据分析', '金融市场', '技术分析',
    ]),
  },
];
```

种子脚本需要同时将岗位分配给已有用户：
- Alexso → CEO / 总经理
- Tina → HR/行政主管
- 安洲 → VP/运营总监
- Michael → 技术开发工程师
- Apple → 市场运营专员
- 刘建烨 → 交易策略分析师
- 唐张世涵 → 市场运营专员（与Apple同岗位）

---

## 七、验收标准

1. ✅ `job_roles` 和 `verdicts` 表成功创建
2. ✅ 岗位种子数据导入成功，用户关联岗位成功
3. ✅ 团队管理页面可以查看和编辑岗位定义
4. ✅ 任务详情页有"权责判定"按钮
5. ✅ 点击判定后 AI 返回结构化的判定结果
6. ✅ 判定结果显示 verdict、confidence、reasoning
7. ✅ out_of_scope 时显示建议人选
8. ✅ 管理者可以接受或推翻判定
9. ✅ AI 对话中可以用自然语言触发判定
10. ✅ 仪表盘显示团队权责分布统计

---

## 八、给 Replit Agent 的指令

请按照本文档的规格实现 AI 权责判定功能。**请分三轮实现：**

### 第一轮：数据模型 + 后端 API + 种子数据

1. 在 `shared/schema.ts` 中新增 `jobRoles` 和 `verdicts` 表及 relations
2. 给 `users` 表添加 `jobRoleId` 字段
3. 运行 `drizzle-kit generate` 和 `drizzle-kit push`
4. 实现岗位管理 CRUD API
5. 实现判定 API（`/api/verdicts/judge` 等）
6. 创建 `server/seed-job-roles.ts` 种子脚本并运行
7. 判定服务使用 `claude-sonnet-4-20250514` 模型
8. AI 客户端使用 `process.env.AI_BASE_URL` 和 `process.env.AI_API_KEY`

### 第二轮：前端界面

1. 团队管理页面增加"岗位定义"标签页
2. 成员列表增加岗位列
3. 任务详情页增加"权责判定"按钮和结果展示
4. 实现 VerdictCard 组件（判定颜色按文档4.3节）
5. 仪表盘增加"团队权责分布"统计卡片

### 第三轮：AI 对话集成

1. 在 System Prompt 中新增判定相关能力描述
2. 新增 `judge_assignment` 和 `query_verdicts` action schema
3. 实现对话中自然语言触发判定
4. 创建任务时如果指定了负责人，确认卡片中自动显示判定结果

**重要：**
- 判定 AI 使用 `claude-sonnet-4-20250514` 模型，不用 Haiku
- AI 客户端配置: `baseURL: process.env.AI_BASE_URL`, `apiKey: process.env.AI_API_KEY`
- 判定结果必须存入 verdicts 表，可追溯
- 管理者推翻判定时必须填写理由