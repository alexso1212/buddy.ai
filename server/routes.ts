import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { SignJWT, jwtVerify } from "jose";
import cookieParser from "cookie-parser";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "depai-task-center-secret"
);

const stripInviteCode = ({ invite_code, ...rest }: User) => rest;

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(cookieParser());

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { invite_code } = req.body;
    if (!invite_code) {
      return res.status(401).json({ message: "Invalid invite code" });
    }
    const user = await storage.getUserByInviteCode(invite_code);
    if (!user) {
      return res.status(401).json({ message: "Invalid invite code" });
    }
    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      path: "/",
    });
    return res.json(stripInviteCode(user));
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie("token", { path: "/" });
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", authMiddleware, (req: Request, res: Response) => {
    return res.json(stripInviteCode(req.user!));
  });

  app.get("/api/tasks", authMiddleware, async (req: Request, res: Response) => {
    const view = (req.query.view as string) || "mine";
    const user = req.user!;
    let taskList: any[] = [];

    if (view === "mine") {
      taskList = await storage.getTasksByUserId(user.id);
    } else if (view === "all") {
      if (user.role === "ceo" || user.role === "admin") {
        taskList = await storage.getAllTasks();
      } else if (user.role === "head") {
        const myTasks = await storage.getTasksByUserId(user.id);
        const deptTasks = await storage.getTasksByDept([
          "销售部",
          "BD部",
          "销售部+BD部",
        ]);
        const merged = new Map<string, any>();
        for (const t of myTasks) merged.set(t.id, t);
        for (const t of deptTasks) merged.set(t.id, t);
        taskList = Array.from(merged.values());
      } else {
        taskList = await storage.getTasksByUserId(user.id);
      }
    } else if (view === "people") {
      if (user.role !== "ceo" && user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      taskList = await storage.getAllTasks();
    } else {
      taskList = await storage.getTasksByUserId(user.id);
    }

    const taskIds = taskList.map((t) => t.id);
    const assigneeMap = await storage.getAssigneesForTasks(taskIds);
    const strippedMap: Record<string, any[]> = {};
    for (const [tid, assignees] of Object.entries(assigneeMap)) {
      strippedMap[tid] = assignees.map(stripInviteCode);
    }

    return res.json({ tasks: taskList, assigneeMap: strippedMap });
  });

  app.get(
    "/api/tasks/:id",
    authMiddleware,
    async (req: Request, res: Response) => {
      const taskId = req.params.id as string;
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      const assignees = await storage.getAssigneesForTask(task.id);
      const logs = await storage.getLogsForTask(task.id);
      return res.json({
        task,
        assignees: assignees.map(stripInviteCode),
        logs,
      });
    }
  );

  app.patch(
    "/api/tasks/:id",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = req.user!;
      const task = await storage.getTaskById(req.params.id as string);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const assignees = await storage.getAssigneesForTask(task.id);
      const assigneeIds = assignees.map((a) => a.id);
      const isAssigned = assigneeIds.includes(user.id);

      if (user.role === "staff") {
        if (!isAssigned) {
          return res.status(403).json({ message: "Forbidden" });
        }
        const allowedKeys = ["status"];
        const bodyKeys = Object.keys(req.body);
        if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
          return res.status(403).json({ message: "Forbidden" });
        }
      } else if (user.role === "head") {
        const deptUsers = await storage.getTasksByDept([
          "销售部",
          "BD部",
          "销售部+BD部",
        ]);
        const deptTaskIds = deptUsers.map((t) => t.id);
        if (!isAssigned && !deptTaskIds.includes(task.id)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const updates: any = { ...req.body, updated_at: new Date() };

      if (updates.status && updates.status !== task.status) {
        if (updates.status === "active" && task.depends_on) {
          const depIds = task.depends_on.split(",").map((s: string) => s.trim());
          for (const depId of depIds) {
            const depTask = await storage.getTaskById(depId);
            if (!depTask || depTask.status !== "done") {
              return res.status(400).json({
                message: `Dependency task ${depId} is not done yet`,
              });
            }
          }
        }

        if (updates.status === "done") {
          updates.completed_at = new Date();
        } else if (task.status === "done") {
          updates.completed_at = null;
        }

        await storage.addLog({
          task_id: task.id,
          user_id: user.id,
          action: "status_change",
          old_value: task.status || undefined,
          new_value: updates.status,
        });
      }

      const updated = await storage.updateTask(task.id, updates);
      return res.json(updated);
    }
  );

  app.get(
    "/api/tasks/:id/logs",
    authMiddleware,
    async (req: Request, res: Response) => {
      const logs = await storage.getLogsForTask(req.params.id as string);
      return res.json(logs);
    }
  );

  app.get("/api/users", authMiddleware, async (_req: Request, res: Response) => {
    const allUsers = await storage.getAllUsers();
    return res.json(allUsers.map(stripInviteCode));
  });

  app.get(
    "/api/phases",
    authMiddleware,
    async (_req: Request, res: Response) => {
      const allPhases = await storage.getAllPhases();
      allPhases.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      return res.json(allPhases);
    }
  );

  app.post("/api/sync", authMiddleware, async (req: Request, res: Response) => {
    const user = req.user!;
    if (user.role !== "ceo") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { updates = [], new_tasks = [], new_comments = [] } = req.body;
    let updated = 0;
    let created = 0;
    let commented = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const upd of updates) {
      try {
        const existing = await storage.getTaskById(upd.id);
        if (!existing) {
          skipped++;
          continue;
        }
        const { id, ...fields } = upd;
        await storage.updateTask(id, { ...fields, updated_at: new Date() });
        await storage.addLog({
          task_id: id,
          user_id: user.id,
          action: "sync_update",
          new_value: JSON.stringify(fields),
        });
        updated++;
      } catch (e: any) {
        errors.push(`update ${upd.id}: ${e.message}`);
      }
    }

    for (const nt of new_tasks) {
      try {
        const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newTask = await storage.createTask({
          id: taskId,
          title: nt.title,
          description: nt.desc || nt.description,
          phase: nt.phase,
          deadline: nt.deadline,
          grace_deadline: nt.grace,
          deliverable: nt.deliverable,
          reviewer_id: nt.reviewer,
          priority: nt.priority || 0,
          depends_on: nt.depends_on,
          parent_id: nt.parent_id,
          created_by: user.id,
        });
        if (nt.assignees && Array.isArray(nt.assignees)) {
          for (const uid of nt.assignees) {
            await storage.addAssignee(newTask.id, uid);
          }
        }
        if (nt.subtasks && Array.isArray(nt.subtasks)) {
          for (let i = 0; i < nt.subtasks.length; i++) {
            const subId = `${taskId}-s${i + 1}`;
            await storage.createTask({
              id: subId,
              title: nt.subtasks[i],
              parent_id: taskId,
              deadline: nt.deadline,
              phase: nt.phase,
              status: "pending",
            });
            if (nt.assignees && Array.isArray(nt.assignees)) {
              for (const uid of nt.assignees) {
                await storage.addAssignee(subId, uid);
              }
            }
          }
        }
        created++;
      } catch (e: any) {
        errors.push(`create: ${e.message}`);
      }
    }

    for (const cm of new_comments) {
      try {
        await storage.addLog({
          task_id: cm.task_id,
          user_id: cm.user_id || user.id,
          action: "comment",
          new_value: cm.content || cm.text,
        });
        commented++;
      } catch (e: any) {
        errors.push(`comment ${cm.task_id}: ${e.message}`);
      }
    }

    try {
      await storage.addLog({
        user_id: user.id,
        action: "sync",
        new_value: JSON.stringify({ updated, created, commented, skipped, errors }),
      });
    } catch {}

    return res.json({ updated, created, commented, skipped, errors });
  });

  app.get(
    "/api/sync/history",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = req.user!;
      if (user.role !== "ceo") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const logs = await storage.getRecentSyncLogs(10);
      return res.json(logs);
    }
  );

  app.post("/api/seed", async (_req: Request, res: Response) => {
    const USERS = [
      { id: "alex", name: "Alex", title: "CEO / 首席讲师", dept: "CEO办公室", role: "ceo", invite_code: "DP-ALEX-9k2m", color: "#C0392B" },
      { id: "tina", name: "Tina", title: "行政人事 / 考核专员", dept: "综合部", role: "admin", invite_code: "DP-TINA-8x3k", color: "#2E86AB" },
      { id: "anzhou", name: "安洲", title: "销售+BD负责人", dept: "销售部+BD部", role: "head", invite_code: "DP-AZ-7f4n", color: "#7B1FA2" },
      { id: "anna", name: "Anna", title: "销售代表", dept: "销售部", role: "staff", invite_code: "DP-ANNA-3r8p", color: "#00897B" },
      { id: "sera", name: "Sera", title: "高级销售代表", dept: "销售部", role: "staff", invite_code: "DP-SERA-5t2w", color: "#00897B" },
      { id: "xiaoluo", name: "小罗", title: "销售代表", dept: "销售部", role: "staff", invite_code: "DP-XL-6y9q", color: "#00897B" },
      { id: "xiaoming", name: "小明", title: "高级剪辑师", dept: "IP内容中心", role: "staff", invite_code: "DP-XM-4d7h", color: "#E65100" },
      { id: "andy", name: "Andy", title: "编导兼剪辑", dept: "IP内容中心", role: "staff", invite_code: "DP-ANDY-2k5j", color: "#E65100" },
      { id: "guolinlin", name: "郭林林", title: "剪辑师", dept: "IP内容中心", role: "staff", invite_code: "DP-GLL-8m3v", color: "#E65100" },
      { id: "linyuanyuan", name: "林媛媛", title: "内容助理(实习)", dept: "IP内容中心", role: "staff", invite_code: "DP-LYY-1n6b", color: "#E65100" },
      { id: "slime", name: "史莱姆", title: "运营编导", dept: "IP内容中心", role: "staff", invite_code: "DP-SLM-9p4c", color: "#E65100" },
      { id: "apple", name: "Apple", title: "达人/出镜IP", dept: "IP内容中心", role: "staff", invite_code: "DP-APL-7q2x", color: "#E65100" },
      { id: "ljy", name: "刘建烨", title: "内容创作/直播", dept: "IP内容中心", role: "staff", invite_code: "DP-LJY-3s8f", color: "#E65100" },
      { id: "tzsh", name: "唐张世涵", title: "直播/达人", dept: "IP内容中心", role: "staff", invite_code: "DP-TZSH-5w1g", color: "#E65100" },
      { id: "michael", name: "Michael", title: "助教", dept: "教研部", role: "staff", invite_code: "DP-MCL-6e4r", color: "#1565C0" },
      { id: "xiehai", name: "谢海", title: "助教(储备讲师)", dept: "教研部", role: "staff", invite_code: "DP-XH-2a7t", color: "#1565C0" },
    ];

    const PHASES = [
      { id: "p0pre", label: "P0 节前冲刺", date_range: "2/10-2/14", color: "#C0392B", sort_order: 1 },
      { id: "cny", label: "春节假期", date_range: "2/15-2/23", color: "#E65100", sort_order: 2 },
      { id: "p1w1", label: "P1 节后第1周", date_range: "2/24-2/28", color: "#E67E22", sort_order: 3 },
      { id: "p2w23", label: "P2 节后2-3周", date_range: "3/2-3/13", color: "#27AE60", sort_order: 4 },
    ];

    const TASKS = [
      { id: "t01", title: "全员合同档案盘点", desc: "逐人核查16人合同签署状态", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-10", grace: "2026-02-11", phase: "p0pre", deliverable: "《合同状态一览表》" },
      { id: "t02", title: "联系法务加急出协议模板(4份)", desc: "竞业禁止、知识产权归属、个人劳务合作、KPI绩效对赌", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-10", grace: "2026-02-11", phase: "p0pre", deliverable: "4份协议模板(Word)" },
      { id: "t03", title: "启动史莱姆背景调查", desc: "核实学历、工作经历、前公司离职原因", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-10", grace: "2026-02-13", phase: "p0pre", deliverable: "背调报告" },
      { id: "t04", title: "与刘建烨面谈—竞业+知识产权协议", desc: "竞业补偿金、离职后12个月禁止期、在职产出归属", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-11", grace: "2026-02-12", phase: "p0pre", deliverable: "已签竞业+IP协议", priority: 1, depends_on: "t02" },
      { id: "t05", title: "与唐张世涵面谈—重签合作协议+KPI", desc: "终止挂职模式，重签劳务合作协议", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-12", grace: "2026-02-13", phase: "p0pre", deliverable: "已签劳务合作协议", priority: 1, depends_on: "t02" },
      { id: "t06", title: "与Apple面谈—KPI绩效对赌协议", desc: "出镜/出勤/转化标准", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-13", grace: "2026-02-14", phase: "p0pre", deliverable: "已签KPI对赌协议", priority: 1, depends_on: "t02" },
      { id: "t07", title: "销售提成制度细则初稿", desc: "10%佣金包内部分配规则", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-14", grace: "2026-02-14", phase: "p0pre", deliverable: "《销售提成制度》初稿" },
      { id: "t08", title: "节前收尾：文件归档+背调跟进", desc: "已签协议扫描存档", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-14", grace: "2026-02-14", phase: "p0pre", deliverable: "归档完成+背调报告" },
      { id: "t09", title: "思考安洲合伙人对赌条款细节", desc: "70万业绩起分线、30%分红公式、BD提成比例", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-23", grace: "2026-02-24", phase: "cny", deliverable: "条款备忘录" },
      { id: "t10", title: "确定双主体软件进货价方案", desc: "德湃教育从科技采购软件定价", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-23", grace: "2026-02-24", phase: "cny", deliverable: "定价方案" },
      { id: "t11", title: "拟定各岗位KPI具体数值", desc: "V3方案中所有数值逐项填入", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-23", grace: "2026-02-24", phase: "cny", deliverable: "KPI数值清单" },
      { id: "t12", title: "审阅安洲销售提成制度初稿", desc: "核实10%佣金包分配是否合理", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-23", grace: "2026-02-24", phase: "cny", deliverable: "批注/修改意见" },
      { id: "t13", title: "全员NDA统一签署", desc: "16人全员签署", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-24", grace: "2026-02-25", phase: "p1w1", deliverable: "16份已签NDA", depends_on: "t02", subtasks: ["销售部3人NDA", "IP内容中心剪辑师NDA", "IP内容中心达人NDA", "教研部NDA", "Tina自己NDA", "楚彤NDA"] },
      { id: "t14", title: "内容创作者知识产权归属协议签署", desc: "小明、Andy等6人签署", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-24", grace: "2026-02-25", phase: "p1w1", deliverable: "6份已签IP归属协议" },
      { id: "t15", title: "史莱姆试用期协议签署", desc: "试用期协议+NDA+竞业", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-24", grace: "2026-02-25", phase: "p1w1", deliverable: "已签试用期协议", depends_on: "t03" },
      { id: "t16", title: "与安洲面谈—合伙人对赌+BD部启动", desc: "70万线/30%分红/BD提成/职责边界", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-24", grace: "2026-02-25", phase: "p1w1", deliverable: "确认条款", priority: 1, depends_on: "t09,t12" },
      { id: "t17", title: "BD部启动计划书", desc: "三条业务线启动节奏", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-25", grace: "2026-02-26", phase: "p1w1", deliverable: "《BD部启动计划书》" },
      { id: "t18", title: "IP合作协议业务条款草案", desc: "运营管理服务范围、利润分成", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-25", grace: "2026-02-26", phase: "p1w1", deliverable: "IP合作业务条款草案" },
      { id: "t19", title: "渠道分销体系方案", desc: "渠道等级、佣金比例、入驻标准", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "《渠道分销体系方案》" },
      { id: "t20", title: "团长裂变体系方案", desc: "有赞分销等级、佣金规则", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "《团长裂变体系方案》" },
      { id: "t21", title: "账号实名资源解决方案", desc: "梳理账号实名困境", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "《账号实名解决方案》" },
      { id: "t22", title: "双主体关联交易定价决策", desc: "确定进货价→通知代账", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-25", grace: "2026-02-26", phase: "p1w1", deliverable: "定价方案" },
      { id: "t23", title: "起草：合伙人对赌+双主体关联交易协议", desc: "基于确认条款起草正式文本", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "两份协议初稿", depends_on: "t16,t22" },
      { id: "t24", title: "薪酬体系说明书+佣金结算规则", desc: "各岗位薪酬结构", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "薪酬说明+结算规则" },
      { id: "t25", title: "竞业补偿金发放台账建档", desc: "竞业协议需有补偿金记录", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "《竞业补偿金台账》" },
      { id: "t26", title: "KPI绩效考核制度终稿审批", desc: "Tina汇总，Alex确认签字", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-26", grace: "2026-02-27", phase: "p1w1", deliverable: "签字确认的《KPI制度》", depends_on: "t11" },
      { id: "t27", title: "全员会议—新架构+KPI宣贯", desc: "IP内容CEO直管，BD部成立", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-27", grace: "2026-02-27", phase: "p1w1", deliverable: "会议纪要+签到", priority: 1, depends_on: "t23,t26" },
      { id: "t28", title: "审批安洲提交的BD方案", desc: "BD启动计划、IP合作条款等4份方案", assignees: ["alex"], reviewer: "alex", deadline: "2026-02-27", grace: "2026-02-28", phase: "p1w1", deliverable: "批注后的4份方案", depends_on: "t17,t18,t19,t20" },
      { id: "t29", title: "销售SOP流程文档", desc: "客资跟进流程、私域话术", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-02-28", grace: "2026-03-02", phase: "p1w1", deliverable: "《销售SOP》" },
      { id: "t30", title: "本周签署文件全部归档", desc: "全部扫描+纸质双备份", assignees: ["tina"], reviewer: "alex", deadline: "2026-02-28", grace: "2026-03-02", phase: "p1w1", deliverable: "归档完成" },
      { id: "t31", title: "员工手册初稿编写", desc: "考勤、请假、奖惩、行为规范", assignees: ["tina"], reviewer: "alex", deadline: "2026-03-03", grace: "2026-03-05", phase: "p2w23", deliverable: "《员工手册》初稿" },
      { id: "t32", title: "退费管理办法起草", desc: "2025年退费243万，需规范流程", assignees: ["tina"], reviewer: "alex", deadline: "2026-03-03", grace: "2026-03-05", phase: "p2w23", deliverable: "《退费管理办法》" },
      { id: "t33", title: "将安洲BD方案包装成正式协议(3份)", desc: "IP合作+渠道分销+团长分销", assignees: ["tina"], reviewer: "alex", deadline: "2026-03-04", grace: "2026-03-06", phase: "p2w23", deliverable: "3份BD协议模板", depends_on: "t28" },
      { id: "t34", title: "渠道商/团长推广素材包", desc: "产品介绍、课程卖点、佣金说明", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-03-04", grace: "2026-03-06", phase: "p2w23", deliverable: "推广素材包" },
      { id: "t35", title: "首批BD目标清单+洽谈计划", desc: "Q1目标IP≥3个、渠道≥5个", assignees: ["anzhou"], reviewer: "alex", deadline: "2026-03-05", grace: "2026-03-07", phase: "p2w23", deliverable: "《Q1 BD目标清单》" },
      { id: "t36", title: "审批—员工手册+退费办法+BD协议模板", desc: "审批后定稿归档", assignees: ["alex"], reviewer: "alex", deadline: "2026-03-06", grace: "2026-03-09", phase: "p2w23", deliverable: "审批签字后归档", depends_on: "t31,t32,t33" },
      { id: "t37", title: "审批—推广素材包+BD目标清单", desc: "确认后BD正式外拓", assignees: ["alex"], reviewer: "alex", deadline: "2026-03-06", grace: "2026-03-09", phase: "p2w23", deliverable: "审批通过", depends_on: "t34,t35" },
      { id: "t38", title: "补充文件起草(6份)", desc: "离职交接/印章管理/学员信息保护等", assignees: ["tina"], reviewer: "alex", deadline: "2026-03-11", grace: "2026-03-13", phase: "p2w23", deliverable: "6份补充文件" },
      { id: "t39", title: "全部文件归档整理", desc: "四层结构，电子+纸质双备份", assignees: ["tina"], reviewer: "alex", deadline: "2026-03-12", grace: "2026-03-13", phase: "p2w23", deliverable: "完整文件夹体系" },
      { id: "t40", title: "三方对账—建档完成检查", desc: "逐项核查建档清单", assignees: ["alex", "tina", "anzhou"], reviewer: "alex", deadline: "2026-03-13", grace: "2026-03-13", phase: "p2w23", deliverable: "《建档完成确认书》", priority: 1, depends_on: "t36,t37,t38,t39", subtasks: ["P0文件到位确认", "P1文件到位确认", "P2进度跟踪", "安洲BD文件归档确认", "双主体分账文件确认", "缺失项清单"] },
    ];

    for (const u of USERS) {
      await storage.upsertUser(u);
    }

    for (const p of PHASES) {
      await storage.upsertPhase(p);
    }

    for (const t of TASKS) {
      await storage.createTask({
        id: t.id,
        title: t.title,
        description: t.desc,
        phase: t.phase,
        deadline: t.deadline,
        grace_deadline: t.grace,
        deliverable: t.deliverable,
        reviewer_id: t.reviewer,
        priority: (t as any).priority || 0,
        depends_on: (t as any).depends_on,
        status: "pending",
      }).catch(async () => {
        await storage.updateTask(t.id, {
          title: t.title,
          description: t.desc,
          deliverable: t.deliverable,
          updated_at: new Date(),
        });
      });

      await storage.removeAssignees(t.id);
      for (const uid of t.assignees) {
        await storage.addAssignee(t.id, uid);
      }

      if ((t as any).subtasks) {
        const subtasks: string[] = (t as any).subtasks;
        for (let i = 0; i < subtasks.length; i++) {
          const subId = `${t.id}-s${i + 1}`;
          await storage.createTask({
            id: subId,
            title: subtasks[i],
            parent_id: t.id,
            deadline: t.deadline,
            phase: t.phase,
            status: "pending",
          }).catch(async () => {
            await storage.updateTask(subId, {
              title: subtasks[i],
              updated_at: new Date(),
            });
          });

          await storage.removeAssignees(subId);
          for (const uid of t.assignees) {
            await storage.addAssignee(subId, uid);
          }
        }
      }
    }

    return res.json({ ok: true });
  });

  return httpServer;
}
