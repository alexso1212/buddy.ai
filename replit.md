# Buddy (AI Chat Application)

## Overview
Buddy is an AI chat application integrated into a comprehensive team task management system for Deltapex Education. It aims to streamline task organization, enhance collaboration, and leverage advanced AI for task assignment, review, and dynamic assistance. The system supports various user roles and hierarchical workflows for managing organizations, departments, users, projects, and tasks, significantly improving efficiency and communication within the organization.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application features an Express.js backend, a React (TypeScript) frontend with Vite, and PostgreSQL with Drizzle ORM. Styling is managed with Tailwind CSS and shadcn/ui components, and `wouter` is used for frontend routing. The architecture emphasizes role-based access control, multi-tenant isolation, and extensive AI integration across its functionalities.

**Core Data Model:**
A 25-table PostgreSQL database schema manages entities such as `organizations`, `departments`, `users`, `projects`, `tasks`, `task_deliverables`, `task_submissions`, `activity_logs`, `notifications`, `conversations`, `chat_messages`, `token_usage`, `user_memories`, `kb_documents`, `kb_chunks`, `briefings`, and `member_profiles`. Key features include invitation management, task deliverable versioning, submission tracking, a knowledge base with pgvector for semantic search, daily AI briefing generation, and AI-extracted member profiles.

**Backend (API):**
- **RESTful API:** Provides CRUD operations with Zod validation and automatic activity logging.
- **Cross-Module Stats APIs:** Aggregates per-department and per-user task statistics.
- **Role-Based Access Control:** Differentiates access for 'owner', 'admin', 'head', and 'member' roles.
- **Organization Management API:** Handles creation, searching, join requests, and invite codes.
- **AI Integration:** Endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **JWT Authentication:** Secure user authentication supporting multi-provider options.
- **Multi-Tenant Isolation:** `orgIsolation` middleware manages `orgId` and `currentUserId` context.
- **Token Usage Tracking:** Records AI token usage and costs.
- **Conversation Persistence:** AI chat history is stored for continuous interactions.
- **Knowledge Base Pipeline:** File upload → text extraction (13 formats) → chunking → storage → **AI auto-classification** (Haiku scores orgRelevance/kbRelevance/sensitivity/category on first 500 chars). processDocument.ts handles the full pipeline asynchronously. Embedding API unavailable; ILIKE keyword matching as fallback.
- **Daily Briefing Service:** AI-generated daily briefings cached per user, aggregating tasks and team stats.
- **AI Subsystem:** Utilizes Anthropic and OpenRouter models, featuring contextual prompts, cross-conversation memory, Zod schema-defined AI actions, an AI-powered verdict service, and web search integration via Tavily API. It includes a "Code Context Mode" for AI interaction with project code.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing, featuring an 8-page structure with persistent sidebar navigation.
- **Design System:** "Claude-style" warm theme with a specific color palette, typography, rounded corners, full dark mode support, and consistent overlay/floating input design patterns.
- **Key Pages:** Dashboard, Agent (full-page AI chat), Graph View, Project/Task lists/details, Team management, and Settings.
- **Knowledge Base Page:** Admin-only management for document upload, status monitoring, chunk preview, and reprocessing.
- **GraphChatFloat:** A floating AI chat panel within the graph view supporting screenshot capture for AI visual analysis.
- **Universal AI Chat Persistence:** All AI chat interactions are persistently stored.
- **AI Chat Components:** Features a floating chat button, main chat panel, various message bubble types, action confirmation cards, and an input bar with enhancements like ThinkingBlock, token usage badges, classified error handling, token buffering, file/image support, code block syntax highlighting, smart suggestion cards, and keyboard shortcuts.
- **Tool Call Cards:** Claude.ai-style collapsible cards for tool use events (web search, file read, code execution).
- **Model Style Hints:** Per-model system prompt style injection (Haiku, Sonnet, Opus) for differentiated response behavior.
- **Interactive Input Widget:** Claude-style interactive component for single_select, multi_select, and rank_priorities.
- **ArtifactPanel:** A slide-out panel for displaying long documents or code blocks from AI messages.
- **Multi-Conversation Background Processing:** Allows switching conversations while AI generates responses in the background.
- **Token Budget & Balance System:** Displays organization's token budget, usage, and remaining balance.
- **Unified Knowledge Base with AI Organization Analysis:** Single `/knowledge-base` page serves as both document management and AI-powered org analysis. Documents uploaded to KB are auto-classified by Haiku (orgRelevance, kbRelevance, sensitivity, category). Admins can multi-select high-value docs and trigger "AI 组织分析" which runs the 3-stage funnel (Haiku scoring → Opus deep synthesis) to extract departments, roles, and members. Results appear in a `SetupConfirmModal` overlay for review before applying. **17-Category Taxonomy:** org_chart/roster/jd/contract/kpi/policy/handbook/sop/product/sales/project/finance/legal/marketing/brand/technical/general. Auto-visibility: sensitivity=high forces admin-only. AI Insight Bar shows classified doc count and org-relevant doc count. Schema: `kb_documents` table has `orgRelevance`, `kbRelevance`, `sensitivity`, `aiSummary` columns. Routes: `POST /api/setup/analyze-kb`, `POST /api/setup/confirm` (setup/analyze upload route removed). No standalone `/setup` page.
- **Member Profiles (成员档案):** AI-extracted or manually created employee profiles with a claim mechanism for users upon registration.
- **Onboarding Flow:** Multi-step onboarding for new users to create or join an organization.
- **Mobile Optimization:** Responsive layouts with adaptations for smaller screens.

