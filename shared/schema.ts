import { pgTable, serial, varchar, text, integer, boolean, timestamp, numeric, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================
// 1. organizations（组织/公司）
// ============================================================
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('project'),
  tokenBudgetUsd: numeric('token_budget_usd', { precision: 10, scale: 4 }),
  budgetResetDay: integer('budget_reset_day').default(1),
  maxMembers: integer('max_members').default(50),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 2. departments（部门）
// ============================================================
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }),
  parentDeptId: integer('parent_dept_id').references((): AnyPgColumn => departments.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 3. job_roles（岗位职责）
// ============================================================
export const jobRoles = pgTable('job_roles', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  responsibilities: text('responsibilities').notNull(),
  boundaries: text('boundaries'),
  requiredSkills: text('required_skills'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 4. users（用户）
// ============================================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  jobRoleId: integer('job_role_id').references(() => jobRoles.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  authProvider: varchar('auth_provider', { length: 50 }),
  authProviderId: varchar('auth_provider_id', { length: 255 }),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// org_memberships（组织成员关系）
// ============================================================
export const orgMemberships = pgTable('org_memberships', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  deptId: integer('dept_id').references(() => departments.id),
  jobRoleId: integer('job_role_id').references(() => jobRoles.id),
  isActive: boolean('is_active').default(true).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// ============================================================
// invitations（组织邀请）
// ============================================================
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  inviteCode: varchar('invite_code', { length: 50 }).notNull().unique(),
  type: text('type').default('code'),
  email: text('email'),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at'),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').default(true).notNull(),
  status: text('status').default('pending'),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: integer('accepted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// organizationJoinRequests（组织加入申请）
// ============================================================
export const organizationJoinRequests = pgTable('organization_join_requests', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message'),
  inviteCode: varchar('invite_code', { length: 50 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 5. projects（项目）
// ============================================================
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  deptId: integer('dept_id').references(() => departments.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  startDate: timestamp('start_date'),
  targetDate: timestamp('target_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 5. tasks（任务）— 核心表
// ============================================================
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  parentTaskId: integer('parent_task_id').references((): AnyPgColumn => tasks.id),

  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('task'),

  // status 可选值：todo | in_progress | submitted | reviewing | done | cancelled
  status: varchar('status', { length: 50 }).notNull().default('todo'),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),

  creatorId: integer('creator_id').references(() => users.id).notNull(),
  assigneeId: integer('assignee_id').references(() => users.id),

  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),

  weight: integer('weight').default(1).notNull(),
  progress: integer('progress').default(0).notNull(),

  tags: text('tags'),

  needsReview: boolean('needs_review').default(false).notNull(),
  warnings: text('warnings'),

  starred: boolean('starred').default(false).notNull(),

  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 5b. task_deliverables（任务交付物）
// ============================================================
export const taskDeliverables = pgTable("task_deliverables", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizations.id),

  type: varchar("type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),

  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  fileMimeType: varchar("file_mime_type", { length: 200 }),

  linkUrl: text("link_url"),

  content: text("content"),

  submittedBy: integer("submitted_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),

  version: integer("version").default(1).notNull(),
  isLatest: boolean("is_latest").default(true).notNull(),

  reviewStatus: varchar("review_status", { length: 50 }).default("pending"),
  reviewScore: integer("review_score"),
  reviewFeedback: text("review_feedback"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// 5c. task_submissions（任务提交记录）
// ============================================================
export const taskSubmissions = pgTable("task_submissions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  submittedBy: integer("submitted_by").notNull().references(() => users.id),

  note: text("note"),
  deliverableIds: jsonb("deliverable_ids").$type<number[]>().default([]),

  status: varchar("status", { length: 50 }).default("pending").notNull(),

  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  overallScore: integer("overall_score"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// 6. task_dependencies（任务依赖关系）
// ============================================================
export const taskDependencies = pgTable('task_dependencies', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  dependsOnTaskId: integer('depends_on_task_id').references(() => tasks.id).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('finish_to_start'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 7. activity_logs（操作日志）
// ============================================================
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  changes: text('changes'),
  source: varchar('source', { length: 50 }).notNull().default('manual'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 8. task_comments（任务评论）
// ============================================================
export const taskComments = pgTable('task_comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 9. task_participants（任务参与人）
// ============================================================
export const taskParticipants = pgTable('task_participants', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('participant'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 10. verdicts（权责判定记录）
// ============================================================
export const verdicts = pgTable('verdicts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  verdict: varchar('verdict', { length: 50 }).notNull(),
  confidence: integer('confidence').notNull(),
  reasoning: text('reasoning').notNull(),
  matchedResponsibilities: text('matched_responsibilities'),
  suggestedAssignee: integer('suggested_assignee').references(() => users.id),
  suggestedReason: text('suggested_reason'),
  requestedBy: integer('requested_by').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  overrideReason: text('override_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 11. notifications（通知）
// ============================================================
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  entityTitle: varchar('entity_title', { length: 500 }).notNull(),
  message: text('message').notNull(),
  triggeredBy: integer('triggered_by').references(() => users.id).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 12. conversations（AI 对话）
// ============================================================
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull().default(1),
  userId: integer('user_id').references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  starred: boolean('starred').default(false).notNull(),
  projectId: integer('project_id').references(() => projects.id),
  projectName: varchar('project_name', { length: 255 }),
  visibility: varchar('visibility', { length: 50 }).notNull().default('private'),
  systemPrompt: text('system_prompt'),
  isArchived: boolean('is_archived').default(false).notNull(),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 14. token_usage（Token 用量记录）
// ============================================================
export const tokenUsage = pgTable('token_usage', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  conversationId: integer('conversation_id').references(() => conversations.id),
  model: varchar('model', { length: 100 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costUsd: varchar('cost_usd', { length: 20 }),
  purpose: varchar('purpose', { length: 50 }).notNull().default('chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// 15. user_memories（用户记忆）
// ============================================================
export const userMemories = pgTable('user_memories', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  orgId: integer('org_id').references(() => organizations.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  content: text('content').notNull(),
  source: varchar('source', { length: 20 }).default('auto'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// 13. chat_messages（对话消息）
// ============================================================
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('text'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Relations 定义
// ============================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  departments: many(departments),
  users: many(users),
  projects: many(projects),
  memberships: many(orgMemberships),
  invitations: many(invitations),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.orgId],
    references: [organizations.id],
  }),
  parentDept: one(departments, {
    fields: [departments.parentDeptId],
    references: [departments.id],
    relationName: 'parentChild',
  }),
  childDepts: many(departments, { relationName: 'parentChild' }),
  users: many(users),
  projects: many(projects),
}));

export const jobRolesRelations = relations(jobRoles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobRoles.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [jobRoles.deptId],
    references: [departments.id],
  }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [users.deptId],
    references: [departments.id],
  }),
  jobRole: one(jobRoles, {
    fields: [users.jobRoleId],
    references: [jobRoles.id],
  }),
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  comments: many(taskComments),
  participatedTasks: many(taskParticipants),
  memberships: many(orgMemberships),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [projects.deptId],
    references: [departments.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'taskHierarchy',
  }),
  subtasks: many(tasks, { relationName: 'taskHierarchy' }),
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
    relationName: 'taskCreator',
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  comments: many(taskComments),
  participants: many(taskParticipants),
  deliverables: many(taskDeliverables),
  submissions: many(taskSubmissions),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: 'dependentTask',
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: 'prerequisiteTask',
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const taskParticipantsRelations = relations(taskParticipants, ({ one }) => ({
  task: one(tasks, {
    fields: [taskParticipants.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskParticipants.userId],
    references: [users.id],
  }),
}));

export const taskDeliverablesRelations = relations(taskDeliverables, ({ one }) => ({
  task: one(tasks, { fields: [taskDeliverables.taskId], references: [tasks.id] }),
  organization: one(organizations, { fields: [taskDeliverables.orgId], references: [organizations.id] }),
  submitter: one(users, { fields: [taskDeliverables.submittedBy], references: [users.id], relationName: 'deliverableSubmitter' }),
  reviewer: one(users, { fields: [taskDeliverables.reviewedBy], references: [users.id], relationName: 'deliverableReviewer' }),
}));

export const taskSubmissionsRelations = relations(taskSubmissions, ({ one }) => ({
  task: one(tasks, { fields: [taskSubmissions.taskId], references: [tasks.id] }),
  organization: one(organizations, { fields: [taskSubmissions.orgId], references: [organizations.id] }),
  submitter: one(users, { fields: [taskSubmissions.submittedBy], references: [users.id], relationName: 'submissionSubmitter' }),
  reviewer: one(users, { fields: [taskSubmissions.reviewedBy], references: [users.id], relationName: 'submissionReviewer' }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const verdictsRelations = relations(verdicts, ({ one }) => ({
  task: one(tasks, {
    fields: [verdicts.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [verdicts.userId],
    references: [users.id],
    relationName: 'verdictUser',
  }),
  suggestedUser: one(users, {
    fields: [verdicts.suggestedAssignee],
    references: [users.id],
    relationName: 'suggestedAssignee',
  }),
  requestedByUser: one(users, {
    fields: [verdicts.requestedBy],
    references: [users.id],
    relationName: 'verdictRequester',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'notificationRecipient',
  }),
  triggeredByUser: one(users, {
    fields: [notifications.triggeredBy],
    references: [users.id],
    relationName: 'notificationTrigger',
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  messages: many(chatMessages),
  tokenUsages: many(tokenUsage),
}));

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  organization: one(organizations, {
    fields: [tokenUsage.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [tokenUsage.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [tokenUsage.conversationId],
    references: [conversations.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [chatMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const userMemoriesRelations = relations(userMemories, ({ one }) => ({
  user: one(users, {
    fields: [userMemories.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userMemories.orgId],
    references: [organizations.id],
  }),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, {
    fields: [orgMemberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [orgMemberships.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [orgMemberships.deptId],
    references: [departments.id],
  }),
  jobRole: one(jobRoles, {
    fields: [orgMemberships.jobRoleId],
    references: [jobRoles.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [invitations.createdBy],
    references: [users.id],
    relationName: 'invitationCreator',
  }),
  acceptedByUser: one(users, {
    fields: [invitations.acceptedBy],
    references: [users.id],
    relationName: 'invitationAcceptor',
  }),
}));

export const organizationJoinRequestsRelations = relations(organizationJoinRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationJoinRequests.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationJoinRequests.userId],
    references: [users.id],
    relationName: 'joinRequestUser',
  }),
  reviewer: one(users, {
    fields: [organizationJoinRequests.reviewedBy],
    references: [users.id],
    relationName: 'joinRequestReviewer',
  }),
}));

// ============================================================
// Insert Schemas & Types
// ============================================================

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

export const insertJobRoleSchema = createInsertSchema(jobRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobRole = z.infer<typeof insertJobRoleSchema>;
export type JobRole = typeof jobRoles.$inferSelect;

export const insertTaskParticipantSchema = createInsertSchema(taskParticipants).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskParticipant = z.infer<typeof insertTaskParticipantSchema>;
export type TaskParticipant = typeof taskParticipants.$inferSelect;

export const insertVerdictSchema = createInsertSchema(verdicts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVerdict = z.infer<typeof insertVerdictSchema>;
export type Verdict = typeof verdicts.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertTokenUsageSchema = createInsertSchema(tokenUsage).omit({
  id: true,
  createdAt: true,
});
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenUsage = typeof tokenUsage.$inferSelect;

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertUserMemorySchema = createInsertSchema(userMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type UserMemory = typeof userMemories.$inferSelect;

export const insertOrgMembershipSchema = createInsertSchema(orgMemberships).omit({
  id: true,
  joinedAt: true,
});
export type InsertOrgMembership = z.infer<typeof insertOrgMembershipSchema>;
export type OrgMembership = typeof orgMemberships.$inferSelect;

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  usedCount: true,
});
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export const insertOrganizationJoinRequestSchema = createInsertSchema(organizationJoinRequests);
export type OrganizationJoinRequest = typeof organizationJoinRequests.$inferSelect;
export type InsertOrganizationJoinRequest = typeof organizationJoinRequests.$inferInsert;

export const insertTaskDeliverableSchema = createInsertSchema(taskDeliverables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
});
export type InsertTaskDeliverable = z.infer<typeof insertTaskDeliverableSchema>;
export type TaskDeliverable = typeof taskDeliverables.$inferSelect;

export const insertTaskSubmissionSchema = createInsertSchema(taskSubmissions).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskSubmission = z.infer<typeof insertTaskSubmissionSchema>;
export type TaskSubmission = typeof taskSubmissions.$inferSelect;

export * from "./models/auth";
