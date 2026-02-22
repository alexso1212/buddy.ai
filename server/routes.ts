import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import {
  insertOrganizationSchema,
  insertDepartmentSchema,
  insertUserSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertTaskDependencySchema,
  insertTaskCommentSchema,
} from "@shared/schema";

function getActivityUserId(body: any): number {
  return body?.userId ?? body?.creatorId ?? 1;
}

export async function registerRoutes(server: Server, app: Express) {
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
        entityType: "project",
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

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProjectById(id);
      if (!existing) return res.status(404).json({ error: "Project not found" });
      await storage.deleteProject(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body),
        entityType: "project",
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

      const data = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
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
      const [subtasks, dependencies, comments] = await Promise.all([
        storage.getTasks({ parentTaskId: id }),
        storage.getTaskDependencies(id),
        storage.getTaskComments(id),
      ]);
      return res.json({ data: { ...task, subtasks, dependencies, comments } });
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
        userId: getActivityUserId(req.body),
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
        userId: getActivityUserId(req.body),
        entityType: "task",
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

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });
      await storage.deleteTask(id);
      await storage.createActivityLog({
        orgId: existing.orgId,
        userId: getActivityUserId(req.body),
        entityType: "task",
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
        orgId: task?.orgId ?? 1,
        userId: getActivityUserId(req.body),
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
        orgId: task?.orgId ?? 1,
        userId: getActivityUserId(req.body),
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
        orgId: task?.orgId ?? 1,
        userId: getActivityUserId(req.body),
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
}
