# AI 引导式任务/项目创建规格 v1.0

## 目标

当用户通过 AI 对话创建任务或项目时，AI 通过逐步引导式提问，确保收集到完整、准确的信息。每一步只问一个问题，每个问题都有快捷选项和自定义输入。

## 核心原则

1. **一次只问一个问题** — 像对话一样自然，不要一次性展示所有问题
1. **先判断再引导** — AI 先判断用户要创建的是项目、任务还是子任务
1. **能推断就不问** — 用户已经提供的信息不要重复问
1. **每步都可编辑** — 所有选项旁边都可以输入自定义内容
1. **可以跳过** — 非必填项可以跳过，后续补充

-----

## 一、引导流程设计

### 第0步：AI 自动判断类型

AI 根据用户的描述先判断这是什么：

```
用户说"明天组织拔河比赛" → AI 判断：这是一个任务
用户说"我们要开始做抖音矩阵号了" → AI 判断：这可能是一个新项目
用户说"在课程录制任务下面加一个字幕翻译" → AI 判断：这是一个子任务
```

如果 AI 不确定，第一个问题就问类型：

```
AI: 「抖音矩阵号」听起来是一个比较大的事项。请问：

🏗️ 这是什么层级？
[新项目 — 包含多个任务的大目标]
[独立任务 — 需要完成的单个事项]
[子任务 — 某个现有任务下的细分工作]
[✏️ 不确定，我来描述一下...]
```

-----

### 创建任务的完整引导流程（共 7 步，非必填可跳过）

#### 步骤 1：确认任务标题（必填）

> 仅当 AI 无法从用户描述中提取标题时才问

```
AI: 任务的标题是什么？

[✏️ 输入任务标题]
```

大多数情况下 AI 可以直接提取标题，此步跳过。

#### 步骤 2：归属项目（必填）

```
AI: 📁 这个任务属于哪个项目？

[AI知识库Bot开发]
[人事协议与组织架构调整]
[销售运营与内容体系优化]
[➕ 创建新项目]
[📋 暂不归属项目]
[✏️ 输入项目名称搜索...]
```

- 选择现有项目 → 记录 projectId，进入下一步
- 选「创建新项目」→ 先走项目创建流程，完成后回来继续
- 选「暂不归属项目」→ projectId 留空，标记 needsReview

#### 步骤 3：任务层级和关联（重要）

```
AI: 🏷️ 这是一个独立任务，还是某个任务的子任务？

[独立任务 — 直接挂在项目下]
[子任务 — 属于某个现有任务的一部分]
[✏️ 不确定]
```

如果选「子任务」，追问父任务：

```
AI: 它属于哪个任务下面？（项目「xxx」下的任务）

[阶段二验收准备]
[内盘期货课程开发]
[销售复盘报告]
[✏️ 搜索任务...]
```

然后追问依赖关系：

```
AI: 🔗 这个任务跟其他任务有先后依赖吗？

[没有依赖，可以独立开始]
[有前置任务 — 需要等别的任务完成才能开始]
[有后置任务 — 别的任务在等这个完成]
[✏️ 描述依赖关系...]
```

如果选「有前置任务」：

```
AI: 需要等哪个任务完成后才能开始？

[阶段一验收准备 ✅ 已完成]
[阶段二验收准备 🔄 进行中]
[CEO决策-双主体定价 🔄 进行中]
[✏️ 搜索任务...]
```

#### 步骤 4：负责人（必填）

```
AI: 👤 谁来负责这个任务？

[我自己 (Alexso)]
[Michael — 技术开发]
[Tina — HR/行政]
[安洲 — 运营总监]
[Apple — 市场运营]
[刘建烨 — 交易策略]
[唐张世涵 — 市场运营]
[✏️ 输入名字...]
```

选项中显示每个人的岗位，帮助用户判断分配是否合理。

#### 步骤 5：截止日期（必填）

```
AI: 📅 什么时候需要完成？

[今天 (2/23)]
[明天 (2/24)]
[本周五 (2/28)]
[下周一 (3/2)]
[下周五 (3/6)]
[月底 (3/31)]
[📅 选择具体日期]
[⏭️ 暂不确定，稍后补充]
```

选「暂不确定」→ dueDate 留空，标记 needsReview

#### 步骤 6：优先级和权重（有默认值，可跳过）

```
AI: 🔴 这个任务的紧急程度？

[🔴 紧急 — 立即处理，阻塞其他工作]
[🟠 高 — 本周内需要重点推进]
[🔵 中 — 正常优先级]（默认）
[⚪ 低 — 有空再处理]
```

