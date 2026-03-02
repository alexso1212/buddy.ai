# Buddy (AI Chat Application)

## Overview
Buddy is an AI chat application integrated into a comprehensive team task management system for Deltapex Education. It streamlines task organization, enhances collaboration, and leverages advanced AI for task assignment, review, and dynamic assistance. The system supports various user roles and hierarchical workflows for managing organizations, departments, users, projects, and tasks, aiming to improve efficiency and communication within the organization.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application features an Express.js backend, a React (TypeScript) frontend with Vite, and PostgreSQL with Drizzle ORM. Styling is managed with Tailwind CSS and shadcn/ui components, and `wouter` is used for frontend routing. The architecture emphasizes role-based access control, multi-tenant isolation, and extensive AI integration.

**Core Data Model:**
An 18-table PostgreSQL database schema manages entities like `organizations`, `departments`, `users`, `projects`, `tasks`, `task_deliverables`, `task_submissions`, `activity_logs`, `notifications`, `conversations`, `chat_messages`, `token_usage`, and `user_memories`. It includes features for invitation management, task deliverable versioning, and submission tracking.

**Backend (API):**
- **RESTful API:** Provides CRUD operations with Zod validation and automatic activity logging.
- **Role-Based Access Control:** Differentiates access for 'owner', 'admin', 'head', and 'member' roles.
- **Organization Management API:** Handles organization creation, searching, join requests, and invite code management.
- **AI Integration:** Dedicated API endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **JWT Authentication:** Secure user authentication using bcryptjs and jsonwebtoken, supporting multi-provider options.
- **Multi-Tenant Isolation:** `orgIsolation` middleware manages `orgId` and `currentUserId` context.
- **Token Usage Tracking:** Records prompt/completion tokens and costs for all AI calls.
- **Conversation Persistence:** AI chat history is persisted for continuous interactions.
- **AI Subsystem:** Utilizes Anthropic direct API and OpenRouter for various AI models. It features contextual prompts, cross-conversation memory, Zod schema-defined AI actions, an AI-powered verdict service, and web search integration via Tavily API. A "Code Context Mode" allows AI to interact with project code for analysis and assistance using `read_file`, `list_directory`, and `search_code` tools with security restrictions.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing, featuring an 8-page structure with persistent sidebar navigation.
- **Design System:** "Claude-style" warm theme with a specific color palette, typography, rounded corners, full dark mode support, and a consistent overlay and floating input design pattern across pages.
- **Key Pages:** Includes Dashboard, Agent (full-page AI chat), Graph View (D3 force-directed graph), Project/Task lists/details, Team management, and Settings.
- **Team Page:** Features tabs for Members, Departments, Job Roles, Join Requests, and Invite Code management.
- **GraphChatFloat:** A floating AI chat panel within the graph view supporting screenshot capture for AI visual analysis, with persistent chat history and full UX parity with the main agent chat.
- **Universal AI Chat Persistence:** All AI chat interactions are persistently stored.
- **AI Chat Components:** Features a floating chat button, main chat panel, various message bubble types, action confirmation cards, and a robust input bar. Enhancements include ThinkingBlock for AI processing display, token usage badges, error classification, token buffering, file/image support, code block syntax highlighting, smart suggestion cards, and user message edit/resend.
- **Interactive Input Widget:** A Claude-style interactive component for single_select, multi_select, and rank_priorities, rendering above the input bar for AI-driven user input.
- **ArtifactPanel:** A slide-out panel for displaying long documents or code blocks from AI messages.
- **Multi-Conversation Background Processing:** Allows users to switch conversations while AI generates responses in the background, with progress indicators and persistence to the database.
- **Token Budget & Balance System:** Displays an organization's token budget, usage, and remaining balance, with warnings for high usage.
- **Onboarding Flow:** A multi-step onboarding process for new users to create or join an organization.
- **Mobile Optimization:** Responsive layouts with adaptations for smaller screens, including specific fixes for GraphChatFloat on iOS.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Anthropic Claude API:** Direct API access for Claude models.
- **OpenAI API (via OpenRouter):** For access to various AI models.
- **Drizzle ORM:** TypeScript ORM.
- **Express.js:** Backend framework.
- **React:** Frontend library.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** React routing library.
- **Zod:** Schema validation.
- **Tavily API:** AI-native web search API.