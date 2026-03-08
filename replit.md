# Buddy (AI Chat Application)

## Overview
Buddy is an AI chat application integrated into a comprehensive team task management system for Deltapex Education. Its primary purpose is to streamline task organization, enhance collaboration, and leverage advanced AI for task assignment, review, and dynamic assistance. The system supports various user roles and hierarchical workflows for managing organizational structures, projects, and tasks, aiming to significantly improve efficiency and communication. The project envisions a future where AI pervasively assists in all aspects of team management, from task decomposition to decision resolution, fostering a more productive and intelligently managed workforce.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application is built with an Express.js backend, a React (TypeScript) frontend utilizing Vite, and PostgreSQL with Drizzle ORM. Styling is handled with Tailwind CSS and shadcn/ui components, and `wouter` manages frontend routing. Key architectural principles include role-based access control, multi-tenant isolation, and deep AI integration across all functionalities.

**Core Data Model:** A 26-table PostgreSQL database schema supports comprehensive management of organizations, departments, users, projects, and tasks, including features for invitation management, task deliverable versioning, submission tracking, a knowledge base with pgvector for semantic search, daily AI briefing generation, and AI-extracted member profiles.

**Backend (API):**
- **RESTful API:** Provides CRUD operations with Zod validation and automatic activity logging.
- **Role-Based Access Control:** Differentiates access based on 'owner', 'admin', 'head', and 'member' roles.
- **AI Integration:** Endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **Multi-Tenant Isolation:** `orgIsolation` middleware ensures data segregation.
- **Knowledge Base Pipeline:** Supports file upload, text extraction from 13 formats, chunking, and AI auto-classification of documents.
- **Daily Briefing Service:** AI-generated personalized daily briefings.
- **AI Subsystem:** Utilizes Anthropic and OpenRouter models. When `ANTHROPIC_API_KEY` is set, all Claude model calls (streaming, non-streaming, utility functions) use the official Anthropic SDK directly (`api.anthropic.com`). Falls back to proxy (`vip.aipro.love/v1`) with `CLAUDE_SIMPLE_API_KEY`/`CLAUDE_COMPLEX_API_KEY` when official key is unavailable. Features contextual prompts, cross-conversation memory, Zod schema-defined AI actions, an AI-powered verdict service, and web search integration. Includes a "Code Context Mode" for AI interaction with project code.
- **AI Auto-Decision Resolution System:** Automates the creation and resolution of decision tasks using AI.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing and a persistent sidebar navigation.
- **Design System:** "Claude-style" warm theme with a specific color palette, typography, rounded corners, full dark mode support, and consistent UI patterns.
- **Key Pages:** Dashboard, Agent (full-page AI chat), Graph View, Project/Task lists/details, Team management, and Settings.
- **Universal AI Chat Persistence:** All AI chat interactions are persistently stored, featuring `@assistant-ui/react` for runtime state management, custom message rendering, tool call cards, and model style hints.
- **ArtifactPanel:** A slide-out panel for displaying AI-generated long documents or code blocks, with functionality to submit AI content as task deliverables.
- **Unified Knowledge Base with AI Organization Analysis:** An admin-only page for document management where AI auto-classifies uploaded documents and can perform a 3-stage funnel to extract departments, roles, and members from high-value documents. Supports a 17-category taxonomy for classification.
- **Member Profiles:** AI-extracted or manually created employee profiles with a claim mechanism.
- **Onboarding Flow:** Multi-step process for new users to create or join an organization.
- **Claude-Style Streaming UI:** Implemented in phases, including redesigned indicators, message bubbles, action buttons, thinking blocks, code blocks, tool call cards, artifact cards, side panels, bottom sheets, inline widgets, and citation superscripts, all utilizing CSS variables for theme compatibility.

**AI-Assisted Workflows:**
- **KB Upload Simplified:** AI automatically classifies document details post-upload.
- **Task Creation AI Suggest:** AI suggests task details in the New Task Modal.
- **Task Dependency AI Suggest:** AI analyzes tasks to suggest prerequisite relationships.
- **Project AI Decomposition:** AI generates Work Breakdown Structures (WBS) with tasks, dependencies, and assignee suggestions for projects.
- **Submission AI Pre-Review:** AI analyzes task submissions against descriptions, providing relevance scores and improvement suggestions.
- **Briefing Action Suggestions:** Daily briefings include AI-suggested one-click actions.
- **Global Deduplication System:** Pre-AI-consumption duplicate detection across task creation, KB uploads, and chat attachments, with user confirmation widgets before proceeding.

**Super Admin Dashboard:**
- Provides administrative control and monitoring for system health, AI consumption, user trends, organization management, knowledge base statistics, and security logs.
- Features model-centric AI Provider Management: dynamic model detection and manual addition, with multiple API endpoints per model, supporting API key storage or environment variable reference. Drag-to-reorder sets per-model priority for fallback.
- **API Probe & Batch Add:** Probes OpenAI-compatible `/models` endpoints to discover and batch-create provider entries.
- **Chat Model Visibility Config:** Configures which models appear in the chat selector via a `system_config` table, offering drag-and-drop reordering and editing.
- **Dual-tier access control:** Super admins see system-wide data, while organization owners access org-scoped data.

**iOS App (Capacitor):** The project is configured for iOS packaging via Capacitor, loading the web application from a deployed domain.

## External Dependencies
- **PostgreSQL:** Primary relational database.
- **Anthropic Claude API:** AI model access (via proxy).
- **OpenAI API (via OpenRouter):** For GPT-4o and DeepSeek V3 models.
- **Drizzle ORM:** TypeScript ORM for database interaction.
- **Express.js:** Backend web application framework.
- **React:** Frontend JavaScript library for building user interfaces.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** Reusable UI components.
- **wouter:** Small routing library for React.
- **Zod:** TypeScript-first schema declaration and validation library.
- **@assistant-ui/react:** UI components for AI chat interfaces.
- **Tavily API:** AI-native web search for AI models.