紧接着：

```
AI: ⚖️ 这个任务的重要程度？（影响图谱中节点的大小，1-10）

[1-3 小事项]  [4-6 一般]（默认）  [7-8 重要]  [9-10 核心]
[✏️ 输入具体数值]
```

#### 步骤 7：补充信息（可跳过）

```
AI: 还有什么需要补充的吗？

[添加任务描述 ✏️]
[添加标签 🏷️]
[设为里程碑 ⬥]
[⏭️ 没有了，直接创建]
```

- 选「添加描述」→ 展开输入框
- 选「添加标签」→ 显示常用标签 + 自定义输入
- 选「设为里程碑」→ type 改为 milestone
- 选「没有了」→ 生成确认卡片

最终确认：

```
AI: [确认卡片]
📋 创建任务
标题: 组织拔河比赛
项目: 人事协议与组织架构调整
层级: 独立任务
负责人: Alexso
截止: 2026-02-24（明天）
优先级: 🔵 中
权重: 4
依赖: 无

[✅ 确认创建]  [✏️ 修改]  [❌ 取消]
```

-----

### 创建项目的完整引导流程（共 6 步）

#### 步骤 1：确认项目名称（必填）

```
AI: 新项目的名称是什么？

[✏️ 输入项目名称]
```

#### 步骤 2：项目目标和描述（重要）

```
AI: 📝 简单描述一下这个项目的目标和背景：

[✏️ 输入项目描述]
[⏭️ 稍后补充]
```

#### 步骤 3：所属部门（必填）

```
AI: 🏢 这个项目属于哪个部门？

[管理层]
[课程研发]
[市场运营]
[技术开发]
[交易策略]
[➕ 新建部门]
[✏️ 输入部门名称...]
```

#### 步骤 4：项目负责人（必填）

```
AI: 👤 谁是项目负责人？

[我自己 (Alexso)]
[Michael] [Tina] [安洲] [Apple] [刘建烨] [唐张世涵]
[✏️ 输入名字...]
```

#### 步骤 5：时间范围（有默认值）

```
AI: 📅 项目预计什么时候开始和结束？

开始时间:
[今天] [下周一] [下月1号] [📅 选择日期]

目标完成时间:
[1个月后] [2个月后] [季度末] [半年后] [📅 选择日期]
[⏭️ 暂不确定]
```

#### 步骤 6：初始任务拆解（可选但推荐）

```
AI: 🧩 要不要现在就把项目拆分成几个主要任务？

[🤖 AI 帮我拆解 — 根据项目描述自动建议任务拆分]
[✏️ 我自己列 — 手动输入任务列表]
[⏭️ 先创建项目，后续再添加任务]
```

选「AI 帮我拆解」→ AI 根据项目描述生成建议的任务列表：

```
AI: 根据「抖音矩阵号运营」项目，建议拆分为以下任务：

1. ✅ 账号矩阵规划（确定账号数量、定位、命名）
2. ✅ 内容SOP制定（拍摄、剪辑、发布流程）
3. ✅ 人员分工安排（谁管哪些号）
4. ✅ 合规审核体系搭建（避免封号）
5. ✅ 数据复盘机制建立（周报模板）

每个任务旁边：[✏️ 编辑] [❌ 删除]
底部：[➕ 添加更多] [✅ 确认创建项目和这些任务] [⏭️ 只创建项目]
```

-----

## 二、前端组件设计

### 2.1 AiStepQuestion 组件

单个步骤的问题卡片：

```
┌──────────────────────────────┐
│ 📁 属于哪个项目？  (步骤 2/7) │
│                              │
│ [AI知识库Bot开发      ]      │
│ [人事协议与组织架构调整]      │
│ [销售运营与内容体系优化]      │
│ [➕ 创建新项目        ]      │
│ [📋 暂不归属项目      ]      │
│                              │
│ ┌──────────────────────────┐ │
│ │ ✏️ 输入项目名称搜索...    │ │
│ └──────────────────────────┘ │
│                              │
│          [⏭️ 跳过]           │
└──────────────────────────────┘
```

**组件 props：**

```typescript
interface StepQuestionProps {
  stepNumber: number;
  totalSteps: number;
  icon: string;           // emoji 图标
  label: string;          // 问题文案
  options: {
    label: string;
    value: any;
    description?: string; // 选项描述（如岗位名称）
    icon?: string;        // 选项图标
  }[];
  allowCustomInput: boolean;   // 是否显示自定义输入框
  customInputPlaceholder?: string;
  allowSkip: boolean;          // 是否可跳过
  onSelect: (value: any) => void;
  onCustomInput: (text: string) => void;
  onSkip: () => void;
}
```

