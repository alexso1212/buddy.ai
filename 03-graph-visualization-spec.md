# 第三步：任务图谱可视化技术规格 v1.0

## 目标

构建一个 2D 力导向图（Force-Directed Graph），将所有任务以节点和连线的形式展示，让管理者：

1. 一眼看到整个公司的任务分布和状态
1. 通过颜色快速定位问题（红色=阻塞/逾期，黄色=进行中）
1. 通过连线追踪依赖链路和阻塞点
1. 点击节点下钻查看任务详情和子任务

## 技术选型

- **D3.js** (`d3-force`) — 力导向图引擎
- 安装: `npm install d3 @types/d3`
- 不使用 Three.js 或 WebGL，先做 2D 验证核心价值

-----

## 一、新增页面和路由

### 1.1 导航栏新增入口

在左侧导航栏中，**仪表盘和项目之间**添加一个新的导航项：

```
仪表盘
📊 图谱    ← 新增
项目
任务
团队
设置
```

路由: `/graph`

### 1.2 页面布局

```
┌──────────────────────────────────────┐
│  顶部工具栏                           │
│  [项目筛选▼] [部门筛选▼] [状态筛选▼]  │
│  [缩放+] [缩放-] [重置视图] [全屏]    │
├──────────────────────────────────────┤
│                                      │
│                                      │
│          力导向图画布                  │
│        (SVG, 占满剩余空间)            │
│                                      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│  底部图例                             │
│  ● 未开始  ● 进行中  ● 审核中         │
│  ● 已完成  ● 已阻塞  ● 已取消         │
│  ── 依赖已解除  ── 依赖阻塞中         │
└──────────────────────────────────────┘
```

点击节点时，右侧弹出详情面板：

```
┌────────────────────────┬─────────────┐
│                        │ 任务详情     │
│      力导向图画布       │ 标题:xxx    │
│                        │ 状态:xxx    │
│                        │ 负责人:xxx  │
│                        │ 截止:xxx    │
│                        │ 子任务列表   │
│                        │ [查看详情→] │
└────────────────────────┴─────────────┘
```

-----

## 二、后端 API

### 2.1 图谱数据接口

新增一个专门为图谱提供数据的 API：

|方法 |路径               |功能              |
|---|-----------------|----------------|
|GET|`/api/graph/data`|获取图谱所需的所有节点和连线数据|

**查询参数：**

- `?projectId=1` — 筛选某个项目
- `?deptId=2` — 筛选某个部门
- `?status=todo,in_progress,blocked` — 筛选状态（逗号分隔）

**返回格式：**

```typescript
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];  // 用于聚类分组和筛选器
}

interface GraphNode {
  id: number;           // task.id
  title: string;        // task.title
  status: string;       // task.status
  priority: string;     // task.priority
  weight: number;       // task.weight (1-10)
  progress: number;     // task.progress (0-100)
  projectId: number;    // task.projectId
  projectName: string;  // project.name
  deptId: number | null;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  isOverdue: boolean;   // 后端计算: dueDate < now && status !== 'done'
  type: string;         // task.type
  parentTaskId: number | null;
  hasSubtasks: boolean; // 是否有子任务
}

interface GraphLink {
  source: number;       // depends_on_task_id (前置任务)
  target: number;       // task_id (当前任务)
  type: string;         // dependency type
  isBlocking: boolean;  // 后端计算: 前置任务 status !== 'done'
}

interface ProjectInfo {
  id: number;
  name: string;
  color: string;        // 后端自动分配的项目颜色
}
```

**后端实现要点：**

```typescript
// server/routes/graph.ts

app.get('/api/graph/data', async (req, res) => {
  const { projectId, deptId, status } = req.query;

  // 1. 查询任务（根据筛选条件）
  // 2. 查询依赖关系
  // 3. 计算 isOverdue: task.dueDate < new Date() && task.status !== 'done' && task.status !== 'cancelled'
  // 4. 计算 isBlocking: 前置任务的 status !== 'done'
  // 5. 为每个项目分配一个颜色（用于聚类视觉区分）
  // 6. 只返回顶层任务（parentTaskId === null），子任务在点击下钻时再加载

  // 项目颜色预设（最多支持10个项目的颜色区分）
  const projectColors = [
    '#6366f1', // 紫色 - indigo
    '#f59e0b', // 金色 - amber
    '#10b981', // 绿色 - emerald
    '#ef4444', // 红色
    '#3b82f6', // 蓝色
    '#ec4899', // 粉色
    '#8b5cf6', // 紫罗兰
    '#14b8a6', // 青色
    '#f97316', // 橙色
    '#64748b', // 灰色
  ];

  return res.json({ data: { nodes, links, projects } });
});
```

### 2.2 子任务下钻接口