**AI-Assisted Workflows (Pervasive AI Suggestions):**
- **KB Upload Simplified:** Upload dialog only requires file + title. AI auto-classifies category, visibility, and sensitivity after upload. No manual dropdown selections needed.
- **Task Creation AI Suggest:** "AI 建议" button in NewTaskModal (task-list and project-detail). Calls `POST /api/ai/suggest-task` (Haiku) to auto-fill description, priority, assignee (based on job_roles matching + workload), and due date. Assignee dropdown shows "AI 推荐" badge.
- **Task Dependency AI Suggest:** "AI 分析依赖" button in task-detail Dependencies tab. Calls `POST /api/ai/suggest-dependencies` (Haiku) to analyze same-project tasks and suggest prerequisite relationships with reasons. Results shown as checklist for batch-add.
- **Project AI Decomposition:** "AI 拆解任务" button in project-detail. Calls `POST /api/ai/decompose-project` (Sonnet) to generate WBS with tasks, dependencies, and assignee suggestions. Confirmation dialog allows editing before batch creation.
- **Submission AI Pre-Review:** "AI 预审" button in task-detail for pending submissions. Calls `POST /api/ai/review-submission` (Haiku) to analyze deliverable content vs task description, returning relevance score (1-5), quality assessment, and improvement suggestions.
- **Join Request Auto-Match:** Frontend-only logic in team.tsx matches join request applicant name/email against pending member_profiles. Shows "AI 建议绑定" badge with one-click approve+bind.
- **Briefing Action Suggestions:** Dashboard daily briefing includes structured `actions` array (reassign, change_priority, remind) with one-click execution buttons. Actions derived from overdue tasks, workload imbalance, and due-today items.

**AI Smart Routing Architecture:**
The AI subsystem uses intelligent task classification (e.g., `quick_reply`, `general_chat`, `code_generation`, `complex_analysis`) to dynamically select AI models, `max_tokens`, `temperature`, and enable Extended Thinking based on the user's message. Context optimization includes trimming conversation history and summarizing older messages.

**iOS App (Capacitor):**
The project is configured for iOS App packaging via Capacitor, loading the live website from a deployed `.replit.app` domain.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Anthropic Claude API:** Via proxy.
- **OpenAI API (via OpenRouter):** For GPT-4o and DeepSeek V3 fallback models.
- **Drizzle ORM:** TypeScript ORM.
- **Express.js:** Backend framework.
- **React:** Frontend library.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** React routing library.
- **Zod:** Schema validation.
- **Tavily API:** AI-native web search API.