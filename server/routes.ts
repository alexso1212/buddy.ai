import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { SignJWT, jwtVerify } from "jose";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { User } from "@shared/schema";
import * as XLSX from "xlsx";

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
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await storage.getUserById(payload.userId as string);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function notifyUsers(userIds: string[], data: { task_id?: string; type: string; title: string; content?: string }) {
  const unique = [...new Set(userIds)];
  for (const uid of unique) {
    try {
      await storage.createNotification({ user_id: uid, ...data });
    } catch {}
  }
}

async function autoUnblockCheck(completedTaskId: string) {
  const dependents = await storage.getTasksDependingOn(completedTaskId);
  for (const dep of dependents) {
    if (!dep.depends_on) continue;
    const depIds = dep.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
    let allDone = true;
    for (const did of depIds) {
      const t = await storage.getTaskById(did);
      if (!t || t.status !== "done") { allDone = false; break; }
    }
    if (allDone && dep.status === "pending") {
      const assignees = await storage.getAssigneesForTask(dep.id);
      await storage.addLog({ task_id: dep.id, action: "auto_unblock", new_value: `前置任务 ${completedTaskId} 完成，已解锁` });
      await notifyUsers(
        assignees.map((a) => a.id),
        { task_id: dep.id, type: "unblock", title: `任务"${dep.title}"已解锁`, content: "所有前置任务已完成，可以开始了" }
      );
    }
  }
}

