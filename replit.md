# Buddy (AI Chat Application)

## Overview
Buddy is an AI chat application integrated into a comprehensive team task management system for Deltapex Education. Its primary purpose is to streamline task organization, enhance collaboration, and leverage advanced AI for task assignment, review, and dynamic assistance. The system supports various user roles and hierarchical workflows for managing organizational structures, projects, and tasks, aiming to significantly improve efficiency and communication. The project envisions a future where AI pervasively assists in all aspects of team management, from task decomposition to decision resolution, fostering a more productive and intelligently managed workforce.

## User Preferences
I prefer iterative development with clear, concise explanations at each step. I want to be asked before major architectural changes or significant code refactoring. For UI/UX, I prioritize a clean, modern aesthetic with a consistent design system. I also value detailed progress updates and transparent communication regarding any challenges or decisions.

## System Architecture
The application is built with an Express.js backend, a React (TypeScript) frontend utilizing Vite, and PostgreSQL with Drizzle ORM. Styling is handled with Tailwind CSS and shadcn/ui components, and `wouter` manages frontend routing. Key architectural principles include role-based access control, multi-tenant isolation, and deep AI integration across all functionalities.

**Core Data Model:** A 26-table PostgreSQL database schema supports comprehensive management of organizations, departments, users, projects, and tasks. It includes features for invitation management, task deliverable versioning, submission tracking, a knowledge base with pgvector for semantic search, daily AI briefing generation, and AI-extracted member profiles.

**Backend (API):**
- **RESTful API:** Provides CRUD operations with Zod validation and automatic activity logging.
- **Role-Based Access Control:** Differentiates access based on 'owner', 'admin', 'head', and 'member' roles.
- **AI Integration:** Endpoints for AI chat, action confirmation, verdict judgment, and assignment auto-judgment.
- **Multi-Tenant Isolation:** `orgIsolation` middleware ensures data segregation.
- **Knowledge Base Pipeline:** Supports file upload, text extraction from 13 formats, chunking, and AI auto-classification (orgRelevance, kbRelevance, sensitivity, category) of documents using Haiku.
- **Daily Briefing Service:** AI-generated personalized daily briefings.
- **AI Subsystem:** Utilizes Anthropic and OpenRouter models, featuring contextual prompts, cross-conversation memory, Zod schema-defined AI actions, an AI-powered verdict service, and web search integration. Includes a "Code Context Mode" for AI interaction with project code.
- **AI Auto-Decision Resolution System:** Automates the creation and resolution of decision tasks linked to original tasks with warnings, using AI to parse user responses for task updates.

**Frontend (UI/UX):**
- **Single Page Application:** React-based with `wouter` for routing and a persistent sidebar navigation.
- **Design System:** "Claude-style" warm theme with a specific color palette, typography, rounded corners, full dark mode support, and consistent UI patterns.
- **Key Pages:** Dashboard, Agent (full-page AI chat), Graph View, Project/Task lists/details, Team management, and Settings.
- **Universal AI Chat Persistence:** All AI chat interactions are persistently stored, featuring `@assistant-ui/react` for runtime state management, custom message rendering, tool call cards, and model style hints.
- **ArtifactPanel:** A slide-out panel for displaying AI-generated long documents or code blocks, with functionality to submit AI content as task deliverables.
- **Unified Knowledge Base with AI Organization Analysis:** An admin-only page for document management where AI auto-classifies uploaded documents and can perform a 3-stage funnel (Haiku scoring → Opus deep synthesis) to extract departments, roles, and members from high-value documents. Supports a 17-category taxonomy for classification.
- **Member Profiles:** AI-extracted or manually created employee profiles with a claim mechanism.
- **Onboarding Flow:** Multi-step process for new users to create or join an organization.

