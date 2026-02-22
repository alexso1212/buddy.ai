# 德湃任务中心 (Depai Task Center) - V6 Rebuild

## Overview
Team task management system for Deltapex Education (financial education company). Complete backend rebuild with simplified 8-table data model using serial integer IDs. Backend-first approach: CRUD API foundation complete, frontend pending rebuild.

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

## Recent Changes
- 2026-02-22: V6 Complete backend rebuild - 8-table schema (serial IDs), full CRUD API, seed script, enriched GET endpoints (project owner, project tasks, task subtasks/deps/comments)
