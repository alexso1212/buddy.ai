# Buddy (AI Chat Application)

## Overview
Buddy is an AI chat application integrated into a comprehensive team task management system for Deltapex Education. It streamlines task organization, enhances collaboration, and leverages advanced AI for task assignment, review, and dynamic assistance. The system supports various user roles and hierarchical workflows for managing organizations, departments, users, projects, and tasks, aiming to improve efficiency and communication within the organization.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application features an Express.js backend, a React (TypeScript) frontend with Vite, and PostgreSQL with Drizzle ORM. Styling is managed with Tailwind CSS and shadcn/ui components, and `wouter` is used for frontend routing. The architecture emphasizes role-based access control, multi-tenant isolation, and extensive AI integration.

**Core Data Model:**
A 23-table PostgreSQL database schema manages entities like `organizations`, `departments`, `users`, `projects`, `tasks`, `task_deliverables`, `task_submissions`, `activity_logs`, `notifications`, `conversations`, `chat_messages`, `token_usage`, `user_memories`, `kb_documents`, and `kb_chunks`. It includes features for invitation management, task deliverable versioning, submission tracking, and a knowledge base with pgvector (v0.8.0) for semantic search via 1536-dim embeddings.

**Backend (API):**
- **RESTful API:** Provides CRUD operations with Zod validation and automatic activity logging.
- **Role-Based Access Control:** Differentiates access for 'owner', 'admin', 'head', and 'member' roles.
- **Organization Management API:** Handles organization creation, searching, join requests, and invite code management.
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **JWT Authentication:** Secure user authentication using bcryptjs and jsonwebtoken, supporting multi-provider options.
- **Multi-Tenant Isolation:** `orgIsolation` middleware manages `orgId` and `currentUserId` context.
- **Token Usage Tracking:** Records prompt/completion tokens and costs for all AI calls.
- **Conversation Persistence:** AI chat history is persisted for continuous interactions.
- **Knowledge Base Pipeline:** File upload → text extraction (PDF/DOCX/TXT/MD) → intelligent chunking → storage. Services in `server/services/kb/` (extractText, chunkText, processDocument, embedding, search). Async processing via `setImmediate`. Routes: `/api/kb/documents/*` (upload, list, detail, chunks, status, delete, reprocess) and `/api/kb/search?q=`. KB files stored in `uploads/kb/`. Embedding API currently unavailable (proxy doesn't support `text-embedding-3-small`); fulltext search via ILIKE keyword matching as fallback. Embedding infrastructure ready for future activation.
- **AI Subsystem:** Utilizes Anthropic direct API and OpenRouter for various AI models. It features contextual prompts, cross-conversation memory, Zod schema-defined AI actions, an AI-powered verdict service, and web search integration via Tavily API. A "Code Context Mode" allows AI to interact with project code for analysis and assistance using `read_file`, `list_directory`, and `search_code` tools with security restrictions.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing, featuring an 8-page structure with persistent sidebar navigation.
- **Design System:** "Claude-style" warm theme with a specific color palette, typography, rounded corners, full dark mode support, and a consistent overlay and floating input design pattern across pages.
- **Key Pages:** Includes Dashboard, Agent (full-page AI chat), Graph View (D3 force-directed graph), Project/Task lists/details, Team management, and Settings.
- **Team Page:** Features tabs for Members, Departments, Job Roles, Join Requests, and Invite Code management.
- **GraphChatFloat:** A floating AI chat panel within the graph view supporting screenshot capture for AI visual analysis, with persistent chat history and full UX parity with the main agent chat.
- **Universal AI Chat Persistence:** All AI chat interactions are persistently stored.
- **AI Chat Components:** Features a floating chat button, main chat panel, various message bubble types, action confirmation cards, and a robust input bar. Enhancements include ThinkingBlock with real-time thinking timer (Claude.ai style "Thinking for Xs..." → "Thought for X seconds"), token usage badges, classified error handling (network auto-retry with backoff, rate limit cooldown, context trimming, stream interruption recovery), token buffering, file/image support, code block syntax highlighting, smart suggestion cards, user message edit/resend, and keyboard shortcuts (↑ to recall last message, Escape to stop generation).
- **Tool Call Cards:** Claude.ai-style collapsible cards for tool use events (web search, file read, code execution) with running/complete/error states, type-specific icons, and expandable detail views.
- **Model Style Hints:** Per-model system prompt style injection — Haiku (concise), Sonnet (balanced), Opus (deep analysis) — for differentiated response behavior.
- **Interactive Input Widget:** A Claude-style interactive component for single_select, multi_select, and rank_priorities, rendering above the input bar for AI-driven user input.
- **ArtifactPanel:** A slide-out panel for displaying long documents or code blocks from AI messages.
- **Multi-Conversation Background Processing:** Allows users to switch conversations while AI generates responses in the background, with progress indicators and persistence to the database.
- **Token Budget & Balance System:** Displays an organization's token budget, usage, and remaining balance, with warnings for high usage.
- **Onboarding Flow:** A multi-step onboarding process for new users to create or join an organization.
- **Mobile Optimization:** Responsive layouts with adaptations for smaller screens, including specific fixes for GraphChatFloat on iOS.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Anthropic Claude API:** Via proxy (`vip.aipro.love`), OpenAI-compatible format. Smart model routing with task classifier.
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

## AI Smart Routing Architecture
The AI subsystem uses intelligent task classification and dynamic parameter selection:

**Task Classifier:** Before each chat request, a Haiku-based classifier categorizes the user message into: `quick_reply`, `general_chat`, `code_generation`, `complex_analysis`, or `document_processing`. This determines model selection, `max_tokens`, `temperature`, and whether Extended Thinking is enabled.

**Per-Task Configuration:**
| Task | Model | max_tokens | Thinking | Temp |
|------|-------|-----------|----------|------|
| Title generation | Haiku | 100 | off | 0.7 |
| Auto judgment | Haiku | 500 | off | 0.0 |
| Quick reply | Haiku | 2048 | off | 0.5 |
| General chat | Sonnet | 8192 | off | 0.7 |
| Code generation | Sonnet | 16384 | on (16k) | 0.3 |
| Complex analysis | Sonnet | 32000 | on (32k) | 0.5 |
| Document processing | Sonnet | 16384 | on (10k) | 0.3 |
| Knowledge QA | Sonnet | 8192 | off | 0.3 |
| Deep mode (Opus) | Opus | 64000 | on (32k) | 0.5 |

**Extended Thinking Control:** The user's "Extended Thinking" toggle acts as a permission flag. Even when enabled, thinking only activates for code/complex/document tasks — never for quick replies or general chat.

**Context Optimization:** Conversation history is trimmed per task category (4-20 recent messages). Older messages are summarized by Haiku and injected as context.

**API Proxy:** All Claude models route through `vip.aipro.love/v1` (OpenAI-compatible format). GPT-4o and DeepSeek V3 route through OpenRouter.

## iOS App (Capacitor)
The project is configured for iOS App packaging via Capacitor:
- **PWA Configuration:** `client/public/manifest.json` with app name, theme color, icons. iOS-specific meta tags in `client/index.html` (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, etc.).
- **Capacitor Config:** `capacitor.config.ts` at project root. App ID: `com.deltapex.buddy`. `server.url` points to the deployed `.replit.app` domain — the App loads the live website, so code changes only require redeployment (not rebuilding the App).
- **App Icons:** Placeholder icons in `client/public/icons/` (192, 512, apple-touch-icon). Should be replaced with high-res 1024x1024 artwork before App Store submission.
- **Build Guide:** `docs/ios-build-guide.md` contains step-by-step instructions for packaging with Xcode and uploading to TestFlight.
- **Theme:** Dark theme (#1A1918) with `black-translucent` status bar for seamless integration with the app's dark UI.

## Documentation
- **Technical Handover:** `docs/HANDOVER.md` — 完整的技术交接文档（1100+ 行），涵盖架构、数据库 Schema（21 表）、API 路由（90+ 端点）、AI 子系统、前端组件、认证体系、环境变量、开发约定、已完成功能清单、待办方向等。供新开发者接手参考。
- **Architecture Export:** `docs/ARCHITECTURE_EXPORT.md` — 架构摘要导出（1371 行），供产品经理设计知识库功能。包含 7 个 Part：关键表 Schema 原始代码、AI 核心接口（classifyTask/chatStream/buildOptimizedContext）、System Prompt 完整代码、路由模式与完整路由清单、AI 服务目录结构与 export 索引、文件上传机制（multer 配置）、环境依赖（pgvector v0.8.0 可用未装、PostgreSQL 16.10）。