### 2.2 交互流程状态管理

```typescript
interface GuidedCreationState {
  mode: 'task' | 'project' | null;  // 当前创建模式
  currentStep: number;               // 当前步骤
  totalSteps: number;
  collectedData: {                   // 已收集的数据
    title?: string;
    projectId?: number;
    parentTaskId?: number;
    assigneeId?: number;
    dueDate?: string;
    priority?: string;
    weight?: number;
    description?: string;
    type?: string;
    tags?: string;
    dependencies?: number[];
    // 项目专用
    deptId?: number;
    startDate?: string;
    targetDate?: string;
    initialTasks?: string[];
  };
  answers: {                         // 每步的回答记录（用于显示对话气泡）
    step: number;
    question: string;
    answer: string;
  }[];
  warnings: string[];                // 需要用户注意的问题
}
```

### 2.3 对话中的显示效果

每次用户选择后，显示为对话气泡：

```
AI: 📁 属于哪个项目？
    [AI知识库Bot开发] [人事架构调整] [销售运营] [✏️ 自定义]

用户: （点击"人事架构调整"）

→ 显示用户气泡: "📁 人事协议与组织架构调整"

AI: 👤 谁来负责？
    [我自己] [Michael] [Tina] [安洲] ...
```

这样整个引导过程看起来就像一段自然的对话。

-----

## 三、后端逻辑

### 3.1 智能步骤跳过

后端根据 AI 已经从用户原始消息中解析出的信息，自动跳过对应步骤。

例如用户说”在AI知识库项目里给Michael创建一个高优先级任务，下周五前完成转录校对”：

- 标题 ✅ 已知：转录校对 → 跳过步骤1
- 项目 ✅ 已知：AI知识库Bot → 跳过步骤2
- 负责人 ✅ 已知：Michael → 跳过步骤4
- 截止日期 ✅ 已知：下周五 → 跳过步骤5
- 优先级 ✅ 已知：高 → 跳过步骤6

只剩步骤3（层级和关联）和步骤7（补充信息），如果这两步也有合理默认值，就直接出确认卡片，不需要任何引导步骤。

### 3.2 follow_up 响应格式更新

```typescript
interface FollowUpResponse {
  type: 'follow_up';
  message: string;           // 引导语
  creationType: 'task' | 'project';  // 创建类型
  partialData: Record<string, any>;  // AI 已解析的数据
  steps: StepQuestion[];     // 所有需要询问的步骤（前端逐步展示）
  currentStep: number;       // 当前应该展示的步骤索引
}

interface StepQuestion {
  step: number;
  field: string;             // 对应数据字段
  icon: string;
  label: string;             // 问题文案
  options: {
    label: string;
    value: any;
    description?: string;
  }[];
  allowCustomInput: boolean;
  customInputPlaceholder?: string;
  allowSkip: boolean;
  skipValue?: any;           // 跳过时使用的默认值
}
```

### 3.3 步骤选项动态生成

后端根据数据库数据动态生成选项：

