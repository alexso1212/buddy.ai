import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, or, inArray, notInArray, sql, ilike, gte } from "drizzle-orm";
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
  organizationJoinRequests,
  memberProfiles,
  type MemberProfile,
  type InsertMemberProfile,
  type OrganizationJoinRequest,
  type InsertOrganizationJoinRequest,
  taskDeliverables,
  taskSubmissions,
  type TaskDeliverable,
  type InsertTaskDeliverable,
  type TaskSubmission,
  type InsertTaskSubmission,
  kbDocuments,
  kbChunks,
  briefings,
  aiProviders,
  type AiProvider,
  type InsertAiProvider,
  aiModelProviders,
  type AiModelProvider,
  type InsertAiModelProvider,
  systemConfig,
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

  async getDepartmentsByOrg(orgId: number): Promise<Department[]> {
    return db.select().from(departments).where(eq(departments.orgId, orgId));
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
    // Cascade: clear deptId on users belonging to this department
    await db.update(users).set({ deptId: null }).where(eq(users.deptId, id));
    // Cascade: clear deptId on org_memberships referencing this department
    await db.update(orgMemberships).set({ deptId: null }).where(eq(orgMemberships.deptId, id));
    // Cascade: clear deptId on member_profiles referencing this department
    await db.update(memberProfiles).set({ deptId: null }).where(eq(memberProfiles.deptId, id));
    // Cascade: reparent child departments to null
    await db.update(departments).set({ parentDeptId: null }).where(eq(departments.parentDeptId, id));
    // Now safe to delete
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
    // Sync: deactivate all org memberships for this user
    await db.update(orgMemberships).set({ isActive: false }).where(eq(orgMemberships.userId, id));
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

  async updateTaskWithVersion(id: number, expectedVersion: number, data: Partial<InsertTask>): Promise<Task | null> {
    const [result] = await db
      .update(tasks)
      .set({ ...data, version: sql`${tasks.version} + 1`, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.version, expectedVersion)))
      .returning();
    return result ?? null;
  }

  async createTaskWithDependencies(
    taskData: InsertTask,
    dependsOnIds: number[],
    orgId: number,
    userId: number
  ): Promise<Task> {
    return await db.transaction(async (tx) => {
      const [task] = await tx.insert(tasks).values(taskData).returning();
      for (const depId of dependsOnIds) {
        await tx.insert(taskDependencies).values({
          taskId: task.id,
          dependsOnTaskId: depId,
          type: 'finish_to_start',
        });
      }
      await tx.insert(activityLogs).values({
        orgId,
        userId,
        entityType: 'task',
        entityId: task.id,
        action: 'create',
        changes: JSON.stringify({ title: task.title, projectId: task.projectId }),
        source: 'ai_chat',
      });
      return task;
    });
  }

  async batchCreateTasks(
    taskItems: Array<{ data: InsertTask; ref?: string; dependsOn?: number[]; dependsOnRef?: string[] }>,
    orgId: number,
    userId: number
  ): Promise<Task[]> {
    return await db.transaction(async (tx) => {
      const refToId = new Map<string, number>();
      const createdTasks: Task[] = [];

      for (const item of taskItems) {
        const [task] = await tx.insert(tasks).values(item.data).returning();
        createdTasks.push(task);

        if (item.ref) {
          refToId.set(item.ref, task.id);
        }

        const allDepIds: number[] = [...(item.dependsOn || [])];
        if (item.dependsOnRef) {
          for (const ref of item.dependsOnRef) {
            const resolvedId = refToId.get(ref);
            if (resolvedId) allDepIds.push(resolvedId);
          }
        }

        for (const depId of allDepIds) {
          await tx.insert(taskDependencies).values({
            taskId: task.id,
            dependsOnTaskId: depId,
            type: 'finish_to_start',
          });
        }

        await tx.insert(activityLogs).values({
          orgId,
          userId,
          entityType: 'task',
          entityId: task.id,
          action: 'create',
          changes: JSON.stringify({ title: task.title, projectId: task.projectId }),
          source: 'ai_chat',
        });
      }

      return createdTasks;
    });
  }

  async checkDuplicateTask(orgId: number, title: string, assigneeId?: number | null, memberProfileId?: number | null): Promise<Task | null> {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const conditions = [
      eq(tasks.orgId, orgId),
      eq(tasks.title, title),
      gte(tasks.createdAt, tenMinAgo),
    ];
    if (assigneeId) {
      conditions.push(eq(tasks.assigneeId, assigneeId));
    } else if (memberProfileId) {
      conditions.push(eq(tasks.memberProfileId, memberProfileId));
    }
    const [result] = await db.select().from(tasks).where(and(...conditions)).limit(1);
    return result ?? null;
  }

  async getActiveTasksByOrg(orgId: number): Promise<Task[]> {
    return db.select().from(tasks).where(
      and(
        eq(tasks.orgId, orgId),
        notInArray(tasks.status, ['done', 'cancelled'])
      )
    );
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

  async getJobRolesByOrg(orgId: number): Promise<JobRole[]> {
    return db.select().from(jobRoles).where(eq(jobRoles.orgId, orgId));
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

  async getChatMessageById(id: number): Promise<ChatMessage | undefined> {
    const [result] = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1);
    return result;
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [result] = await db.insert(chatMessages).values(data).returning();
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, data.conversationId));
    return result;
  }

  async findRecentAttachmentMessages(orgId: number, days: number = 7) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.select({
      id: chatMessages.id,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
      conversationId: chatMessages.conversationId,
    })
    .from(chatMessages)
    .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.orgId, orgId),
        gte(chatMessages.createdAt, cutoff),
        sql`${chatMessages.metadata} IS NOT NULL AND ${chatMessages.metadata}::text LIKE '%attachmentHashes%'`
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(50);
  }

  async deleteChatMessagesByConversation(conversationId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  }

  async deleteChatMessagesAfter(conversationId: number, afterMessageId: number): Promise<number> {
    const result = await db.delete(chatMessages)
      .where(and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.id} > ${afterMessageId}`
      ))
      .returning();
    return result.length;
  }

  async truncateChatMessages(conversationId: number, keepCount: number): Promise<number> {
    const allMessages = await db.select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);

    if (allMessages.length <= keepCount) return 0;

    const idsToDelete = allMessages.slice(keepCount).map(m => m.id);
    const result = await db.delete(chatMessages)
      .where(and(
        eq(chatMessages.conversationId, conversationId),
        inArray(chatMessages.id, idsToDelete)
      ))
      .returning();
    return result.length;
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

  async getConversationsByUser(orgId: number, userId: number): Promise<Conversation[]> {
    return db.select().from(conversations).where(
      and(eq(conversations.orgId, orgId), eq(conversations.userId, userId), eq(conversations.isArchived, false))
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

  async updateOrganization(id: number, data: Partial<{ name: string; type: string; description: string | null; tokenBudgetUsd: string | null; budgetResetDay: number }>): Promise<Organization | undefined> {
    const [result] = await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
    return result;
  }

  // ==================== Organization Join Requests ====================
  async createJoinRequest(data: InsertOrganizationJoinRequest): Promise<OrganizationJoinRequest> {
    const [result] = await db.insert(organizationJoinRequests).values(data).returning();
    return result;
  }

  async getJoinRequestsByOrgId(orgId: number, status?: string): Promise<Array<OrganizationJoinRequest & { user: { id: number; displayName: string; email: string; avatarUrl: string | null } }>> {
    const conditions = [eq(organizationJoinRequests.orgId, orgId)];
    if (status) {
      conditions.push(eq(organizationJoinRequests.status, status));
    }
    const results = await db.select({
      id: organizationJoinRequests.id,
      orgId: organizationJoinRequests.orgId,
      userId: organizationJoinRequests.userId,
      message: organizationJoinRequests.message,
      inviteCode: organizationJoinRequests.inviteCode,
      status: organizationJoinRequests.status,
      reviewedBy: organizationJoinRequests.reviewedBy,
      reviewedAt: organizationJoinRequests.reviewedAt,
      reviewNote: organizationJoinRequests.reviewNote,
      createdAt: organizationJoinRequests.createdAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(organizationJoinRequests)
    .innerJoin(users, eq(organizationJoinRequests.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(organizationJoinRequests.createdAt));
    return results;
  }

  async getJoinRequestById(id: number): Promise<OrganizationJoinRequest | undefined> {
    const [result] = await db.select().from(organizationJoinRequests).where(eq(organizationJoinRequests.id, id));
    return result;
  }

  async updateJoinRequest(id: number, data: Partial<OrganizationJoinRequest>): Promise<OrganizationJoinRequest | undefined> {
    const [result] = await db.update(organizationJoinRequests).set(data).where(eq(organizationJoinRequests.id, id)).returning();
    return result;
  }

  async getPendingJoinRequestByUserId(userId: number, orgId: number): Promise<OrganizationJoinRequest | undefined> {
    const [result] = await db.select().from(organizationJoinRequests)
      .where(and(
        eq(organizationJoinRequests.userId, userId),
        eq(organizationJoinRequests.orgId, orgId),
        eq(organizationJoinRequests.status, 'pending')
      ));
    return result;
  }

  async cancelOtherPendingJoinRequests(userId: number, orgId: number, excludeId: number): Promise<void> {
    await db.update(organizationJoinRequests)
      .set({ status: 'cancelled' })
      .where(and(
        eq(organizationJoinRequests.userId, userId),
        eq(organizationJoinRequests.orgId, orgId),
        eq(organizationJoinRequests.status, 'pending'),
        sql`${organizationJoinRequests.id} != ${excludeId}`
      ));
  }

  async deactivateOrgInvitations(orgId: number): Promise<void> {
    await db.update(invitations).set({ isActive: false }).where(
      and(eq(invitations.orgId, orgId), eq(invitations.isActive, true))
    );
  }

  async countOrgMembers(orgId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(orgMemberships)
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.isActive, true)));
    return result[0]?.count ?? 0;
  }

  async createDeliverable(data: InsertTaskDeliverable): Promise<TaskDeliverable> {
    const [deliverable] = await db.insert(taskDeliverables).values(data).returning();
    return deliverable;
  }

  async getDeliverablesByTaskId(taskId: number, onlyLatest = false): Promise<Array<TaskDeliverable & { submitter: { id: number; displayName: string | null; avatarUrl: string | null } }>> {
    const conditions = [eq(taskDeliverables.taskId, taskId)];
    if (onlyLatest) conditions.push(eq(taskDeliverables.isLatest, true));

    const rows = await db
      .select({
        deliverable: taskDeliverables,
        submitterId: users.id,
        submitterName: users.displayName,
        submitterAvatar: users.avatarUrl,
      })
      .from(taskDeliverables)
      .leftJoin(users, eq(taskDeliverables.submittedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(taskDeliverables.version), desc(taskDeliverables.createdAt));

    return rows.map(r => ({
      ...r.deliverable,
      submitter: { id: r.submitterId!, displayName: r.submitterName, avatarUrl: r.submitterAvatar },
    }));
  }

  async getDeliverableById(id: number): Promise<TaskDeliverable | null> {
    const [row] = await db.select().from(taskDeliverables).where(eq(taskDeliverables.id, id));
    return row ?? null;
  }

  async updateDeliverable(id: number, data: Partial<TaskDeliverable>): Promise<TaskDeliverable> {
    const [updated] = await db.update(taskDeliverables).set({ ...data, updatedAt: new Date() }).where(eq(taskDeliverables.id, id)).returning();
    return updated;
  }

  async deleteDeliverable(id: number): Promise<void> {
    const allSubmissions = await db.select().from(taskSubmissions);
    const linked = allSubmissions.some(s => {
      const ids = s.deliverableIds as number[] | null;
      return ids && ids.includes(id);
    });
    if (linked) throw new Error('该交付物已关联提交记录，无法删除');
    await db.delete(taskDeliverables).where(eq(taskDeliverables.id, id));
  }

  async markPreviousVersions(taskId: number, type: string, title: string): Promise<void> {
    await db.update(taskDeliverables)
      .set({ isLatest: false, updatedAt: new Date() })
      .where(and(
        eq(taskDeliverables.taskId, taskId),
        eq(taskDeliverables.type, type),
        eq(taskDeliverables.title, title),
        eq(taskDeliverables.isLatest, true),
      ));
  }

  async createSubmission(data: InsertTaskSubmission): Promise<TaskSubmission> {
    const [submission] = await db.insert(taskSubmissions).values(data).returning();
    return submission;
  }

  async getSubmissionsByTaskId(taskId: number): Promise<Array<TaskSubmission & { submitter: { id: number; displayName: string | null; avatarUrl: string | null }; deliverables: TaskDeliverable[] }>> {
    const rows = await db
      .select({
        submission: taskSubmissions,
        submitterId: users.id,
        submitterName: users.displayName,
        submitterAvatar: users.avatarUrl,
      })
      .from(taskSubmissions)
      .leftJoin(users, eq(taskSubmissions.submittedBy, users.id))
      .where(eq(taskSubmissions.taskId, taskId))
      .orderBy(desc(taskSubmissions.createdAt));

    const results = [];
    for (const r of rows) {
      const ids = (r.submission.deliverableIds as number[] | null) || [];
      let deliverables: TaskDeliverable[] = [];
      if (ids.length > 0) {
        deliverables = await db.select().from(taskDeliverables).where(inArray(taskDeliverables.id, ids));
      }
      results.push({
        ...r.submission,
        submitter: { id: r.submitterId!, displayName: r.submitterName, avatarUrl: r.submitterAvatar },
        deliverables,
      });
    }
    return results;
  }

  async getSubmissionById(id: number): Promise<TaskSubmission | null> {
    const [row] = await db.select().from(taskSubmissions).where(eq(taskSubmissions.id, id));
    return row ?? null;
  }

  async updateSubmission(id: number, data: Partial<TaskSubmission>): Promise<TaskSubmission> {
    const [updated] = await db.update(taskSubmissions).set(data).where(eq(taskSubmissions.id, id)).returning();
    return updated;
  }

  async getPendingSubmissionsByOrgId(orgId: number): Promise<Array<TaskSubmission & { task: { id: number; title: string }; submitter: { id: number; displayName: string | null } }>> {
    const rows = await db
      .select({
        submission: taskSubmissions,
        taskId: tasks.id,
        taskTitle: tasks.title,
        submitterId: users.id,
        submitterName: users.displayName,
      })
      .from(taskSubmissions)
      .innerJoin(tasks, eq(taskSubmissions.taskId, tasks.id))
      .innerJoin(users, eq(taskSubmissions.submittedBy, users.id))
      .where(and(
        eq(taskSubmissions.orgId, orgId),
        eq(taskSubmissions.status, 'pending'),
      ))
      .orderBy(taskSubmissions.createdAt);

    return rows.map(r => ({
      ...r.submission,
      task: { id: r.taskId, title: r.taskTitle },
      submitter: { id: r.submitterId, displayName: r.submitterName },
    }));
  }

  // ===================== Knowledge Base =====================

  async getKbDocumentsByOrg(orgId: number) {
    return await db.select().from(kbDocuments).where(eq(kbDocuments.orgId, orgId)).orderBy(desc(kbDocuments.createdAt));
  }

  async getKbDocumentById(id: number) {
    const [doc] = await db.select().from(kbDocuments).where(eq(kbDocuments.id, id));
    return doc || null;
  }

  async createKbDocument(data: typeof kbDocuments.$inferInsert) {
    const [doc] = await db.insert(kbDocuments).values(data).returning();
    return doc;
  }

  async updateKbDocument(id: number, data: Partial<typeof kbDocuments.$inferInsert>) {
    const [doc] = await db.update(kbDocuments).set({ ...data, updatedAt: new Date() }).where(eq(kbDocuments.id, id)).returning();
    return doc;
  }

  async findKbDocByHash(orgId: number, contentHash: string) {
    const [doc] = await db.select().from(kbDocuments).where(
      and(eq(kbDocuments.orgId, orgId), eq(kbDocuments.contentHash, contentHash))
    ).limit(1);
    return doc || null;
  }

  async findKbDocByFileName(orgId: number, fileName: string) {
    const [doc] = await db.select().from(kbDocuments).where(
      and(eq(kbDocuments.orgId, orgId), eq(kbDocuments.fileName, fileName))
    ).limit(1);
    return doc || null;
  }

  async deleteKbDocument(id: number) {
    await db.delete(kbDocuments).where(eq(kbDocuments.id, id));
  }

  async createKbChunks(chunks: (typeof kbChunks.$inferInsert)[]) {
    if (chunks.length === 0) return [];
    return await db.insert(kbChunks).values(chunks).returning();
  }

  async getKbChunksByDocument(documentId: number) {
    return await db.select().from(kbChunks).where(eq(kbChunks.documentId, documentId)).orderBy(kbChunks.chunkIndex);
  }

  async deleteKbChunksByDocument(documentId: number) {
    await db.delete(kbChunks).where(eq(kbChunks.documentId, documentId));
  }

  async executeRaw(query: any) {
    return await db.execute(query);
  }

  // ===================== Briefings =====================

  async getBriefing(orgId: number, userId: number, date: string) {
    const [b] = await db.select().from(briefings)
      .where(and(eq(briefings.orgId, orgId), eq(briefings.userId, userId), eq(briefings.date, date)));
    return b || null;
  }

  async createBriefing(data: typeof briefings.$inferInsert) {
    const [b] = await db.insert(briefings).values(data).returning();
    return b;
  }

  async deleteBriefing(orgId: number, userId: number, date: string) {
    await db.delete(briefings).where(
      and(eq(briefings.orgId, orgId), eq(briefings.userId, userId), eq(briefings.date, date))
    );
  }

  // ===================== Member Profiles =====================

  async createMemberProfile(data: InsertMemberProfile): Promise<MemberProfile> {
    const [result] = await db.insert(memberProfiles).values(data).returning();
    return result;
  }

  async getMemberProfilesByOrg(orgId: number): Promise<MemberProfile[]> {
    return db.select().from(memberProfiles).where(eq(memberProfiles.orgId, orgId));
  }

  async getPendingProfilesByOrg(orgId: number): Promise<MemberProfile[]> {
    return db.select().from(memberProfiles).where(
      and(eq(memberProfiles.orgId, orgId), or(eq(memberProfiles.status, 'pending'), eq(memberProfiles.status, 'manual')))
    );
  }

  async getMemberProfileById(id: number): Promise<MemberProfile | undefined> {
    const [result] = await db.select().from(memberProfiles).where(eq(memberProfiles.id, id));
    return result;
  }

  async updateMemberProfile(id: number, data: Partial<InsertMemberProfile>): Promise<MemberProfile | undefined> {
    const [result] = await db.update(memberProfiles).set({ ...data, updatedAt: new Date() }).where(eq(memberProfiles.id, id)).returning();
    return result;
  }

  async deleteMemberProfile(id: number): Promise<void> {
    await db.delete(memberProfiles).where(eq(memberProfiles.id, id));
  }

  async findMemberProfileByEmail(orgId: number, email: string): Promise<MemberProfile | undefined> {
    const [result] = await db.select().from(memberProfiles).where(
      and(eq(memberProfiles.orgId, orgId), eq(memberProfiles.email, email))
    );
    return result;
  }

  async findMemberProfileByEmployeeId(orgId: number, employeeId: string): Promise<MemberProfile | undefined> {
    const [result] = await db.select().from(memberProfiles).where(
      and(eq(memberProfiles.orgId, orgId), eq(memberProfiles.employeeId, employeeId))
    );
    return result;
  }

  async findMemberProfileByName(orgId: number, fullName: string): Promise<MemberProfile | undefined> {
    const [result] = await db.select().from(memberProfiles).where(
      and(eq(memberProfiles.orgId, orgId), eq(memberProfiles.fullName, fullName))
    );
    return result;
  }

  async findDepartmentByName(orgId: number, name: string): Promise<Department | undefined> {
    const [result] = await db.select().from(departments).where(
      and(eq(departments.orgId, orgId), eq(departments.name, name))
    );
    return result;
  }

  async findJobRoleByTitle(orgId: number, title: string): Promise<JobRole | undefined> {
    const [result] = await db.select().from(jobRoles).where(
      and(eq(jobRoles.orgId, orgId), eq(jobRoles.title, title))
    );
    return result;
  }

  async migrateTasksFromProfile(profileId: number, userId: number): Promise<number> {
    const result = await db.update(tasks)
      .set({ assigneeId: userId, memberProfileId: null })
      .where(eq(tasks.memberProfileId, profileId))
      .returning();
    return result.length;
  }

  async updateOrgMembership(orgId: number, userId: number, data: { deptId?: number | null; jobRoleId?: number | null; role?: string; isActive?: boolean }): Promise<OrgMembership | undefined> {
    const [result] = await db.update(orgMemberships)
      .set(data)
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)))
      .returning();
    return result;
  }

  async getTaskCountByMemberProfile(profileId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.memberProfileId, profileId));
    return result[0]?.count ?? 0;
  }

  async getAiProviders(): Promise<AiProvider[]> {
    return db.select().from(aiProviders).orderBy(aiProviders.priority);
  }

  async getAiProvider(id: number): Promise<AiProvider | undefined> {
    const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, id));
    return provider;
  }

  async createAiProvider(data: InsertAiProvider): Promise<AiProvider> {
    const [provider] = await db.insert(aiProviders).values(data).returning();
    return provider;
  }

  async updateAiProvider(id: number, data: Partial<InsertAiProvider>): Promise<AiProvider> {
    const [provider] = await db.update(aiProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiProviders.id, id))
      .returning();
    return provider;
  }

  async deleteAiProvider(id: number): Promise<void> {
    await db.delete(aiProviders).where(eq(aiProviders.id, id));
  }

  async reorderAiProviders(ids: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(aiProviders)
          .set({ priority: i, updatedAt: new Date() })
          .where(eq(aiProviders.id, ids[i]));
      }
    });
  }

  async getModelProviders(): Promise<AiModelProvider[]> {
    return db.select().from(aiModelProviders).orderBy(aiModelProviders.modelId, aiModelProviders.priority);
  }

  async getModelProvidersByModel(modelId: string): Promise<AiModelProvider[]> {
    return db.select().from(aiModelProviders)
      .where(eq(aiModelProviders.modelId, modelId))
      .orderBy(aiModelProviders.priority);
  }

  async getModelProvider(id: number): Promise<AiModelProvider | undefined> {
    const [provider] = await db.select().from(aiModelProviders).where(eq(aiModelProviders.id, id));
    return provider;
  }

  async createModelProvider(data: InsertAiModelProvider): Promise<AiModelProvider> {
    const [provider] = await db.insert(aiModelProviders).values(data).returning();
    return provider;
  }

  async updateModelProvider(id: number, data: Partial<InsertAiModelProvider>): Promise<AiModelProvider> {
    const [provider] = await db.update(aiModelProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiModelProviders.id, id))
      .returning();
    return provider;
  }

  async deleteModelProvider(id: number): Promise<void> {
    await db.delete(aiModelProviders).where(eq(aiModelProviders.id, id));
  }

  async reorderModelProviders(modelId: string, ids: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(aiModelProviders)
          .set({ priority: i, updatedAt: new Date() })
          .where(and(eq(aiModelProviders.id, ids[i]), eq(aiModelProviders.modelId, modelId)));
      }
    });
  }

  async createDecisionTask(data: {
    orgId: number;
    projectId: number;
    title: string;
    description: string;
    creatorId: number;
    assigneeId: number;
    decisionForTaskId: number;
    decisionType: string;
    decisionDeadline: Date;
    escalationDeadline: Date;
  }): Promise<Task> {
    const [result] = await db.insert(tasks).values({
      ...data,
      type: 'decision',
      status: 'todo',
      priority: 'high',
      isDecisionTask: true,
      decisionStatus: 'pending',
      weight: 1,
      progress: 0,
      needsReview: false,
    }).returning();
    return result;
  }

  async resolveDecisionTask(
    decisionTaskId: number,
    updates: Partial<InsertTask>
  ): Promise<{ decisionTask: Task; originalTask: Task | undefined }> {
    const decisionTask = await this.getTaskById(decisionTaskId);
    if (!decisionTask || !decisionTask.isDecisionTask || !decisionTask.decisionForTaskId) {
      throw new Error(`Decision task #${decisionTaskId} not found or invalid`);
    }

    const [updatedDecision] = await db.update(tasks).set({
      decisionStatus: 'resolved',
      status: 'done',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tasks.id, decisionTaskId)).returning();

    const originalTask = await db.update(tasks).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(tasks.id, decisionTask.decisionForTaskId)).returning().then(r => r[0]);

    const remainingDecisions = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(
        eq(tasks.decisionForTaskId, decisionTask.decisionForTaskId),
        eq(tasks.isDecisionTask, true),
        eq(tasks.decisionStatus, 'pending')
      ));

    if (Number(remainingDecisions[0]?.count) === 0 && originalTask) {
      await db.update(tasks).set({
        needsReview: false,
        updatedAt: new Date(),
      }).where(eq(tasks.id, decisionTask.decisionForTaskId));
    }

    return { decisionTask: updatedDecision, originalTask };
  }

  async getPendingDecisionTasksForUser(userId: number, orgId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(
      eq(tasks.orgId, orgId),
      eq(tasks.assigneeId, userId),
      eq(tasks.isDecisionTask, true),
      eq(tasks.decisionStatus, 'pending')
    )).orderBy(desc(tasks.createdAt));
  }

  async getPendingDecisionTasksForTask(taskId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(
      eq(tasks.decisionForTaskId, taskId),
      eq(tasks.isDecisionTask, true),
      eq(tasks.decisionStatus, 'pending')
    ));
  }

  async getDecisionTaskStats(orgId: number): Promise<{ pendingCount: number }> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(
        eq(tasks.orgId, orgId),
        eq(tasks.isDecisionTask, true),
        eq(tasks.decisionStatus, 'pending')
      ));
    return { pendingCount: Number(result?.count || 0) };
  }

  async getDecisionTasksForTask(taskId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(
      eq(tasks.decisionForTaskId, taskId),
      eq(tasks.isDecisionTask, true)
    )).orderBy(desc(tasks.createdAt));
  }

  async getSystemConfig(key: string): Promise<string | null> {
    const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return row?.value ?? null;
  }

  async setSystemConfig(key: string, value: string): Promise<void> {
    await db.insert(systemConfig)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

export const storage = new DatabaseStorage();
