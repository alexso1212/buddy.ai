# 德湃任务中心 (Depai Task Center) - V6 Rebuild

## Overview
Team task management system for Deltapex Education (financial education company). Complete V6 rebuild with 11-table data model using serial integer IDs. Full CRUD API + 8-page frontend with sidebar navigation.

## Tech Stack
- Express.js + Vite + React (TypeScript)
- PostgreSQL with Drizzle ORM (pg driver)
- Tailwind CSS + shadcn/ui components
- wouter for frontend routing

## Project Structure
- `shared/schema.ts` - Database schema: 11 tables (organizations, departments, users, projects, tasks, task_dependencies, activity_logs, task_comments, task_participants, job_roles, verdicts)
- `server/storage.ts` - DatabaseStorage class with CRUD methods for all 8 tables
- `server/routes.ts` - REST API routes with Zod validation, unified response format, auto activity logging
- `server/seed.ts` - Seed script: Deltapex Education org, 5 departments, CEO user
- `01-data-model-spec.md` - Data model specification
- `02-crud-ui-spec.md` - CRUD API + UI specification

## Database Schema (8 tables, serial IDs)
1. **organizations** - id, name, slug, logoUrl, plan, createdAt, updatedAt
2. **departments** - id, orgId, name, parentId, headId, sortOrder, createdAt, updatedAt
3. **users** - id, orgId, deptId, email, displayName, avatarUrl, role (owner/admin/head/member), isActive, createdAt, updatedAt
4. **projects** - id, orgId, deptId, name, description, status (active/paused/completed/archived), ownerId, startDate, targetDate, createdAt, updatedAt
5. **tasks** - id, orgId, projectId, parentTaskId, title, description, type (task/milestone), status (todo/in_progress/in_review/done/cancelled), priority (low/medium/high/urgent), creatorId, assigneeId, startDate, dueDate, completedAt, weight, progress, tags, createdAt, updatedAt
6. **task_dependencies** - id, taskId (blocked), dependsOnTaskId (blocker), type (finish_to_start), createdAt
7. **activity_logs** - id, orgId, userId, entityType, entityId, action, changes, source (manual/automation/system), createdAt
8. **task_comments** - id, taskId, userId, content, createdAt, updatedAt

## API Routes (REST, unified {data}/{error} format)
- GET/POST /api/organizations
- GET/POST /api/departments, PATCH/DELETE /api/departments/:id
- GET/POST /api/users, PATCH/DELETE /api/users/:id
- GET /api/projects (includes owner info), POST /api/projects
- GET /api/projects/:id (includes tasks), PATCH/DELETE /api/projects/:id
- GET /api/tasks (filters: projectId, assigneeId, status, parentTaskId; includes participants), POST /api/tasks
- GET /api/tasks/:id (includes subtasks, dependencies, comments, participants), PATCH/DELETE /api/tasks/:id
- GET /api/tasks/:id/dependencies, POST/DELETE /api/task-dependencies/:id
- GET /api/tasks/:id/comments, POST /api/tasks/:id/comments
- GET/POST /api/tasks/:id/participants, DELETE /api/tasks/:taskId/participants/:userId
- GET /api/activity-logs (filters: entityType, entityId)

## API Conventions
- POST: Zod safeParse validation, 201 on success
- PATCH: 404 if not found, returns updated record
- DELETE: 404 if not found, returns { success: true }
- All mutations auto-write to activity_logs
- Error: { error: string }, Success: { data: ... }

## Roles
- owner (Alexso/CEO): Full access
- admin: Full view/edit
- head: Department scope
- member: Own tasks

## Seed Data
- Organization: Deltapex Education (id: 1)
- Departments: 管理层, 课程研发, 市场运营, 技术开发, 交易策略
- CEO user: Alexso (id: 1, role: owner)

