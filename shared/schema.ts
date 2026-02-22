import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, serial, primaryKey, boolean, numeric, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#888"),
  parent_id: text("parent_id"),
  head_id: text("head_id"),
  sort_order: integer("sort_order").default(0),
  description: text("description"),
  kpi_description: text("kpi_description"),
  compensation_note: text("compensation_note"),
  budget_note: text("budget_note"),
  is_planned: boolean("is_planned").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  dept: text("dept"),
  dept_id: text("dept_id").references(() => departments.id),
  role: text("role").notNull().default("staff"),
  invite_code: text("invite_code").notNull().unique(),
  color: text("color").default("#888"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const phases = pgTable("phases", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  date_range: text("date_range"),
  color: text("color"),
  sort_order: integer("sort_order").default(0),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  objective: text("objective"),
  acceptance_criteria: text("acceptance_criteria"),
  owner_id: text("owner_id").references(() => users.id),
  created_by: text("created_by").references(() => users.id),
  deadline: text("deadline"),
  status: text("status").default("active"),
  priority: integer("priority").default(1),
  scope: text("scope").default("company"),
  department_id: text("department_id").references(() => departments.id),
  color: text("color"),
  member_ids: text("member_ids").array(),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at").defaultNow(),
  completed_at: timestamp("completed_at"),
});

export const modules = pgTable("modules", {
  id: text("id").primaryKey(),
  project_id: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  phase: text("phase").references(() => phases.id),
  deadline: text("deadline").notNull(),
  grace_deadline: text("grace_deadline"),
  deliverable: text("deliverable"),
  reviewer_id: text("reviewer_id").references(() => users.id),
  feishu_link: text("feishu_link"),
  status: text("status").default("pending"),
  priority: integer("priority").default(0),
  parent_id: text("parent_id"),
  depends_on: text("depends_on"),
  project_id: text("project_id").references(() => projects.id),
  module_id: text("module_id").references(() => modules.id),
  related_project_ids: text("related_project_ids").array(),
  is_milestone: boolean("is_milestone").default(false),
  sort_order: integer("sort_order").default(0),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  completed_at: timestamp("completed_at"),
});

export const task_assignees = pgTable("task_assignees", {
  task_id: text("task_id").notNull().references(() => tasks.id),
  user_id: text("user_id").notNull().references(() => users.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.task_id, table.user_id] }),
}));

