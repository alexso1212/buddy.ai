# Buddy (AI Chat Application)

## Overview
Depai Task Center is a comprehensive team task management system for Deltapex Education, designed to streamline task organization, enhance collaboration, and integrate advanced AI capabilities for task assignment, review, and dynamic assistance. It features an 11-table data model with a full CRUD API and an 8-page frontend, supporting various user roles and hierarchical workflows for managing organizations, departments, users, projects, and tasks. The project aims to improve efficiency and communication within the organization.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application is built with an Express.js backend, a React (TypeScript) frontend utilizing Vite, and PostgreSQL with Drizzle ORM for data persistence. Tailwind CSS and shadcn/ui components are used for styling and UI elements, while `wouter` handles frontend routing.

**Core Data Model:**
A 16-table PostgreSQL database schema manages entities like `organizations`, `departments`, `users`, `projects`, `tasks`, `activity_logs`, `notifications`, `conversations`, `chat_messages`, `token_usage`, `user_memories`, `org_memberships`, `invitations`, and `organization_join_requests`. All tables use serial integer IDs. The `organizations` table includes `maxMembers` and `isPublic` fields. The `users` table includes `onboardingCompleted`. The `invitations` table supports multiple types (`code`/`email`/`link`) with `status`, `acceptedAt`, `acceptedBy` tracking.

**Backend (API):**
- **RESTful API:** Provides full CRUD operations with unified `{data}/{error}` response formats, Zod validation, and automatic activity logging.
- **Role-Based Access Control:** Implements differentiated access for 'owner', 'admin', 'head', and 'member' roles.
- **Organization Management API:** POST /api/organizations (create), GET /api/organizations/search (search by invite code), POST/GET/PUT /api/organizations/:id/join-requests (submit/list/approve), GET/POST /api/organizations/:id/invite-code (get/regenerate). Uses `generateInviteCode()` from `server/utils/inviteCode.ts` for human-readable codes (e.g., `DPE-X4NM`).
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **JWT Authentication:** Comprehensive user authentication with bcryptjs for password hashing and jsonwebtoken for JWT. Supports multi-provider authentication (email/password, Google/Apple/GitHub via Replit Auth OIDC, Telegram Login Widget).
- **Multi-Tenant Isolation:** `orgIsolation` middleware manages `orgId` and `currentUserId` context, supporting both JWT and header-based identification.
- **Token Usage Tracking:** Records prompt/completion tokens and cost for all AI calls in the `token_usage` table.
- **Conversation Persistence:** AI chat history is persisted to `conversations` and `chat_messages` tables, supporting `conversationId` for continuous interactions.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing.
- **Layout & Design:** 8-page structure with persistent sidebar navigation. Features a "Claude-style" warm theme with a specific color palette, typography, rounded corners, and full dark mode support.
- **Design Pattern (Overlay & Floating Input):** All pages with a top bar and/or bottom input area follow a consistent design featuring an absolute positioned gradient overlay for the top bar and a three-layer floating input area at the bottom. The input box appears to float over content, with faintly visible text scrolling behind it.
- **Key Pages:** Includes Dashboard, Agent (full-page AI chat), Graph View (D3 force-directed graph with advanced visualization for tasks and dependencies), Project List/Detail, Task List/Detail, Team (with 5-tab layout: Members/Departments/Job Roles/Join Requests/Invite Code), and Settings.
- **Team Page Tabs:** Uses shadcn Tabs. Members/Departments/Job Roles visible to all; Join Requests (with pending count badge, approve/reject with dialog, collapsible history) and Invite Code (display, copy, owner-only regenerate with confirm dialog) visible to owner/admin only.
- **GraphChatFloat:** A floating AI chat panel within the graph view that enables screenshot capture of the SVG graph, sending it as an image attachment for AI visual analysis. Chat history is persisted. Full UX parity with agent.tsx: token usage badges, error classification with retry buttons, 45s timeout detection, 50ms token buffering, paste/drag-drop file support.
- **Universal AI Chat Persistence:** All AI chat interactions across the application are persistently stored in the `conversations`/`chat_messages` tables.
- **AI Chat Components:** Features a floating chat button, main chat panel, various message bubble types, action confirmation cards, and a robust input bar.
- **AI Chat UX Enhancements:** Collapsible ThinkingBlock for Claude extended thinking display with Markdown rendering (react-markdown + remark-gfm), copy button, character count ("X 字"), and smooth CSS max-height/opacity transition animation; token usage badges on replies; 50ms token buffering for smoother streaming; 45s timeout detection; error classification with retry buttons; spinner animations on confirm cards; post-action context injection into conversation history; Ctrl+V paste and drag-drop file/image support in input bar; message timestamps (HH:MM); hover-to-reveal AI reply actions; code block syntax highlighting (highlight.js); smart suggestion cards from user task data; user message edit & resend (pencil icon on hover, truncates subsequent messages and re-invokes AI).
- **ArtifactPanel:** Slide-out panel for long documents/code (>2000 chars or code blocks >30 lines). Supports fullscreen toggle, copy-all, download as .md, Markdown rendering. Triggered via "Open in panel" button on qualifying AI messages. Portal-rendered with backdrop and slide animation.
- **Multi-Conversation Background Processing:** Global `chatStreamStore` (useSyncExternalStore) tracks per-conversation streaming state. Users can switch conversations while AI is generating; the stream continues in background and persists to DB. Sidebar shows animated pulse indicator for actively streaming conversations. `takeoverStream()` transfers active SSE reader to global store on component unmount (page navigation), continuing to consume events and saving the complete response to DB. Fallback path saves partial content if reader/decoder unavailable. `isBackgroundStreamActive()` prevents DB load race when returning to a conversation with an active background stream.
- **Thinking/Search/Token Persistence:** AI thinking content (`thinking`, `thinkingDuration`), search results (`searchResults`), and token usage (`tokenUsage`) are now persisted in the `chat_messages.metadata` JSON field via `saveMessageToDB`. On conversation reload, these fields are reconstructed from metadata and displayed (ThinkingBlock shows collapsed by default for historical messages).
- **Token Budget & Balance System:** `organizations.tokenBudgetUsd` (numeric) and `budgetResetDay` (integer) columns. `GET /api/token-usage/balance` returns billing-cycle-aware usage/remaining/percentUsed. `PATCH /api/organization/budget` (owner/admin RBAC). Settings page shows progress bar with color-coded thresholds (green/amber/red). Agent page shows low-balance toast warning when >80% used.
- **GraphChatFloat Enhancements:** Scroll-to-bottom button; stop-generating button; all agent.tsx UX parity features.
- **Verdict and Needs Review Features:** Integrated UI for displaying AI verdicts and flagging tasks requiring review.
- **Onboarding Flow:** Multi-step onboarding page (`/onboarding`) for new users without an organization. Steps: welcome (create/join choice), create org (form + auto invite code), create-success (display invite code + copy), join (invite code search), join-preview (org details + apply), pending (poll for approval), complete (auto-redirect). AuthGuard redirects users with `!onboardingCompleted && !orgId` to onboarding. Matches login page dark theme (`var(--bg-sidebar)`, `#D4B896` accent, pill buttons). POST /api/organizations returns new JWT token for immediate auth refresh.
- **Mobile Optimization:** Responsive layouts with adaptations for smaller screens, including swipeable task cards and compact statistics.
- **GraphChatFloat Mobile Fixes:** Rendered via React Portal to `document.body` to escape graph container's `overflow: hidden` and avoid `position: fixed` clipping on mobile Safari. DOM isolation via Portal eliminates need for event propagation blocking (removed capture-phase stopPropagation that was preventing native scroll). `touch-action: auto` + `overscrollBehavior: contain` + `-webkit-overflow-scrolling: touch` enable iOS rubber-band scrolling. `visualViewport` resize listener tracks keyboard height; `fullViewportHeight` ref preserves pre-keyboard viewport for stable sizing. When keyboard opens, panel fills remaining visible space (`viewportHeight - 12`) instead of shrinking to 40% of reduced viewport. `minHeight: 0` on flex containers enables proper overflow scrolling. Header/close button/input borders enhanced for dark-background visibility.