|方法 |路径                           |功能           |
|---|-----------------------------|-------------|
|GET|`/api/graph/subtasks/:taskId`|获取某任务的子任务图谱数据|

返回格式同上，但只包含该任务的子任务节点和它们之间的依赖关系。

-----

## 三、前端图谱组件

### 3.1 文件结构

```
client/src/
  pages/
    GraphView.tsx          ← 图谱页面主组件
  components/
    graph/
      ForceGraph.tsx       ← D3 力导向图核心组件
      GraphToolbar.tsx     ← 顶部工具栏（筛选、缩放）
      GraphLegend.tsx      ← 底部图例
      NodeDetailPanel.tsx  ← 右侧详情面板
```

### 3.2 ForceGraph.tsx — 核心组件规格

**节点（Nodes）渲染规则：**

|视觉属性  |数据映射       |具体规则                                     |
|------|-----------|-----------------------------------------|
|大小（半径）|`weight`   |`radius = 12 + weight * 4`，即最小16px，最大52px|
|填充颜色  |`status`   |见下方颜色表                                   |
|描边颜色  |`isOverdue`|逾期时描边为红色 `#ef4444`，3px宽；正常时无描边           |
|描边动画  |`isOverdue`|逾期节点有脉冲动画（CSS animation pulse）           |
|透明度   |交互状态       |默认1.0，hover其他节点时非关联节点降至0.2               |
|内部图标  |`type`     |milestone=⬥菱形，其他=圆形                      |

**节点状态颜色（与CRUD界面保持一致）：**

```typescript
const STATUS_COLORS: Record<string, string> = {
  todo: '#9ca3af',        // 灰色
  in_progress: '#f59e0b', // 黄色/琥珀色
  in_review: '#3b82f6',   // 蓝色
  blocked: '#ef4444',     // 红色
  done: '#10b981',        // 绿色
  cancelled: '#6b7280',   // 深灰色
};
```

**节点标签：**

- 节点旁边显示任务标题（截取前12个字符 + “…”）
- 字体大小: 11px
- 当缩放级别 < 0.5 时隐藏标签，避免密集时看不清

**连线（Links）渲染规则：**

|视觉属性|数据映射        |具体规则                                 |
|----|------------|-------------------------------------|
|颜色  |`isBlocking`|阻塞中=`#ef4444`红色，已解除=`#10b981`绿色      |
|宽度  |`isBlocking`|阻塞中=3px，已解除=1.5px                    |
|虚线  |`isBlocking`|阻塞中=实线，已解除=虚线 `stroke-dasharray: 5,5`|
|箭头  |方向          |连线末端有箭头，指向被依赖的任务（工作流方向）              |
|动画  |`isBlocking`|阻塞中的连线有流动动画（dash offset animation）   |

**聚类（Clustering）：**

- 同一个项目的任务会自然聚集在一起（通过 D3 force 的分组力实现）
- 每个项目的聚类区域用一个半透明的背景色圆/椭圆标记
- 聚类区域标签显示项目名称

```typescript
// D3 force 配置
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(d => d.id).distance(100))
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(d => d.radius + 5))
  // 聚类力：同项目的节点互相吸引
  .force('cluster', forceCluster());

// 自定义聚类力函数
function forceCluster() {
  // 同一个 projectId 的节点之间施加额外吸引力
  // 不同 projectId 的节点之间施加轻微排斥力
  // 这样同项目的任务会自然形成一团
}
```

### 3.3 交互行为

**缩放和平移：**

- 鼠标滚轮缩放（D3 zoom behavior）
- 鼠标拖拽平移画布
- 缩放范围: 0.1x - 4x
- 工具栏的 +/- 按钮每次缩放 0.2x
- “重置视图” 按钮回到初始缩放和位置，fit to screen

**节点拖拽：**

- 可以拖拽节点重新定位
- 拖拽时该节点固定位置（d.fx, d.fy），释放后继续参与力模拟

**Hover 效果：**

- hover 节点时：
  - 该节点放大 1.3 倍
  - 与该节点直接关联的节点和连线保持正常透明度
  - 所有非关联节点和连线透明度降至 0.2
  - 显示 tooltip：任务标题、状态、负责人、截止日期

**点击节点：**

- 单击：打开右侧详情面板，显示任务详细信息
- 如果该任务有子任务（hasSubtasks=true），详情面板中显示”展开子任务”按钮
- 点击”展开子任务”：调用 `/api/graph/subtasks/:taskId` 获取子任务数据，在图谱中展开显示

**点击空白区域：**

- 关闭详情面板
- 恢复所有节点透明度

### 3.4 GraphToolbar.tsx

```
[全部项目 ▼]  [全部部门 ▼]  [全部状态 ▼]  |  [🔍+] [🔍-] [↺重置] [⛶全屏]
```

