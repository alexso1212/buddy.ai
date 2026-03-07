import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1),
  projectId: z.number(),
  description: z.string().optional(),
  type: z.enum(['milestone', 'task', 'subtask', 'bug', 'request']).default('task'),
  status: z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']).default('todo'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  assigneeId: z.number().optional(),
  dueDate: z.string().optional(),
  weight: z.number().min(1).max(10).default(3),
  parentTaskId: z.number().optional(),
  tags: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  ref: z.string().optional(),
  dependsOn: z.array(z.number()).optional(),
  dependsOnRef: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  taskId: z.number(),
  title: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assigneeId: z.number().optional(),
  dueDate: z.string().optional(),
  weight: z.number().min(1).max(10).optional(),
  progress: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  version: z.number().optional(),
});

export const queryTasksSchema = z.object({
  projectId: z.number().optional(),
  assigneeId: z.number().optional(),
  status: z.string().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  deptId: z.number().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
});

export const addCommentSchema = z.object({
  taskId: z.number(),
  content: z.string().min(1),
});

export const judgeAssignmentSchema = z.object({
  taskId: z.number(),
  userId: z.number(),
});

export const queryVerdictsSchema = z.object({
  userId: z.number().optional(),
  taskId: z.number().optional(),
});

export const createUserSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'head', 'member']).default('member'),
  deptId: z.number().optional(),
  jobRoleId: z.number().optional(),
});

export const updateUserSchema = z.object({
  userId: z.number(),
  displayName: z.string().optional(),
  role: z.enum(['owner', 'admin', 'head', 'member']).optional(),
  deptId: z.number().nullable().optional(),
  jobRoleId: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  parentDeptId: z.number().optional(),
});

export const resolveDecisionSchema = z.object({
  decisionTaskId: z.number(),
  updates: z.object({
    assigneeId: z.number().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    description: z.string().optional(),
    weight: z.number().min(1).max(10).optional(),
  }),
});

export const ACTION_SCHEMAS: Record<string, z.ZodSchema> = {
  create_task: createTaskSchema,
  update_task: updateTaskSchema,
  query_tasks: queryTasksSchema,
  create_project: createProjectSchema,
  add_comment: addCommentSchema,
  judge_assignment: judgeAssignmentSchema,
  query_verdicts: queryVerdictsSchema,
  create_user: createUserSchema,
  update_user: updateUserSchema,
  create_department: createDepartmentSchema,
  resolve_decision: resolveDecisionSchema,
};
