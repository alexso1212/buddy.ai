# 德湃任务中心 (Depai Task Center) - V6 Rebuild

## Overview
Team task management system for Deltapex Education (financial education company). Complete V6 rebuild with simplified 8-table data model using serial integer IDs. Full CRUD API + 7-page frontend with sidebar navigation.

## Tech Stack
- Express.js + Vite + React (TypeScript)
- PostgreSQL with Drizzle ORM (pg driver)
- Tailwind CSS + shadcn/ui components
- wouter for frontend routing

## Project Structure
- `shared/schema.ts` - Database schema: 8 tables (organizations, departments, users, projects, tasks, task_dependencies, activity_logs, task_comments)
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
- GET /api/tasks (filters: projectId, assigneeId, status, parentTaskId), POST /api/tasks
- GET /api/tasks/:id (includes subtasks, dependencies, comments), PATCH/DELETE /api/tasks/:id
- GET /api/tasks/:id/dependencies, POST/DELETE /api/task-dependencies/:id
- GET /api/tasks/:id/comments, POST /api/tasks/:id/comments
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

## Frontend Pages (7 pages, sidebar + content layout)
- `client/src/App.tsx` - Sidebar navigation (240px, dark bg) + content area, responsive mobile menu
- `client/src/pages/dashboard.tsx` - Stats cards (total/in-progress/completed/overdue) + my tasks table
- `client/src/pages/project-list.tsx` - Projects table with owner, new project modal
- `client/src/pages/project-detail.tsx` - Project info + task table, edit project modal, new task modal
- `client/src/pages/task-list.tsx` - Task table with filters (project/status/assignee), inline status change, new task modal
- `client/src/pages/task-detail.tsx` - Full task info, subtasks, dependencies, comments, activity log
- `client/src/pages/team.tsx` - User list + department tree (2 tabs), add/edit/delete
- `client/src/pages/settings.tsx` - Organization info (read-only)

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

## Recent Changes
- 2026-02-22: V6 Complete backend rebuild - 8-table schema (serial IDs), full CRUD API, seed script, enriched GET endpoints (project owner, project tasks, task subtasks/deps/comments)
- 2026-02-22: V6 Frontend rebuild - 7 pages with sidebar navigation, all CRUD operations, status color badges, filter bar, inline status change, subtasks/deps/comments on task detail
