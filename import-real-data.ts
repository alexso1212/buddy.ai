// server/import-real-data.ts
// 导入真实业务数据：团队成员、项目、任务、依赖关系
// 运行方式: npx tsx server/import-real-data.ts

import { db } from “./db”;
import {
users,
projects,
tasks,
taskDependencies,
} from “../shared/schema”;

async function importData() {
console.log(“🚀 开始导入真实业务数据…\n”);

// ============================================
// 1. 创建团队成员
// ============================================
// 注意: Alexso (ID=1) 已在种子数据中创建
// 部门: 1=管理层, 2=课程研发, 3=市场运营, 4=技术开发, 5=交易策略

console.log(“📋 创建团队成员…”);
const newUsers = await db.insert(users).values([
{
orgId: 1,
deptId: 4, // 技术开发
email: “michael@deltapex.com”,
displayName: “Michael”,
role: “member”,
},
{
orgId: 1,
deptId: 1, // 管理层
email: “tina@deltapex.com”,
displayName: “Tina”,
role: “manager”,
},
{
orgId: 1,
deptId: 1, // 管理层
email: “anzhou@deltapex.com”,
displayName: “安洲”,
role: “manager”,
},
{
orgId: 1,
deptId: 3, // 市场运营
email: “apple@deltapex.com”,
displayName: “Apple”,
role: “member”,
},
{
orgId: 1,
deptId: 5, // 交易策略
email: “liujianye@deltapex.com”,
displayName: “刘建烨”,
role: “member”,
},
{
orgId: 1,
deptId: 3, // 市场运营
email: “tangzhangshihan@deltapex.com”,
displayName: “唐张世涵”,
role: “member”,
},
]).returning();

// 用户 ID 映射 (基于插入顺序)
// Alexso = 1 (已存在)
// Michael = newUsers[0].id
// Tina = newUsers[1].id
// 安洲 = newUsers[2].id
// Apple = newUsers[3].id
// 刘建烨 = newUsers[4].id
// 唐张世涵 = newUsers[5].id

const michaelId = newUsers[0].id;
const tinaId = newUsers[1].id;
const anzhouId = newUsers[2].id;
const appleId = newUsers[3].id;
const liujianyeId = newUsers[4].id;
const tangId = newUsers[5].id;
const alexsoId = 1;

console.log(`  ✅ 创建了 ${newUsers.length} 个团队成员`);
console.log(`     Michael(${michaelId}), Tina(${tinaId}), 安洲(${anzhouId}), Apple(${appleId}), 刘建烨(${liujianyeId}), 唐张世涵(${tangId})`);

// ============================================
// 2. 创建项目
// ============================================

console.log(”\n📁 创建项目…”);
const newProjects = await db.insert(projects).values([
{
orgId: 1,
deptId: 4, // 技术开发
name: “AI知识库Bot开发”,
description: “订单流交易AI知识库机器人，覆盖视频转录、知识结构化、Coze Bot搭建。Michael主导开发。”,
status: “active”,
ownerId: alexsoId,
startDate: new Date(“2026-02-10”),
targetDate: new Date(“2026-03-07”),
},
{
orgId: 1,
deptId: 1, // 管理层
name: “人事协议与组织架构调整”,
description: “完成全员协议签署、KPI体系建立、组织架构重组、双主体关联交易定价。”,
status: “active”,
ownerId: alexsoId,
startDate: new Date(“2026-02-11”),
targetDate: new Date(“2026-03-06”),
},
{
orgId: 1,
deptId: 3, // 市场运营
name: “销售运营与内容体系优化”,
description: “重构销售KPI、建立矩阵账号合规SOP、直播切片运营、内盘期货课程开发。”,
status: “active”,
ownerId: alexsoId,
startDate: new Date(“2026-02-14”),
targetDate: new Date(“2026-03-31”),
},
]).returning();

const projAiBot = newProjects[0].id;
const projHr = newProjects[1].id;
const projSales = newProjects[2].id;

console.log(`  ✅ 创建了 3 个项目: AI知识库Bot(${projAiBot}), 人事架构(${projHr}), 销售运营(${projSales})`);

// ============================================
// 3. 创建任务 — 项目1: AI知识库Bot开发
// ============================================

console.log(”\n📌 创建任务 — AI知识库Bot开发…”);
const aiTasks = await db.insert(tasks).values([
{
// [0] 查看 Michael 第一周周报
orgId: 1,
projectId: projAiBot,
title: “查看 Michael 第一周周报”,
description: “关注：转录进度、成本消耗、有无阻塞需要介入”,
type: “task”,
status: “done”, // 已过期，标记为done
priority: “medium”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-13T17:30:00+08:00”),
weight: 2,
progress: 100,
},
{
// [1] 阶段一验收准备
orgId: 1,
projectId: projAiBot,
title: “阶段一验收准备”,
description: “验收前准备：打开共享文件夹，随机选3-5个转录文件；对照原视频听2分钟，检查转录准确度；看Vision分析是否准确描述了订单流信号；检查成本报告是否在预算内。质量不达标→不进入阶段二。”,
type: “milestone”,
status: “done”,
priority: “high”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-18T16:00:00+08:00”),
weight: 7,
progress: 100,
},
{
// [2] 查看 Michael 第二周周报
orgId: 1,
projectId: projAiBot,
title: “查看 Michael 第二周周报”,
description: “关注：结构化文档质量、术语一致性、成本消耗”,
type: “task”,
status: “done”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-20T17:30:00+08:00”),
weight: 2,
progress: 100,
},
{
// [3] 阶段二验收准备 — 需亲自审内容
orgId: 1,
projectId: projAiBot,
title: “阶段二验收准备 — 需亲自审内容”,
description: “这次验收最重要，需要亲自看内容：读3-5篇结构化知识文档全文；重点看是否补全了具体信号描述；审核课程大纲逻辑是否合理；确认知识库分组方案。预留1-2小时阅读时间。”,
type: “milestone”,
status: “in_progress”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-25T15:00:00+08:00”),
weight: 9,
progress: 30,
},
{
// [4] 查看 Michael 第三周周报
orgId: 1,
projectId: projAiBot,
title: “查看 Michael 第三周周报”,
description: “关注：Coze搭建进度、测试通过率、上线准备情况”,
type: “task”,
status: “todo”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-27T17:30:00+08:00”),
weight: 2,
progress: 0,
},
{
// [5] 最终验收 — 亲自测试Bot
orgId: 1,
projectId: projAiBot,
title: “最终验收 — 亲自测试Bot”,
description: “准备10+个测试问题：基础概念(Footprint、DOM、Delta)；实战场景(ES关键价位吸收判断)；边界测试(课程没涉及的内容)；学习路径(新手推荐)。通过→通知学员上线；不通过→列修改清单。”,
type: “milestone”,
status: “todo”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-03-04T14:00:00+08:00”),
weight: 10,
progress: 0,
},
]).returning();

