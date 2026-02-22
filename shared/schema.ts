import { pgTable, serial, varchar, text, integer, boolean, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
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
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
// Relations 定义
// ============================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  departments: many(departments),
  users: many(users),
  projects: many(projects),
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
