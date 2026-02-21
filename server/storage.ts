import {
  type User,
  type Phase,
  type Task,
  type TaskLog,
  type Notification,
  type Comment,
  type EvalPeriod,
  type EvalScore,
  type EvalRule,
  type Attachment,
  type Department,
  type OrgChange,
  users,
  phases,
  tasks,
  task_assignees,
  task_logs,
  notifications,
  comments,
  eval_periods,
  eval_scores,
  eval_rules,
  attachments,
  departments,
  org_changes,
} from "@shared/schema";
import { eq, inArray, and, desc, sql, like, gte, lte, ne, count, asc, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Pool from "pg";

const pool = new Pool.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export class DatabaseStorage {
  // ---- Users ----
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByInviteCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.invite_code, code));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getActiveUsers(): Promise<User[]> {
    return db.select().from(users).where(ne(users.is_active, false));
  }

  async upsertUser(user: {
    id: string; name: string; title?: string; dept?: string; dept_id?: string; role: string; invite_code: string; color?: string; is_active?: boolean;
  }): Promise<User> {
    const [result] = await db.insert(users).values(user)
      .onConflictDoUpdate({ target: users.id, set: { name: user.name, title: user.title, dept: user.dept, dept_id: user.dept_id, role: user.role, invite_code: user.invite_code, color: user.color, is_active: user.is_active } })
      .returning();
    return result;
  }

  async updateUser(id: string, updates: Partial<{ name: string; title: string; dept_id: string; role: string; color: string; is_active: boolean; }>): Promise<User | undefined> {
    const [result] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result;
  }

  // ---- Departments ----
  async getAllDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(asc(departments.sort_order));
  }

  async getDepartmentById(id: string): Promise<Department | undefined> {
    const [result] = await db.select().from(departments).where(eq(departments.id, id));
    return result;
  }

  async createDepartment(dept: { id: string; name: string; color?: string; parent_id?: string; head_id?: string; sort_order?: number; }): Promise<Department> {
    const [result] = await db.insert(departments).values(dept).returning();
    return result;
  }

  async updateDepartment(id: string, updates: Partial<{ name: string; color: string; parent_id: string; head_id: string; sort_order: number; }>): Promise<Department | undefined> {
    const [result] = await db.update(departments).set(updates).where(eq(departments.id, id)).returning();
    return result;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getUsersByDeptId(deptId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.dept_id, deptId));
  }

  // ---- Org Changes ----
  async createOrgChange(change: {
    requested_by: string; change_type: string; target_type: string; target_id: string;
    old_value?: any; new_value?: any; status?: string;
  }): Promise<OrgChange> {
    const [result] = await db.insert(org_changes).values(change).returning();
    return result;
  }

  async getAllOrgChanges(): Promise<OrgChange[]> {
    return db.select().from(org_changes).orderBy(desc(org_changes.created_at));
  }

  async getPendingOrgChanges(): Promise<OrgChange[]> {
    return db.select().from(org_changes).where(eq(org_changes.status, "pending")).orderBy(desc(org_changes.created_at));
  }

  async getOrgChangeById(id: number): Promise<OrgChange | undefined> {
    const [result] = await db.select().from(org_changes).where(eq(org_changes.id, id));
    return result;
  }

  async updateOrgChange(id: number, updates: { status: string; reviewed_by?: string; review_note?: string; reviewed_at?: Date; }): Promise<OrgChange | undefined> {
    const [result] = await db.update(org_changes).set(updates).where(eq(org_changes.id, id)).returning();
    return result;
  }

  // ---- Phases ----
  async getAllPhases(): Promise<Phase[]> {
    return db.select().from(phases);
  }

  async upsertPhase(phase: {
    id: string; label: string; date_range?: string; color?: string; sort_order?: number;
  }): Promise<Phase> {
    const [result] = await db.insert(phases).values(phase)
      .onConflictDoUpdate({ target: phases.id, set: { label: phase.label, date_range: phase.date_range, color: phase.color, sort_order: phase.sort_order } })
      .returning();
    return result;
  }

  // ---- Tasks ----
  async getTaskById(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks);
  }

  async getTasksByUserId(userId: string): Promise<Task[]> {
    const rows = await db.select({ task: tasks }).from(tasks)
      .innerJoin(task_assignees, eq(tasks.id, task_assignees.task_id))
      .where(eq(task_assignees.user_id, userId));
    return rows.map((r) => r.task);
  }

  async getTasksByDept(deptNames: string[]): Promise<Task[]> {
    if (deptNames.length === 0) return [];
    const rows = await db.selectDistinct({ task: tasks }).from(tasks)
      .innerJoin(task_assignees, eq(tasks.id, task_assignees.task_id))
      .innerJoin(users, eq(task_assignees.user_id, users.id))
      .where(inArray(users.dept, deptNames));
    return rows.map((r) => r.task);
  }

  async createTask(task: {
    id: string; title: string; description?: string; phase?: string; deadline: string;
    grace_deadline?: string; deliverable?: string; reviewer_id?: string; feishu_link?: string;
    status?: string; priority?: number; parent_id?: string; depends_on?: string;
    sort_order?: number; created_by?: string;
  }): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async updateTask(id: string, updates: Partial<{
    title: string; description: string; status: string; priority: number;
    deadline: string; grace_deadline: string; feishu_link: string; deliverable: string;
    reviewer_id: string; completed_at: Date | null; updated_at: Date;
  }>): Promise<Task | undefined> {
    const [result] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    return result;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getSubtasks(parentId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.parent_id, parentId)).orderBy(asc(tasks.sort_order));
  }

  async getTasksDependingOn(taskId: string): Promise<Task[]> {
    return db.select().from(tasks).where(like(tasks.depends_on, `%${taskId}%`));
  }

  async getAssigneesForTask(taskId: string): Promise<User[]> {
    const rows = await db.select({ user: users }).from(task_assignees)
      .innerJoin(users, eq(task_assignees.user_id, users.id))
      .where(eq(task_assignees.task_id, taskId));
    return rows.map((r) => r.user);
  }

  async getAssigneesForTasks(taskIds: string[]): Promise<Record<string, User[]>> {
    if (taskIds.length === 0) return {};
    const rows = await db.select({ task_id: task_assignees.task_id, user: users })
      .from(task_assignees)
      .innerJoin(users, eq(task_assignees.user_id, users.id))
      .where(inArray(task_assignees.task_id, taskIds));
    const result: Record<string, User[]> = {};
    for (const row of rows) {
      if (!result[row.task_id]) result[row.task_id] = [];
      result[row.task_id].push(row.user);
    }
    return result;
  }

  async addAssignee(taskId: string, userId: string): Promise<void> {
    await db.insert(task_assignees).values({ task_id: taskId, user_id: userId })
      .onConflictDoUpdate({ target: [task_assignees.task_id, task_assignees.user_id], set: { user_id: userId } });
  }

  async removeAssignees(taskId: string): Promise<void> {
    await db.delete(task_assignees).where(eq(task_assignees.task_id, taskId));
  }

  async getAllTaskAssignees(): Promise<{ task_id: string; user_id: string }[]> {
    return db.select({ task_id: task_assignees.task_id, user_id: task_assignees.user_id }).from(task_assignees);
  }

  // ---- Task Logs ----
  async addLog(log: { task_id?: string; user_id?: string; action: string; old_value?: string; new_value?: string; }): Promise<TaskLog> {
    const [result] = await db.insert(task_logs).values(log).returning();
    return result;
  }

  async getLogsForTask(taskId: string): Promise<TaskLog[]> {
    return db.select().from(task_logs).where(eq(task_logs.task_id, taskId)).orderBy(desc(task_logs.created_at));
  }

  async getAllTaskLogs(): Promise<TaskLog[]> {
    return db.select().from(task_logs);
  }

  async getRecentLogs(limit: number): Promise<TaskLog[]> {
    return db.select().from(task_logs).orderBy(desc(task_logs.created_at)).limit(limit);
  }

  async getRecentSyncLogs(limit: number): Promise<TaskLog[]> {
    return db.select().from(task_logs).where(eq(task_logs.action, "sync")).orderBy(desc(task_logs.created_at)).limit(limit);
  }

  async getUrgeCountForTask(taskId: string): Promise<number> {
    const result = await db.select({ cnt: count() }).from(task_logs)
      .where(and(eq(task_logs.task_id, taskId), eq(task_logs.action, "urge")));
    return Number(result[0]?.cnt ?? 0);
  }

  async getLastUrgeForTask(taskId: string): Promise<TaskLog | undefined> {
    const [result] = await db.select().from(task_logs)
      .where(and(eq(task_logs.task_id, taskId), eq(task_logs.action, "urge")))
      .orderBy(desc(task_logs.created_at)).limit(1);
    return result;
  }

  // ---- Notifications ----
  async createNotification(n: { user_id: string; task_id?: string; type: string; title: string; content?: string; }): Promise<Notification> {
    const [result] = await db.insert(notifications).values(n).returning();
    return result;
  }

  async getNotificationsForUser(userId: string, limit = 50): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.user_id, userId)).orderBy(desc(notifications.created_at)).limit(limit);
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    const result = await db.select({ cnt: count() }).from(notifications)
      .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
    return Number(result[0]?.cnt ?? 0);
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ is_read: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ is_read: true }).where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
  }

  async hasNotificationToday(userId: string, taskId: string, type: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db.select({ cnt: count() }).from(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        eq(notifications.task_id, taskId),
        eq(notifications.type, type),
        gte(notifications.created_at, today),
      ));
    return Number(result[0]?.cnt ?? 0) > 0;
  }

  async hasLogToday(taskId: string, action: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db.select({ cnt: count() }).from(task_logs)
      .where(and(
        eq(task_logs.task_id, taskId),
        eq(task_logs.action, action),
        gte(task_logs.created_at, today),
      ));
    return Number(result[0]?.cnt ?? 0) > 0;
  }

  // ---- Comments ----
  async createComment(c: { task_id: string; user_id: string; content: string; }): Promise<Comment> {
    const [result] = await db.insert(comments).values(c).returning();
    return result;
  }

  async getCommentsForTask(taskId: string): Promise<Comment[]> {
    return db.select().from(comments).where(eq(comments.task_id, taskId)).orderBy(asc(comments.created_at));
  }

  // ---- Eval Periods ----
  async createEvalPeriod(p: { id: string; title: string; type?: string; start_date: string; end_date: string; scoring_deadline?: string; status?: string; created_by?: string; }): Promise<EvalPeriod> {
    const [result] = await db.insert(eval_periods).values(p).returning();
    return result;
  }

  async getEvalPeriodById(id: string): Promise<EvalPeriod | undefined> {
    const [result] = await db.select().from(eval_periods).where(eq(eval_periods.id, id));
    return result;
  }

  async getAllEvalPeriods(): Promise<EvalPeriod[]> {
    return db.select().from(eval_periods).orderBy(desc(eval_periods.created_at));
  }

  async updateEvalPeriod(id: string, updates: Partial<{ title: string; status: string; scoring_deadline: string; }>): Promise<EvalPeriod | undefined> {
    const [result] = await db.update(eval_periods).set(updates).where(eq(eval_periods.id, id)).returning();
    return result;
  }

  // ---- Eval Scores ----
  async createEvalScore(s: { period_id: string; user_id: string; scorer_id: string; scorer_role: string; dimension: string; score: string; auto_calculated?: boolean; comment?: string; }): Promise<EvalScore> {
    const [result] = await db.insert(eval_scores).values(s).returning();
    return result;
  }

  async getEvalScoresForPeriod(periodId: string): Promise<EvalScore[]> {
    return db.select().from(eval_scores).where(eq(eval_scores.period_id, periodId));
  }

  async getEvalScoresForUserInPeriod(periodId: string, userId: string): Promise<EvalScore[]> {
    return db.select().from(eval_scores).where(and(eq(eval_scores.period_id, periodId), eq(eval_scores.user_id, userId)));
  }

  async upsertEvalScore(s: { period_id: string; user_id: string; scorer_id: string; scorer_role: string; dimension: string; score: string; auto_calculated?: boolean; comment?: string; overridden_by?: string; }): Promise<EvalScore> {
    const existing = await db.select().from(eval_scores).where(and(
      eq(eval_scores.period_id, s.period_id),
      eq(eval_scores.user_id, s.user_id),
      eq(eval_scores.dimension, s.dimension),
      eq(eval_scores.scorer_role, s.scorer_role),
    ));
    if (existing.length > 0) {
      const [result] = await db.update(eval_scores).set({
        score: s.score, comment: s.comment, scorer_id: s.scorer_id,
        overridden_by: s.overridden_by, overridden_at: s.overridden_by ? new Date() : undefined,
        auto_calculated: s.auto_calculated,
      }).where(eq(eval_scores.id, existing[0].id)).returning();
      return result;
    }
    return this.createEvalScore(s);
  }

  // ---- Eval Rules ----
  async getAllEvalRules(): Promise<EvalRule[]> {
    return db.select().from(eval_rules).orderBy(asc(eval_rules.id));
  }

  async upsertEvalRule(rule: { dimension: string; label: string; weight: string; formula?: string; updated_by?: string; }): Promise<EvalRule> {
    const [result] = await db.insert(eval_rules).values(rule)
      .onConflictDoUpdate({ target: eval_rules.dimension, set: { label: rule.label, weight: rule.weight, formula: rule.formula, updated_by: rule.updated_by, updated_at: new Date() } })
      .returning();
    return result;
  }

  // ---- Attachments ----
  async createAttachment(a: { task_id: string; user_id: string; filename: string; filepath: string; filesize?: number; mime_type?: string; }): Promise<Attachment> {
    const [result] = await db.insert(attachments).values(a).returning();
    return result;
  }

  async getAttachmentsForTask(taskId: string): Promise<Attachment[]> {
    return db.select().from(attachments).where(eq(attachments.task_id, taskId)).orderBy(desc(attachments.created_at));
  }

  async getAttachmentById(id: number): Promise<Attachment | undefined> {
    const [result] = await db.select().from(attachments).where(eq(attachments.id, id));
    return result;
  }

  async deleteAttachment(id: number): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id));
  }

  async getOldAttachments(beforeDate: Date): Promise<Attachment[]> {
    return db.select().from(attachments).where(lte(attachments.created_at, beforeDate));
  }
}

export const storage = new DatabaseStorage();