console.log(`  ✅ 创建了 ${aiTasks.length} 个任务`);

// ============================================
// 4. 创建任务 — 项目2: 人事协议与组织架构调整
// ============================================

console.log(”\n📌 创建任务 — 人事协议与组织架构调整…”);
const hrTasks = await db.insert(tasks).values([
{
// [0] 与刘建烨面谈
orgId: 1,
projectId: projHr,
title: “与刘建烨面谈 - 签署竞业+知识产权协议”,
description: “面谈要点：竞业禁止协议(离职12个月)；知识产权归属协议；竞业补偿金条款协商；明确岗位KPI。提醒Tina提前准备好协议打印件。”,
type: “task”,
status: “done”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-11T14:00:00+08:00”),
weight: 8,
progress: 100,
},
{
// [1] 与唐张世涵面谈
orgId: 1,
projectId: projHr,
title: “与唐张世涵面谈 - 重签合作协议+KPI”,
description: “面谈要点：终止当前挂职模式；重签个人劳务合作协议；明确每周直播≥X小时/内容≥X条；设定3个月考察期。提醒Tina提前准备协议。”,
type: “task”,
status: “done”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-12T14:00:00+08:00”),
weight: 8,
progress: 100,
},
{
// [2] 与Apple面谈
orgId: 1,
projectId: projHr,
title: “与Apple面谈 - KPI绩效对赌协议”,
description: “面谈要点：补签KPI绩效对赌协议；明确出镜/出勤/转化标准；达标保留当前薪资，未达标降至基础薪；给1个月缓冲期。”,
type: “task”,
status: “done”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-13T14:00:00+08:00”),
weight: 7,
progress: 100,
},
{
// [3] 春节假期思考事项
orgId: 1,
projectId: projHr,
title: “春节假期思考事项”,
description: “假期期间独立思考：安洲对赌条款细节(70万线/BD提成比例)；双主体软件进货价定价；各岗位KPI具体数值。”,
type: “task”,
status: “done”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-15T10:00:00+08:00”),
weight: 5,
progress: 100,
},
{
// [4] 与安洲面谈 - 合伙人对赌+BD部启动
orgId: 1,
projectId: projHr,
title: “与安洲面谈 - 合伙人对赌+BD部启动”,
description: “节后第一天面谈要点：确认70万起分线+30%增量分红条款；BD部三条线提成比例；佣金池审计机制；职责边界确认(不管IP内容)。提醒Tina提前准备协议草稿。”,
type: “task”,
status: “done”,
priority: “high”,
creatorId: alexsoId,
assigneeId: anzhouId,
dueDate: new Date(“2026-02-24T14:00:00+08:00”),
weight: 9,
progress: 100,
},
{
// [5] CEO决策 - 双主体关联交易定价
orgId: 1,
projectId: projHr,
title: “CEO决策 - 双主体关联交易定价”,
description: “决策事项：德湃教育向德湃科技采购软件的进货价确定；BD收入归属教育公司的分账SOP；与代账公司沟通关联交易合规性。”,
type: “task”,
status: “in_progress”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-25T14:00:00+08:00”),
weight: 9,
progress: 50,
},
{
// [6] 审批 - KPI绩效考核制度终稿
orgId: 1,
projectId: projHr,
title: “审批 - KPI绩效考核制度终稿”,
description: “Tina提交各岗位KPI汇总表，逐项确认具体数值：视频条数、客资转化率、出勤天数等。确认后签字，准备全员宣贯。”,
type: “task”,
status: “in_progress”,
priority: “high”,
creatorId: alexsoId,
assigneeId: tinaId,
dueDate: new Date(“2026-02-26T14:00:00+08:00”),
weight: 8,
progress: 40,
},
{
// [7] 全员会议 - 新架构+KPI宣贯
orgId: 1,
projectId: projHr,
title: “全员会议 - 新架构+KPI宣贯”,
description: “宣布内容：IP内容中心→CEO直管；业务拓展部成立；安洲职责调整；全员KPI体系3/1起正式执行；签署安洲合伙人协议+双主体协议。提醒Tina准备会议室+投屏+打印。”,
type: “milestone”,
status: “todo”,
priority: “critical”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-27T14:00:00+08:00”),
weight: 10,
progress: 0,
},
{
// [8] 审批 - 员工手册+BD协议模板
orgId: 1,
projectId: projHr,
title: “审批 - 员工手册+BD协议模板”,
description: “审批Tina提交的：员工手册终稿；退费管理办法；IP合作协议模板；渠道分销协议模板；团长分销协议模板。确认后归档。”,
type: “task”,
status: “todo”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: tinaId,
dueDate: new Date(“2026-03-06T14:00:00+08:00”),
weight: 5,
progress: 0,
},
]).returning();

