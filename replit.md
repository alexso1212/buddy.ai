# Buddy (AI Chat Application)

## Overview
Depai Task Center is a comprehensive team task management system designed for Deltapex Education, a financial education company. The project, currently in its V6 rebuild, features an 11-table data model with serial integer IDs, a full CRUD API, and an 8-page frontend with sidebar navigation. It aims to streamline task organization, enhance collaboration, and integrate advanced AI capabilities for task assignment, review, and dynamic assistance. The system supports various user roles with distinct access levels, ensuring a hierarchical and efficient workflow for managing organizations, departments, users, projects, and tasks.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

### Transparent Overlay & Floating Input Design Pattern
All pages with a top bar and/or bottom input area must follow this pattern:
- **Top bar:** Absolute positioned gradient overlay, height 108px, `linear-gradient(to bottom, rgba(30,29,26,0.99) 0%, transparent 100%)`, `pointerEvents: 'none'` on the gradient, interactive elements inside get `pointerEvents: 'auto'`. On agent page shows ModelSelector in center; other pages show "Buddy" title.
- **Bottom input area:** Three-layer structure:
  1. **Gradient transition** (40px): `linear-gradient(to top, rgba(30,29,26,0.85) 0%, transparent 100%)` — only at the boundary between content and the bar.
  2. **Input box zone** (no background plate): The background plate is masked/cut out using an SVG mask that precisely matches the input box shape (borderRadius: 20px), so text scrolling behind the input box is visible through it.
  3. **Bottom padding** below the input: `rgba(30,29,26,0.85)` with height `calc(3.33vh + env(safe-area-inset-bottom))`.
- **Input box itself:** `rgba(44, 43, 40, 0.50)` (50% opacity) with `backdropFilter: blur(16px)`, `border: 1px solid rgba(255,255,255,0.08)`, `borderRadius: 20`.
- **Key principle:** The input box should appear to "float" over the content. Text scrolling behind the input box should be faintly visible through it. The gradient only exists at the content/bar boundary; beyond that, opacity is uniform.
- **Apply this pattern** to every page that has a top bar and/or a text input area at the bottom.

## System Architecture
The application is built with an Express.js backend, a React (TypeScript) frontend utilizing Vite, and PostgreSQL with Drizzle ORM for data persistence. Tailwind CSS and shadcn/ui components are used for styling and UI elements, while `wouter` handles frontend routing.

**Core Data Model:**
The system uses a 14-table PostgreSQL database schema, including `organizations`, `departments`, `users`, `projects`, `tasks`, `task_dependencies`, `activity_logs`, `task_comments`, `job_roles`, `verdicts`, `notifications`, `conversations`, `chat_messages`, and `token_usage`. All tables use serial integer IDs.

**Backend (API):**
- **RESTful API:** Provides full CRUD operations for all entities, with unified `{data}/{error}` response formats.
- **Validation:** Zod is used for API request validation.
- **Activity Logging:** All mutations automatically generate entries in `activity_logs`.
- **Role-Based Access Control:** Differentiates access for 'owner', 'admin', 'head', and 'member' roles.
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **JWT Authentication:** Full user auth system with `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`. Uses bcryptjs for password hashing and jsonwebtoken for JWT (7-day expiry). Auth middleware (`server/middleware/auth.ts`) verifies JWT tokens.
- **Multi-Tenant Isolation:** `orgIsolation` middleware first attempts JWT token parsing for `orgId`/`currentUserId`, falling back to `x-org-id`/`x-user-id` headers (defaulting to org 1 / user 1). All API routes use `req.orgId` and `req.currentUserId`.
- **Token Usage Tracking:** Every AI call (chat, verdict) records prompt/completion tokens and cost to the `token_usage` table. `GET /api/token-usage/stats?period=7d|30d|90d` returns usage grouped by purpose and user.
- **Conversation Persistence:** AI chat supports `conversationId` parameter; when provided, history is loaded from DB and messages are persisted. Confirm actions write system messages to chat history.

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
- **Dual Claude Direct API + OpenRouter:** Three OpenAI SDK clients route to different providers based on model selection:
  - `CLAUDE_COMPLEX_API_KEY` → Anthropic direct API for complex models (Claude Opus 4)
  - `CLAUDE_SIMPLE_API_KEY` → Anthropic direct API for simple models (Claude Sonnet 4, Claude Haiku 3.5)
  - `AI_API_KEY` + `AI_BASE_URL` → OpenRouter for other models (GPT-4o, DeepSeek, etc.)
- **Model routing:** `getClientForModel()` in `server/services/ai/index.ts` selects the correct client based on model ID.
- **Contextual Prompts:** System prompts are dynamically generated with relevant team, project, and task context.
- **Action Schemas:** Zod schemas define available AI actions (e.g., `create_task`, `update_task`, `query_tasks`, `create_project`, `add_comment`).
- **Action Executor:** Processes and executes confirmed AI actions, logging their source as `ai_chat`.
- **Verdict Service:** An AI-powered service for judging task-user assignments, determining scope, confidence, and suggesting assignees.
- **Structured Follow-up:** When AI detects missing information, it provides structured, clickable options for users to complete task details, auto-populating choices from the database.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Anthropic Claude API (Direct):** Two API keys for complex (Opus) and simple (Sonnet/Haiku) models via OpenAI-compatible endpoint `https://api.anthropic.com/v1/`.
- **OpenAI API (via OpenRouter):** Fallback for non-Claude models (GPT-4o, DeepSeek, etc.).
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **Express.js:** Web application framework for the backend.
- **React:** Frontend JavaScript library.
- **Vite:** Build tool for the frontend.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** Reusable UI components.
- **wouter:** Small routing library for React.
- **Zod:** Schema declaration and validation library.