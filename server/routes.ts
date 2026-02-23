import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { chat as aiChat, generateProjectTasks } from "./services/ai/index";
import { executeAction } from "./services/ai/actionExecutor";
import {
  insertOrganizationSchema,
  insertDepartmentSchema,
  insertUserSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertTaskDependencySchema,
  insertTaskCommentSchema,
  insertTaskParticipantSchema,
  insertJobRoleSchema,
  insertConversationSchema,
  insertChatMessageSchema,
} from "@shared/schema";
import { judgeTaskAssignment } from "./services/ai/verdictService";

function getActivityUserId(body: any, fallback: number = 1): number {
  return body?.userId ?? body?.creatorId ?? fallback;
}

export async function registerRoutes(server: Server, app: Express) {
  async function generateTeamNotifications(
    triggeredByUserId: number,
    entityType: 'task' | 'project',
    entityId: number,
    entityTitle: string,
    orgId: number,
    type: string,
    message: string
  ) {
    const recipientIds = new Set<number>();

    if (entityType === 'task') {
      const task = await storage.getTaskById(entityId);
      if (task) {
        if (task.assigneeId && task.assigneeId !== triggeredByUserId) recipientIds.add(task.assigneeId);
        if (task.creatorId !== triggeredByUserId) recipientIds.add(task.creatorId);
        const participants = await storage.getTaskParticipants(entityId);
        for (const p of participants) {
          if (p.userId !== triggeredByUserId) recipientIds.add(p.userId);
        }
      }
    } else if (entityType === 'project') {
      const project = await storage.getProjectById(entityId);
      if (project) {
        if (project.ownerId !== triggeredByUserId) recipientIds.add(project.ownerId);
        const projectTasks = await storage.getTasks({ projectId: entityId });
        for (const t of projectTasks) {
          if (t.assigneeId && t.assigneeId !== triggeredByUserId) recipientIds.add(t.assigneeId);
          if (t.creatorId !== triggeredByUserId) recipientIds.add(t.creatorId);
        }
      }
    }

    // Team vs Personal: Only notify superiors if there are already other recipients
    // (meaning it's a team event, not a purely personal task)
    if (recipientIds.size > 0) {
      const triggerUser = await storage.getUserById(triggeredByUserId);
      if (triggerUser && triggerUser.deptId) {
        const allUsers = await storage.getUsers();
        const heads = allUsers.filter(u => u.deptId === triggerUser.deptId && (u.role === 'head' || u.role === 'admin' || u.role === 'owner') && u.id !== triggeredByUserId);
        for (const h of heads) {
          recipientIds.add(h.id);
        }
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggeredByUserId);
        for (const o of ownerUsers) {
          recipientIds.add(o.id);
        }
      }
    }

    if (recipientIds.size === 0) return;

    const notificationData = Array.from(recipientIds).map(userId => ({
      orgId,
      userId,
      type,
      entityType,
      entityId,
      entityTitle,
      message,
      triggeredBy: triggeredByUserId,
      isRead: false,
    }));

    await storage.createManyNotifications(notificationData);
  }

  // ===================== Organizations =====================
  app.get("/api/organizations", async (_req, res) => {
    try {
      const data = await storage.getOrganizations();
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/organizations", async (req, res) => {
    try {
      const parsed = insertOrganizationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const org = await storage.createOrganization(parsed.data);
      await storage.createActivityLog({
        orgId: org.id,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "organization",
        entityId: org.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: org });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Departments =====================
  app.get("/api/departments", async (_req, res) => {
    try {
      const data = await storage.getDepartments();
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const parsed = insertDepartmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const dept = await storage.createDepartment(parsed.data);
      await storage.createActivityLog({
        orgId: dept.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: dept.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: dept });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/departments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDepartmentById(id);
      if (!existing) return res.status(404).json({ error: "Department not found" });
      const updated = await storage.updateDepartment(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDepartmentById(id);
      if (!existing) return res.status(404).json({ error: "Department not found" });
      await storage.deleteDepartment(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "department",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, name: existing.name }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Users =====================
  app.get("/api/users", async (_req, res) => {
    try {
      const data = await storage.getUsers();
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const user = await storage.createUser(parsed.data);
      await storage.createActivityLog({
        orgId: user.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: user.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: user });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const updated = await storage.deleteUser(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, displayName: existing.displayName }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Projects =====================
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      const users = await storage.getUsers();
      const data = projects.map(p => ({ ...p, owner: users.find(u => u.id === p.ownerId) || null }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProjectById(id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const tasks = await storage.getTasks({ projectId: id });
      return res.json({ data: { ...project, tasks } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const project = await storage.createProject(parsed.data);
      await storage.createActivityLog({
        orgId: project.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "project",
        entityId: project.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: project });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });
      const updated = await storage.updateProject(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "project",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      if (req.body.status && req.body.status !== existing.status) {
        const triggerUserId = getActivityUserId(req.body, req.currentUserId);
        const triggerUser = await storage.getUserById(triggerUserId);
        const triggerName = triggerUser?.displayName || '某人';
        const statusLabels: Record<string, string> = {
          active: '进行中', paused: '已暂停', completed: '已完成', archived: '已归档'
        };
        const newStatusLabel = statusLabels[req.body.status] || req.body.status;
        await generateTeamNotifications(
          triggerUserId, 'project', id, existing.name, existing.orgId,
          req.body.status === 'completed' ? 'completed' : 'status_change',
          `${triggerName} 将项目「${existing.name}」状态更改为「${newStatusLabel}」`
        );
      }
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });

      const triggerUserId = getActivityUserId(req.body, req.currentUserId);
      const recipientIds = new Set<number>();
      if (existing.ownerId !== triggerUserId) recipientIds.add(existing.ownerId);
      const projectTasks = await storage.getTasks({ projectId: id });
      for (const t of projectTasks) {
        if (t.assigneeId && t.assigneeId !== triggerUserId) recipientIds.add(t.assigneeId);
        if (t.creatorId !== triggerUserId) recipientIds.add(t.creatorId);
      }
      const triggerUser = await storage.getUserById(triggerUserId);
      if (triggerUser && recipientIds.size > 0) {
        const allUsers = await storage.getUsers();
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggerUserId);
        for (const o of ownerUsers) recipientIds.add(o.id);
      }

      await storage.deleteProject(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: triggerUserId,
        entityType: "project",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, name: existing.name }),
        source: "manual",
      });

      if (recipientIds.size > 0) {
        const triggerName = triggerUser?.displayName || '某人';
        const notifs = Array.from(recipientIds).map(userId => ({
          orgId: existing.orgId,
          userId,
          type: 'deleted' as const,
          entityType: 'project' as const,
          entityId: id,
          entityTitle: existing.name,
          message: `${triggerName} 删除了项目「${existing.name}」`,
          triggeredBy: triggerUserId,
          isRead: false,
        }));
        await storage.createManyNotifications(notifs);
      }

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Tasks =====================
  app.get("/api/tasks", async (req, res) => {
    try {
      const filters: { projectId?: number; assigneeId?: number; status?: string[]; parentTaskId?: number | null } = {};

      if (req.query.projectId) filters.projectId = parseInt(req.query.projectId as string);
      if (req.query.assigneeId) filters.assigneeId = parseInt(req.query.assigneeId as string);
      if (req.query.status) filters.status = (req.query.status as string).split(",");
      if (req.query.parentTaskId !== undefined) {
        const val = req.query.parentTaskId as string;
        filters.parentTaskId = val === "null" ? null : parseInt(val);
      }

      const tasksData = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
      const taskIds = tasksData.map(t => t.id);
      const allParticipants = await storage.getTaskParticipantsByTaskIds(taskIds);
      const allUsers = await storage.getUsers();
      const data = tasksData.map(t => ({
        ...t,
        participants: allParticipants
          .filter(p => p.taskId === t.id)
          .map(p => ({ ...p, user: allUsers.find(u => u.id === p.userId) || null })),
      }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      const [subtasks, dependencies, comments, participantsRaw] = await Promise.all([
        storage.getTasks({ parentTaskId: id }),
        storage.getTaskDependencies(id),
        storage.getTaskComments(id),
        storage.getTaskParticipants(id),
      ]);
      const allUsers = await storage.getUsers();
      const participants = participantsRaw.map(p => ({
        ...p,
        user: allUsers.find(u => u.id === p.userId) || null,
      }));
      return res.json({ data: { ...task, subtasks, dependencies, comments, participants } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const parsed = insertTaskSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const task = await storage.createTask(parsed.data);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: task.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: task });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });
      const updated = await storage.updateTask(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      if (req.body.status && req.body.status !== existing.status) {
        const triggerUserId = getActivityUserId(req.body, req.currentUserId);
        const statusLabels: Record<string, string> = {
          todo: '待办', in_progress: '进行中', in_review: '审核中', done: '已完成', cancelled: '已取消'
        };
        const newStatusLabel = statusLabels[req.body.status] || req.body.status;
        const triggerUser = await storage.getUserById(triggerUserId);
        const triggerName = triggerUser?.displayName || '某人';
        await generateTeamNotifications(
          triggerUserId, 'task', id, existing.title, existing.orgId,
          req.body.status === 'done' ? 'completed' : 'status_change',
          `${triggerName} 将任务「${existing.title}」状态更改为「${newStatusLabel}」`
        );
      }
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });

      const triggerUserId = getActivityUserId(req.body, req.currentUserId);
      const participants = await storage.getTaskParticipants(id);
      const recipientIds = new Set<number>();
      if (existing.assigneeId && existing.assigneeId !== triggerUserId) recipientIds.add(existing.assigneeId);
      if (existing.creatorId !== triggerUserId) recipientIds.add(existing.creatorId);
      for (const p of participants) {
        if (p.userId !== triggerUserId) recipientIds.add(p.userId);
      }
      const triggerUser = await storage.getUserById(triggerUserId);
      if (triggerUser && recipientIds.size > 0) {
        const allUsers = await storage.getUsers();
        const ownerUsers = allUsers.filter(u => u.role === 'owner' && u.id !== triggerUserId);
        for (const o of ownerUsers) recipientIds.add(o.id);
      }

      await storage.deleteTask(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: triggerUserId,
        entityType: "task",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, title: existing.title }),
        source: "manual",
      });

      if (recipientIds.size > 0) {
        const triggerName = triggerUser?.displayName || '某人';
        const notifs = Array.from(recipientIds).map(userId => ({
          orgId: existing.orgId,
          userId,
          type: 'deleted' as const,
          entityType: 'task' as const,
          entityId: id,
          entityTitle: existing.title,
          message: `${triggerName} 删除了任务「${existing.title}」`,
          triggeredBy: triggerUserId,
          isRead: false,
        }));
        await storage.createManyNotifications(notifs);
      }

      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Dependencies =====================
  app.get("/api/tasks/:id/dependencies", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getTaskDependencies(id);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/task-dependencies", async (req, res) => {
    try {
      const parsed = insertTaskDependencySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const dep = await storage.createTaskDependency(parsed.data);
      const task = await storage.getTaskById(dep.taskId);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_dependency",
        entityId: dep.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: dep });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/task-dependencies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTaskById(id);
      await storage.deleteTaskDependency(id);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_dependency",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Comments =====================
  app.get("/api/tasks/:id/comments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getTaskComments(id);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/comments", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const body = { ...req.body, taskId };
      const parsed = insertTaskCommentSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const comment = await storage.createTaskComment(parsed.data);
      const task = await storage.getTaskById(taskId);
      await storage.createActivityLog({
        orgId: task?.orgId ?? req.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task_comment",
        entityId: comment.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: comment });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Task Participants =====================
  app.get("/api/tasks/:id/participants", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const participants = await storage.getTaskParticipants(taskId);
      const users = await storage.getUsers();
      const data = participants.map(p => ({
        ...p,
        user: users.find(u => u.id === p.userId) || null,
      }));
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/participants", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const parsed = insertTaskParticipantSchema.safeParse({ ...req.body, taskId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const participant = await storage.addTaskParticipant(parsed.data);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: taskId,
        action: "add_participant",
        changes: JSON.stringify({ userId: parsed.data.userId, role: parsed.data.role }),
        source: "manual",
      });
      return res.status(201).json({ data: participant });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:taskId/participants/:userId", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const userId = parseInt(req.params.userId);
      const task = await storage.getTaskById(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      await storage.removeTaskParticipantByTaskAndUser(taskId, userId);
      await storage.createActivityLog({
        orgId: task.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "task",
        entityId: taskId,
        action: "remove_participant",
        changes: JSON.stringify({ userId }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Activity Logs =====================
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const filters: { entityType?: string; entityId?: number } = {};
      if (req.query.entityType) filters.entityType = req.query.entityType as string;
      if (req.query.entityId) filters.entityId = parseInt(req.query.entityId as string);
      const data = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Graph Visualization =====================
  app.get("/api/graph/data", async (req, res) => {
    try {
      const { projectId, deptId, status } = req.query;

      const projectColors = [
        '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
      ];

      // Get all tasks with filters
      const taskFilters: any = {};
      if (projectId) taskFilters.projectId = parseInt(projectId as string);
      if (status) {
        // status is comma-separated
      }

      const allTasks = await storage.getTasks(taskFilters);
      
      // Get all projects for color mapping
      const allProjects = await storage.getProjects();
      const projectMap = new Map(allProjects.map(p => [p.id, p]));

      // Get all users for assignee names
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      // Get all dependencies
      const allDeps = await storage.getAllTaskDependencies();

      // Filter by status if provided
      const statusFilter = status ? (status as string).split(',') : null;

      // Filter: only top-level tasks (parentTaskId === null), apply filters
      let filteredTasks = allTasks.filter(t => t.parentTaskId === null);
      if (deptId) {
        const deptIdNum = parseInt(deptId as string);
        const projectsInDept = allProjects.filter(p => p.deptId === deptIdNum).map(p => p.id);
        filteredTasks = filteredTasks.filter(t => projectsInDept.includes(t.projectId));
      }
      if (statusFilter) {
        filteredTasks = filteredTasks.filter(t => statusFilter.includes(t.status));
      }

      // Check which tasks have subtasks
      const tasksWithSubtasks = new Set(
        allTasks.filter(t => t.parentTaskId !== null).map(t => t.parentTaskId)
      );

      const now = new Date();
      const filteredIds = new Set(filteredTasks.map(t => t.id));

      const nodes = filteredTasks.map(t => {
        const project = projectMap.get(t.projectId);
        const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          weight: t.weight,
          progress: t.progress,
          projectId: t.projectId,
          projectName: project?.name ?? '',
          deptId: project?.deptId ?? null,
          assigneeId: t.assigneeId,
          assigneeName: assignee?.displayName ?? null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isOverdue: !!(t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'),
          type: t.type,
          parentTaskId: t.parentTaskId,
          hasSubtasks: tasksWithSubtasks.has(t.id),
        };
      });

      // Build a map of task statuses for isBlocking calculation
      const taskStatusMap = new Map(allTasks.map(t => [t.id, t.status]));

      const links = allDeps
        .filter(d => filteredIds.has(d.taskId) && filteredIds.has(d.dependsOnTaskId))
        .map(d => ({
          source: d.dependsOnTaskId,
          target: d.taskId,
          type: d.type,
          isBlocking: taskStatusMap.get(d.dependsOnTaskId) !== 'done',
        }));

      const projectsUsed = Array.from(new Set(filteredTasks.map(t => t.projectId)));
      const projectsInfo = projectsUsed.map((pid, idx) => ({
        id: pid,
        name: projectMap.get(pid)?.name ?? '',
        color: projectColors[idx % projectColors.length],
      }));

      return res.json({ data: { nodes, links, projects: projectsInfo } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/graph/subtasks/:taskId", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const allTasks = await storage.getTasks({ parentTaskId: taskId });
      const allProjects = await storage.getProjects();
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const allDeps = await storage.getAllTaskDependencies();
      const allTasksAll = await storage.getTasks({});
      const tasksWithSubtasks = new Set(
        allTasksAll.filter(t => t.parentTaskId !== null).map(t => t.parentTaskId)
      );
      const now = new Date();
      const subtaskIds = new Set(allTasks.map(t => t.id));
      const taskStatusMap = new Map(allTasksAll.map(t => [t.id, t.status]));

      const nodes = allTasks.map(t => {
        const project = projectMap.get(t.projectId);
        const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          weight: t.weight,
          progress: t.progress,
          projectId: t.projectId,
          projectName: project?.name ?? '',
          deptId: project?.deptId ?? null,
          assigneeId: t.assigneeId,
          assigneeName: assignee?.displayName ?? null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isOverdue: !!(t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'),
          type: t.type,
          parentTaskId: t.parentTaskId,
          hasSubtasks: tasksWithSubtasks.has(t.id),
        };
      });

      const links = allDeps
        .filter(d => subtaskIds.has(d.taskId) && subtaskIds.has(d.dependsOnTaskId))
        .map(d => ({
          source: d.dependsOnTaskId,
          target: d.taskId,
          type: d.type,
          isBlocking: taskStatusMap.get(d.dependsOnTaskId) !== 'done',
        }));

      const projectColors = [
        '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
        '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
      ];
      const projectsUsed = Array.from(new Set(allTasks.map(t => t.projectId)));
      const projectsInfo = projectsUsed.map((pid, idx) => ({
        id: pid,
        name: projectMap.get(pid)?.name ?? '',
        color: projectColors[idx % projectColors.length],
      }));

      return res.json({ data: { nodes, links, projects: projectsInfo } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Job Roles =====================
  app.get("/api/job-roles", async (_req, res) => {
    try {
      const data = await storage.getJobRoles();
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-roles", async (req, res) => {
    try {
      const parsed = insertJobRoleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const role = await storage.createJobRole(parsed.data);
      await storage.createActivityLog({
        orgId: role.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: role.id,
        action: "create",
        changes: JSON.stringify(parsed.data),
        source: "manual",
      });
      return res.status(201).json({ data: role });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/job-roles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobRoleById(id);
      if (!existing) return res.status(404).json({ error: "Job role not found" });
      const updated = await storage.updateJobRole(id, req.body);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: id,
        action: "update",
        changes: JSON.stringify(req.body),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/job-roles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobRoleById(id);
      if (!existing) return res.status(404).json({ error: "Job role not found" });
      await storage.deleteJobRole(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "job_role",
        entityId: id,
        action: "delete",
        changes: JSON.stringify({ id, title: existing.title }),
        source: "manual",
      });
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id/job-role", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      const { jobRoleId } = req.body;
      const updated = await storage.updateUser(id, { jobRoleId });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "user",
        entityId: id,
        action: "assign_job_role",
        changes: JSON.stringify({ jobRoleId }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Verdicts =====================
  app.post("/api/verdicts/judge", async (req, res) => {
    try {
      const { taskId, userId, requestedBy } = req.body;
      if (!taskId || !userId) return res.status(400).json({ error: "taskId and userId are required" });

      const orgId = req.orgId;
      const reqUserId = requestedBy || req.currentUserId;
      const verdictResult = await judgeTaskAssignment(taskId, userId);

      const verdict = await storage.createVerdict({
        orgId,
        taskId,
        userId,
        verdict: verdictResult.verdict,
        confidence: verdictResult.confidence,
        reasoning: verdictResult.reasoning,
        matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
        suggestedAssignee: verdictResult.suggestedAssigneeId,
        suggestedReason: verdictResult.suggestedReason,
        requestedBy: reqUserId,
        status: 'completed',
      });

      if (verdictResult.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(verdictResult.tokenUsage.model, verdictResult.tokenUsage.promptTokens, verdictResult.tokenUsage.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: reqUserId,
            model: verdictResult.tokenUsage.model,
            promptTokens: verdictResult.tokenUsage.promptTokens,
            completionTokens: verdictResult.tokenUsage.completionTokens,
            totalTokens: verdictResult.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'verdict',
          });
        } catch (tokenErr) {
          console.error('Failed to record verdict token usage:', tokenErr);
        }
      }

      const suggestedUser = verdictResult.suggestedAssigneeId
        ? await storage.getUserById(verdictResult.suggestedAssigneeId)
        : null;

      await storage.createActivityLog({
        orgId,
        userId: reqUserId,
        entityType: "verdict",
        entityId: verdict.id,
        action: "judge",
        changes: JSON.stringify({ taskId, userId, verdict: verdictResult.verdict }),
        source: "system",
      });

      return res.json({
        data: {
          verdict: {
            id: verdict.id,
            verdict: verdict.verdict,
            confidence: verdict.confidence,
            reasoning: verdict.reasoning,
            matchedResponsibilities: verdictResult.matchedResponsibilities,
            suggestedAssignee: suggestedUser ? {
              id: suggestedUser.id,
              name: suggestedUser.displayName,
              reason: verdictResult.suggestedReason,
            } : undefined,
          },
        },
      });
    } catch (e: any) {
      console.error('Verdict judge error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/verdicts/judge-assignment", async (req, res) => {
    try {
      const { taskId, userId, requestedBy } = req.body;
      if (!taskId || !userId) return res.status(400).json({ error: "taskId and userId are required" });

      const orgId = req.orgId;
      const reqUserId = requestedBy || req.currentUserId;
      const verdictResult = await judgeTaskAssignment(taskId, userId);

      const verdict = await storage.createVerdict({
        orgId,
        taskId,
        userId,
        verdict: verdictResult.verdict,
        confidence: verdictResult.confidence,
        reasoning: verdictResult.reasoning,
        matchedResponsibilities: JSON.stringify(verdictResult.matchedResponsibilities),
        suggestedAssignee: verdictResult.suggestedAssigneeId,
        suggestedReason: verdictResult.suggestedReason,
        requestedBy: reqUserId,
        status: 'completed',
      });

      if (verdictResult.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(verdictResult.tokenUsage.model, verdictResult.tokenUsage.promptTokens, verdictResult.tokenUsage.completionTokens);
        try {
          await storage.createTokenUsage({
            orgId,
            userId: reqUserId,
            model: verdictResult.tokenUsage.model,
            promptTokens: verdictResult.tokenUsage.promptTokens,
            completionTokens: verdictResult.tokenUsage.completionTokens,
            totalTokens: verdictResult.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'verdict',
          });
        } catch (tokenErr) {
          console.error('Failed to record verdict token usage:', tokenErr);
        }
      }

      return res.json({ data: verdict });
    } catch (e: any) {
      console.error('Verdict judge-assignment error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/task/:taskId", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = await storage.getVerdictsByTaskId(taskId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const data = await storage.getVerdictsByUserId(userId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/verdicts/:id/accept", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVerdictById(id);
      if (!existing) return res.status(404).json({ error: "Verdict not found" });
      const updated = await storage.updateVerdict(id, { status: 'accepted' });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "verdict",
        entityId: id,
        action: "accept",
        changes: JSON.stringify({ status: 'accepted' }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/verdicts/:id/override", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVerdictById(id);
      if (!existing) return res.status(404).json({ error: "Verdict not found" });
      const { overrideReason } = req.body;
      if (!overrideReason) return res.status(400).json({ error: "overrideReason is required" });
      const updated = await storage.updateVerdict(id, { status: 'overridden', overrideReason });
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body, req.currentUserId),
        entityType: "verdict",
        entityId: id,
        action: "override",
        changes: JSON.stringify({ status: 'overridden', overrideReason }),
        source: "manual",
      });
      return res.json({ data: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verdicts/stats", async (req, res) => {
    try {
      const allVerdicts = await storage.getAllVerdicts();
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const statsByUser: Record<number, { displayName: string; in_scope: number; stretch: number; out_of_scope: number; shared: number; total: number }> = {};

      for (const v of allVerdicts) {
        if (!statsByUser[v.userId]) {
          const user = userMap.get(v.userId);
          statsByUser[v.userId] = {
            displayName: user?.displayName ?? 'Unknown',
            in_scope: 0,
            stretch: 0,
            out_of_scope: 0,
            shared: 0,
            total: 0,
          };
        }
        const s = statsByUser[v.userId];
        if (v.verdict === 'in_scope') s.in_scope++;
        else if (v.verdict === 'stretch') s.stretch++;
        else if (v.verdict === 'out_of_scope') s.out_of_scope++;
        else if (v.verdict === 'shared') s.shared++;
        s.total++;
      }

      return res.json({ data: Object.entries(statsByUser).map(([userId, stats]) => ({ userId: parseInt(userId), ...stats })) });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Notifications =====================
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || req.currentUserId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const data = await storage.getNotificationsByUserId(userId, limit);
      const allUsers = await storage.getUsers();
      const enriched = data.map(n => ({
        ...n,
        triggeredByUser: allUsers.find(u => u.id === n.triggeredBy) || null,
      }));
      return res.json({ data: enriched });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string) || req.currentUserId;
      const count = await storage.getUnreadNotificationCount(userId);
      return res.json({ data: { count } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationRead(id);
      return res.json({ data: notification });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.body.userId || req.currentUserId;
      await storage.markAllNotificationsRead(userId);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Stats Overview =====================
  app.get("/api/stats/overview", async (req, res) => {
    try {
      const tasks = await storage.getTasks({});
      const now = new Date();

      const totalTasks = tasks.length;
      const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
      const completedCount = tasks.filter(t => t.status === "done").length;
      const overdueCount = tasks.filter(t => {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < now;
      }).length;
      const needsReviewCount = tasks.filter(t => t.needsReview).length;

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(todayStart);
      const dayOfWeek = weekStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - mondayOffset);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayNew = tasks.filter(t => new Date(t.createdAt) >= todayStart).length;
      const weekNew = tasks.filter(t => new Date(t.createdAt) >= weekStart).length;
      const monthNew = tasks.filter(t => new Date(t.createdAt) >= monthStart).length;

      return res.json({
        data: {
          totalTasks,
          inProgressCount,
          completedCount,
          overdueCount,
          needsReviewCount,
          todayNew,
          weekNew,
          monthNew,
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Conversations =====================
  app.get("/api/conversations", async (req, res) => {
    try {
      const data = await storage.getConversationsByOrg(req.orgId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/conversations/search", async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json({ data: [] });
      const data = await storage.searchConversations(req.orgId, q);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getConversationById(id);
      if (!data) return res.status(404).json({ error: "Conversation not found" });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const parsed = insertConversationSchema.parse(req.body);
      const data = await storage.createConversation(parsed);
      return res.json({ data });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.updateConversation(id, req.body);
      if (!data) return res.status(404).json({ error: "Conversation not found" });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      return res.json({ data: { success: true } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Chat Messages =====================
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const data = await storage.getChatMessages(conversationId);
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messageData = { ...req.body, conversationId };
      const parsed = insertChatMessageSchema.parse(messageData);
      const data = await storage.createChatMessage(parsed);
      return res.json({ data });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  // ===================== AI Guided Options =====================
  app.get("/api/ai/guided-options", async (req, res) => {
    try {
      const { type, projectId } = req.query;

      if (type === 'parentTasks' && projectId) {
        const tasks = await storage.getTasks({ projectId: Number(projectId) });
        const topLevelTasks = tasks.filter(t => !t.parentTaskId && t.status !== 'cancelled');
        const options = topLevelTasks.map(t => ({
          label: t.title,
          value: t.id,
          description: `${t.status} | 优先级: ${t.priority}`,
        }));
        return res.json({ data: options });
      }

      if (type === 'departments') {
        const departments = await storage.getDepartments();
        const options = departments.map(d => ({
          label: d.name,
          value: d.id,
        }));
        return res.json({ data: options });
      }

      if (type === 'users') {
        const users = await storage.getUsers();
        const jobRoles = await storage.getJobRoles();
        const roleMap = new Map(jobRoles.map(r => [r.id, r]));
        const options = users.filter(u => u.isActive).map(u => {
          const role = u.jobRoleId ? roleMap.get(u.jobRoleId) : null;
          return {
            label: u.displayName,
            value: u.id,
            description: role?.title || '',
          };
        });
        return res.json({ data: options });
      }

      if (type === 'projects') {
        const projects = await storage.getProjects();
        const options = projects.filter(p => p.status !== 'cancelled').map(p => ({
          label: p.name,
          value: p.id,
          description: p.status,
        }));
        return res.json({ data: options });
      }

      return res.status(400).json({ error: 'Invalid type parameter' });
    } catch (e: any) {
      console.error('Guided options error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Decompose Project =====================
  app.post("/api/ai/decompose-project", async (req, res) => {
    try {
      const { projectName, projectDescription } = req.body;
      if (!projectName) {
        return res.status(400).json({ error: 'projectName is required' });
      }

      const userId = req.currentUserId;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';

      const result = await generateProjectTasks(projectName, projectDescription || '', {
        currentUserId: userId,
        currentUserName: userName,
      });

      if (result.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(
          result.tokenUsage.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens
        );
        try {
          await storage.createTokenUsage({
            orgId: req.orgId,
            userId,
            conversationId: null,
            model: result.tokenUsage.model,
            promptTokens: result.tokenUsage.promptTokens,
            completionTokens: result.tokenUsage.completionTokens,
            totalTokens: result.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'chat',
          });
        } catch (tokenErr) {
          console.error('Failed to record token usage:', tokenErr);
        }
      }

      return res.json({ data: result.tasks });
    } catch (e: any) {
      console.error('Project decompose error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== AI Chat =====================
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, conversationHistory, conversationId, currentUserId, systemPrompt, model } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      const orgId = req.orgId;
      const userId = currentUserId || req.currentUserId;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';

      let activeConvId = conversationId || null;

      if (!activeConvId) {
        const title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        const newConv = await storage.createConversation({
          title,
          orgId,
          userId,
        });
        activeConvId = newConv.id;
      }

      let history = conversationHistory || [];
      if (activeConvId && history.length === 0) {
        const conv = await storage.getConversationById(activeConvId);
        if (conv && conv.orgId !== orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        const dbMessages = await storage.getChatMessages(activeConvId);
        history = dbMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      }

      const result = await aiChat(
        message,
        history,
        { currentUserId: userId, currentUserName: userName, customSystemPrompt: systemPrompt || undefined, model: model || undefined }
      );

      if (result.tokenUsage) {
        const { calculateCost } = await import('./services/ai/tokenCost');
        const cost = calculateCost(
          result.tokenUsage.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens
        );
        try {
          await storage.createTokenUsage({
            orgId,
            userId,
            conversationId: activeConvId || null,
            model: result.tokenUsage.model,
            promptTokens: result.tokenUsage.promptTokens,
            completionTokens: result.tokenUsage.completionTokens,
            totalTokens: result.tokenUsage.totalTokens,
            costUsd: cost,
            purpose: 'chat',
          });
        } catch (tokenErr) {
          console.error('Failed to record token usage:', tokenErr);
        }
      }

      return res.json({ data: { ...result, conversationId: activeConvId } });
    } catch (e: any) {
      console.error('AI Chat error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai/confirm", async (req, res) => {
    try {
      const { actionType, data, currentUserId, conversationId } = req.body;
      if (!actionType || !data) {
        return res.status(400).json({ error: 'actionType and data are required' });
      }

      const userId = currentUserId || req.currentUserId;
      const result = await executeAction(actionType, data, userId);

      if (conversationId) {
        const conv = await storage.getConversationById(conversationId);
        if (conv && conv.orgId !== req.orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        try {
          const summaryParts = [];
          if (actionType === 'create_task') summaryParts.push(`创建任务「${data.title || ''}」`);
          else if (actionType === 'update_task') summaryParts.push(`更新任务 #${data.id || ''}`);
          else if (actionType === 'create_project') summaryParts.push(`创建项目「${data.name || ''}」`);
          else if (actionType === 'add_comment') summaryParts.push(`添加评论`);
          else summaryParts.push(`执行操作: ${actionType}`);

          await storage.createChatMessage({
            conversationId,
            role: 'system',
            content: `[操作已执行] ${summaryParts.join('，')}`,
            type: 'action_result',
            metadata: JSON.stringify({ actionType, result }),
          });
        } catch (msgErr) {
          console.error('Failed to save system message:', msgErr);
        }
      }

      return res.json({ data: result });
    } catch (e: any) {
      console.error('AI Confirm error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ===================== Token Usage Stats =====================
  app.get("/api/token-usage/stats", async (req, res) => {
    try {
      const orgId = req.orgId;
      const period = (req.query.period as string) || '30d';

      let since: Date | undefined;
      const now = new Date();
      if (period === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (period === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (period === '90d') since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const stats = await storage.getTokenUsageStats(orgId, since);
      return res.json({ data: stats });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}