## Frontend Pages (8 pages, sidebar + content layout)
- `client/src/App.tsx` - Sidebar navigation (240px, dark bg) + content area, responsive mobile menu
- `client/src/pages/dashboard.tsx` - Stats cards (total/in-progress/completed/overdue) + my tasks table with participant avatars
- `client/src/pages/agent.tsx` - Full-page AI chat interface (replaces floating button), max-w-3xl centered layout
- `client/src/pages/project-list.tsx` - Projects table with owner, new project modal
- `client/src/pages/project-detail.tsx` - Project info + task table, edit project modal, new task modal
- `client/src/pages/task-list.tsx` - Task table with filters (project/status/assignee), inline status change, participant avatars column, new task modal
- `client/src/pages/task-detail.tsx` - Full task info, participant management (add/remove), subtasks, dependencies, comments, activity log, verdict
- `client/src/pages/team.tsx` - User list + department tree + job roles (3 tabs), add/edit/delete
- `client/src/pages/settings.tsx` - Organization info (read-only)

## Shared Components
- `client/src/components/ParticipantAvatars.tsx` - Overlapping avatar circles with click-to-expand popup showing full participant list with role labels

## Status Colors (Tailwind)
- todo: bg-gray-200 text-gray-700
- in_progress: bg-yellow-200 text-yellow-700
- in_review: bg-blue-200 text-blue-700
- done: bg-green-200 text-green-700
- cancelled: bg-gray-400 text-gray-800

## Priority Colors
- urgent: bg-red-100 text-red-700
- high: bg-orange-100 text-orange-700
- medium: bg-blue-100 text-blue-700
- low: bg-gray-100 text-gray-600

## AI Chat Components
- `client/src/components/ai/AiChatButton.tsx` - Floating 56px circular button at bottom-right
- `client/src/components/ai/AiChatPanel.tsx` - Main chat panel (400px, 70vh), manages messages/history/loading state
- `client/src/components/ai/AiMessageBubble.tsx` - Message bubbles (user/assistant/system/confirm/multi_confirm)
- `client/src/components/ai/AiConfirmCard.tsx` - Action confirmation card with per-action confirm/reject
- `client/src/components/ai/AiInputBar.tsx` - Input bar with Enter-to-send, Shift+Enter for newline

## AI Backend (server/services/ai/)
- `index.ts` - OpenAI SDK with OpenRouter baseURL, claude-sonnet-4 model
- `prompts.ts` - System prompt with dynamic team/project/task context
- `actionSchemas.ts` - Zod schemas for create_task, update_task, query_tasks, create_project, add_comment
- `actionExecutor.ts` - Executes confirmed actions with ai_chat source logging
- `verdictService.ts` - AI verdict judgment service using claude-sonnet-4, temp=0.1
- API routes: POST /api/ai/chat, POST /api/ai/confirm

## Database Schema (10 tables, serial IDs)
### New tables (AI Verdict feature)
9. **job_roles** - id, orgId, deptId, title, description, responsibilities (JSON string), boundaries (JSON string), requiredSkills (JSON string), createdAt, updatedAt
10. **verdicts** - id, orgId, taskId, userId, verdict (in_scope/stretch/out_of_scope/shared), confidence (0-100), reasoning, matchedResponsibilities, suggestedAssignee, suggestedReason, requestedBy, status (pending/completed/accepted/overridden), overrideReason, createdAt, updatedAt
- **users** table now has `jobRoleId` field linking to job_roles

## API Routes (Verdict feature)
- GET/POST/PATCH/DELETE /api/job-roles - Job role CRUD
- PATCH /api/users/:id/job-role - Assign job role to user
- POST /api/verdicts/judge - AI judges task-user assignment
- POST /api/verdicts/judge-assignment - Auto-judge during task assignment
- GET /api/verdicts/task/:taskId - Get verdicts for a task
- GET /api/verdicts/user/:userId - Get verdicts for a user
- PATCH /api/verdicts/:id/accept - Accept verdict
- PATCH /api/verdicts/:id/override - Override verdict (requires reason)
- GET /api/verdicts/stats - Verdict statistics by user

## Seed Data (Job Roles)
- CEO / 总经理 → Alexso
- HR/行政主管 → Tina
- VP/运营总监 → 安洲
- 技术开发工程师 → Michael
- 市场运营专员 → Apple, 唐张世涵
- 交易策略分析师 → 刘建烨

