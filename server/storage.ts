import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, or, inArray, sql, ilike } from "drizzle-orm";
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
  tokenUsage,
  type TokenUsage,
  type InsertTokenUsage,
  userMemories,
  type UserMemory,
  type InsertUserMemory,
  orgMemberships,
  invitations,
  type OrgMembership,
  type InsertOrgMembership,
  type Invitation,
  type InsertInvitation,
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

  async getUserByProvider(provider: string, providerId: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(
      and(eq(users.authProvider, provider), eq(users.authProviderId, providerId))
    );
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
    await db.delete(tokenUsage).where(eq(tokenUsage.conversationId, id));
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async searchConversations(orgId: number, query: string): Promise<(Conversation & { matchSnippets?: string[] })[]> {
    const pattern = `%${query}%`;
    const matchingByTitle = await db.select().from(conversations).where(
      and(
        eq(conversations.orgId, orgId),
        eq(conversations.isArchived, false),
        ilike(conversations.title, pattern)
      )
    );

    const matchingMessages = await db
      .select({
        conversationId: chatMessages.conversationId,
        content: chatMessages.content,
        role: chatMessages.role,
      })
      .from(chatMessages)
      .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.isArchived, false),
          ilike(chatMessages.content, pattern)
        )
      )
      .orderBy(desc(chatMessages.createdAt));

    const convIdsFromMessages = [...new Set(matchingMessages.map(m => m.conversationId))];
    const convsByContent = convIdsFromMessages.length > 0
      ? await db.select().from(conversations).where(
          and(
            inArray(conversations.id, convIdsFromMessages),
            eq(conversations.isArchived, false)
          )
        )
      : [];

    const snippetMap = new Map<number, string[]>();
    for (const msg of matchingMessages) {
      const existing = snippetMap.get(msg.conversationId) || [];
      if (existing.length < 3) {
        const lowerContent = msg.content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const idx = lowerContent.indexOf(lowerQuery);
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(msg.content.length, idx + query.length + 30);
          const snippet = (start > 0 ? '...' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '...' : '');
          existing.push(snippet);
        }
        snippetMap.set(msg.conversationId, existing);
      }
    }

    const allMap = new Map<number, Conversation & { matchSnippets?: string[] }>();
    for (const c of matchingByTitle) allMap.set(c.id, { ...c, matchSnippets: snippetMap.get(c.id) });
    for (const c of convsByContent) {
      if (!allMap.has(c.id)) allMap.set(c.id, { ...c, matchSnippets: snippetMap.get(c.id) });
      else if (snippetMap.has(c.id)) allMap.get(c.id)!.matchSnippets = snippetMap.get(c.id);
    }

    return Array.from(allMap.values()).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
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

  // ==================== Token Usage ====================
  async createTokenUsage(data: InsertTokenUsage): Promise<TokenUsage> {
    const [result] = await db.insert(tokenUsage).values(data).returning();
    return result;
  }

  async getTokenUsageByOrg(orgId: number, since?: Date): Promise<TokenUsage[]> {
    const conditions = [eq(tokenUsage.orgId, orgId)];
    if (since) {
      conditions.push(sql`${tokenUsage.createdAt} >= ${since}`);
    }
    return db.select().from(tokenUsage).where(and(...conditions)).orderBy(desc(tokenUsage.createdAt));
  }

  async getTokenUsageStats(orgId: number, since?: Date): Promise<{
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: string;
    byPurpose: Record<string, { tokens: number; cost: string }>;
    byUser: Record<number, { tokens: number; cost: string }>;
  }> {
    const conditions = [eq(tokenUsage.orgId, orgId)];
    if (since) {
      conditions.push(sql`${tokenUsage.createdAt} >= ${since}`);
    }
    const rows = await db.select().from(tokenUsage).where(and(...conditions));

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const byPurpose: Record<string, { tokens: number; cost: number }> = {};
    const byUser: Record<number, { tokens: number; cost: number }> = {};

    for (const row of rows) {
      totalPromptTokens += row.promptTokens;
      totalCompletionTokens += row.completionTokens;
      totalTokens += row.totalTokens;
      const cost = parseFloat(row.costUsd || '0');
      totalCost += cost;

      if (!byPurpose[row.purpose]) byPurpose[row.purpose] = { tokens: 0, cost: 0 };
      byPurpose[row.purpose].tokens += row.totalTokens;
      byPurpose[row.purpose].cost += cost;

      if (row.userId) {
        if (!byUser[row.userId]) byUser[row.userId] = { tokens: 0, cost: 0 };
        byUser[row.userId].tokens += row.totalTokens;
        byUser[row.userId].cost += cost;
      }
    }

    const formatPurpose: Record<string, { tokens: number; cost: string }> = {};
    for (const [k, v] of Object.entries(byPurpose)) {
      formatPurpose[k] = { tokens: v.tokens, cost: v.cost.toFixed(6) };
    }
    const formatUser: Record<number, { tokens: number; cost: string }> = {};
    for (const [k, v] of Object.entries(byUser)) {
      formatUser[Number(k)] = { tokens: v.tokens, cost: v.cost.toFixed(6) };
    }

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd: totalCost.toFixed(6),
      byPurpose: formatPurpose,
      byUser: formatUser,
    };
  }

  // ==================== Conversations (org-scoped) ====================
  async getConversationsByOrg(orgId: number): Promise<Conversation[]> {
    return db.select().from(conversations).where(
      and(eq(conversations.orgId, orgId), eq(conversations.isArchived, false))
    ).orderBy(desc(conversations.updatedAt));
  }

  // ==================== User Memories ====================
  async getUserMemories(userId: number, orgId: number): Promise<UserMemory[]> {
    return db.select().from(userMemories).where(
      and(eq(userMemories.userId, userId), eq(userMemories.orgId, orgId))
    ).orderBy(desc(userMemories.updatedAt));
  }

  async createUserMemory(data: InsertUserMemory): Promise<UserMemory> {
    const [result] = await db.insert(userMemories).values(data).returning();
    return result;
  }

  async deleteUserMemory(id: number): Promise<void> {
    await db.delete(userMemories).where(eq(userMemories.id, id));
  }

  // ==================== Org Memberships ====================
  async getOrgMemberships(userId: number): Promise<OrgMembership[]> {
    return db.select().from(orgMemberships).where(
      and(eq(orgMemberships.userId, userId), eq(orgMemberships.isActive, true))
    );
  }

  async getUserOrgsWithDetails(userId: number): Promise<(OrgMembership & { orgName: string; orgType: string })[]> {
    const result = await db
      .select({
        id: orgMemberships.id,
        userId: orgMemberships.userId,
        orgId: orgMemberships.orgId,
        role: orgMemberships.role,
        deptId: orgMemberships.deptId,
        jobRoleId: orgMemberships.jobRoleId,
        isActive: orgMemberships.isActive,
        joinedAt: orgMemberships.joinedAt,
        orgName: organizations.name,
        orgType: organizations.type,
      })
      .from(orgMemberships)
      .innerJoin(organizations, eq(orgMemberships.orgId, organizations.id))
      .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.isActive, true)));
    return result;
  }

  async createOrgMembership(data: InsertOrgMembership): Promise<OrgMembership> {
    const [result] = await db.insert(orgMemberships).values(data).returning();
    return result;
  }

  async getOrgMembershipByUserAndOrg(userId: number, orgId: number): Promise<OrgMembership | undefined> {
    const [result] = await db.select().from(orgMemberships).where(
      and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, orgId))
    );
    return result;
  }

  async getOrgMembers(orgId: number): Promise<(OrgMembership & { displayName: string; email: string; avatarUrl: string | null })[]> {
    const result = await db
      .select({
        id: orgMemberships.id,
        userId: orgMemberships.userId,
        orgId: orgMemberships.orgId,
        role: orgMemberships.role,
        deptId: orgMemberships.deptId,
        jobRoleId: orgMemberships.jobRoleId,
        isActive: orgMemberships.isActive,
        joinedAt: orgMemberships.joinedAt,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(orgMemberships.userId, users.id))
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.isActive, true)));
    return result;
  }

  async switchActiveOrg(userId: number, orgId: number): Promise<User | undefined> {
    const [result] = await db.update(users).set({ orgId }).where(eq(users.id, userId)).returning();
    return result;
  }

  // ==================== Invitations ====================
  async createInvitation(data: InsertInvitation): Promise<Invitation> {
    const [result] = await db.insert(invitations).values(data).returning();
    return result;
  }

  async getInvitationByCode(code: string): Promise<Invitation | undefined> {
    const [result] = await db.select().from(invitations).where(eq(invitations.inviteCode, code));
    return result;
  }

  async getOrgInvitations(orgId: number): Promise<Invitation[]> {
    return db.select().from(invitations).where(
      and(eq(invitations.orgId, orgId), eq(invitations.isActive, true))
    ).orderBy(desc(invitations.createdAt));
  }

  async deactivateInvitation(id: number): Promise<Invitation | undefined> {
    const [result] = await db.update(invitations).set({ isActive: false }).where(eq(invitations.id, id)).returning();
    return result;
  }

  async incrementInvitationUsedCount(id: number): Promise<void> {
    await db.update(invitations).set({ usedCount: sql`${invitations.usedCount} + 1` }).where(eq(invitations.id, id));
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async updateOrganization(id: number, data: Partial<{ name: string; type: string; description: string | null }>): Promise<Organization | undefined> {
    const [result] = await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
