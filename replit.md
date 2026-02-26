# Buddy (AI Chat Application)

## Overview
Depai Task Center is a comprehensive team task management system for Deltapex Education, designed to streamline task organization, enhance collaboration, and integrate advanced AI capabilities for task assignment, review, and dynamic assistance. It features an 11-table data model with a full CRUD API and an 8-page frontend, supporting various user roles and hierarchical workflows for managing organizations, departments, users, projects, and tasks. The project aims to improve efficiency and communication within the organization.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application is built with an Express.js backend, a React (TypeScript) frontend utilizing Vite, and PostgreSQL with Drizzle ORM for data persistence. Tailwind CSS and shadcn/ui components are used for styling and UI elements, while `wouter` handles frontend routing.

**Core Data Model:**
A 15-table PostgreSQL database schema manages entities like `organizations`, `departments`, `users`, `projects`, `tasks`, `activity_logs`, `notifications`, `conversations`, `chat_messages`, `token_usage`, and `user_memories`. All tables use serial integer IDs.

**Backend (API):**
- **RESTful API:** Provides full CRUD operations with unified `{data}/{error}` response formats, Zod validation, and automatic activity logging.
- **Role-Based Access Control:** Implements differentiated access for 'owner', 'admin', 'head', and 'member' roles.
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **JWT Authentication:** Comprehensive user authentication with bcryptjs for password hashing and jsonwebtoken for JWT. Supports multi-provider authentication (email/password, Google/Apple/GitHub via Replit Auth OIDC, Telegram Login Widget).
- **Multi-Tenant Isolation:** `orgIsolation` middleware manages `orgId` and `currentUserId` context, supporting both JWT and header-based identification.
- **Token Usage Tracking:** Records prompt/completion tokens and cost for all AI calls in the `token_usage` table.
- **Conversation Persistence:** AI chat history is persisted to `conversations` and `chat_messages` tables, supporting `conversationId` for continuous interactions.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing.
- **Layout & Design:** 8-page structure with persistent sidebar navigation. Features a "Claude-style" warm theme with a specific color palette, typography, rounded corners, and full dark mode support.
- **Design Pattern (Overlay & Floating Input):** All pages with a top bar and/or bottom input area follow a consistent design featuring an absolute positioned gradient overlay for the top bar and a three-layer floating input area at the bottom. The input box appears to float over content, with faintly visible text scrolling behind it.
- **Key Pages:** Includes Dashboard, Agent (full-page AI chat), Graph View (D3 force-directed graph with advanced visualization for tasks and dependencies), Project List/Detail, Task List/Detail, Team, and Settings.
- **GraphChatFloat:** A floating AI chat panel within the graph view that enables screenshot capture of the SVG graph, sending it as an image attachment for AI visual analysis. Chat history is persisted. Full UX parity with agent.tsx: token usage badges, error classification with retry buttons, 45s timeout detection, 50ms token buffering, paste/drag-drop file support.
- **Universal AI Chat Persistence:** All AI chat interactions across the application are persistently stored in the `conversations`/`chat_messages` tables.
- **AI Chat Components:** Features a floating chat button, main chat panel, various message bubble types, action confirmation cards, and a robust input bar.
- **AI Chat UX Enhancements:** Collapsible ThinkingBlock for Claude extended thinking display; token usage badges on replies; 50ms token buffering for smoother streaming; 45s timeout detection; error classification with retry buttons; spinner animations on confirm cards; post-action context injection into conversation history; Ctrl+V paste and drag-drop file/image support in input bar; message timestamps (HH:MM); hover-to-reveal AI reply actions; code block syntax highlighting (highlight.js); smart suggestion cards from user task data.
- **GraphChatFloat Enhancements:** Scroll-to-bottom button; stop-generating button; all agent.tsx UX parity features.
- **Verdict and Needs Review Features:** Integrated UI for displaying AI verdicts and flagging tasks requiring review.
- **Mobile Optimization:** Responsive layouts with adaptations for smaller screens, including swipeable task cards and compact statistics.
- **GraphChatFloat Mobile Fixes:** Touch/pointer event propagation blocking prevents D3 from capturing gestures inside the chat panel. `touch-action: pan-y` + `overscrollBehavior: contain` + `-webkit-overflow-scrolling: touch` enable native scrolling. `visualViewport` resize listener dynamically repositions the panel when the mobile keyboard opens, ensuring the close button stays accessible. Panel height uses JS-calculated `viewportHeight * 0.4` instead of CSS `40vh` to avoid mobile Safari large-viewport unit issues; `maxHeight: Math.max(viewportHeight - 40, 200)` prevents overflow; header/close button/input borders enhanced for dark-background visibility.

**AI Subsystem:**
- **Dual Claude Direct API + OpenRouter:** Utilizes three OpenAI SDK clients for model routing: Anthropic direct API for complex (Claude Opus 4) and simple (Claude Sonnet 4, Claude Haiku 3.5) models, and OpenRouter for other models (GPT-4o, DeepSeek).
- **Contextual Prompts:** Dynamically generated system prompts incorporate relevant team, project, and task context, with smart prioritization of context information.
- **Cross-Conversation Memory:** The `user_memories` table stores user preferences and context, auto-loaded into system prompts and extracted after conversations for continuous learning.
- **Action Schemas & Executor:** Zod schemas define available AI actions (e.g., `create_task`, `update_task`, `query_tasks`), which are processed and executed, with support for batch actions, transactional execution, optimistic locking, and duplicate detection.
- **Verdict Service:** AI-powered service for judging task assignments, scope, and confidence.
- **Structured Follow-up:** Provides structured, clickable options for users to complete missing task details.
- **Web Search Integration:** Tavily API provides real-time web search capabilities, injecting results into the system prompt and displaying them in the UI.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Anthropic Claude API:** Direct API access for Claude models (Opus, Sonnet, Haiku).
- **OpenAI API (via OpenRouter):** For other AI models (e.g., GPT-4o, DeepSeek).
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **Express.js:** Backend web framework.
- **React:** Frontend JavaScript library.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** React routing library.
- **Zod:** Schema validation library.
- **Tavily API:** AI-native web search API.