**AI Subsystem:**
- **Dual Claude Direct API + OpenRouter:** Utilizes three OpenAI SDK clients for model routing: Anthropic direct API for complex (Claude Opus 4) and simple (Claude Sonnet 4, Claude Haiku 3.5) models, and OpenRouter for other models (GPT-4o, DeepSeek).
- **Contextual Prompts:** Dynamically generated system prompts incorporate relevant team, project, and task context, with smart prioritization of context information.
- **Cross-Conversation Memory:** The `user_memories` table stores user preferences and context, auto-loaded into system prompts and extracted after conversations for continuous learning.
- **Action Schemas & Executor:** Zod schemas define available AI actions (e.g., `create_task`, `update_task`, `query_tasks`), which are processed and executed, with support for batch actions, transactional execution, optimistic locking, and duplicate detection.
- **Verdict Service:** AI-powered service for judging task assignments, scope, and confidence.
- **Structured Follow-up:** Provides structured, clickable options for users to complete missing task details.
- **Web Search Integration:** Tavily API provides real-time web search capabilities, injecting results into the system prompt and displaying them in the UI.
- **Code Context Mode (Interactive Tool Use):** Toggle in Agent chat (`codeContextEnabled`) that enables two layers of code awareness: (1) Static injection of project file tree and key files into the system prompt via `server/services/ai/codeContext.ts` (cached 5min). (2) Interactive tool-use loop via `codeToolChatStream` in `server/services/ai/index.ts` using Anthropic native SDK (`@anthropic-ai/sdk`). Three tools defined in `server/services/ai/codeTools.ts`: `read_file` (reads file content with line limits), `list_directory` (lists directory structure with depth control), `search_code` (grep-like search across safe directories). Tool loop runs up to 8 rounds, accumulating token usage across rounds. Tool results truncated at 15K chars. Security: SAFE_DIRS allowlist (client/, server/, shared/, docs/, script/, references/), BLOCKED_PATTERNS (.env, secrets, keys), extension whitelist. Frontend shows blue "代码" badge when enabled, "已加载 X 个代码文件" static info bar, and per-tool-call status indicators (gray lines with animated dot showing "正在读取...", "正在搜索...") via `tool_use` SSE events. Tool call history persisted in `chat_messages.metadata.toolCalls`. GraphChatFloat also supports tool_use events.

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