console.log(`  ✅ 创建了 ${hrTasks.length} 个任务`);

// ============================================
// 5. 创建任务 — 项目3: 销售运营与内容体系优化
// ============================================

console.log(”\n📌 创建任务 — 销售运营与内容体系优化…”);
const salesTasks = await db.insert(tasks).values([
{
// [0] 合作方内部讨论体系化内容
orgId: 1,
projectId: projSales,
title: “合作方内部讨论体系化内容”,
description: “含变现体系、转化SOP、销售团队人才画像等内容。沉淀后文字反馈给产品负责人。”,
type: “task”,
status: “done”,
priority: “high”,
creatorId: alexsoId,
assigneeId: anzhouId,
dueDate: new Date(“2026-02-14”),
weight: 6,
progress: 100,
},
{
// [1] 产品负责人分享SOP给合作方
orgId: 1,
projectId: projSales,
title: “产品负责人分享SOP给合作方”,
description: “产品负责人已制定的销售转化SOP，需分享给合作方参考。”,
type: “task”,
status: “done”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-14”),
weight: 3,
progress: 100,
},
{
// [2] 合作方明确销售团队人才画像
orgId: 1,
projectId: projSales,
title: “合作方明确销售团队人才画像与需求清单”,
description: “形成文字需求清单发给产品负责人，供其对现有团队人员进行评估调整。”,
type: “task”,
status: “done”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: anzhouId,
dueDate: new Date(“2026-02-14”),
weight: 4,
progress: 100,
},
{
// [3] 建立矩阵账号合规审核SOP
orgId: 1,
projectId: projSales,
title: “建立矩阵账号合规审核SOP + 核心数据复盘表格”,
description: “账号是不可再生资源，需尽快建立合规审核体系保护账号。复盘此前账号被封原因(IP集中、同行举报、K线图等金融敏感场景)。”,
type: “task”,
status: “done”,
priority: “high”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-14”),
weight: 7,
progress: 100,
},
{
// [4] 直播运营设置直播记录员
orgId: 1,
projectId: projSales,
title: “直播运营：设置直播记录员，记录高光时刻并切片剪辑”,
description: “直播中讲解的历史金融知识等内容用户需求高但未被切片利用。第二天由剪辑师按时间节点二创。”,
type: “task”,
status: “done”,
priority: “high”,
creatorId: alexsoId,
assigneeId: appleId,
dueDate: new Date(“2026-02-14”),
weight: 6,
progress: 100,
},
{
// [5] 达人启动”授人以渔”类内容
orgId: 1,
projectId: projSales,
title: “达人启动「授人以渔」类内容准备”,
description: “基于ENTJ真实性格，输出专业价值内容，结合学员案例。”,
type: “task”,
status: “done”,
priority: “medium”,
creatorId: alexsoId,
assigneeId: alexsoId,
dueDate: new Date(“2026-02-15”),
weight: 4,
progress: 100,
},
{
// [6] 重构销售团队KPI考核体系
orgId: 1,
projectId: projSales,
title: “销售负责人：重构销售团队KPI考核体系”,
description: “包括：重构KPI考核；客服应答率监控；优化线索分配与复盘机制；销售团队从10人调整至4-5人。”,
type: “task”,
status: “in_progress”,
priority: “high”,
creatorId: alexsoId,
assigneeId: anzhouId,
dueDate: new Date(“2026-02-21”),
weight: 8,
progress: 60,
},
{
// [7] 内盘期货课程开发
orgId: 1,
projectId: projSales,
title: “内盘期货课程开发，定价6000-8000元”,
description: “软件已完成，正在录制课程。即将上有赞系统做裂变分销。面向内盘期货用户(月活180-200万)。”,
type: “milestone”,
status: “in_progress”,
priority: “high”,
creatorId: alexsoId,
assigneeId: alexsoId,
startDate: new Date(“2026-02-01”),
dueDate: new Date(“2026-03-31”),
weight: 10,
progress: 40,
},
]).returning();

