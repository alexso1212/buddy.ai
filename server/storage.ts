import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import {
  organizations,
  departments,
  users,
  projects,
  tasks,
  taskDependencies,
  activityLogs,
  taskComments,
  taskParticipants,
  jobRoles,
  verdicts,
  notifications,
  conversations,
  chatMessages,
  type Organization,
  type Department,
  type User,
  type Project,
  type Task,
  type TaskDependency,
  type ActivityLog,
  type TaskComment,
  type TaskParticipant,
  type JobRole,
  type Verdict,
  type InsertOrganization,
  type InsertDepartment,
  type InsertUser,
  type InsertProject,
  type InsertTask,
  type InsertTaskDependency,
  type InsertActivityLog,
  type InsertTaskComment,
  type InsertTaskParticipant,
  type InsertJobRole,
  type InsertVerdict,
  type Notification,
  type InsertNotification,
  type Conversation,
  type ChatMessage,
  type InsertConversation,
  type InsertChatMessage,
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export class DatabaseStorage {
  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations);
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [result] = await db.insert(organizations).values(data).returning();
    return result;
  }

  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments);
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [result] = await db.select().from(departments).where(eq(departments.id, id));
    return result;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [result] = await db.insert(departments).values(data).returning();
    return result;
  }

  async updateDepartment(id: number, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [result] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return result;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.email, email));
    return result;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(data).returning();
    return result;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [result] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result;
  }

  async deleteUser(id: number): Promise<User | undefined> {
    const [result] = await db.update(users).set({ isActive: false }).where(eq(users.id, id)).returning();
    return result;
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  async getProjectById(id: number): Promise<Project | undefined> {
    const [result] = await db.select().from(projects).where(eq(projects.id, id));
    return result;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [result] = await db.insert(projects).values(data).returning();
    return result;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [result] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return result;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getTasks(filters?: { projectId?: number; assigneeId?: number; status?: string[]; parentTaskId?: number | null }): Promise<Task[]> {
    if (!filters) {
      return db.select().from(tasks);
    }
    const conditions = [];
    if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters.status?.length) conditions.push(inArray(tasks.status, filters.status));
    if (filters.parentTaskId === null) conditions.push(sql`${tasks.parentTaskId} IS NULL`);
    else if (filters.parentTaskId) conditions.push(eq(tasks.parentTaskId, filters.parentTaskId));

    if (conditions.length === 0) {
      return db.select().from(tasks);
    }
    return db.select().from(tasks).where(and(...conditions));
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const [result] = await db.select().from(tasks).where(eq(tasks.id, id));
    return result;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(data).returning();
    return result;
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [result] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return result;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getTaskDependencies(taskId: number): Promise<TaskDependency[]> {
    return db.select().from(taskDependencies).where(
      or(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnTaskId, taskId))
    );
  }

  async createTaskDependency(data: InsertTaskDependency): Promise<TaskDependency> {
    const [result] = await db.insert(taskDependencies).values(data).returning();
    return result;
  }

  async deleteTaskDependency(id: number): Promise<void> {
    await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
  }

  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(desc(taskComments.createdAt));
  }

  async createTaskComment(data: InsertTaskComment): Promise<TaskComment> {
    const [result] = await db.insert(taskComments).values(data).returning();
    return result;
  }

  async getTaskParticipants(taskId: number): Promise<TaskParticipant[]> {
    return db.select().from(taskParticipants).where(eq(taskParticipants.taskId, taskId));
  }

  async getTaskParticipantsByTaskIds(taskIds: number[]): Promise<TaskParticipant[]> {
    if (taskIds.length === 0) return [];
    return db.select().from(taskParticipants).where(inArray(taskParticipants.taskId, taskIds));
  }

  async addTaskParticipant(data: InsertTaskParticipant): Promise<TaskParticipant> {
    const [result] = await db.insert(taskParticipants).values(data).returning();
    return result;
  }

  async removeTaskParticipant(id: number): Promise<void> {
    await db.delete(taskParticipants).where(eq(taskParticipants.id, id));
  }

  async removeTaskParticipantByTaskAndUser(taskId: number, userId: number): Promise<void> {
    await db.delete(taskParticipants).where(
      and(eq(taskParticipants.taskId, taskId), eq(taskParticipants.userId, userId))
    );
  }

  async getAllTaskDependencies(): Promise<TaskDependency[]> {
    return await db.select().from(taskDependencies);
  }

  async getActivityLogs(filters?: { entityType?: string; entityId?: number }): Promise<ActivityLog[]> {
    if (!filters) {
      return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
    }
    const conditions = [];
    if (filters.entityType) conditions.push(eq(activityLogs.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(activityLogs.entityId, filters.entityId));

    if (conditions.length === 0) {
      return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
    }
    return db.select().from(activityLogs).where(and(...conditions)).orderBy(desc(activityLogs.createdAt));
  }

  async createActivityLog(data: InsertActivityLog): Promise<ActivityLog> {
    const [result] = await db.insert(activityLogs).values(data).returning();
    return result;
  }

  async getJobRoles(): Promise<JobRole[]> {
    return db.select().from(jobRoles);
  }

  async getJobRoleById(id: number): Promise<JobRole | undefined> {
    const [result] = await db.select().from(jobRoles).where(eq(jobRoles.id, id));
    return result;
  }

  async createJobRole(data: InsertJobRole): Promise<JobRole> {
    const [result] = await db.insert(jobRoles).values(data).returning();
    return result;
  }

  async updateJobRole(id: number, data: Partial<InsertJobRole>): Promise<JobRole | undefined> {
    const [result] = await db.update(jobRoles).set(data).where(eq(jobRoles.id, id)).returning();
    return result;
  }

  async deleteJobRole(id: number): Promise<void> {
    await db.delete(jobRoles).where(eq(jobRoles.id, id));
  }

  async getVerdictsByTaskId(taskId: number): Promise<Verdict[]> {
    return db.select().from(verdicts).where(eq(verdicts.taskId, taskId)).orderBy(desc(verdicts.createdAt));
  }

  async getVerdictsByUserId(userId: number): Promise<Verdict[]> {
    return db.select().from(verdicts).where(eq(verdicts.userId, userId)).orderBy(desc(verdicts.createdAt));
  }

  async getVerdictById(id: number): Promise<Verdict | undefined> {
    const [result] = await db.select().from(verdicts).where(eq(verdicts.id, id));
    return result;
  }

  async createVerdict(data: InsertVerdict): Promise<Verdict> {
    const [result] = await db.insert(verdicts).values(data).returning();
    return result;
  }

  async updateVerdict(id: number, data: Partial<InsertVerdict>): Promise<Verdict | undefined> {
    const [result] = await db.update(verdicts).set(data).where(eq(verdicts.id, id)).returning();
    return result;
  }

  async getAllVerdicts(): Promise<Verdict[]> {
    return db.select().from(verdicts).orderBy(desc(verdicts.createdAt));
  }

  async getNotificationsByUserId(userId: number, limit?: number): Promise<Notification[]> {
    const q = db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
    if (limit) return q.limit(limit);
    return q;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count ?? 0;
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [result] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return result;
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(data).returning();
    return result;
  }

  async createManyNotifications(dataList: InsertNotification[]): Promise<Notification[]> {
    if (dataList.length === 0) return [];
    return db.insert(notifications).values(dataList).returning();
  }
  // ==================== Conversations ====================
  async getConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.updatedAt));
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [result] = await db.select().from(conversations).where(eq(conversations.id, id));
    return result;
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const [result] = await db.insert(conversations).values(data).returning();
    return result;
  }

  async updateConversation(id: number, data: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [result] = await db.update(conversations).set({ ...data, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
    return result;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // ==================== Chat Messages ====================
  async getChatMessages(conversationId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [result] = await db.insert(chatMessages).values(data).returning();
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, data.conversationId));
    return result;
  }

  async deleteChatMessagesByConversation(conversationId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  }
}

export const storage = new DatabaseStorage();