- 项目筛选：下拉多选，选中某个项目只显示该项目的任务
- 部门筛选：下拉多选
- 状态筛选：下拉多选，可以隐藏已完成的任务（默认不显示 done 和 cancelled）
- 默认筛选：显示 todo + in_progress + in_review + blocked（隐藏 done 和 cancelled）

### 3.5 GraphLegend.tsx

底部固定的图例栏：

```
节点状态: ● 未开始(灰) ● 进行中(黄) ● 审核中(蓝) ● 已阻塞(红) ● 已完成(绿) ● 已取消(深灰)
连线:     ── 阻塞中(红色实线) ┈┈ 已解除(绿色虚线)
节点大小: 与任务权重成正比
⚠️ 红色脉冲描边 = 逾期任务
```

### 3.6 NodeDetailPanel.tsx

右侧滑出面板，宽度 320px：

```
┌─────────────────────┐
│ ✕                   │
│                     │
│ [状态标签] [优先级]  │
│ 任务标题             │
│                     │
│ 📋 描述             │
│ 任务描述内容...      │
│                     │
│ 👤 负责人: xxx      │
│ 📅 截止: 2026-02-25 │
│ ⚖️ 权重: 9/10       │
│ 📊 进度: 30%        │
│ 📁 项目: AI知识库Bot │
│                     │
│ 🔗 依赖关系          │
│ ← 等待: 第二周周报   │
│ → 阻塞: 第三周周报   │
│                     │
│ 📂 子任务 (3个)      │
│  ● 子任务A ✅        │
│  ● 子任务B 🔄        │
│  ● 子任务C ⏸️        │
│  [在图谱中展开子任务] │
│                     │
│ [查看完整详情 →]     │
└─────────────────────┘
```

“查看完整详情” 链接跳转到 `/tasks/:id` 页面。

-----

## 四、性能优化

当前阶段数据量小（23个任务），性能不是问题。但为未来扩展预留：

1. **默认只加载顶层任务**（parentTaskId === null），子任务按需加载
1. **默认隐藏已完成和已取消的任务**，减少节点数量
1. **节点标签在低缩放级别时隐藏**
1. **Canvas 降级方案预留**：当节点超过 200 个时，考虑从 SVG 切换到 Canvas 渲染（当前阶段不实现）

-----

## 五、验收标准

完成本步骤后，项目应满足：

1. ✅ 导航栏出现”图谱”入口，点击进入 `/graph` 页面
1. ✅ 页面加载时自动获取数据并渲染力导向图
1. ✅ 节点大小与 weight 正相关
1. ✅ 节点颜色正确对应 status（灰/黄/蓝/红/绿/深灰）
1. ✅ 逾期任务有红色脉冲描边
1. ✅ 连线颜色正确（阻塞=红色实线，已解除=绿色虚线）
1. ✅ 连线有箭头指示方向
1. ✅ 同项目的节点自然聚集在一起
1. ✅ 可以缩放和平移画布
1. ✅ 可以拖拽节点
1. ✅ Hover 节点时高亮关联节点，其他节点变淡
1. ✅ 点击节点弹出右侧详情面板
1. ✅ 筛选器功能正常（按项目、状态筛选后图谱实时更新）
1. ✅ 底部图例正确显示
1. ✅ 使用真实数据（3个项目、23个任务、14条依赖关系）渲染正常

-----

## 六、给 Replit Agent 的指令

请按照本文档的规格实现任务图谱可视化功能。**请分两轮实现：**

### 第一轮：后端 API + 基础图谱渲染

1. 安装 D3.js: `npm install d3 @types/d3`
1. 实现 `/api/graph/data` 接口，返回格式严格按照文档第二节定义
1. 实现 `/api/graph/subtasks/:taskId` 接口
1. 创建 `/graph` 页面和 `ForceGraph.tsx` 组件
1. 实现基础的力导向图渲染：节点（大小、颜色）、连线（颜色、箭头）
1. 在导航栏添加”图谱”入口

### 第二轮：交互和细节

1. 实现缩放、平移、节点拖拽
1. 实现 Hover 高亮效果（关联节点保持，其他变淡）
1. 实现点击节点弹出右侧详情面板
1. 实现顶部筛选工具栏
1. 实现底部图例
1. 实现逾期节点的红色脉冲描边动画
1. 实现阻塞连线的流动动画
1. 实现项目聚类效果

**重要：**

- 状态颜色必须使用文档 3.2 节定义的 `STATUS_COLORS`
- 节点半径公式: `radius = 12 + weight * 4`
- 默认隐藏 status 为 `done` 和 `cancelled` 的任务
- 所有数据从 API 获取，不要硬编码测试数据