let checkDeadlinesRunning = false;
async function checkDeadlines() {
  if (checkDeadlinesRunning) return;
  checkDeadlinesRunning = true;
  try {
  const allTasks = await storage.getAllTasks();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  for (const task of allTasks) {
    if (task.status === "done" || task.parent_id) continue;
    const dl = new Date(task.deadline + "T23:59:59");
    const diffMs = dl.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const assignees = await storage.getAssigneesForTask(task.id);
    const assigneeIds = assignees.map((a) => a.id);

    if (diffDays === 1 || diffDays === 0) {
      for (const uid of assigneeIds) {
        const exists = await storage.hasNotificationToday(uid, task.id, "deadline");
        if (!exists) {
          await storage.createNotification({ user_id: uid, task_id: task.id, type: "deadline", title: `任务"${task.title}"明天到期`, content: `截止日期: ${task.deadline}` });
        }
      }
    } else if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      const reviewerIds = task.reviewer_id ? [task.reviewer_id] : [];
      const allNotifyIds = [...assigneeIds, ...reviewerIds];

      for (const uid of allNotifyIds) {
        const exists = await storage.hasNotificationToday(uid, task.id, "overdue");
        if (!exists) {
          let title = `任务"${task.title}"已逾期${overdueDays}天`;
          if (overdueDays >= 7) title = `[严重] 任务"${task.title}"严重逾期${overdueDays}天`;
          else if (overdueDays >= 3) title = `[警告] 任务"${task.title}"逾期${overdueDays}天（系统催办）`;
          await storage.createNotification({ user_id: uid, task_id: task.id, type: "overdue", title, content: `截止日期: ${task.deadline}` });
        }
      }

      if (overdueDays >= 3) {
        const hasLog = await storage.hasLogToday(task.id, "system_urge");
        if (!hasLog) {
          await storage.addLog({ task_id: task.id, action: "system_urge", new_value: `逾期${overdueDays}天，系统自动催办` }).catch(() => {});
        }
      }

      if (overdueDays >= 7) {
        const ceoUsers = (await storage.getAllUsers()).filter((u) => u.role === "ceo");
        for (const ceo of ceoUsers) {
          const exists = await storage.hasNotificationToday(ceo.id, task.id, "overdue");
          if (!exists) {
            await storage.createNotification({ user_id: ceo.id, task_id: task.id, type: "overdue", title: `[严重逾期] "${task.title}" (${overdueDays}天)`, content: `负责人: ${assignees.map((a) => a.name).join(", ")}` });
          }
        }
      }
    }
  }
  } finally {
    checkDeadlinesRunning = false;
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(cookieParser());

  // ---- Auth ----
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { invite_code } = req.body;
    if (!invite_code) return res.status(401).json({ message: "Invalid invite code" });
    const user = await storage.getUserByInviteCode(invite_code);
    if (!user) return res.status(401).json({ message: "Invalid invite code" });
    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", path: "/" });
    return res.json(stripInviteCode(user));
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token", { path: "/" });
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", authMiddleware, (req, res) => res.json(stripInviteCode(req.user!)));

  // ---- Tasks ----
  app.get("/api/tasks", authMiddleware, async (req, res) => {
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
        const deptTasks = await storage.getTasksByDept(["销售部", "BD部", "销售部+BD部"]);
        const merged = new Map<string, any>();
        for (const t of myTasks) merged.set(t.id, t);
        for (const t of deptTasks) merged.set(t.id, t);
        taskList = Array.from(merged.values());
      } else {
        taskList = await storage.getTasksByUserId(user.id);
      }
    } else if (view === "people") {
      if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      taskList = await storage.getAllTasks();
    } else if (view === "overview") {
      if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
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

    checkDeadlines().catch(() => {});

    return res.json({ tasks: taskList, assigneeMap: strippedMap });
  });

  app.get("/api/tasks/:id", authMiddleware, async (req, res) => {
    const task = await storage.getTaskById(req.params.id as string);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const assignees = await storage.getAssigneesForTask(task.id);
    const logs = await storage.getLogsForTask(task.id);
    return res.json({ task, assignees: assignees.map(stripInviteCode), logs });
  });

  app.patch("/api/tasks/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    const task = await storage.getTaskById(req.params.id as string);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const assignees = await storage.getAssigneesForTask(task.id);
    const assigneeIds = assignees.map((a) => a.id);
    const isAssigned = assigneeIds.includes(user.id);

    if (user.role === "staff") {
      if (!isAssigned) return res.status(403).json({ message: "Forbidden" });
      const allowedKeys = ["status"];
      if (Object.keys(req.body).some((k) => !allowedKeys.includes(k))) return res.status(403).json({ message: "Forbidden" });
    } else if (user.role === "head") {
      const deptTasks = await storage.getTasksByDept(["销售部", "BD部", "销售部+BD部"]);
      if (!isAssigned && !deptTasks.some((t) => t.id === task.id)) return res.status(403).json({ message: "Forbidden" });
    }

    const updates: any = { ...req.body, updated_at: new Date() };

    if (updates.status && updates.status !== task.status) {
      if (updates.status === "active" && task.depends_on) {
        const depIds = task.depends_on.split(",").map((s: string) => s.trim());
        for (const depId of depIds) {
          const depTask = await storage.getTaskById(depId);
          if (!depTask || depTask.status !== "done") {
            return res.status(400).json({ message: `前置任务 ${depId} 尚未完成` });
          }
        }
      }

      if (updates.status === "done") {
        if (!task.parent_id) {
          const subtasks = await storage.getSubtasks(task.id);
          const incomplete = subtasks.filter((st) => st.status !== "done");
          if (incomplete.length > 0) {
            return res.status(400).json({ message: `还有 ${incomplete.length} 个子任务未完成，无法标记为已完成` });
          }
        }
        updates.completed_at = new Date();
      } else if (task.status === "done") {
        updates.completed_at = null;
      }

      await storage.addLog({
        task_id: task.id, user_id: user.id, action: "status_change",
        old_value: task.status || undefined, new_value: updates.status,
      });

      if (task.reviewer_id && task.reviewer_id !== user.id) {
        await notifyUsers([task.reviewer_id], {
          task_id: task.id, type: "status",
          title: `任务"${task.title}"状态变更`,
          content: `${task.status} → ${updates.status}`,
        });
      }
    }

    const updated = await storage.updateTask(task.id, updates);

    if (updates.status === "done") {
      autoUnblockCheck(task.id).catch(() => {});
    }

    return res.json(updated);
  });

  app.get("/api/tasks/:id/logs", authMiddleware, async (req, res) => {
    const logs = await storage.getLogsForTask(req.params.id as string);
    return res.json(logs);
  });

  // ---- Subtasks ----
  app.get("/api/tasks/:id/subtasks", authMiddleware, async (req, res) => {
    const subtasks = await storage.getSubtasks(req.params.id as string);
    return res.json(subtasks);
  });

  app.post("/api/tasks/:id/subtasks", authMiddleware, async (req, res) => {
    const user = req.user!;
    const parentId = req.params.id as string;
    const parent = await storage.getTaskById(parentId);
    if (!parent) return res.status(404).json({ message: "Parent task not found" });

    if (user.role === "staff") return res.status(403).json({ message: "Forbidden" });
    if (user.role === "head") {
      const deptTasks = await storage.getTasksByDept(["销售部", "BD部", "销售部+BD部"]);
      const assignees = await storage.getAssigneesForTask(parentId);
      if (!assignees.some((a) => a.id === user.id) && !deptTasks.some((t) => t.id === parentId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const { title } = req.body;
    if (!title) return res.status(400).json({ message: "Title required" });
    const subId = `${parentId}-s${Date.now().toString(36)}`;
    const subtask = await storage.createTask({
      id: subId, title, parent_id: parentId, deadline: parent.deadline,
      phase: parent.phase || undefined, status: "pending",
    });

    const parentAssignees = await storage.getAssigneesForTask(parentId);
    for (const a of parentAssignees) {
      await storage.addAssignee(subId, a.id);
    }

    return res.json(subtask);
  });

  app.patch("/api/tasks/:parentId/subtasks/:subId", authMiddleware, async (req, res) => {
    const user = req.user!;
    const subtask = await storage.getTaskById(req.params.subId as string);
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });

    if (user.role === "staff") {
      const assignees = await storage.getAssigneesForTask(subtask.parent_id || subtask.id);
      if (!assignees.some((a) => a.id === user.id)) return res.status(403).json({ message: "Forbidden" });
      const allowedKeys = ["status"];
      if (Object.keys(req.body).some((k) => !allowedKeys.includes(k))) return res.status(403).json({ message: "Forbidden" });
    }

    const updates: any = { ...req.body, updated_at: new Date() };
    if (updates.status === "done") updates.completed_at = new Date();
    else if (updates.status && subtask.status === "done") updates.completed_at = null;

    const updated = await storage.updateTask(subtask.id, updates);
    return res.json(updated);
  });

  app.delete("/api/tasks/:parentId/subtasks/:subId", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role === "staff") return res.status(403).json({ message: "Forbidden" });
    const subtask = await storage.getTaskById(req.params.subId as string);
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });
    await storage.removeAssignees(subtask.id);
    await storage.deleteTask(subtask.id);
    return res.json({ ok: true });
  });

  // ---- Comments ----
  app.get("/api/tasks/:id/comments", authMiddleware, async (req, res) => {
    const cmts = await storage.getCommentsForTask(req.params.id as string);
    return res.json(cmts);
  });

  app.post("/api/tasks/:id/comments", authMiddleware, async (req, res) => {
    const user = req.user!;
    const taskId = req.params.id as string;
    const task = await storage.getTaskById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const assignees = await storage.getAssigneesForTask(taskId);
    const canComment = user.role === "ceo" || user.role === "admin" ||
      assignees.some((a) => a.id === user.id) || task.reviewer_id === user.id;
    if (!canComment) return res.status(403).json({ message: "Forbidden" });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Content required" });
    const comment = await storage.createComment({ task_id: taskId, user_id: user.id, content: content.trim() });

    const notifyIds = [...assignees.map((a) => a.id)];
    if (task.reviewer_id) notifyIds.push(task.reviewer_id);
    const filtered = [...new Set(notifyIds)].filter((id) => id !== user.id);
    await notifyUsers(filtered, {
      task_id: taskId, type: "comment",
      title: `${user.name}评论了"${task.title}"`,
      content: content.trim().slice(0, 100),
    });

    return res.json(comment);
  });

  // ---- Notifications ----
  app.get("/api/notifications", authMiddleware, async (req, res) => {
    const notifs = await storage.getNotificationsForUser(req.user!.id);
    const unreadCount = await storage.getUnreadCountForUser(req.user!.id);
    return res.json({ notifications: notifs, unreadCount });
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    await storage.markNotificationRead(parseInt(req.params.id as string));
    return res.json({ ok: true });
  });

  app.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
    await storage.markAllNotificationsRead(req.user!.id);
    return res.json({ ok: true });
  });

  // ---- Urge (manual) ----
  app.post("/api/tasks/:id/urge", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const taskId = req.params.id as string;
    const task = await storage.getTaskById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const lastUrge = await storage.getLastUrgeForTask(taskId);
    if (lastUrge?.created_at) {
      const hoursSince = (Date.now() - new Date(lastUrge.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return res.status(429).json({ message: "24小时内已催办，请稍后再试" });
    }

    await storage.addLog({ task_id: taskId, user_id: user.id, action: "urge", new_value: `${user.name}催办` });
    const assignees = await storage.getAssigneesForTask(taskId);
    await notifyUsers(assignees.map((a) => a.id), {
      task_id: taskId, type: "urge",
      title: `[催办] ${user.name}催办了"${task.title}"`,
      content: "请尽快处理",
    });

    const urgeCount = await storage.getUrgeCountForTask(taskId);
    return res.json({ ok: true, urgeCount });
  });

  // ---- Overview stats ----
  app.get("/api/overview", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const allTasks = await storage.getAllTasks();
    const mainTasks = allTasks.filter((t) => !t.parent_id);
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];

    const totalTasks = mainTasks.length;
    const doneTasks = mainTasks.filter((t) => t.status === "done").length;
    const dueTodayTasks = mainTasks.filter((t) => t.deadline === today && t.status !== "done").length;
    const overdueTasks = mainTasks.filter((t) => {
      if (t.status === "done") return false;
      return t.deadline < today;
    }).length;
    const doneYesterday = mainTasks.filter((t) => {
      if (t.status !== "done" || !t.completed_at) return false;
      const d = new Date(t.completed_at).toISOString().split("T")[0];
      return d === yesterday;
    }).length;

    const phases = await storage.getAllPhases();
    phases.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const phaseProgress = phases.map((p) => {
      const pTasks = mainTasks.filter((t) => t.phase === p.id);
      const done = pTasks.filter((t) => t.status === "done").length;
      return { id: p.id, label: p.label, color: p.color, total: pTasks.length, done, pct: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0 };
    });

    const riskTasks = mainTasks
      .filter((t) => t.status !== "done" && t.deadline < today)
      .map((t) => {
        const dl = new Date(t.deadline + "T23:59:59");
        const overdueDays = Math.ceil((now.getTime() - dl.getTime()) / (1000 * 60 * 60 * 24));
        return { ...t, overdueDays };
      })
      .sort((a, b) => b.overdueDays - a.overdueDays);

    const taskIds = riskTasks.map((t) => t.id);
    const assigneeMap = await storage.getAssigneesForTasks(taskIds);
    const riskWithAssignees = riskTasks.map((t) => ({
      ...t,
      assignees: (assigneeMap[t.id] || []).map(stripInviteCode),
    }));

    const recentLogs = await storage.getRecentLogs(20);

    return res.json({
      stats: { totalTasks, doneTasks, dueTodayTasks, overdueTasks, doneYesterday },
      phaseProgress,
      riskTasks: riskWithAssignees,
      recentLogs,
    });
  });

  app.get("/api/users", authMiddleware, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    return res.json(allUsers.map(stripInviteCode));
  });

  app.get("/api/phases", authMiddleware, async (_req, res) => {
    const allPhases = await storage.getAllPhases();
    allPhases.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return res.json(allPhases);
  });

  // ---- Eval Periods ----
  app.get("/api/eval/periods", authMiddleware, async (req, res) => {
    const periods = await storage.getAllEvalPeriods();
    return res.json(periods);
  });

  app.post("/api/eval/periods", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo") return res.status(403).json({ message: "Forbidden" });
    const { title, type, start_date, end_date, scoring_deadline } = req.body;
    if (!title || !start_date || !end_date) return res.status(400).json({ message: "Missing required fields" });
    const id = `ep-${Date.now().toString(36)}`;
    const period = await storage.createEvalPeriod({
      id, title, type: type || "monthly", start_date, end_date,
      scoring_deadline, status: "draft", created_by: user.id,
    });
    return res.json(period);
  });

  app.get("/api/eval/periods/:id", authMiddleware, async (req, res) => {
    const period = await storage.getEvalPeriodById(req.params.id as string);
    if (!period) return res.status(404).json({ message: "Period not found" });
    const scores = await storage.getEvalScoresForPeriod(period.id);
    const rules = await storage.getAllEvalRules();
    return res.json({ period, scores, rules });
  });

  app.patch("/api/eval/periods/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo") return res.status(403).json({ message: "Forbidden" });
    const periodId = req.params.id as string;
    const period = await storage.getEvalPeriodById(periodId);
    if (!period) return res.status(404).json({ message: "Period not found" });

    const { status } = req.body;

    if (status === "scoring" && period.status === "draft") {
      await storage.updateEvalPeriod(periodId, { status: "scoring" });
      await generateAutoScores(periodId);
      const allUsers = await storage.getAllUsers();
      const scorerIds = allUsers.filter((u) => u.role === "ceo" || u.role === "admin" || u.role === "head").map((u) => u.id);
      await notifyUsers(scorerIds, { type: "eval", title: `考核周期"${period.title}"已启动打分`, content: "请及时完成交付质量评分" });
      return res.json(await storage.getEvalPeriodById(periodId));
    }

    if (status === "review" && period.status === "scoring") {
      await storage.updateEvalPeriod(periodId, { status: "review" });
      return res.json(await storage.getEvalPeriodById(periodId));
    }

    if (status === "published" && (period.status === "review" || period.status === "scoring")) {
      await storage.updateEvalPeriod(periodId, { status: "published" });
      const allUsers = await storage.getAllUsers();
      await notifyUsers(allUsers.map((u) => u.id), {
        type: "eval", title: `考核结果已发布: ${period.title}`, content: "可以查看个人考核结果",
      });
      return res.json(await storage.getEvalPeriodById(periodId));
    }

    const updates: any = {};
    if (req.body.title) updates.title = req.body.title;
    if (req.body.scoring_deadline) updates.scoring_deadline = req.body.scoring_deadline;
    if (Object.keys(updates).length > 0) {
      await storage.updateEvalPeriod(periodId, updates);
    }
    return res.json(await storage.getEvalPeriodById(periodId));
  });

  // ---- Eval Scores ----
  app.post("/api/eval/scores", authMiddleware, async (req, res) => {
    const user = req.user!;
    const { period_id, user_id, dimension, score, comment } = req.body;
    if (!period_id || !user_id || !dimension || score === undefined) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const period = await storage.getEvalPeriodById(period_id);
    if (!period || (period.status !== "scoring" && period.status !== "review")) {
      return res.status(400).json({ message: "Period not in scoring/review state" });
    }

    const targetUser = await storage.getUserById(user_id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (user.role === "staff") return res.status(403).json({ message: "Forbidden" });
    if (user.role === "head") {
      if (targetUser.dept !== user.dept && !["销售部", "BD部"].includes(targetUser.dept || "")) {
        return res.status(403).json({ message: "只能给部门下属打分" });
      }
    }

    const existingScores = await storage.getEvalScoresForUserInPeriod(period_id, user_id);
    const existingForDim = existingScores.filter((s) => s.dimension === dimension);

    let overridden_by: string | undefined;
    if (existingForDim.length > 0) {
      const roleHierarchy: Record<string, number> = { ceo: 4, admin: 3, head: 2, staff: 1 };
      const myLevel = roleHierarchy[user.role] || 0;
      const existingHighest = Math.max(...existingForDim.map((s) => roleHierarchy[s.scorer_role] || 0));
      if (myLevel < existingHighest) return res.status(403).json({ message: "无权覆盖更高级别的评分" });
      if (myLevel > existingHighest || myLevel === existingHighest) overridden_by = user.id;
    }

    const result = await storage.upsertEvalScore({
      period_id, user_id, scorer_id: user.id, scorer_role: user.role,
      dimension, score: String(score), comment, overridden_by,
    });

    return res.json(result);
  });

  app.get("/api/eval/periods/:id/user/:userId", authMiddleware, async (req, res) => {
    const user = req.user!;
    const periodId = req.params.id as string;
    const targetUserId = req.params.userId as string;

    if (user.role === "staff" && user.id !== targetUserId) return res.status(403).json({ message: "Forbidden" });
    if (user.role === "head") {
      const target = await storage.getUserById(targetUserId);
      if (target && target.id !== user.id && target.dept !== user.dept && !["销售部", "BD部"].includes(target.dept || "")) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const scores = await storage.getEvalScoresForUserInPeriod(periodId, targetUserId);
    const rules = await storage.getAllEvalRules();
    return res.json({ scores, rules });
  });

  // ---- Eval Rules ----
  app.get("/api/eval/rules", authMiddleware, async (_req, res) => {
    const rules = await storage.getAllEvalRules();
    return res.json(rules);
  });

  app.put("/api/eval/rules", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo") return res.status(403).json({ message: "Forbidden" });
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ message: "rules array required" });

    const totalWeight = rules.reduce((sum: number, r: any) => sum + Number(r.weight), 0);
    if (totalWeight !== 100) return res.status(400).json({ message: `权重总和必须为100%，当前为${totalWeight}%` });

    const results = [];
    for (const rule of rules) {
      const r = await storage.upsertEvalRule({
        dimension: rule.dimension, label: rule.label, weight: String(rule.weight),
        formula: rule.formula, updated_by: user.id,
      });
      results.push(r);
    }

    await storage.addLog({ user_id: user.id, action: "eval_rules_update", new_value: JSON.stringify(rules) });
    return res.json(results);
  });

  // ---- Attachments ----
  app.get("/api/tasks/:id/attachments", authMiddleware, async (req, res) => {
    const atts = await storage.getAttachmentsForTask(req.params.id as string);
    return res.json(atts);
  });

  app.post("/api/tasks/:id/attachments", authMiddleware, upload.single("file"), async (req, res) => {
    const user = req.user!;
    const taskId = req.params.id as string;
    const task = await storage.getTaskById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const att = await storage.createAttachment({
      task_id: taskId, user_id: user.id,
      filename: req.file.originalname, filepath: req.file.filename,
      filesize: req.file.size, mime_type: req.file.mimetype,
    });
    return res.json(att);
  });

  app.get("/api/attachments/:id/download", authMiddleware, async (req, res) => {
    const att = await storage.getAttachmentById(parseInt(req.params.id as string));
    if (!att) return res.status(404).json({ message: "Attachment not found" });
    const filePath = path.join(uploadDir, att.filepath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(att.filename)}"`);
    if (att.mime_type) res.setHeader("Content-Type", att.mime_type);
    return res.sendFile(filePath);
  });

  app.delete("/api/attachments/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    const att = await storage.getAttachmentById(parseInt(req.params.id as string));
    if (!att) return res.status(404).json({ message: "Attachment not found" });
    if (att.user_id !== user.id && user.role !== "ceo" && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const filePath = path.join(uploadDir, att.filepath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await storage.deleteAttachment(att.id);
    return res.json({ ok: true });
  });

  // ---- Sync ----
  app.post("/api/sync", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo") return res.status(403).json({ message: "Forbidden" });
    const { updates = [], new_tasks = [], new_comments = [] } = req.body;
    let updated = 0, created = 0, commented = 0, skipped = 0;
    const errors: string[] = [];

    for (const upd of updates) {
      try {
        const existing = await storage.getTaskById(upd.id);
        if (!existing) { skipped++; continue; }
        const { id, ...fields } = upd;
        await storage.updateTask(id, { ...fields, updated_at: new Date() });
        await storage.addLog({ task_id: id, user_id: user.id, action: "sync_update", new_value: JSON.stringify(fields) });
        if (fields.status === "done") autoUnblockCheck(id).catch(() => {});
        updated++;
      } catch (e: any) { errors.push(`update ${upd.id}: ${e.message}`); }
    }

    for (const nt of new_tasks) {
      try {
        const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await storage.createTask({
          id: taskId, title: nt.title, description: nt.desc || nt.description, phase: nt.phase,
          deadline: nt.deadline, grace_deadline: nt.grace, deliverable: nt.deliverable,
          reviewer_id: nt.reviewer, priority: nt.priority || 0, depends_on: nt.depends_on,
          parent_id: nt.parent_id, created_by: user.id,
        });
        if (nt.assignees && Array.isArray(nt.assignees)) {
          for (const uid of nt.assignees) await storage.addAssignee(taskId, uid);
        }
        if (nt.subtasks && Array.isArray(nt.subtasks)) {
          for (let i = 0; i < nt.subtasks.length; i++) {
            const subId = `${taskId}-s${i + 1}`;
            await storage.createTask({ id: subId, title: nt.subtasks[i], parent_id: taskId, deadline: nt.deadline, phase: nt.phase, status: "pending" });
            if (nt.assignees) for (const uid of nt.assignees) await storage.addAssignee(subId, uid);
          }
        }
        created++;
      } catch (e: any) { errors.push(`create: ${e.message}`); }
    }

    for (const cm of new_comments) {
      try {
        await storage.addLog({ task_id: cm.task_id, user_id: cm.user_id || user.id, action: "comment", new_value: cm.content || cm.text });
        commented++;
      } catch (e: any) { errors.push(`comment ${cm.task_id}: ${e.message}`); }
    }

    try {
      await storage.addLog({ user_id: user.id, action: "sync", new_value: JSON.stringify({ updated, created, commented, skipped, errors }) });
    } catch {}

    return res.json({ updated, created, commented, skipped, errors });
  });

  app.get("/api/sync/history", authMiddleware, async (req, res) => {
    if (req.user!.role !== "ceo") return res.status(403).json({ message: "Forbidden" });
    const logs = await storage.getRecentSyncLogs(10);
    return res.json(logs);
  });

  // ---- Seed ----
  // ---- Departments ----
  app.get("/api/departments", authMiddleware, async (_req, res) => {
    const depts = await storage.getAllDepartments();
    return res.json(depts);
  });

  app.get("/api/departments/stats", authMiddleware, async (_req, res) => {
    const allTasks = await storage.getAllTasks();
    const mainTasks = allTasks.filter((t) => !t.parent_id);
    const allUsers = await storage.getAllUsers();
    const allAssignees = await storage.getAllTaskAssignees();
    const today = new Date().toISOString().split("T")[0];

    const userDeptMap = new Map(allUsers.map((u) => [u.id, u.dept_id]));
    const tasksByDept: Record<string, { total: number; active: number; done: number; overdue: number; dueSoon: number }> = {};

    for (const task of mainTasks) {
      const assigneeIds = allAssignees.filter((a) => a.task_id === task.id).map((a) => a.user_id);
      const deptIds = new Set(assigneeIds.map((uid) => userDeptMap.get(uid)).filter(Boolean) as string[]);

      for (const deptId of deptIds) {
        if (!tasksByDept[deptId]) tasksByDept[deptId] = { total: 0, active: 0, done: 0, overdue: 0, dueSoon: 0 };
        const s = tasksByDept[deptId];
        s.total++;
        if (task.status === "done") s.done++;
        else if (task.status === "active" || task.status === "review") s.active++;
        if (task.status !== "done" && task.deadline && task.deadline < today) s.overdue++;
        if (task.status !== "done" && task.deadline) {
          const dl = new Date(task.deadline);
          const now = new Date();
          const diffDays = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
          if (diffDays >= 0 && diffDays <= 3) s.dueSoon++;
        }
      }
    }

    return res.json(tasksByDept);
  });

  app.post("/api/departments", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { id, name, color, parent_id, head_id, sort_order } = req.body;
    if (!id || !name) return res.status(400).json({ message: "id and name required" });

    if (user.role === "ceo") {
      const dept = await storage.createDepartment({ id, name, color, parent_id, head_id, sort_order });
      await storage.createOrgChange({ requested_by: user.id, change_type: "dept_create", target_type: "department", target_id: id, new_value: { id, name, color, head_id }, status: "approved" });
      return res.json(dept);
    } else {
      const change = await storage.createOrgChange({ requested_by: user.id, change_type: "dept_create", target_type: "department", target_id: id, new_value: { id, name, color, head_id, sort_order }, status: "pending" });
      return res.json({ pending: true, change });
    }
  });

  app.patch("/api/departments/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const deptId = req.params.id as string;
    const dept = await storage.getDepartmentById(deptId);
    if (!dept) return res.status(404).json({ message: "Department not found" });

    const updates = req.body;

    if (user.role === "ceo") {
      const changeType = updates.head_id !== undefined && updates.head_id !== dept.head_id ? "head_change" : "dept_edit";
      const updated = await storage.updateDepartment(deptId, updates);
      await storage.createOrgChange({ requested_by: user.id, change_type: changeType, target_type: "department", target_id: deptId, old_value: dept, new_value: updates, status: "approved" });
      return res.json(updated);
    } else {
      const change = await storage.createOrgChange({ requested_by: user.id, change_type: "dept_edit", target_type: "department", target_id: deptId, old_value: dept, new_value: updates, status: "pending" });
      return res.json({ pending: true, change });
    }
  });

  app.delete("/api/departments/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo") return res.status(403).json({ message: "Only CEO can delete departments" });

    const deptId = req.params.id as string;
    const dept = await storage.getDepartmentById(deptId);
    if (!dept) return res.status(404).json({ message: "Department not found" });

    const members = await storage.getUsersByDeptId(deptId);
    if (members.length > 0) return res.status(400).json({ message: "部门下还有成员，请先移走所有成员" });

    await storage.deleteDepartment(deptId);
    await storage.createOrgChange({ requested_by: user.id, change_type: "dept_delete", target_type: "department", target_id: deptId, old_value: dept, status: "approved" });
    return res.json({ ok: true });
  });

  // ---- User management (org) ----
  app.patch("/api/users/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const targetId = req.params.id as string;
    const target = await storage.getUserById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const updates = req.body;

    if (user.role === "ceo") {
      const changeType = updates.dept_id !== undefined && updates.dept_id !== target.dept_id ? "user_move" : "user_edit";
      const updated = await storage.updateUser(targetId, updates);
      await storage.createOrgChange({ requested_by: user.id, change_type: changeType, target_type: "user", target_id: targetId, old_value: { name: target.name, title: target.title, dept_id: target.dept_id, role: target.role, color: target.color }, new_value: updates, status: "approved" });
      return res.json(stripInviteCode(updated!));
    } else {
      const changeType = updates.dept_id !== undefined && updates.dept_id !== target.dept_id ? "user_move" : "user_edit";
      const change = await storage.createOrgChange({ requested_by: user.id, change_type: changeType, target_type: "user", target_id: targetId, old_value: { name: target.name, title: target.title, dept_id: target.dept_id, role: target.role, color: target.color }, new_value: updates, status: "pending" });
      return res.json({ pending: true, change });
    }
  });

  // ---- Org Changes (approval) ----
  app.get("/api/org-changes", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const status = req.query.status as string | undefined;
    if (status === "pending") {
      const changes = await storage.getPendingOrgChanges();
      return res.json(changes);
    }
    const changes = await storage.getAllOrgChanges();
    return res.json(changes);
  });

  app.patch("/api/org-changes/:id", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo") return res.status(403).json({ message: "Only CEO can approve/reject changes" });

    const changeId = parseInt(req.params.id as string);
    const change = await storage.getOrgChangeById(changeId);
    if (!change) return res.status(404).json({ message: "Change not found" });
    if (change.status !== "pending") return res.status(400).json({ message: "Change is not pending" });

    const { status, review_note } = req.body;
    if (status !== "approved" && status !== "rejected") return res.status(400).json({ message: "Invalid status" });

    if (status === "approved") {
      const newVal = change.new_value as any;
      if (change.change_type === "dept_create") {
        await storage.createDepartment({ id: newVal.id, name: newVal.name, color: newVal.color, head_id: newVal.head_id, sort_order: newVal.sort_order });
      } else if (change.change_type === "dept_edit" || change.change_type === "head_change") {
        await storage.updateDepartment(change.target_id, newVal);
      } else if (change.change_type === "dept_delete") {
        await storage.deleteDepartment(change.target_id);
      } else if (change.change_type === "user_move" || change.change_type === "user_edit") {
        await storage.updateUser(change.target_id, newVal);
      }
    }

    const updated = await storage.updateOrgChange(changeId, { status, reviewed_by: user.id, review_note, reviewed_at: new Date() });

    await notifyUsers([change.requested_by], {
      type: "org",
      title: status === "approved" ? `架构变更已通过` : `架构变更被驳回`,
      content: review_note || (status === "approved" ? "您的架构变更申请已通过" : "您的架构变更申请被驳回"),
    });

    return res.json(updated);
  });

  // ---- Collaboration Graph ----
  app.get("/api/collaboration", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const allUsers = await storage.getActiveUsers();
    const allDepts = await storage.getAllDepartments();
    const allTasks = await storage.getAllTasks();
    const allAssignees = await storage.getAllTaskAssignees();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const taskAssigneeMap: Record<string, string[]> = {};
    for (const a of allAssignees) {
      if (!taskAssigneeMap[a.task_id]) taskAssigneeMap[a.task_id] = [];
      taskAssigneeMap[a.task_id].push(a.user_id);
    }

    const userTaskMap: Record<string, string[]> = {};
    for (const a of allAssignees) {
      if (!userTaskMap[a.user_id]) userTaskMap[a.user_id] = [];
      userTaskMap[a.user_id].push(a.task_id);
    }

    const nodes: any[] = [];
    for (const u of allUsers) {
      const userTasks = (userTaskMap[u.id] || []).map((tid) => allTasks.find((t) => t.id === tid)).filter(Boolean) as typeof allTasks;
      const mainTasks = userTasks.filter((t) => !t.parent_id);
      const overdueCount = mainTasks.filter((t) => t.status !== "done" && t.deadline < today).length;
      const nearDeadline = mainTasks.some((t) => {
        if (t.status === "done") return false;
        const dl = new Date(t.deadline + "T23:59:59");
        const diff = (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 2;
      });
      let status = "healthy";
      if (overdueCount > 0) status = "danger";
      else if (nearDeadline) status = "warning";

      nodes.push({ id: u.id, type: "person", name: u.name, dept_id: u.dept_id, color: u.color, task_count: mainTasks.length, overdue_count: overdueCount, status, title: u.title });
    }

    for (const d of allDepts) {
      const memberCount = allUsers.filter((u) => u.dept_id === d.id).length;
      nodes.push({ id: d.id, type: "dept", name: d.name, color: d.color, member_count: memberCount, head_id: d.head_id });
    }

    const linkMap: Record<string, { source: string; target: string; taskIds: Set<string> }> = {};
    const addLink = (a: string, b: string, taskId: string) => {
      const key = [a, b].sort().join("--");
      if (!linkMap[key]) linkMap[key] = { source: a, target: b, taskIds: new Set() };
      linkMap[key].taskIds.add(taskId);
    };

    for (const task of allTasks) {
      const assignees = taskAssigneeMap[task.id] || [];
      for (let i = 0; i < assignees.length; i++) {
        for (let j = i + 1; j < assignees.length; j++) {
          addLink(assignees[i], assignees[j], task.id);
        }
      }

      if (task.reviewer_id) {
        for (const uid of assignees) {
          if (uid !== task.reviewer_id) addLink(uid, task.reviewer_id, task.id);
        }
      }

      if (task.depends_on) {
        const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
        for (const depId of depIds) {
          const depTask = allTasks.find((t) => t.id === depId);
          if (!depTask) continue;
          const depAssignees = taskAssigneeMap[depId] || [];
          for (const a1 of assignees) {
            for (const a2 of depAssignees) {
              if (a1 !== a2) addLink(a1, a2, task.id);
            }
          }
        }
      }
    }

    const links = Object.values(linkMap).map((l) => {
      const taskIds = Array.from(l.taskIds);
      const linkedTasks = taskIds.map((tid) => allTasks.find((t) => t.id === tid)).filter(Boolean) as typeof allTasks;
      let linkStatus = "healthy";
      const hasOverdue = linkedTasks.some((t) => t.status !== "done" && t.deadline < today);
      const hasWarning = linkedTasks.some((t) => {
        if (t.status === "done") return false;
        const dl = new Date(t.deadline + "T23:59:59");
        const diff = (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 2;
      });
      if (hasOverdue) linkStatus = "danger";
      else if (hasWarning) linkStatus = "warning";

      return { source: l.source, target: l.target, weight: taskIds.length, task_ids: taskIds, status: linkStatus };
    });

    return res.json({ nodes, links });
  });

  // ---- Excel Export ----
  app.get("/api/export/excel", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const allTasks = await storage.getAllTasks();
    const allUsers = await storage.getAllUsers();
    const allPhases = await storage.getAllPhases();
    const allDepartments = await storage.getAllDepartments();
    const taskAssigneesList = await storage.getAllTaskAssignees();
    const taskLogsList = await storage.getAllTaskLogs();

    const today = new Date().toISOString().split("T")[0];
    const phaseMap = new Map(allPhases.map((p) => [p.id, p]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const deptMap = new Map(allDepartments.map((d) => [d.id, d]));

    const taskAssigneeMap: Record<string, string[]> = {};
    for (const ta of taskAssigneesList) {
      if (!taskAssigneeMap[ta.task_id]) taskAssigneeMap[ta.task_id] = [];
      taskAssigneeMap[ta.task_id].push(ta.user_id);
    }

    const statusMap: Record<string, string> = { pending: "待处理", active: "进行中", review: "待审核", done: "已完成" };
    const priorityMap: Record<number, string> = { 0: "普通", 1: "重要", 2: "紧急" };

    const mainTasks = allTasks.filter((t) => !t.parent_id);
    allPhases.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const sortedTasks = [...mainTasks].sort((a, b) => {
      const pa = phaseMap.get(a.phase || "");
      const pb = phaseMap.get(b.phase || "");
      const sa = pa?.sort_order ?? 999;
      const sb = pb?.sort_order ?? 999;
      if (sa !== sb) return sa - sb;
      return (a.deadline || "").localeCompare(b.deadline || "");
    });

    const sheet1Data = sortedTasks.map((t) => {
      const phase = phaseMap.get(t.phase || "");
      const assigneeIds = taskAssigneeMap[t.id] || [];
      const assigneeNames = assigneeIds.map((id) => userMap.get(id)?.name || id).join(", ");
      const reviewer = t.reviewer_id ? userMap.get(t.reviewer_id)?.name || "" : "";

      let overdueDays = 0;
      if (t.deadline) {
        const dl = new Date(t.deadline + "T23:59:59");
        const compareDate = t.completed_at ? new Date(t.completed_at) : new Date();
        if (compareDate > dl) {
          overdueDays = Math.ceil((compareDate.getTime() - dl.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const urgeCount = taskLogsList.filter((l) => l.task_id === t.id && l.action === "urge").length;

      return {
        "任务ID": t.id,
        "标题": t.title,
        "阶段": phase?.label || "",
        "负责人": assigneeNames,
        "考核人": reviewer,
        "状态": statusMap[t.status || "pending"] || t.status || "",
        "优先级": priorityMap[t.priority ?? 0] || "普通",
        "截止日期": t.deadline || "",
        "宽限期": t.grace_deadline || "",
        "完成时间": t.completed_at ? new Date(t.completed_at).toISOString().split("T")[0] : "",
        "逾期天数": overdueDays > 0 ? overdueDays : 0,
        "交付物": t.deliverable || "",
        "催办次数": urgeCount,
      };
    });

    const sheet2Data = allUsers.map((u) => {
      const dept = u.dept_id ? deptMap.get(u.dept_id)?.name || u.dept || "" : u.dept || "";
      const userTaskIds: string[] = Object.entries(taskAssigneeMap)
        .filter(([, uids]) => uids.includes(u.id))
        .map(([tid]) => tid);
      const userTasks = userTaskIds.map((tid) => allTasks.find((t) => t.id === tid)).filter((t): t is NonNullable<typeof t> => !!t && !t.parent_id);

      const totalTasks = userTasks.length;
      const doneTasks = userTasks.filter((t) => t.status === "done");
      const doneCount = doneTasks.length;
      const activeCount = userTasks.filter((t) => t.status === "active").length;
      const overdueCount = userTasks.filter((t) => t.deadline < today && t.status !== "done").length;

      let onTimeRate = "-";
      if (doneCount > 0) {
        const onTime = doneTasks.filter((t) => {
          if (!t.completed_at) return true;
          const completedDate = new Date(t.completed_at).toISOString().split("T")[0];
          return completedDate <= t.deadline;
        }).length;
        onTimeRate = Math.round((onTime / doneCount) * 100) + "%";
      }

      const statusChangeLogs = taskLogsList.filter(
        (l) => l.action === "status_change" && l.old_value === "pending" && l.new_value === "active" && userTaskIds.includes(l.task_id || "")
      );
      let avgResponse = "-";
      if (statusChangeLogs.length > 0) {
        let totalHours = 0;
        let cnt = 0;
        for (const log of statusChangeLogs) {
          const task = allTasks.find((t) => t.id === log.task_id);
          if (task?.created_at && log.created_at) {
            const diff = new Date(log.created_at).getTime() - new Date(task.created_at).getTime();
            totalHours += diff / (1000 * 60 * 60);
            cnt++;
          }
        }
        if (cnt > 0) avgResponse = (totalHours / cnt).toFixed(1) + "h";
      }

      const urgeCount = taskLogsList.filter((l) => l.action === "urge" && userTaskIds.includes(l.task_id || "")).length;

      return {
        "姓名": u.name,
        "部门": dept,
        "总任务数": totalTasks,
        "已完成": doneCount,
        "进行中": activeCount,
        "逾期数": overdueCount,
        "按时完成率": onTimeRate,
        "平均响应时间": avgResponse,
        "被催办次数": urgeCount,
      };
    });

    const allPeriods = await storage.getAllEvalPeriods();
    const publishedPeriod = allPeriods.find((p) => p.status === "published");

    let sheet3Data: any[];
    if (publishedPeriod) {
      const scores = await storage.getEvalScoresForPeriod(publishedPeriod.id);
      const rules = await storage.getAllEvalRules();
      const ruleMap = new Map(rules.map((r) => [r.dimension, r]));

      const userScoreMap: Record<string, Record<string, number>> = {};
      for (const s of scores) {
        if (!userScoreMap[s.user_id]) userScoreMap[s.user_id] = {};
        userScoreMap[s.user_id][s.dimension] = Number(s.score);
      }

      const evalRows = Object.entries(userScoreMap).map(([userId, dims]) => {
        const u = userMap.get(userId);
        const dept = u?.dept_id ? deptMap.get(u.dept_id)?.name || u?.dept || "" : u?.dept || "";

        let weightedTotal = 0;
        for (const [dim, score] of Object.entries(dims)) {
          const rule = ruleMap.get(dim);
          if (rule) {
            weightedTotal += score * Number(rule.weight) / 100;
          }
        }

        return {
          userId,
          "姓名": u?.name || userId,
          "部门": dept,
          "按时率": dims["timeliness"] ?? "-",
          "逾期分": dims["overdue"] ?? "-",
          "质量分": dims["quality"] ?? "-",
          "响应分": dims["response"] ?? "-",
          "协作分": dims["collaboration"] ?? "-",
          "子任务分": dims["subtask"] ?? "-",
          "加权总分": Math.round(weightedTotal * 10) / 10,
        };
      });

      evalRows.sort((a, b) => (b["加权总分"] as number) - (a["加权总分"] as number));
      sheet3Data = evalRows.map((r, i) => {
        const { userId, ...rest } = r;
        return { ...rest, "排名": i + 1 };
      });
    } else {
      sheet3Data = [{ "考核报告": "暂无考核数据" }];
    }

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, "任务明细");
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, "人员统计");
    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, "考核报告");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const todayStr = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.xml");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`Deltapex_任务导出_${todayStr}.xlsx`)}`);
    res.send(Buffer.from(buf));
  });

  // ---- Seed ----
  app.post("/api/seed", async (_req, res) => {
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

    const TASKS: any[] = [
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

    const DEPARTMENTS = [
      { id: "ceo_office", name: "决策中心", color: "#C0392B", head_id: "alex", sort_order: 1, description: "战略/风控/核心IP/关键人考核", kpi_description: "公司整体营收与利润", compensation_note: "100%利润+65%个人留存目标" },
      { id: "admin_dept", name: "综合部", color: "#2E86AB", head_id: "tina", sort_order: 2, description: "招聘汰换/KPI考核/行政杂事", kpi_description: "招聘达成率/人效比", compensation_note: "底薪+招聘伯乐奖" },
      { id: "operations", name: "运营总部", color: "#7B1FA2", parent_id: undefined, head_id: "anzhou", sort_order: 3, description: "销售+BD+渠道运营管理", kpi_description: "总营收/渠道拓展数/BD签约数", compensation_note: "合伙人对赌: 70万业绩起分线/30%分红" },
      { id: "sales_dept", name: "销售部", color: "#9C27B0", parent_id: "operations", head_id: "anzhou", sort_order: 4, description: "私域加粉/引导成交", kpi_description: "首单转化率/成交额", compensation_note: "底薪+5%销售提成" },
      { id: "bd_dept", name: "业务拓展部", color: "#AB47BC", parent_id: "operations", head_id: "anzhou", sort_order: 5, description: "渠道拓展/IP合作/团长分销", kpi_description: "新签渠道数/BD营收", compensation_note: "底薪+BD提成" },
      { id: "marketing_dept", name: "市场部", color: "#CE93D8", parent_id: "operations", head_id: undefined, sort_order: 6, is_planned: true, description: "品牌推广/市场活动/投放" },
      { id: "ip_center", name: "IP内容中心", color: "#E65100", head_id: "alex", sort_order: 7, description: "短视频生产/直播导流/深度内容", kpi_description: "加粉数/直播进场率/内容产出量", compensation_note: "底薪+阶梯获客奖励/总营收分红" },
      { id: "edu_dept", name: "教研部", color: "#1565C0", head_id: "alex", sort_order: 8, description: "实盘展示/周末直播大课/日常答疑", kpi_description: "实盘收益/课程口碑/完课率/满意度", compensation_note: "固定薪资/底薪+增值引流奖励" },
      { id: "pr_dept", name: "品宣部", color: "#00897B", head_id: undefined, sort_order: 9, is_planned: true, description: "品牌形象/公关/舆情管理" },
    ];

    for (const d of DEPARTMENTS) {
      await storage.createDepartment(d).catch(async () => {
        await storage.updateDepartment(d.id, { name: d.name, color: d.color, head_id: d.head_id, sort_order: d.sort_order, description: d.description, kpi_description: (d as any).kpi_description, compensation_note: (d as any).compensation_note, is_planned: (d as any).is_planned });
      });
    }

    const DEPT_MAP: Record<string, string> = {
      "CEO办公室": "ceo_office", "综合部": "admin_dept", "销售部": "sales_dept",
      "销售部+BD部": "sales_dept", "IP内容中心": "ip_center", "教研部": "edu_dept",
      "业务拓展部": "bd_dept",
    };

    for (const u of USERS) await storage.upsertUser({ ...u, dept_id: DEPT_MAP[u.dept] || undefined });
    for (const p of PHASES) await storage.upsertPhase(p);

    for (const t of TASKS) {
      await storage.createTask({
        id: t.id, title: t.title, description: t.desc, phase: t.phase,
        deadline: t.deadline, grace_deadline: t.grace, deliverable: t.deliverable,
        reviewer_id: t.reviewer, priority: t.priority || 0, depends_on: t.depends_on, status: "pending",
      }).catch(async () => {
        await storage.updateTask(t.id, { title: t.title, description: t.desc, deliverable: t.deliverable, updated_at: new Date() });
      });
      await storage.removeAssignees(t.id);
      for (const uid of t.assignees) await storage.addAssignee(t.id, uid);
      if (t.subtasks) {
        for (let i = 0; i < t.subtasks.length; i++) {
          const subId = `${t.id}-s${i + 1}`;
          await storage.createTask({ id: subId, title: t.subtasks[i], parent_id: t.id, deadline: t.deadline, phase: t.phase, status: "pending" })
            .catch(async () => { await storage.updateTask(subId, { title: t.subtasks[i], updated_at: new Date() }); });
          await storage.removeAssignees(subId);
          for (const uid of t.assignees) await storage.addAssignee(subId, uid);
        }
      }
    }

    const EVAL_RULES = [
      { dimension: 'timeliness', label: '按时完成率', weight: '30', formula: '(按时完成任务数 / 总完成任务数) × 100' },
      { dimension: 'overdue', label: '逾期严重度', weight: '20', formula: '100 - Σ(逾期天数×权重系数)，1天扣3分，3天扣10分，7天+扣25分' },
      { dimension: 'quality', label: '交付质量', weight: '25', formula: '考核人主观打分 0-100' },
      { dimension: 'response', label: '响应速度', weight: '10', formula: '100 - (平均接单耗时小时数×2)' },
      { dimension: 'collaboration', label: '协作表现', weight: '10', formula: '100 - (被催办次数×15)' },
      { dimension: 'subtask', label: '子任务完成率', weight: '5', formula: '(已完成子任务数 / 总子任务数) × 100' },
    ];
    for (const rule of EVAL_RULES) await storage.upsertEvalRule(rule);

    return res.json({ ok: true });
  });

  // ---- Analysis ----
  /**
   * Placeholder for AI-powered analysis.
   * Will call external LLM API to generate natural language insights
   * based on rule engine output.
   * 
   * Input: ruleAnalysis object (blockers, dueThisWeek, workload, nextWeek, criticalPath)
   * Output: { summary: string, suggestions: string[] } | null
   * 
   * Future implementation will:
   * 1. Convert ruleAnalysis to a prompt
   * 2. Call AI API
   * 3. Parse response into summary + action suggestions
   * 4. Return structured result
   */
  async function generateAIAnalysis(_ruleAnalysis: any): Promise<{ summary: string; suggestions: string[] } | null> {
    // TODO: Implement when AI API key is configured
    return null;
  }

  async function computeAnalysis() {
    const allTasks = await storage.getAllTasks();
    const mainTasks = allTasks.filter((t) => !t.parent_id);
    const allUsers = await storage.getAllUsers();
    const allPhases = await storage.getAllPhases();
    const allAssignees = await storage.getAllTaskAssignees();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const todayDate = new Date(today + "T00:00:00");

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const taskMap = new Map(mainTasks.map((t) => [t.id, t]));
    const assigneesByTask: Record<string, string[]> = {};
    for (const a of allAssignees) {
      if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
      assigneesByTask[a.task_id].push(a.user_id);
    }

    const blockers: any[] = [];
    const blockedTasks: any[] = [];
    for (const task of mainTasks) {
      if (task.status === "done" || !task.depends_on) continue;
      const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
      for (const depId of depIds) {
        const depTask = taskMap.get(depId);
        if (!depTask || depTask.status === "done") continue;
        const depDl = depTask.deadline ? new Date(depTask.deadline + "T23:59:59") : null;
        const overdueDays = depDl ? Math.max(0, Math.ceil((now.getTime() - depDl.getTime()) / 86400000)) : 0;
        let suggestion = "";
        if (overdueDays > 3) suggestion = "建议: 确认是否需要重新分配或移除依赖";
        else if (depTask.status === "pending") suggestion = "建议: 督促负责人尽快启动";
        else if (depTask.status === "active") suggestion = "建议: 跟进进度，确认交付时间";
        else suggestion = "建议: 跟进审核进度";

        const depAssignees = (assigneesByTask[depId] || []).map((uid) => userMap.get(uid)?.name || uid);
        const taskAssignees = (assigneesByTask[task.id] || []).map((uid) => userMap.get(uid)?.name || uid);

        blockers.push({
          taskId: task.id, taskTitle: task.title, taskAssignees,
          blockerId: depId, blockerTitle: depTask.title, blockerStatus: depTask.status,
          blockerAssignees: depAssignees, overdueDays, suggestion,
        });
        blockedTasks.push(task.id);
      }
    }

    const dependentsMap: Record<string, string[]> = {};
    for (const task of mainTasks) {
      if (!task.depends_on) continue;
      const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
      for (const depId of depIds) {
        if (!dependentsMap[depId]) dependentsMap[depId] = [];
        dependentsMap[depId].push(task.id);
      }
    }

    function findCriticalPath(): { path: string[]; risk: string } {
      const memo: Record<string, string[]> = {};
      function longestPath(taskId: string, visited: Set<string>): string[] {
        if (visited.has(taskId)) return [];
        if (memo[taskId]) return memo[taskId];
        visited.add(taskId);
        const deps = dependentsMap[taskId] || [];
        let best: string[] = [];
        for (const depId of deps) {
          const p = longestPath(depId, visited);
          if (p.length > best.length) best = p;
        }
        visited.delete(taskId);
        memo[taskId] = [taskId, ...best];
        return memo[taskId];
      }
      let longest: string[] = [];
      for (const task of mainTasks) {
        const depsOf = task.depends_on?.split(",").map((s) => s.trim()).filter(Boolean) || [];
        const isRoot = depsOf.length === 0 || depsOf.every((d) => !taskMap.has(d));
        if (isRoot || !task.depends_on) {
          const p = longestPath(task.id, new Set());
          if (p.length > longest.length) longest = p;
        }
      }
      const pathDetails = longest.map((id) => {
        const t = taskMap.get(id);
        return { id, title: t?.title || id, status: t?.status || "unknown" };
      });
      const doneCount = pathDetails.filter((p) => p.status === "done").length;
      const notDone = pathDetails.filter((p) => p.status !== "done");
      const lastTask = longest.length > 0 ? taskMap.get(longest[longest.length - 1]) : null;
      let risk = "";
      if (notDone.length > 0) {
        const blockedOnPath = notDone.filter((p) => {
          const t = taskMap.get(p.id);
          if (!t?.depends_on) return false;
          const deps = t.depends_on.split(",").map((s) => s.trim());
          return deps.some((d) => { const dt = taskMap.get(d); return dt && dt.status !== "done"; });
        });
        if (blockedOnPath.length > 0) {
          risk = `链上${longest.length}个任务，${doneCount}个已完成，${blockedOnPath.length}个被阻塞`;
        }
        if (lastTask) {
          risk += risk ? `。影响: ${lastTask.title}(${lastTask.deadline})可能推迟` : `最终任务: ${lastTask.title}(${lastTask.deadline})`;
        }
      }
      return { path: longest, risk };
    }
    const criticalPath = findCriticalPath();

    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const dueThisWeek: any[] = [];
    for (const task of mainTasks) {
      if (task.status === "done") continue;
      if (task.deadline >= weekStartStr && task.deadline <= weekEndStr) {
        const dl = new Date(task.deadline + "T00:00:00");
        const diffDays = Math.round((dl.getTime() - todayDate.getTime()) / 86400000);
        let dayLabel = task.deadline;
        if (diffDays === 0) dayLabel = "今天";
        else if (diffDays === 1) dayLabel = "明天";
        else if (diffDays === 2) dayLabel = "后天";
        else {
          const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
          dayLabel = `${dl.getMonth() + 1}/${dl.getDate()}(${dayNames[dl.getDay()]})`;
        }
        const isOverdue = task.deadline < today;
        const taskAssignees = (assigneesByTask[task.id] || []).map((uid) => userMap.get(uid)?.name || uid);
        dueThisWeek.push({
          taskId: task.id, title: task.title, deadline: task.deadline,
          dayLabel, isOverdue, assignees: taskAssignees, diffDays,
        });
      }
    }
    dueThisWeek.sort((a, b) => a.diffDays - b.diffDays);

    const workload: any[] = [];
    for (const u of allUsers) {
      const userTaskIds = Object.entries(assigneesByTask)
        .filter(([, uids]) => uids.includes(u.id))
        .map(([tid]) => tid);
      const activeTasks = userTaskIds
        .map((tid) => taskMap.get(tid))
        .filter((t): t is NonNullable<typeof t> => !!t && t.status !== "done" && !t.parent_id);
      const dueNextWeekCount = activeTasks.filter((t) => {
        return t.deadline >= weekStartStr && t.deadline <= weekEndStr;
      }).length;
      workload.push({
        userId: u.id, name: u.name, dept: u.dept,
        activeCount: activeTasks.length, dueThisWeekCount: dueNextWeekCount,
        level: activeTasks.length >= 5 ? "overloaded" : activeTasks.length >= 3 ? "busy" : "available",
        taskTypes: activeTasks.length > 0 ? Array.from(new Set(activeTasks.map((t) => {
          if (t.title.includes("审") || t.title.includes("决策") || t.title.includes("确定")) return "决策类";
          if (t.title.includes("方案") || t.title.includes("草案") || t.title.includes("初稿")) return "方案类";
          return "执行类";
        }))) : [],
      });
    }
    workload.sort((a, b) => b.activeCount - a.activeCount);

    const nextWeekStart = new Date(weekEnd);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
    const nextWeekStartStr = nextWeekStart.toISOString().split("T")[0];
    const nextWeekEndStr = nextWeekEnd.toISOString().split("T")[0];

    const nextWeekTasks = mainTasks.filter((t) => t.status !== "done" && t.deadline >= nextWeekStartStr && t.deadline <= nextWeekEndStr);
    const thisWeekTaskCount = dueThisWeek.length;
    const nextWeekTaskCount = nextWeekTasks.length;
    const ratio = thisWeekTaskCount > 0 ? (nextWeekTaskCount / thisWeekTaskCount).toFixed(1) : "N/A";

    const dayCountMap: Record<string, number> = {};
    for (const t of nextWeekTasks) {
      dayCountMap[t.deadline] = (dayCountMap[t.deadline] || 0) + 1;
    }
    let busiestDay = "";
    let busiestCount = 0;
    for (const [day, cnt] of Object.entries(dayCountMap)) {
      if (cnt > busiestCount) { busiestDay = day; busiestCount = cnt; }
    }

    const gateTasks: any[] = [];
    for (const task of mainTasks) {
      const downstream = dependentsMap[task.id] || [];
      if (downstream.length >= 2 && task.status !== "done") {
        const dl = task.deadline ? new Date(task.deadline + "T23:59:59") : null;
        const isOverdue = dl ? now > dl : false;
        const taskAssignees = (assigneesByTask[task.id] || []).map((uid) => userMap.get(uid)?.name || uid);
        gateTasks.push({
          taskId: task.id, title: task.title, deadline: task.deadline,
          downstreamCount: downstream.length, isOverdue, assignees: taskAssignees,
        });
      }
    }

    const nextWeekLookahead = {
      thisWeekCount: thisWeekTaskCount,
      nextWeekCount: nextWeekTaskCount,
      ratio,
      busiestDay,
      busiestDayCount: busiestCount,
      gateTasks,
      dateRange: `${nextWeekStart.getMonth() + 1}/${nextWeekStart.getDate()}-${nextWeekEnd.getMonth() + 1}/${nextWeekEnd.getDate()}`,
    };

    // Stage 1: Rule engine (implemented)
    const ruleAnalysis = {
      blockers,
      criticalPath: {
        path: criticalPath.path.map((id) => {
          const t = taskMap.get(id);
          return { id, title: t?.title || id, status: t?.status || "unknown" };
        }),
        risk: criticalPath.risk,
      },
      dueThisWeek,
      workload,
      nextWeekLookahead,
      computedAt: now.toISOString(),
    };

    // Stage 2: AI analysis (placeholder, implement later)
    const aiAnalysis = await generateAIAnalysis(ruleAnalysis);

    return {
      ...ruleAnalysis,
      ai: aiAnalysis,
    };
  }

  app.get("/api/analysis", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const cached = await storage.getAnalysisCache("daily");
    if (cached) {
      const age = Date.now() - new Date(cached.computed_at!).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return res.json(cached.data);
      }
    }

    const data = await computeAnalysis();
    await storage.upsertAnalysisCache("daily", data);
    return res.json(data);
  });

  app.post("/api/analysis/refresh", authMiddleware, async (req, res) => {
    const user = req.user!;
    if (user.role !== "ceo" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const data = await computeAnalysis();
    await storage.upsertAnalysisCache("daily", data);
    return res.json(data);
  });

  return httpServer;
}

async function generateAutoScores(periodId: string) {
  const period = await storage.getEvalPeriodById(periodId);
  if (!period) return;

  const allUsers = (await storage.getAllUsers()).filter((u) => u.role !== "ceo");
  const allTasks = await storage.getAllTasks();
  const allLogs = await storage.getRecentLogs(10000);

  for (const targetUser of allUsers) {
    const userTasks = await storage.getTasksByUserId(targetUser.id);
    const mainTasks = userTasks.filter((t) => !t.parent_id);
    const periodStart = period.start_date;
    const periodEnd = period.end_date;

    const relevantTasks = mainTasks.filter((t) => {
      return t.deadline >= periodStart && t.deadline <= periodEnd;
    });

    const doneTasks = relevantTasks.filter((t) => t.status === "done");
    const totalDone = doneTasks.length;

    let timelinessScore = 100;
    if (totalDone > 0) {
      let onTime = 0;
      for (const t of doneTasks) {
        if (!t.completed_at) { onTime++; continue; }
        const completedDate = new Date(t.completed_at).toISOString().split("T")[0];
        const dlDate = t.deadline;
        if (completedDate <= dlDate) {
          onTime++;
        } else if (t.grace_deadline && completedDate <= t.grace_deadline) {
          onTime += 0.95;
        }
      }
      timelinessScore = Math.round((onTime / totalDone) * 100);
    }

    let overdueScore = 100;
    for (const t of relevantTasks) {
      if (t.status === "done" && t.completed_at) {
        const completedDate = new Date(t.completed_at);
        const dlDate = new Date(t.deadline + "T23:59:59");
        if (completedDate > dlDate) {
          const diffDays = Math.ceil((completedDate.getTime() - dlDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) overdueScore -= 3;
          else if (diffDays <= 3) overdueScore -= 5 * diffDays;
          else if (diffDays <= 7) overdueScore -= 8 * diffDays;
          else overdueScore -= 10 * diffDays;
        }
      } else if (t.status !== "done") {
        const now = new Date();
        const dlDate = new Date(t.deadline + "T23:59:59");
        if (now > dlDate) {
          const diffDays = Math.ceil((now.getTime() - dlDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) overdueScore -= 3;
          else if (diffDays <= 3) overdueScore -= 5 * diffDays;
          else if (diffDays <= 7) overdueScore -= 8 * diffDays;
          else overdueScore -= 10 * diffDays;
        }
      }
    }
    overdueScore = Math.max(0, overdueScore);

    let responseScore = 100;
    const statusLogs = allLogs.filter((l) => l.action === "status_change" && l.old_value === "pending" && l.new_value === "active");
    const userStatusLogs = statusLogs.filter((l) => {
      const task = relevantTasks.find((t) => t.id === l.task_id);
      return task !== undefined;
    });
    if (userStatusLogs.length > 0) {
      let totalHours = 0;
      let count = 0;
      for (const log of userStatusLogs) {
        const task = allTasks.find((t) => t.id === log.task_id);
        if (task?.created_at && log.created_at) {
          const diff = new Date(log.created_at).getTime() - new Date(task.created_at).getTime();
          totalHours += diff / (1000 * 60 * 60);
          count++;
        }
      }
      if (count > 0) {
        const avgHours = totalHours / count;
        responseScore = Math.max(0, Math.round(100 - avgHours * 2));
      }
    }

    const urgeLogs = allLogs.filter((l) => l.action === "urge" && relevantTasks.some((t) => t.id === l.task_id));
    const collaborationScore = Math.max(0, 100 - urgeLogs.length * 15);

    const allSubtasks = userTasks.filter((t) => t.parent_id);
    let subtaskScore = 100;
    if (allSubtasks.length > 0) {
      const doneSubtasks = allSubtasks.filter((t) => t.status === "done").length;
      subtaskScore = Math.round((doneSubtasks / allSubtasks.length) * 100);
    }

    const autoScores = [
      { dimension: "timeliness", score: timelinessScore },
      { dimension: "overdue", score: overdueScore },
      { dimension: "response", score: responseScore },
      { dimension: "collaboration", score: collaborationScore },
      { dimension: "subtask", score: subtaskScore },
    ];

    for (const s of autoScores) {
      await storage.upsertEvalScore({
        period_id: periodId, user_id: targetUser.id, scorer_id: "system",
        scorer_role: "system", dimension: s.dimension, score: String(s.score),
        auto_calculated: true,
      });
    }
  }
}
