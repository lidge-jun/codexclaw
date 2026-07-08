 # External Skill Catalog — cli-jaw-skills (1st-class source)
 
 Quick-reference catalog for `cxc skill search` / `cxc skill show`. Browse here
 first before running a search — if the skill you need is listed below, load it
 directly with `cxc skill show <id>`.
 
 ## Source Priority
 
 | Priority | Source | Flag | Notes |
 |----------|--------|------|-------|
 | 1st | **jaw** (cli-jaw-skills registry) | `--source jaw` (default) | Curated, tested, adapter-compatible |
 | 2nd | **clawhub** | `--source clawhub` | Community catalog, larger but unvetted |
 | 3rd | **hermes** | `--source hermes` | Experimental, currently sparse |
 
 Always try jaw first. Fall back to clawhub when jaw has no match. Use
 `--source all` only when neither jaw nor clawhub covers the need.
 
 ## cli-jaw Active Skills (installed in cli-jaw runtime)
 
 These are battle-tested and maintained as first-party. When loaded via
 `cxc skill show`, they get the external-skill adapter preamble automatically.
 
 | Skill | Domain |
 |-------|--------|
 | `dev` | Universal dev discipline (C0-C5 classifier, verification, safety) |
 | `dev-architecture` | Module boundaries, circular deps, coupling review |
 | `dev-backend` | API, server, database, middleware, observability |
 | `dev-code-reviewer` | Code review process, quality thresholds, antipatterns |
 | `dev-data` | Data pipelines, ETL, SQL optimization, schema evolution |
 | `dev-debugging` | 5-phase root-cause debugging methodology |
 | `dev-devops` | Containers, K8s, CI/CD, IaC, SRE |
 | `dev-frontend` | Frontend/UI implementation, responsive, motion, React/Vue/Svelte |
 | `dev-pabcd` | cli-jaw PABCD orchestration workflows |
 | `dev-scaffolding` | Project setup, feature scaffolding, structural audits |
 | `dev-security` | XSS, CSRF, auth, OWASP, threat model |
 | `dev-testing` | Unit/integration/E2E/contract tests, TDD, coverage |
 | `dev-uiux-design` | UI/UX direction, design judgment, empty/error states |
 | `browser` | Chrome browser control via CDP |
 | `design` | cli-jaw Design workspace (panel UX, artifact lifecycle) |
 | `desktop-control` | Unified desktop + browser automation |
 | `diagram` | SVG diagrams, charts, interactive visualizations |
 | `docx` | Word DOCX create/read/edit/review |
 | `github` | GitHub operations via gh CLI |
 | `goal` | Goal execution with PABCD integration |
 | `hwp` | HWP/HWPX Korean documents |
 | `memory` | Persistent long-term memory across sessions |
 | `pdf` | PDF read/create/edit/review |
 | `pdf-vision` | PDF visual inspection |
 | `pptx` | PowerPoint create/read/edit/review |
 | `repo-map` | Ranked repository structure map |
 | `screen-capture` | macOS screen/camera capture |
 | `search` | Unified search hub (web, X, deep research) |
 | `structured-renderers` | Web UI structured renderer schemas |
 | `telegram-send` | Telegram voice/photo/document delivery |
 | `video` | Code-based video create/edit/render (Remotion, FFmpeg) |
 | `xlsx` | Excel create/read/edit/analyze |
 
 ## cli-jaw Reference Skills (available on demand)
 
 Not installed by default. Load with `cxc skill show <id>`.
 
 ### Agent & Automation
 
 | Skill | Description |
 |-------|-------------|
 | `agent-eval` | Head-to-head agent comparison (pass rate, cost, time) |
 | `agent-harness-construction` | Design agent action spaces and tool definitions |
 | `agent-repl` | Persistent REPL sessions with model switching |
 | `agent-setup-wizard` | Interactive agent skill/rules installer |
 | `agentic-engineering` | Eval-first execution, decomposition, cost-aware routing |
 | `autonomous-loops` | Autonomous loop patterns with quality gates |
 | `continuous-agent-loop` | Continuous autonomous loops with recovery controls |
 | `continuous-learning` | Extract reusable patterns from agent sessions |
 | `continuous-learning-v2` | Instinct-based learning with confidence scoring |
 | `dispatching-parallel-agents` | Parallel task dispatch for independent work |
 | `dmux-workflows` | Multi-agent orchestration via tmux pane manager |
 | `claude-devfleet` | Multi-agent coding via Claude DevFleet |
 | `team-builder` | Agent picker for parallel teams |
 
 ### Cloud & Deploy
 
 | Skill | Description |
 |-------|-------------|
 | `agents-sdk` | Cloudflare Workers Agents SDK |
 | `cloudflare-deploy` | Deploy to Cloudflare Workers/Pages |
 | `durable-objects` | Cloudflare Durable Objects |
 | `deployment-patterns` | CI/CD, Docker, health checks, rollback |
 | `docker-patterns` | Docker/Compose patterns |
 | `netlify-deploy` | Deploy to Netlify |
 | `render-deploy` | Deploy to Render |
 | `vercel-deploy` | Deploy to Vercel |
 
 ### Language & Framework Patterns
 
 | Skill | Description |
 |-------|-------------|
 | `python-patterns` | Pythonic idioms, PEP 8, type hints |
 | `python-testing` | pytest, TDD, fixtures, mocking |
 | `modern-python` | Modern Python patterns |
 | `rust-patterns` | Ownership, error handling, traits, concurrency |
 | `rust-testing` | Unit/integration/property-based Rust tests |
 | `golang-patterns` | Idiomatic Go patterns |
 | `golang-testing` | Table-driven tests, benchmarks, fuzzing |
 | `kotlin-patterns` | Idiomatic Kotlin patterns |
 | `kotlin-testing` | Kotest, MockK, coroutine testing |
 | `kotlin-coroutines-flows` | Coroutines/Flow for Android and KMP |
 | `kotlin-exposed-patterns` | JetBrains Exposed ORM patterns |
 | `kotlin-ktor-patterns` | Ktor server patterns |
 | `java-coding-standards` | Java coding standards for Spring Boot |
 | `jpa-patterns` | JPA/Hibernate entity design and optimization |
 | `springboot-patterns` | Spring Boot architecture patterns |
 | `springboot-security` | Spring Security best practices |
 | `springboot-tdd` | Spring Boot TDD with JUnit 5, Mockito |
 | `springboot-verification` | Spring Boot verification pipeline |
 | `django-patterns` | Django architecture, DRF, ORM |
 | `django-security` | Django security best practices |
 | `django-tdd` | Django TDD with pytest-django |
 | `django-verification` | Django verification pipeline |
 | `laravel-patterns` | Laravel architecture, Eloquent, queues |
 | `laravel-security` | Laravel security best practices |
 | `laravel-tdd` | Laravel TDD with PHPUnit/Pest |
 | `laravel-verification` | Laravel verification pipeline |
 | `react-best-practices` | React/Next.js performance optimization |
 | `nextjs-turbopack` | Next.js 16+ and Turbopack |
 | `nuxt4-patterns` | Nuxt 4 hydration, SSR, performance |
 | `bun-runtime` | Bun as runtime/bundler/test runner |
 | `swiftui-patterns` | SwiftUI architecture, @Observable, navigation |
 | `swift-concurrency-6-2` | Swift 6.2 Approachable Concurrency |
 | `swift-actor-persistence` | Thread-safe persistence with Swift actors |
 | `swift-protocol-di-testing` | Protocol-based DI for testable Swift |
 | `android-clean-architecture` | Clean Architecture for Android/KMP |
 | `compose-multiplatform-patterns` | Compose Multiplatform/Jetpack Compose |
 | `flutter-dart-code-review` | Flutter/Dart code review checklist |
 | `foundation-models-on-device` | Apple FoundationModels on-device LLM |
 | `cpp-coding-standards` | C++ Core Guidelines |
 | `cpp-testing` | GoogleTest/CTest patterns |
 | `perl-patterns` | Modern Perl 5.36+ idioms |
 | `perl-security` | Perl security (taint mode, DBI) |
 | `perl-testing` | Test2::V0, prove, Devel::Cover |
 | `pytorch-patterns` | PyTorch training pipelines |
 
 ### Database
 
 | Skill | Description |
 |-------|-------------|
 | `database-designer` | Schema design, normalization, indexing |
 | `database-migrations` | Migration strategies, zero-downtime |
 | `postgres` | PostgreSQL read-only SQL queries |
 | `postgres-patterns` | PostgreSQL query optimization, indexing |
 | `clickhouse-io` | ClickHouse analytics patterns |
 
 ### Office & Documents
 
 | Skill | Description |
 |-------|-------------|
 | `officecli-accessibility` | Office document accessibility checks |
 | `officecli-cjk` | CJK text handling overlay for OfficeCLI |
 | `officecli-data-pipeline` | Pandas DataFrame to Excel pipeline |
 | `ooxml_core` | Core OOXML reference |
 | `pptx_original` | Original PPTX skill (pre-OfficeCLI) |
 | `xlsx_original` | Original XLSX skill (pre-OfficeCLI) |
 | `html2pptx` | Convert HTML slides to native PPTX |
 | `frontend-slides` | Animation-rich HTML presentations |
 | `nutrient-document-processing` | Nutrient DWS API for document processing |
 
 ### Media & Visuals
 
 | Skill | Description |
 |-------|-------------|
 | `imagegen` | OpenAI Image API generation/editing |
 | `fal-image-edit` | AI media via fal.ai |
 | `nano-banana-pro` | Gemini 3 Pro image generation |
 | `canvas-design` | Visual art in PNG/PDF |
 | `algorithmic-art` | Algorithmic art with p5.js |
 | `sora` | OpenAI Sora video generation |
 | `video-downloader` | Download videos via yt-dlp |
 | `video-frames` | Extract frames/clips via FFmpeg |
 | `videodb` | Video/audio ingest and analysis |
 | `tts` | Text-to-speech (edge-tts, macOS say) |
 | `speech` | Text-to-speech narration/voiceover |
 | `transcribe` | Audio transcription with diarization |
 
 ### Search & Research
 
 | Skill | Description |
 |-------|-------------|
 | `deep-research` | Google Gemini Deep Research Agent |
 | `exa-search` | Neural search via Exa MCP |
 | `research-worker` | Read-only codebase exploration for research |
 | `documentation-lookup` | Up-to-date docs via Context7 MCP |
 | `web-ai` | Structured browser workflow for ChatGPT/Gemini/Grok |
 
 ### Productivity & Integration
 
 | Skill | Description |
 |-------|-------------|
 | `linear` | Linear issue/project management |
 | `notion` | Notion API (pages, databases, blocks) |
 | `notion-knowledge-capture` | Capture conversations into Notion |
 | `notion-meeting-intelligence` | Meeting prep with Notion context |
 | `notion-research-documentation` | Research synthesis from Notion sources |
 | `notion-spec-to-implementation` | Turn Notion specs into implementation plans |
 | `trello` | Trello boards/lists/cards management |
 | `things-mac` | Things 3 task management via CLI |
 | `apple-notes` | Apple Notes via memo CLI |
 | `apple-reminders` | Apple Reminders via remindctl CLI |
 | `obsidian` | Obsidian vault management |
 | `1password` | 1Password CLI (op) |
 | `gog` | Google Workspace CLI |
 | `himalaya` | CLI email via IMAP/SMTP |
 | `spotify-player` | Terminal Spotify playback |
 | `openhue` | Philips Hue control |
 | `weather` | Weather via wttr.in/Open-Meteo |
 | `goplaces` | Google Places API queries |
 | `whatsapp` | WhatsApp automations via Kapso |
 | `x-api` | X/Twitter API integration |
 | `xurl` | Authenticated X API requests |
 | `crosspost` | Multi-platform content distribution |
 
 ### Code Quality & Process
 
 | Skill | Description |
 |-------|-------------|
 | `tdd` | TDD methodology before implementation |
 | `verification-loop` | Multi-phase verification (build, types, lint, tests) |
 | `static-analysis` | Static analysis enforcement |
 | `property-based-testing` | Property-based testing patterns |
 | `insecure-defaults` | Detect insecure default configurations |
 | `security-best-practices` | Security review and improvements |
 | `security-ownership-map` | Git-based security ownership topology |
 | `security-threat-model` | Repository-grounded threat modeling |
 | `plankton-code-quality` | Write-time code quality enforcement |
 | `linter-fix-guide` | Lint error explanation and fixes |
 | `debugging-checklist` | Systematic debugging checklist |
 | `debugging-helpers` | Bug/test failure debugging helpers |
 | `skill-creator` | Create/update AgentSkills |
 | `skill-stocktake` | Audit skills for quality |
 | `rules-distill` | Extract cross-cutting principles into rules |
 
 ### Content & Writing
 
 | Skill | Description |
 |-------|-------------|
 | `article-writing` | Long-form content (articles, guides, tutorials) |
 | `content-engine` | Platform-native content for X/LinkedIn/TikTok/YouTube |
 | `email-draft-polish` | Email drafting with tone/audience targeting |
 | `doc-coauthoring` | Structured documentation co-authoring |
 | `writing-plans` | Pre-implementation writing plans |
 | `investor-materials` | Pitch decks, memos, financial models |
 | `investor-outreach` | Investor communications |
 | `market-research` | Market research with source attribution |
 | `visa-doc-translate` | Visa document translation to bilingual PDF |
 
 ### Architecture & Planning
 
 | Skill | Description |
 |-------|-------------|
 | `architecture-decision-records` | Capture architectural decisions as ADRs |
 | `senior-architect` | System architecture, ADRs, pattern selection |
 | `blueprint` | Multi-session engineering construction plans |
 | `brainstorming` | Intent/requirements exploration before implementation |
 | `codebase-onboarding` | Generate structured onboarding guides |
 | `codebase-orientation` | Quick codebase orientation for unfamiliar code |
 | `context-budget` | Audit context window consumption |
 | `context-compression` | Context compaction and conversation summarization |
 | `strategic-compact` | Manual context compaction at workflow boundaries |
 | `ralphinho-rfc-pipeline` | RFC-driven multi-agent DAG execution |
 | `ai-first-engineering` | AI-first engineering operating model |
 | `prompt-engineering` | Prompt engineering patterns |
 | `mcp-builder` | Create MCP servers for LLM integrations |
 
 ### Miscellaneous
 
 | Skill | Description |
 |-------|-------------|
 | `atlas` | ChatGPT Atlas desktop app control (macOS) |
 | `claude-api` | Anthropic Claude API patterns |
 | `openai-docs` | OpenAI official documentation |
 | `data-scraper-agent` | AI-powered data collection agent |
 | `develop-web-game` | Web game development + testing loop |
 | `figma-implement-design` | Figma-to-code implementation |
 | `git-worktrees` | Git worktree isolation for feature work |
 | `jupyter-notebook` | Jupyter notebook scaffolding |
 | `liquid-glass-design` | iOS 26-27 Liquid Glass design system |
 | `tmux` | tmux session remote control |
 | `web-artifacts-builder` | Multi-component HTML artifacts |
 | `web-perf` | Chrome DevTools web performance analysis |
 | `theme-factory` | Styling artifacts with themes |
 | `ui-design-system` | Design tokens, palettes, typography, WCAG |
 | `summarize` | URL/podcast/file text summarization |
 | `log-summarizer` | Noisy log summarization |
 | `regex-vs-llm-structured-text` | Regex vs LLM decision framework |
 | `vision-click` | Vision-based coordinate click |
 | `sentry` | Sentry issue/event inspection |