```typescript
function generateStepOptions(field: string, orgId: number): StepOption[] {
  switch (field) {
    case 'projectId':
      // 查询该组织的所有活跃项目
      const projects = await db.select().from(projects)
        .where(eq(projects.orgId, orgId))
        .where(eq(projects.status, 'active'));
      return [
        ...projects.map(p => ({ label: p.name, value: p.id })),
        { label: '➕ 创建新项目', value: 'new_project' },
        { label: '📋 暂不归属项目', value: null },
      ];

    case 'assigneeId':
      // 查询该组织的所有用户，带岗位信息
      const users = await db.select().from(users)
        .where(eq(users.orgId, orgId))
        .leftJoin(jobRoles, eq(users.jobRoleId, jobRoles.id));
      return [
        { label: '我自己', value: currentUserId, description: currentUserRole },
        ...users.filter(u => u.id !== currentUserId)
          .map(u => ({
            label: u.displayName,
            value: u.id,
            description: u.jobRole?.title || u.deptName,
          })),
      ];

    case 'parentTaskId':
      // 查询已选项目下的顶层任务
      const tasks = await db.select().from(tasks)
        .where(eq(tasks.projectId, selectedProjectId))
        .where(isNull(tasks.parentTaskId));
      return [
        { label: '独立任务（直接挂在项目下）', value: null },
        ...tasks.map(t => ({
          label: t.title,
          value: t.id,
          description: `${t.status} | ${t.assigneeName}`,
        })),
      ];

    case 'priority':
      return [
        { label: '🔴 紧急', value: 'critical', description: '立即处理，阻塞其他工作' },
        { label: '🟠 高', value: 'high', description: '本周内需要重点推进' },
        { label: '🔵 中', value: 'medium', description: '正常优先级' },
        { label: '⚪ 低', value: 'low', description: '有空再处理' },
      ];

    case 'dueDate':
      const today = new Date();
      return [
        { label: `今天 (${formatDate(today)})`, value: formatISO(today) },
        { label: `明天 (${formatDate(addDays(today, 1))})`, value: formatISO(addDays(today, 1)) },
        { label: `本周五 (${formatDate(nextFriday(today))})`, value: formatISO(nextFriday(today)) },
        { label: `下周一 (${formatDate(nextMonday(today))})`, value: formatISO(nextMonday(today)) },
        { label: `下周五 (${formatDate(addDays(nextMonday(today), 4))})`, value: formatISO(addDays(nextMonday(today), 4)) },
        { label: `月底 (${formatDate(endOfMonth(today))})`, value: formatISO(endOfMonth(today)) },
      ];

    case 'weight':
      return [
        { label: '1-3 小事项', value: 2 },
        { label: '4-6 一般', value: 5 },
        { label: '7-8 重要', value: 8 },
        { label: '9-10 核心', value: 10 },
      ];

    case 'type':
      return [
        { label: '📝 普通任务', value: 'task' },
        { label: '⬥ 里程碑', value: 'milestone', description: '关键节点，图谱中用菱形显示' },
        { label: '🐛 Bug', value: 'bug' },
        { label: '📨 需求', value: 'request' },
      ];
  }
}
```

-----

## 四、System Prompt 更新

在 AI 的 system prompt 中新增以下规则：

```
## 创建任务/项目时的引导规则

当用户想创建任务或项目时，你需要：

1. 首先判断这是项目、任务还是子任务
2. 从用户的描述中尽可能多地提取信息
3. 对于已知的信息，直接填入 partialData
4. 对于缺少的必填信息，生成对应的 step question
5. 如果所有必填信息都已知，直接返回 confirm 类型，不走 follow_up

### 必填信息判断：
- 创建任务：title（必填）、projectId（必填）、assigneeId（有默认值=当前用户）
- 创建项目：name（必填）、deptId（推荐但可跳过）

### 信息充足的判断：
如果用户说"在AI知识库项目里给Michael创建转录校对任务，高优先级，下周五前完成"
→ 所有关键信息已知，直接返回 confirm，不走 follow_up

如果用户说"明天组织拔河比赛"
→ 缺少 projectId，需要 follow_up
→ partialData: { title: "组织拔河比赛", dueDate: "2026-02-24" }
→ steps: [projectId, parentTaskId, assigneeId, priority, weight, extras]

如果用户说"创建一个任务"
→ 缺少所有信息，需要 follow_up
→ steps: [title, projectId, parentTaskId, assigneeId, dueDate, priority, weight, extras]
```

-----

## 五、验收标准

1. ✅ 用户说模糊的话时（如”创建一个任务”），AI 进入逐步引导模式
1. ✅ 每次只展示一个问题，用户回答后才出下一个
1. ✅ 用户选择后显示为对话气泡
1. ✅ 每个问题都有快捷选项和自定义输入框
1. ✅ 非必填问题可以跳过
1. ✅ 信息充足时（用户描述完整）直接出确认卡片，不走引导
1. ✅ 引导支持任务层级判断（独立任务 vs 子任务）
1. ✅ 引导支持依赖关系设置
1. ✅ 创建项目时支持 AI 自动拆解任务
1. ✅ 步骤选项从数据库动态生成（项目列表、用户列表等）

-----

## 六、给 Replit Agent 的指令

请按文档规格实现 AI 引导式创建功能，分两轮：

### 第一轮：后端逻辑

1. 更新 follow_up 响应格式，支持 steps 数组和 creationType
1. 每个 step 的选项从数据库动态生成
1. AI 判断信息充足时直接返回 confirm，不足时返回 follow_up
1. 更新 system prompt 中的创建引导规则
1. 支持创建项目时的 AI 自动拆解（AI 根据项目描述生成建议任务列表）

### 第二轮：前端交互

1. 实现 AiStepQuestion 组件（单步问题卡片）
1. 实现逐步引导交互：一次只显示一个问题，回答后显示气泡再出下一题
1. 每个问题支持快捷选项按钮 + 自定义输入框 + 跳过按钮
1. 所有步骤完成后自动组装数据发给后端，返回确认卡片
1. 日期类问题的自定义选项使用日期选择器