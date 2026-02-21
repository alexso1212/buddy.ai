import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, serial, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  dept: text("dept"),
  role: text("role").notNull().default("staff"),
  invite_code: text("invite_code").notNull().unique(),
  color: text("color").default("#888"),
  created_at: timestamp("created_at").defaultNow(),
});

export const phases = pgTable("phases", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  date_range: text("date_range"),
  color: text("color"),
  sort_order: integer("sort_order").default(0),
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
