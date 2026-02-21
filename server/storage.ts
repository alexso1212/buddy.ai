import {
  type User,
  type Phase,
  type Task,
  type TaskLog,
  users,
  phases,
  tasks,
  task_assignees,
  task_logs,
} from "@shared/schema";
import { eq, inArray, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Pool from "pg";

export interface IStorage {
  getUserById(id: string): Promise<User | undefined>;
  getUserByInviteCode(code: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: {
    id: string;
    name: string;
    title?: string;
    dept?: string;
    role: string;
    invite_code: string;
    color?: string;
  }): Promise<User>;

  getAllPhases(): Promise<Phase[]>;
  upsertPhase(phase: {
    id: string;
    label: string;
    date_range?: string;
    color?: string;
    sort_order?: number;
  }): Promise<Phase>;

  getTaskById(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getTasksByUserId(userId: string): Promise<Task[]>;
  getTasksByDept(deptNames: string[]): Promise<Task[]>;
  createTask(task: {
    id: string;
    title: string;
    description?: string;
    phase?: string;
    deadline: string;
    grace_deadline?: string;
    deliverable?: string;
    reviewer_id?: string;
    feishu_link?: string;
    status?: string;
    priority?: number;
    parent_id?: string;
    depends_on?: string;
    sort_order?: number;
    created_by?: string;
  }): Promise<Task>;
  updateTask(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      status: string;
      priority: number;
      deadline: string;
      grace_deadline: string;
      feishu_link: string;
      deliverable: string;
      reviewer_id: string;
      completed_at: Date | null;
      updated_at: Date;
    }>
  ): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  getAssigneesForTask(taskId: string): Promise<User[]>;
  getAssigneesForTasks(taskIds: string[]): Promise<Record<string, User[]>>;
  addAssignee(taskId: string, userId: string): Promise<void>;
  removeAssignees(taskId: string): Promise<void>;

  addLog(log: {
    task_id?: string;
    user_id?: string;
    action: string;
    old_value?: string;
    new_value?: string;
  }): Promise<TaskLog>;
  getLogsForTask(taskId: string): Promise<TaskLog[]>;
  getRecentSyncLogs(limit: number): Promise<TaskLog[]>;
}

const pool = new Pool.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export class DatabaseStorage implements IStorage {
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByInviteCode(code: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.invite_code, code));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async upsertUser(user: {
    id: string;
    name: string;
    title?: string;
    dept?: string;
    role: string;
    invite_code: string;
    color?: string;
  }): Promise<User> {
    const [result] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: user.name,
          title: user.title,
          dept: user.dept,
          role: user.role,
          invite_code: user.invite_code,
          color: user.color,
        },
      })
      .returning();
    return result;
  }

  async getAllPhases(): Promise<Phase[]> {
    return db.select().from(phases);
  }

  async upsertPhase(phase: {
    id: string;
    label: string;
    date_range?: string;
    color?: string;
    sort_order?: number;
  }): Promise<Phase> {
    const [result] = await db
      .insert(phases)
      .values(phase)
      .onConflictDoUpdate({
        target: phases.id,
        set: {
          label: phase.label,
          date_range: phase.date_range,
          color: phase.color,
          sort_order: phase.sort_order,
        },
      })
      .returning();
    return result;
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks);
  }

  async getTasksByUserId(userId: string): Promise<Task[]> {
    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(task_assignees, eq(tasks.id, task_assignees.task_id))
      .where(eq(task_assignees.user_id, userId));
    return rows.map((r) => r.task);
  }

  async getTasksByDept(deptNames: string[]): Promise<Task[]> {
    if (deptNames.length === 0) return [];
    const rows = await db
      .selectDistinct({ task: tasks })
      .from(tasks)
      .innerJoin(task_assignees, eq(tasks.id, task_assignees.task_id))
      .innerJoin(users, eq(task_assignees.user_id, users.id))
      .where(inArray(users.dept, deptNames));
    return rows.map((r) => r.task);
  }

  async createTask(task: {
    id: string;
    title: string;
    description?: string;
    phase?: string;
    deadline: string;
    grace_deadline?: string;
    deliverable?: string;
    reviewer_id?: string;
    feishu_link?: string;
    status?: string;
    priority?: number;
    parent_id?: string;
    depends_on?: string;
    sort_order?: number;
    created_by?: string;
  }): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async updateTask(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      status: string;
      priority: number;
      deadline: string;
      grace_deadline: string;
      feishu_link: string;
      deliverable: string;
      reviewer_id: string;
      completed_at: Date | null;
      updated_at: Date;
    }>
  ): Promise<Task | undefined> {
    const [result] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return result;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getAssigneesForTask(taskId: string): Promise<User[]> {
    const rows = await db
      .select({ user: users })
      .from(task_assignees)
      .innerJoin(users, eq(task_assignees.user_id, users.id))
      .where(eq(task_assignees.task_id, taskId));
    return rows.map((r) => r.user);
  }

  async getAssigneesForTasks(
    taskIds: string[]
  ): Promise<Record<string, User[]>> {
    if (taskIds.length === 0) return {};
    const rows = await db
      .select({
        task_id: task_assignees.task_id,
        user: users,
      })
      .from(task_assignees)
      .innerJoin(users, eq(task_assignees.user_id, users.id))
      .where(inArray(task_assignees.task_id, taskIds));
    const result: Record<string, User[]> = {};
    for (const row of rows) {
      if (!result[row.task_id]) {
        result[row.task_id] = [];
      }
      result[row.task_id].push(row.user);
    }
    return result;
  }

  async addAssignee(taskId: string, userId: string): Promise<void> {
    await db
      .insert(task_assignees)
      .values({ task_id: taskId, user_id: userId })
      .onConflictDoUpdate({
        target: [task_assignees.task_id, task_assignees.user_id],
        set: { user_id: userId },
      });
  }

  async removeAssignees(taskId: string): Promise<void> {
    await db
      .delete(task_assignees)
      .where(eq(task_assignees.task_id, taskId));
  }

  async addLog(log: {
    task_id?: string;
    user_id?: string;
    action: string;
    old_value?: string;
    new_value?: string;
  }): Promise<TaskLog> {
    const [result] = await db.insert(task_logs).values(log).returning();
    return result;
  }

  async getLogsForTask(taskId: string): Promise<TaskLog[]> {
    return db
      .select()
      .from(task_logs)
      .where(eq(task_logs.task_id, taskId));
  }

  async getRecentSyncLogs(limit: number): Promise<TaskLog[]> {
    return db
      .select()
      .from(task_logs)
      .where(eq(task_logs.action, "sync"))
      .orderBy(desc(task_logs.created_at))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