console.log(`  ✅ 创建了 ${salesTasks.length} 个任务`);

// ============================================
// 6. 创建任务依赖关系
// ============================================

console.log(”\n🔗 创建依赖关系…”);

await db.insert(taskDependencies).values([
// AI知识库Bot: 线性流程，每步依赖前一步
// 阶段一验收(1) 依赖 第一周周报(0)
{ taskId: aiTasks[1].id, dependsOnTaskId: aiTasks[0].id, type: “finish_to_start” },
// 第二周周报(2) 依赖 阶段一验收(1)
{ taskId: aiTasks[2].id, dependsOnTaskId: aiTasks[1].id, type: “finish_to_start” },
// 阶段二验收(3) 依赖 第二周周报(2)
{ taskId: aiTasks[3].id, dependsOnTaskId: aiTasks[2].id, type: “finish_to_start” },
// 第三周周报(4) 依赖 阶段二验收(3)
{ taskId: aiTasks[4].id, dependsOnTaskId: aiTasks[3].id, type: “finish_to_start” },
// 最终验收(5) 依赖 第三周周报(4)
{ taskId: aiTasks[5].id, dependsOnTaskId: aiTasks[4].id, type: “finish_to_start” },

```
// 人事架构: 部分线性，部分并行
// 安洲面谈(4) 依赖 春节思考(3) — 春节想好条款再谈
{ taskId: hrTasks[4].id, dependsOnTaskId: hrTasks[3].id, type: "finish_to_start" },
// 双主体定价(5) 依赖 安洲面谈(4) — 先确认合伙人方案再定价
{ taskId: hrTasks[5].id, dependsOnTaskId: hrTasks[4].id, type: "finish_to_start" },
// KPI终稿(6) 依赖 刘建烨面谈(0)、唐张世涵面谈(1)、Apple面谈(2) — 个人协议都签完再定KPI
{ taskId: hrTasks[6].id, dependsOnTaskId: hrTasks[0].id, type: "finish_to_start" },
{ taskId: hrTasks[6].id, dependsOnTaskId: hrTasks[1].id, type: "finish_to_start" },
{ taskId: hrTasks[6].id, dependsOnTaskId: hrTasks[2].id, type: "finish_to_start" },
// 全员会议(7) 依赖 双主体定价(5) + KPI终稿(6) — 全部就绪才开全员会
{ taskId: hrTasks[7].id, dependsOnTaskId: hrTasks[5].id, type: "finish_to_start" },
{ taskId: hrTasks[7].id, dependsOnTaskId: hrTasks[6].id, type: "finish_to_start" },
// 员工手册(8) 依赖 全员会议(7) — 宣贯完再终稿
{ taskId: hrTasks[8].id, dependsOnTaskId: hrTasks[7].id, type: "finish_to_start" },

// 销售运营: 部分依赖
// 重构KPI(6) 依赖 合作方讨论(0) + 人才画像(2) — 先有方向再重构
{ taskId: salesTasks[6].id, dependsOnTaskId: salesTasks[0].id, type: "finish_to_start" },
{ taskId: salesTasks[6].id, dependsOnTaskId: salesTasks[2].id, type: "finish_to_start" },
```

]);

console.log(”  ✅ 创建了所有依赖关系”);

// ============================================
// 汇总
// ============================================
console.log(”\n========================================”);
console.log(“✅ 数据导入完成！”);
console.log(`   👥 团队成员: 7 人（含 Alexso）`);
console.log(`   📁 项目: 3 个`);
console.log(`   📌 任务: ${aiTasks.length + hrTasks.length + salesTasks.length} 个`);
console.log(`   🔗 依赖关系: 14 条`);
console.log(”========================================”);

process.exit(0);
}

importData().catch((err) => {
console.error(“❌ 导入失败:”, err);
process.exit(1);
});