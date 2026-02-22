# 德湃任务中心 (Depai Task Center)

## Overview
Depai Task Center is a comprehensive team task management system designed for Deltapex Education, a financial education company. The project, currently in its V6 rebuild, features an 11-table data model with serial integer IDs, a full CRUD API, and an 8-page frontend with sidebar navigation. It aims to streamline task organization, enhance collaboration, and integrate advanced AI capabilities for task assignment, review, and dynamic assistance. The system supports various user roles with distinct access levels, ensuring a hierarchical and efficient workflow for managing organizations, departments, users, projects, and tasks.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application is built with an Express.js backend, a React (TypeScript) frontend utilizing Vite, and PostgreSQL with Drizzle ORM for data persistence. Tailwind CSS and shadcn/ui components are used for styling and UI elements, while `wouter` handles frontend routing.

**Core Data Model:**
The system uses an 11-table PostgreSQL database schema, including `organizations`, `departments`, `users`, `projects`, `tasks`, `task_dependencies`, `activity_logs`, `task_comments`, `job_roles`, `verdicts`, and `notifications`. All tables use serial integer IDs.

**Backend (API):**
- **RESTful API:** Provides full CRUD operations for all entities, with unified `{data}/{error}` response formats.
- **Validation:** Zod is used for API request validation.
- **Activity Logging:** All mutations automatically generate entries in `activity_logs`.
- **Role-Based Access Control:** Differentiates access for 'owner', 'admin', 'head', and 'member' roles.
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.

**Frontend (UI/UX):**
- **Single Page Application:** Built with React and `wouter` for routing.
- **Layout:** Features an 8-page structure with a persistent sidebar navigation (240px, dark background) and a main content area.
- **Design System:** Follows a "Claude-style" warm theme with a specific color palette (warm beige, terracotta orange) and typography (sans-serif for UI, serif for AI replies). Components feature rounded corners and subtle shadows. Dark mode is fully supported.
- **Pages:**
    - **Dashboard:** Overview statistics and user-specific task lists.
    - **Agent:** Full-page AI chat interface with a welcome screen, suggestion cards, and structured options for AI interaction.
    - **Project List/Detail:** Management and viewing of projects and their associated tasks.
    - **Task List/Detail:** Comprehensive task management, including subtasks, dependencies, comments, participant management, and verdict integration. Features inline status changes and filtering.
    - **Team:** User management, department hierarchy, and job role definitions.
    - **Settings:** Organization-level information.
- **AI Chat Components:** Includes a floating chat button, a main chat panel managing history and state, various message bubble types, action confirmation cards, and a robust input bar.
- **Verdict Feature UI:** Integrated verdict displays with color-coding (green/yellow/red/blue) and actions for accepting or overriding verdicts.
- **Needs Review Feature:** Tasks with incomplete information (`needsReview=true`) are flagged with warnings and a dedicated filter.
- **Mobile Optimization:** Responsive layouts with specific adaptations for smaller screens, such as swipeable task cards, compact stats, and tab navigation on detail pages.

**AI Subsystem:**
- **OpenAI SDK:** Utilizes OpenAI SDK with OpenRouter, leveraging models like `claude-sonnet-4` for various tasks.
- **Contextual Prompts:** System prompts are dynamically generated with relevant team, project, and task context.
- **Action Schemas:** Zod schemas define available AI actions (e.g., `create_task`, `update_task`, `query_tasks`, `create_project`, `add_comment`).
- **Action Executor:** Processes and executes confirmed AI actions, logging their source as `ai_chat`.
- **Verdict Service:** An AI-powered service for judging task-user assignments, determining scope, confidence, and suggesting assignees.
- **Structured Follow-up:** When AI detects missing information, it provides structured, clickable options for users to complete task details, auto-populating choices from the database.

## External Dependencies
- **PostgreSQL:** Primary database.
- **OpenAI API (via OpenRouter):** For AI chat and verdict generation, using models like `claude-sonnet-4`.
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **Express.js:** Web application framework for the backend.
- **React:** Frontend JavaScript library.
- **Vite:** Build tool for the frontend.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** Reusable UI components.
- **wouter:** Small routing library for React.
- **Zod:** Schema declaration and validation library.