**AI-Assisted Workflows:**
- **KB Upload Simplified:** AI automatically classifies document details post-upload.
- **Task Creation AI Suggest:** AI suggests task details (description, priority, assignee, due date) in the New Task Modal.
- **Task Dependency AI Suggest:** AI analyzes tasks to suggest prerequisite relationships.
- **Project AI Decomposition:** AI generates Work Breakdown Structures (WBS) with tasks, dependencies, and assignee suggestions for projects.
- **Submission AI Pre-Review:** AI analyzes task submissions against descriptions, providing relevance scores and improvement suggestions.
- **Briefing Action Suggestions:** Daily briefings include AI-suggested one-click actions derived from task statuses.
- **Global Deduplication System:** Pre-AI-consumption duplicate detection across three entry points: (1) Task creation uses Jaccard keyword similarity matching (0 tokens); (2) KB uploads check filename + file size + MD5 content hash (0 tokens); (3) Chat attachments compute MD5 and check 7-day history. All dedup checks happen before AI processing, with user confirmation widgets before proceeding. `forceCreate`/`forceUpload` flags bypass detection after user confirms. AI self-check prompt rules also instruct the model to verify against active task lists.

**Super Admin Dashboard:**
- Provides administrative control and monitoring for system health, AI consumption, user trends, organization management, knowledge base statistics, and security logs.
- Features model-centric AI Provider Management: models are dynamic (auto-detected via API probe or manually added); under each model, admins add/manage multiple API endpoints (base URL optional for official APIs, timeout). Supports two key modes: direct API key storage in DB (`api_key` column) or environment variable reference (`api_key_env_var`). Drag-to-reorder sets per-model priority for fallback. Uses `ai_model_providers` table alongside legacy `ai_providers` table. API keys are masked in GET responses (first 8 + last 4 chars shown).
- **API Probe & Batch Add:** `POST /api/admin/ai/probe-models` probes an OpenAI-compatible `/models` endpoint to discover available models (with SSRF protection blocking private IPs). Batch-create endpoint creates provider entries for multiple models at once.
- **Chat Model Visibility Config:** `system_config` table (key-value store with JSON values) stores `chat_visible_models` — an ordered list of `{id, label, desc}` entries controlling which models appear in the chat selector. Admin panel provides drag-and-drop reordering, inline label/desc editing, and add/remove from configured models. `GET /api/ai/available-models` (auth required) returns the visible list with fallback to defaults.
- **Dual-tier access control:** Super admins see all system-wide data (overview, all users, all orgs, AI workforce analysis, API endpoint management). Organization owners can also access the admin dashboard but only see org-scoped data (AI usage stats, hourly trends, security audit logs, KB health for their own organization). Backend enforces per-route authorization via `requireSuperAdmin` guard and org-scoped SQL filtering.

**Claude-Style Streaming UI (Phase 1 — Core Skeleton):**
- CSS design tokens: `--bg-user-message`, `--accent-orange`, `--accent-blue`, `--accent-green`, `--bg-secondary`, `--bg-tertiary`, `--text-tertiary`, `--border-code`, `--ease-spring`, `--ease-out-quart` added to `:root` in `index.css`.
- Keyframe animations: `slideUpFade`, `streamFadeIn`, `starburstSpin`, `starburstRayPulse`, `actionButtonsFadeIn` in `index.css`.
- `StarburstIndicator` component (`client/src/components/ai/StarburstIndicator.tsx`): Orange 8-ray rotating SVG with staggered pulse animation, replaces `ThinkingAnimation` as loading indicator while waiting for first token.
- User message bubbles restyled: `--bg-user-message` background, `--text-user` color, 15px font, `slideUpFade 350ms` entry animation.
- Action buttons (copy, retry, thumbs up/down) restyled: 32x32 tap target, 16x16 icons, `--text-tertiary` color with hover to `--text-secondary`, fade-in 300ms delayed 200ms after stream completes.
- Send/Stop button unified: single 36x36 circular button, cross-fades between send arrow (dark fill) and stop square (light fill) via `transition: all 200ms ease`.
- Auto-scroll improved: `isAutoScrolling` ref with 50px threshold, stops on user scroll up, resumes when near bottom, force-scrolls on send.

