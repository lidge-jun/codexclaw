## 2. Existing Repo First

Before scaffolding inside an existing repo:
1. Resolve the repo root from `pwd` / project context / applicable `AGENTS.md`.
2. Detect existing architecture, docs, plans, changelog, ADR, agent-context, and source-of-truth conventions.
3. Read existing `README.md`, `AGENTS.md`, `CLAUDE.md`, `devlog/`, `docs/`, `plans/`, `adr/`, `architecture/`, or equivalent source-of-truth docs before proposing new structure.
4. Reuse clear conventions instead of imposing the default pattern.
5. Show a compact tree before broad additions.
6. Do not create new project-level docs folders, planning folders, `AGENTS.md`, or extra tooling without approval.

MUST preserve mature repo conventions over the default scaffold pattern.

### Codexclaw-First Durable Docs

**Rule (SCAF-SOT-01):** In codexclaw or any repo that already uses durable devlog/source-of-truth conventions, prefer the existing `devlog/` placement, local numbering scheme, and source-of-truth paths before proposing generic `docs/` + `plans/`.

Keep it light:
- Cross-link scaffold docs to evidence paths (`path:line`, plan file, ADR, current-architecture note) so future workers can audit why files exist.
- Follow existing phase/decade numbering when present; do not flatten or renumber local history.
- In multi-cycle loop units, the decade docs (010, 020, 030...) are authored during
  the docs-only first work-phase (LOOP-DOCS-FIRST-01, `cxc-loop`), not scaffolded
  empty.
- Treat source-of-truth placement as part of scaffolding completion: the final audit must say which durable convention was reused or that none existed.
- Boundary/public-export decisions still route to `dev-architecture` §1 (`ARCH-DECISION-01`, `ARCH-MAP-01`); scaffolding owns file placement and skeleton consistency.

## 2.1 Lightweight Source of Truth (implementation-unit devlog)

The implementation-unit devlog routine (`devlog/_plan/` units — `pabcd` §Work-Phase
Loop, UNIT-RESIDENCE-01) is the DEFAULT for C2+ work where the repository uses it.
C0/C1 follow the record exemptions in `dev` §0.1; do not create a unit just for them. Propose the `docs/`/`plans/`
architecture docs when:

C0/C1 record exemptions are owned by cxc-dev §0.1; this routine does not override them.

- The repo is immature, undocumented, or inconsistent; or
- The user asks for a durable source-of-truth structure; or
- A broad change needs a durable plan/current-architecture record.

Default proposal:

```
docs/
  architecture.md        # current system shape, not future wishes
  conventions.md         # naming, layout, commands, testing
plans/
  active/                # active implementation plans
  done/                  # completed work summaries
```

Folder names are advisory. If the repo already has `devlog/`, `docs/`, `adr/`, `plans/`,
`changelog/`, `architecture/`, or another convention, propose using those instead.
Also detect optional lightweight source-of-truth files such as `CONTEXT.md`,
`CONTEXT-MAP.md`, and `docs/adr/`. Reuse them when present. Do not create them unless
the repo already uses that convention or the user approves. Create an ADR only for a
decision that is hard to reverse, surprising without context, or has a real tradeoff.

Before patching a repo, FIND its general source-of-truth docs first
(architecture/INDEX docs, or equivalent) and read them. For SOT-SYNC-01,
read [Check phase](../../pabcd/references/phase-check.md#check-phase).

Implementation-unit devlog method:
- Split large work into phase-level documents instead of one huge plan —
  dependency-ordered (PHASE-SPLIT-01), ALL written to diff-level up front
  (DIFFLEVEL-ROADMAP-01; both defined in `pabcd`).
- Keep diff-level plans in files, not chat: exact paths, NEW/MODIFY/DELETE, before/after diffs for MODIFY, complete content for NEW.
- Keep chat summaries short: explain the phase, show a compact tree/change map, then link the plan file.
- Move completed plan folders to an archive/done area if the repo already uses that convention.

Phase naming is owned by [Implementation units](../../pabcd/references/implementation-units.md)
(LEXICO-SPLIT-01). Use the existing three-digit convention; do not mix two-digit names.

Before creating any new source-of-truth folders, ask concisely: state that no durable docs were found,
show the proposed tree, give a specific recommendation, and confirm you will not create them without approval.
This gate governs introducing a convention, not routine unit subfolders in an
existing devlog/_plan. Create a unit only when required; cxc-dev §0.1 does not
require a new unit for a C0/C1 fast-path record.

## 8. Function-Structure Docs

Structured per-feature docs are part of the **full** scaffolding standard, not the lightweight default.

Use them when:
- The user explicitly asks for full structural docs.
- The repo already maintains per-feature structure/function docs.
- A broad feature needs durable module-level function documentation.

When used:
- One `.md` file per feature folder (e.g. `price.md`, `auth.md`)
- Keep each document concise, bounded, and task-oriented — not padded to a fixed length
- Required sections: File Tree, Module Responsibility, Key Function Signatures, Dependencies, Dependents, Sync Checklist
- Update the corresponding `.md` whenever a feature is added or modified
- Template: `<SKILL_DIR>/assets/str_func_template.md`

Do not generate heavy feature docs by default for small or immature repos.
Prefer lightweight architecture/conventions docs first.

## 11. Documentation Generation

When generating project documentation or scaffolding docs:

### README Generation
1. Read existing structure (§2 Existing Repo First)
2. Generate README with: project purpose, quick start, architecture overview (link to existing source-of-truth docs if present), contribution guide
3. Match tone to project maturity: immature repos get setup-heavy READMEs; mature repos get architecture-heavy ones

### API Documentation
1. Scan route files and extract endpoint signatures
2. Generate per-endpoint docs: method, path, params, request/response shape, auth requirements
3. Place alongside code (colocation) or in `docs/api/` per project convention

### Structure Documentation
1. Generate or update the repo's existing structure docs
2. Include: directory tree, module responsibility map, dependency flow
3. Follow the repo's existing source-of-truth convention when one exists

### Planning Documentation
1. Follow decade numbering (../../pabcd/references/implementation-units.md, LEXICO-SPLIT-01): 000-009 research, 010-019 phase 1, etc.
2. Each plan entry should capture: title, date, what changed, why, evidence paths
3. Cross-reference related plan entries within the same work folder when helpful