## needsReview Feature
- **tasks** table has `needsReview` (boolean, default false) and `warnings` (text, JSON string array)
- AI system prompt instructs to add warnings array to create_task data when info is incomplete
- actionExecutor sets needsReview=true and serializes warnings to JSON when present
- AiConfirmCard shows warnings in yellow section, has skip/confirm/cancel buttons
- Dashboard: 5th stat card "待补充" (amber), ⚠️ icon on needsReview task titles
- Task list: "待补充信息" filter option, ⚠️ icon on titles
- Task detail: yellow banner with warnings + "标记为已完善" button (PATCHes needsReview=false)

## API Routes (Stats)
- GET /api/stats/overview - Returns totalTasks, inProgressCount, completedCount, overdueCount, needsReviewCount, todayNew, weekNew, monthNew

## AI Follow-Up (Structured Options)
- When AI detects missing fields for create_task (projectId, assigneeId, priority, dueDate, type), returns `follow_up` type response
- `AiFollowUpCard` component renders clickable option buttons instead of text questions
- Options auto-populated from DB: projects list, users list, fixed priority/date/type options
- User clicks options → submits → AI returns confirm card with complete data
- Custom input supported for dueDate (allowCustom flag)
- Backend: `buildFollowUpResponse()` in `server/services/ai/index.ts` generates options
- Triggers: AI returns follow_up type, Zod validation fails with title present, confidence < 0.7 with missing key fields

## Recent Changes
- 2026-02-22: AI follow-up structured options - AiFollowUpCard with clickable buttons for missing fields, replaces text-based follow-up questions
- 2026-02-22: Fix duplicate task creation (confirm button disables on click), cache invalidation after AI confirm (invalidates /api/tasks, /api/projects, /api/stats/overview), dashboard two-row stats (row 1: overview, row 2: today/week/month new), AI chat sessionStorage persistence with clear button
- 2026-02-22: V6 Complete backend rebuild - 8-table schema (serial IDs), full CRUD API, seed script, enriched GET endpoints (project owner, project tasks, task subtasks/deps/comments)
- 2026-02-22: V6 Frontend rebuild - 7 pages with sidebar navigation, all CRUD operations, status color badges, filter bar, inline status change, subtasks/deps/comments on task detail
- 2026-02-22: Graph visualization (Round 1) - D3.js force-directed graph on /graph page, /api/graph/data and /api/graph/subtasks/:taskId endpoints, ForceGraph component with node size by weight (radius=12+weight*4), status colors, blocking/non-blocking link styles with arrows, cluster force grouping by project, zoom/pan/drag, hover highlight, detail panel, toolbar filters (project + status), legend, default hide done/cancelled
- 2026-02-22: AI Chat (Round 1) - OpenAI SDK with OpenRouter, Claude 3.5 Haiku model, floating chat button + panel, confirm cards with per-action states, multi_confirm support, follow-up questions, activity logging with ai_chat source
- 2026-02-22: AI Verdict (Round 1) - job_roles + verdicts tables, jobRoleId on users, verdict service with claude-sonnet-4 (temp=0.1), job-roles CRUD API, verdict judge/accept/override/stats APIs, 6 job role seed data with user assignments
- 2026-02-22: AI Verdict (Round 2) - Team page 3-tab layout (members/departments/job roles), job role column in members table, TagListEditor for responsibilities/boundaries/skills CRUD, task detail verdict button with VerdictCard (color-coded: green/yellow/red/blue), accept/override verdict actions
- 2026-02-22: AI Verdict (Round 3) - System prompt adds judge_assignment + query_verdicts actions, actionSchemas for both, actionExecutor calls verdictService for judge_assignment, query_verdicts returns per-user stats in executeQuery
- 2026-02-22: Dark mode - System prefers-color-scheme ThemeProvider with manual toggle (light/dark/system), all pages/components use CSS variable classes (bg-background, bg-card, text-foreground, text-muted-foreground, border-border), status/priority/verdict badges have dark: variants, sidebar uses bg-sidebar tokens, AI chat components dark-mode-aware
- 2026-02-22: Mobile UI optimization - Responsive layouts using md: breakpoint. Dashboard: compact stat cards + task card list. Task list: collapsible filter bar + task cards. Project list: project cards. Task detail: tab navigation (详情/子任务/依赖/评论/活动) to avoid long scrolling. Team: member cards. Desktop layout unchanged.
