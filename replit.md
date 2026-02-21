# 德湃任务中心 (Depai Task Center)

## Overview
Team task management board for a 16-person financial education company. Round 1: Login + Dashboard + Status management + JSON sync.

## Tech Stack
- Express.js + Vite + React (TypeScript)
- PostgreSQL with Drizzle ORM
- JWT auth (jose) with httpOnly cookies
- Tailwind CSS + shadcn/ui components
- wouter for frontend routing

## Project Structure
- `shared/schema.ts` - Database schema (users, phases, tasks, task_assignees, task_logs)
- `server/storage.ts` - DatabaseStorage class with Drizzle ORM
- `server/routes.ts` - API routes with JWT auth middleware
- `client/src/lib/auth.tsx` - AuthProvider context
- `client/src/lib/utils.ts` - Status/priority/deadline helpers
- `client/src/pages/login.tsx` - Invite code login page
- `client/src/pages/dashboard.tsx` - Main dashboard with 3 tabs
- `client/src/pages/sync.tsx` - JSON sync page (CEO only)

## Key Features
1. Invite code login (format: DP-XXXX-XXXX)
2. Dashboard with 3 tabs: My Tasks, All Tasks, People View
3. Task status transitions: pending → active → review → done
4. Dependency blocking (depends_on field)
5. JSON sync for batch operations (CEO only)

## Roles
- CEO (alex): Full access
- Admin (tina): Full view/edit, no delete
- Head (anzhou): Own + department tasks
- Staff: Own tasks only, status changes only

## API Routes
- POST /api/auth/login, /api/auth/logout, GET /api/auth/me
- GET /api/tasks?view=mine|all|people, PATCH /api/tasks/:id
- GET /api/phases, GET /api/users
- POST /api/sync, GET /api/sync/history
- POST /api/seed (initial data)

## Database
- 16 users, 4 phases, 40+ tasks seeded via POST /api/seed

## Recent Changes
- 2026-02-21: Initial build - all Round 1 features complete