export const task_logs = pgTable("task_logs", {
  id: serial("id").primaryKey(),
  task_id: text("task_id"),
  user_id: text("user_id"),
  action: text("action").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value"),
  created_at: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => users.id),
  task_id: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  is_read: boolean("is_read").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const eval_periods = pgTable("eval_periods", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("monthly"),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  scoring_deadline: text("scoring_deadline"),
  status: text("status").default("draft"),
  created_by: text("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

export const eval_scores = pgTable("eval_scores", {
  id: serial("id").primaryKey(),
  period_id: text("period_id").notNull().references(() => eval_periods.id),
  user_id: text("user_id").notNull().references(() => users.id),
  scorer_id: text("scorer_id").notNull().references(() => users.id),
  scorer_role: text("scorer_role").notNull(),
  dimension: text("dimension").notNull(),
  score: numeric("score").notNull(),
  auto_calculated: boolean("auto_calculated").default(false),
  comment: text("comment"),
  overridden_by: text("overridden_by").references(() => users.id),
  overridden_at: timestamp("overridden_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const eval_rules = pgTable("eval_rules", {
  id: serial("id").primaryKey(),
  dimension: text("dimension").notNull().unique(),
  label: text("label").notNull(),
  weight: numeric("weight").notNull(),
  formula: text("formula"),
  updated_by: text("updated_by").references(() => users.id),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  filesize: integer("filesize"),
  mime_type: text("mime_type"),
  created_at: timestamp("created_at").defaultNow(),
});

export const org_changes = pgTable("org_changes", {
  id: serial("id").primaryKey(),
  requested_by: text("requested_by").notNull().references(() => users.id),
  change_type: text("change_type").notNull(),
  target_type: text("target_type").notNull(),
  target_id: text("target_id").notNull(),
  old_value: jsonb("old_value"),
  new_value: jsonb("new_value"),
  status: text("status").default("pending"),
  reviewed_by: text("reviewed_by").references(() => users.id),
  review_note: text("review_note"),
  created_at: timestamp("created_at").defaultNow(),
  reviewed_at: timestamp("reviewed_at"),
});


export const task_claims = pgTable("task_claims", {
  id: serial("id").primaryKey(),
  project_id: text("project_id").notNull().references(() => projects.id),
  user_id: text("user_id").notNull().references(() => users.id),
  status: text("status").default("pending"),
  notified_at: timestamp("notified_at").defaultNow(),
  claimed_at: timestamp("claimed_at"),
  rejected_at: timestamp("rejected_at"),
  reject_reason: text("reject_reason"),
  escalated_at: timestamp("escalated_at"),
  escalated_to: text("escalated_to").references(() => users.id),
  escalation_result: text("escalation_result"),
  escalation_note: text("escalation_note"),
  nudge_count: integer("nudge_count").default(0),
  last_nudge_at: timestamp("last_nudge_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const cross_dept_requests = pgTable("cross_dept_requests", {
  id: serial("id").primaryKey(),
  project_id: text("project_id").notNull().references(() => projects.id),
  requested_by: text("requested_by").notNull().references(() => users.id),
  target_user_id: text("target_user_id").notNull().references(() => users.id),
  target_dept_id: text("target_dept_id").references(() => departments.id),
  status: text("status").default("pending"),
  ceo_approved: boolean("ceo_approved"),
  ceo_approved_at: timestamp("ceo_approved_at"),
  dept_head_id: text("dept_head_id").references(() => users.id),
  dept_head_approved: boolean("dept_head_approved"),
  dept_head_approved_at: timestamp("dept_head_approved_at"),
  reject_reason: text("reject_reason"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  created_at: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
});

export const insertPhaseSchema = createInsertSchema(phases).omit({
  id: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  created_at: true,
  updated_at: true,
  completed_at: true,
});

export const insertTaskAssigneeSchema = createInsertSchema(task_assignees);

export const insertTaskLogSchema = createInsertSchema(task_logs).omit({
  id: true,
  created_at: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  created_at: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  created_at: true,
});

export const insertEvalPeriodSchema = createInsertSchema(eval_periods).omit({
  created_at: true,
});

export const insertEvalScoreSchema = createInsertSchema(eval_scores).omit({
  id: true,
  created_at: true,
});

export const insertEvalRuleSchema = createInsertSchema(eval_rules).omit({
  id: true,
  updated_at: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  created_at: true,
});

export const analysis_cache = pgTable("analysis_cache", {
  id: text("id").primaryKey().default("daily"),
  data: jsonb("data").notNull(),
  computed_at: timestamp("computed_at").defaultNow(),
});

export const insertOrgChangeSchema = createInsertSchema(org_changes).omit({
  id: true,
  created_at: true,
  reviewed_at: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  created_at: true,
  completed_at: true,
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  created_at: true,
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPhase = z.infer<typeof insertPhaseSchema>;
export type Phase = typeof phases.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskAssignee = z.infer<typeof insertTaskAssigneeSchema>;
export type TaskAssignee = typeof task_assignees.$inferSelect;

export type InsertTaskLog = z.infer<typeof insertTaskLogSchema>;
export type TaskLog = typeof task_logs.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export type InsertEvalPeriod = z.infer<typeof insertEvalPeriodSchema>;
export type EvalPeriod = typeof eval_periods.$inferSelect;

export type InsertEvalScore = z.infer<typeof insertEvalScoreSchema>;
export type EvalScore = typeof eval_scores.$inferSelect;

export type InsertEvalRule = z.infer<typeof insertEvalRuleSchema>;
export type EvalRule = typeof eval_rules.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

export type InsertOrgChange = z.infer<typeof insertOrgChangeSchema>;
export type OrgChange = typeof org_changes.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;

export const insertTaskClaimSchema = createInsertSchema(task_claims).omit({
  id: true,
  created_at: true,
});

export const insertCrossDeptRequestSchema = createInsertSchema(cross_dept_requests).omit({
  id: true,
  created_at: true,
});

export type InsertTaskClaim = z.infer<typeof insertTaskClaimSchema>;
export type TaskClaim = typeof task_claims.$inferSelect;

export type InsertCrossDeptRequest = z.infer<typeof insertCrossDeptRequestSchema>;
export type CrossDeptRequest = typeof cross_dept_requests.$inferSelect;