**Claude-Style Streaming UI (Phase 2 — Rich Content):**
- **ThinkingBlock redesign** (`ThinkingBlock.tsx`): Full-width collapsible bar with `var(--bg-secondary)` background, 12px radius. Left timer SVG icon (16x16), center summary text with real-time elapsed timer during streaming ("Thinking for Xs..."), post-completion shows duration + auto-generated one-line summary. Right chevron (12x12) appears on complete, rotates 90deg on expand. Active shimmer animation via `::after` pseudo-element. Expanded content slides down (300ms) with max-height 300px scrollable area.
- **CodeBlock redesign** (`AIMessageContent.tsx`): `var(--bg-code)` background, `var(--border-code)` border, 8px radius. Header with `var(--bg-code-header)` background shows language label left + Copy button right (14x14 inline SVG icons, checkmark on copy for 1.5s). Code area: 16px padding, monospace font, 13px size, 1.5 line-height. Removed line numbers, share button, and collapse/expand. Clipboard error handling added.
- **ToolCallCard redesign** (`AiMessageBubble.tsx`): Inline SVG icons per tool type (magnifying glass for search, terminal for code/default). Status indicators: spinner SVG (0.8s rotation) for running, green check circle for complete (cross-fade 200ms), red X for error. `var(--bg-secondary)` background, 10px radius, tight 4px margin spacing. Expandable detail area on complete with chevron rotation animation.
- **CSS additions** (`index.css`): `@keyframes shimmer` (background-position sweep), `@keyframes toolSpinner` (0.8s linear rotation), `@keyframes expandSlideDown` (300ms max-height/opacity). Classes: `.thinking-collapse-bar`, `.thinking-collapse-bar.active::after`, `.thinking-collapse-bar.clickable`, `.thinking-expand-content`, `.tool-spinner`, `.expand-slide-down`.
- All colors use CSS variables (`var(--bg-secondary)`, `var(--text-secondary)`, `var(--border-code)`, `var(--accent-green)`, etc.) for theme compatibility.
- Phases 4-5 (widgets, citations, polish) are NOT yet implemented.

**Claude-Style Streaming UI (Phase 3 — Artifacts & Panels):**
- **ArtifactCard** (`ArtifactCard.tsx`): Inline card replacing old "Open in panel" button. 56x56 thumbnail with DocumentIcon/CodeIcon SVG, title (15px, line-clamp 2), subtitle with extension mapping (e.g., "Code . TSX", "File . MD"). `artifactSlideUp` 250ms entry animation. `BackgroundProcessingBanner` shows StarburstIndicator + text while streaming.
- **ArtifactSidePanel** (`ArtifactSidePanel.tsx`): Desktop (>=768px) side panel, `clamp(400px, 50vw, 700px)` width, `flexShrink: 0`. Slides in from right via `panelSlideInRight` (350ms ease-out-quart), closes with `panelSlideOutRight` (250ms). Header with title, copy, download, close buttons. Body renders `AIMessageContent`. Esc key closes.
- **ArtifactBottomSheet** (`ArtifactBottomSheet.tsx`): Mobile (<768px) bottom sheet, max-height 90vh. Overlay `rgba(0,0,0,0.5)` with `overlayFadeIn`. Sheet uses `sheetSlideUp` (400ms ease-spring). Drag handle with `touch-action: none` (only on handle). Swipe-to-dismiss if dragged >30% of height.
- **Layout integration** (`agent.tsx`): Outer container changed to `flex h-full`. Chat area is `flex-1 min-w-0` with smooth transition. Side panel rendered alongside (not overlay) so chat shrinks. `artifactPanel` state managed at layout level. `onOpenArtifact` callback added to `BuddyCallbacks` interface, passed through `BuddyRuntimeProvider`.
- **CSS additions** (`index.css`): `@keyframes artifactSlideUp`, `panelSlideInRight`, `panelSlideOutRight`, `sheetSlideUp`, `sheetSlideDown`, `overlayFadeIn`. Classes: `.artifact-side-panel`, `.artifact-side-panel.closing`, `.artifact-bottom-sheet-overlay`, `.artifact-bottom-sheet`, `.artifact-bottom-sheet.closing`.
- Old `ArtifactPanel` component retained for utility exports (`isLongContent`, `extractArtifactTitle`) but no longer rendered directly in message bubbles.

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