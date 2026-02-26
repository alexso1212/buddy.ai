# Buddy (AI Chat Application)

## Overview
Buddy is an AI-powered chat application designed to enhance task management and collaboration. It features an 8-page React frontend with sidebar navigation, an Express.js backend, and a PostgreSQL database. The system aims to streamline task organization, facilitate collaboration, and integrate advanced AI capabilities for task assignment, review, and dynamic assistance across various user roles and organizations.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application uses an Express.js backend, a React (TypeScript) frontend with Vite, and PostgreSQL with Drizzle ORM. Tailwind CSS and shadcn/ui are used for styling, and `wouter` for frontend routing.

**Core Data Model:**
A 15-table PostgreSQL database schema manages entities like `organizations`, `departments`, `users`, `projects`, `tasks`, `activity_logs`, `task_comments`, `job_roles`, `verdicts`, `notifications`, `conversations`, `chat_messages`, `token_usage`, and `user_memories`. All tables utilize serial integer IDs.

**Backend (API):**
- **RESTful API:** Provides full CRUD operations with unified `{data}/{error}` response formats. Zod is used for validation.
- **Access Control:** Role-Based Access Control (RBAC) supports 'owner', 'admin', 'head', and 'member' roles.
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **Authentication:** JWT-based authentication with bcryptjs for password hashing. Supports email+password, Google/Apple/GitHub (via Replit Auth OIDC), and Telegram Login Widget, unifying users via `authProvider`/`authProviderId`.
- **Multi-Tenant Isolation:** `orgIsolation` middleware ensures data segregation per organization.
- **Token Usage Tracking:** Records prompt/completion tokens and costs for all AI calls.
- **Conversation Persistence:** AI chat history is persisted to `conversations`/`chat_messages` tables, supporting `conversationId` for continuity.

**Frontend (UI/UX):**
- **Single Page Application:** Built with React, featuring an 8-page structure and a persistent sidebar navigation.
- **Design System:** A "Claude-style" warm theme with a specific color palette, typography, and full dark mode support. Components feature rounded corners and subtle shadows.
- **Transparent Overlay & Floating Input Design Pattern:** A consistent UI pattern for top bars and bottom input areas, featuring absolute positioned gradient overlays and input boxes that appear to "float" over content, allowing scrolling text to be visible through them. This pattern is applied to all relevant pages.
- **Key Pages:**
    - **Dashboard:** Overview and task lists.
    - **Agent:** Full-page AI chat interface.
    - **Graph View:** D3 force-directed graph for hierarchical task visualization with interactive elements, dependency highlighting, and AI analysis integration. Includes screenshot capture for AI visual analysis.
    - **Project List/Detail:** Management of projects and tasks.
    - **Task List/Detail:** Comprehensive task management with inline status changes, subtasks, dependencies, and verdict integration.
    - **Team:** User and department management.
    - **Settings:** Organization-level configuration.
- **Universal AI Chat Persistence:** All AI chat interactions across the application are persisted for a unified history.
- **Verdict Feature:** Integrated displays for AI verdicts with color-coding and user actions.
- **Mobile Optimization:** Responsive layouts with specific adaptations for smaller screens.

**AI Subsystem:**
- **Hybrid AI Providers:** Routes AI model requests to Anthropic direct API (for Claude models) or OpenRouter (for other models like GPT-4o, DeepSeek).
- **Contextual Prompts:** Dynamically generated system prompts incorporate relevant team, project, and task context.
- **Cross-Conversation Memory:** `user_memories` table stores and extracts user preferences and context via AI, auto-loading into system prompts.
- **Action Schemas & Executor:** Zod schemas define AI actions (e.g., `create_task`, `update_task`) which are executed transactionally, supporting batch operations and optimistic locking.
- **Web Search Integration:** Tavily API provides real-time web search, injecting results into AI prompts and displaying them in the UI.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Anthropic Claude API:** Direct integration for Claude models.
- **OpenAI API (via OpenRouter):** For other AI models.
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **Express.js:** Backend web framework.
- **React:** Frontend library.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** React routing library.
- **Zod:** Schema validation library.
- **Tavily API:** AI-native web search.