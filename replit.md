# 德湃任务中心 (Depai Task Center)

## Overview
Team task management board for a 16-person financial education company. V1: Login + Dashboard + Status management + JSON sync. V2: Notifications, Comments, Subtasks, Attachments, Automation Engine, KPI Evaluation, Overview Analytics. V3: Organization management, approval workflow, D3.js collaboration graph. V4: Evaluation dashboard analytics (radar/bar charts), Gantt chart, Excel export.

## Tech Stack
- Express.js + Vite + React (TypeScript)
- PostgreSQL with Drizzle ORM
- JWT auth (jose) with httpOnly cookies
- Tailwind CSS + shadcn/ui components
- wouter for frontend routing
- multer for file uploads
- D3.js for force-directed collaboration graph
- Recharts for radar/bar chart analytics
- SheetJS (xlsx) for Excel export

## Project Structure
- `shared/schema.ts` - Database schema (users, phases, tasks, task_assignees, task_logs, notifications, comments, eval_periods, eval_scores, eval_rules, attachments, departments, org_changes)
- `server/storage.ts` - DatabaseStorage class with Drizzle ORM
- `server/routes.ts` - API routes with JWT auth middleware
- `client/src/lib/auth.tsx` - AuthProvider context
- `client/src/lib/utils.ts` - Status/priority/deadline helpers
- `client/src/pages/login.tsx` - Invite code login page
- `client/src/pages/dashboard.tsx` - Main dashboard with 3 tabs, task detail (comments, subtasks, attachments)
- `client/src/pages/sync.tsx` - JSON sync page (CEO only)
- `client/src/pages/overview.tsx` - Overview analytics (stats, phase progress, risk board, activity)
- `client/src/pages/evaluation.tsx` - KPI evaluation (period management, scoring, rules)
- `client/src/pages/organization.tsx` - Organization management (dept tree, edit, approval workflow, history)
- `client/src/pages/collaboration.tsx` - D3.js force-directed collaboration graph
- `client/src/pages/gantt.tsx` - Gantt chart (CEO/Admin only, pure CSS+JS)

## Key Features
1. Invite code login (format: DP-XXXX-XXXX)
2. Dashboard with 3 tabs: My Tasks, All Tasks, People View
3. Task status transitions: pending → active → review → done
4. Dependency blocking (depends_on field) + auto-unblock on completion
5. JSON sync for batch operations (CEO only)
6. Notification system with bell icon, unread badge, 30s auto-polling
7. Comment system in task detail panel
8. Subtask checkboxes (add/toggle/delete, blocks parent task completion if incomplete)
9. File attachments upload/download (20MB limit, multer, /uploads directory)
10. Manual urge button (CEO/Admin, 24h cooldown per task)
11. Deadline escalation: 1-day warning, 3-day system urge, 7-day CEO escalation
12. Overview page: stats cards, phase progress bars, risk board (overdue tasks), recent activity
13. KPI Evaluation: period lifecycle (draft→scoring→review→published), auto-scoring (5 dimensions), manual quality rating, role hierarchy override
14. Organization management: department tree, edit/create/delete departments, user edit/move, CEO/Admin approval workflow
15. Collaboration graph: D3.js force-directed graph showing task-based relationships, status-colored links/nodes, department filtering, side panel details
16. Evaluation Dashboard: radar chart (6-axis, current vs previous period), team ranking table (sortable, trend arrows), department comparison stacked bar chart
17. Gantt Chart: pure CSS+JS timeline with status-colored bars, grace period extensions, dependency arrows (SVG), overdue indicators, phase collapse, day/week toggle, filters
18. Excel Export: 3-sheet .xlsx download (任务明细, 人员统计, 考核报告) with SheetJS

## Roles
- CEO (alex): Full access, evaluation override, urge capability
- Admin (tina): Full view/edit, no delete, urge capability, evaluation scoring
- Head (anzhou): Own + department tasks, department evaluation
- Staff: Own tasks only, status changes only

## API Routes
- POST /api/auth/login, /api/auth/logout, GET /api/auth/me
- GET /api/tasks?view=mine|all|people, PATCH /api/tasks/:id
- GET /api/phases, GET /api/users
- POST /api/sync, GET /api/sync/history
- POST /api/seed (initial data)
- GET/POST /api/comments/:taskId, DELETE /api/comments/:id
- GET /api/notifications, GET /api/notifications/unread-count, PATCH /api/notifications/:id/read, PATCH /api/notifications/read-all
- POST /api/tasks/:id/urge
- GET/POST /api/subtasks/:taskId, PATCH /api/subtasks/:id, DELETE /api/subtasks/:id
- GET /api/overview/stats
- POST /api/attachments/:taskId, GET /api/attachments/:taskId, GET /api/attachments/:id/download, DELETE /api/attachments/:id
- GET/POST /api/eval/periods, PATCH /api/eval/periods/:id, GET /api/eval/scores/:periodId, PATCH /api/eval/scores/:id, GET /api/eval/rules, POST /api/eval/rules
- GET/POST /api/departments, PATCH /api/departments/:id, DELETE /api/departments/:id
- PATCH /api/users/:id (org management)
- GET /api/org-changes, PATCH /api/org-changes/:id (approval workflow)
- GET /api/collaboration (force-directed graph data)
- GET /api/export/excel (3-sheet .xlsx download, CEO/Admin only)

## Automation Engine
- Runs passively on GET /api/tasks (no cron needed)
- checkDeadlines: triggers on task list load, creates overdue notifications with escalation tiers
- auto-unblock: when task completes, unblocks dependent tasks from pending→active
- Notification deduplication: hasNotificationToday prevents daily spam
- Urge cooldown: 24h between manual urges on same task

## Evaluation System
- Auto-score dimensions: timeliness (30%), overdue (20%), quality (25% manual), response (10%), collaboration (10%), subtask (5%)
- Period workflow: draft → scoring (triggers auto-score generation) → review → published (notifies all users)
- Role hierarchy for override: CEO (4) > Admin (3) > Head (2) > Staff (1)

## Database
- 16 users, 4 phases, 40+ tasks seeded via POST /api/seed
- 6 new tables for V2: notifications, comments, eval_periods, eval_scores, eval_rules, attachments

## Recent Changes
- 2026-02-21: Initial build - all Round 1 features complete
- 2026-02-21: V2 complete - notifications, comments, subtasks, attachments, automation, evaluation, overview analytics
- 2026-02-21: V3 complete - organization management, approval workflow, D3.js collaboration graph
- 2026-02-21: V4 complete - evaluation dashboard (radar/bar charts), Gantt chart, Excel export
- 2026-02-21: V4.1 Gantt redesign - Daily Analysis Panel (server-side: blockers, critical path, workload, due dates, next week lookahead with analysis_cache table), hover-based dependency highlighting, critical path toggle, clean default view (no arrows), legend bar, mobile responsive (tab toggle), analysis panel sidebar with refresh
