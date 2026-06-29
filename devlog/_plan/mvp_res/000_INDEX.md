# codexclaw MVP — Loop-Ordered Plan (mvp_res)

Status: CANONICAL INDEX · 2026-06-30 · supersedes the decade-themed layout in `../260629_codexclaw_mvp/`

> This folder re-expresses the codexclaw plan in **execution (loop) order**, not decade-theme
> order. The old `260629_codexclaw_mvp/` files remain as the source-of-record reference; here each
> **loop = one small IPABCD cycle = one decade folder slot**. Research is consolidated up front.

## Naming convention (LOCKED)

- `000-009` = research (carried over verbatim + new research). Source copies live in
  `000_research_src/`.
- Each implementation **loop Ln** owns a **decade**: `010=L1`, `020=L2`, ... `310=L31`.
- The decade head doc is `0X0_L<n>_<slug>.md`; finer sub-passes are `0X1_L<n>.1_<slug>.md`,
  `0X2_...`, allowing `.1` fractioning when a loop splits.
- Directory sort order == execution order. No more decade-theme/exec-order mismatch.

## Project shorthand (LOCKED -- jun 2026-06-30)

- **`cxc`** is the official 3-letter CLI alias / shorthand for `codexclaw`.
- Binary aliases: `codexclaw` (full) and `cxc` (short) both point at `bin/codexclaw.mjs`.
- Avoids collision with `jaw` (cli-jaw), `ocx` (opencodex), `codex` (runtime).
- All loop docs, CLI examples, and command tables MUST use `cxc <cmd>` as the primary form
  (full `codexclaw <cmd>` shown once per doc max, in the install/synopsis line).

## Subagent lifecycle (LOCKED -- jun 2026-06-30)

- **SUB-CLOSE**: once a subagent's result is received and integrated, and there is no pending
  resume work for it, close it immediately with `multi_agent_v1.close_agent`. Do not leave finished
  children open.
- A child closed as `inconclusive` / ack-only counts as **NOT approval / NOT pass**; record that
  fact, then close it. Re-spawn smaller (`fork_context: false`) only if the deliverable is still
  required.
- **Exception (fresh-eyes reuse)**: a contradiction-derivation Mind that is scheduled for M3
  re-invocation (context-preserving reuse + strong re-evaluate-from-scratch prompt, see L9) MAY be
  kept alive between rounds. Close it once its dry-run series converges (no remaining
  contradictions).
- Applies to every loop's A/C audit dispatches and to the L9 interview dispatcher.

## What codexclaw is (one-liner)

A single Codex plugin that **reuses the OpenAI `codex` runtime** (no custom harness) and layers
cli-jaw-style dev discipline (IPABCD + dev skills + multi-model subagents) on top, with file-based
state and `codex` feature-flag activation. opencodex (`ocx`) is an **optional** provider proxy,
never vendored. References: jawcode, ouroboros/Q00, lazycodex/omo.

## Loop ledger -- L1..L31 -> decade map

Status legend (decision-state vs impl-state are SEPARATE; never use RESOLVED as a doc Status):
Scope: this legend governs **loop (L-doc) Status lines only**. Meta/non-loop docs use free-form
labels outside this enum: `CANONICAL INDEX` (this file), `PROVENANCE` (000_BUILD_LOG), `P` (active
PABCD pass plans). Those are not loop statuses and are intentionally not in the enum.
- DONE — shipped + tested (code lives, tests green).
- FROZEN — design frozen, impl pending (interview-bearing loops).
- PLANNED — all gating decisions resolved, impl pending. Append `(Q-x resolved)` to name the decision.
- ANALYZED — research done, impl not yet planned in detail.
- DEFERRED — intentionally postponed (e.g. Phase 3); not blocked on a pending decision.
- BLOCKED(Q-id) — cannot proceed until jun resolves decision Q-id. A resolved decision must NOT stay BLOCKED.
Rule: when a decision is resolved but code isn't written, the Status is PLANNED (or FROZEN for
interview loops), NEVER "RESOLVED". "RESOLVED" belongs only in the Open-decisions table / Resolved notes.

### Phase 1 -- MVP core (state mgmt + dev-skill injection, config untouched)  [L1-L7 DONE]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L1 | 010 | IPABCD state engine (state.ts + fsm.ts, session-scoped) | DONE | 018_pass1_P_plan, 022.1 |
| L2 | 020 | Directive-injection hook (UserPromptSubmit + passive Stop) | DONE | 018.2, 018.3 |
| L3 | 030 | Goal budget gate (PreToolUse ^create_goal$ deny) | DONE | 023, 023.2 |
| L4 | 040 | dev-* router skills (13 skills, recipe = dev-debugging) | DONE | 024, 024.3, 024.4 |
| L5 | 050 | Subagent roles (explorer/reviewer/executor, B-opt2 inline) | DONE | 025, 025.1 |
| L6 | 060 | Install / activation (codex features enable wrapper + revert) | DONE | 027, 028, 028.1, 028.2 |
| L7 | 070 | Build aggregation + Phase-1 verification gate (S1-S5) | DONE | 070, 070.1, 029, 029.1 |
| L1.4 | 014 | IDLE/complete closed state + structural attest enforcement (R-2/R-4 hardening) | DONE | 014, 007 |
| L3.4 | 034 | Narrow PreToolUse matcher to ^create_goal$ (R-10 hardening) | DONE | 034, 007 |
| L2.4 | 024 | Transcript-marker idempotency + context-pressure suppression (R-11 hardening) | DONE | 024, 007 |
| L2.5 | 025 | R-12 decision: PostCompact/SubagentStop NOT required for MVP (evidence-grounded) | DONE | 025, 007 |
| L6.4 | 064 | R-13 decision: install-bootstrap boundary (codex owns hook-trust + enable) | DONE | 064, 007 |

### Cluster 1 -- IPABCD Interview completion  [L8-L11]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L8 | 080 | Interview state schema + readiness FSM (tracker/known/unknown/assumptions/contradictions, bound) | DONE | 080, 022.2, 022.3 |
| L9 | 090 | 5-Mind contradiction dispatcher (subagent contradiction-ONLY) | DONE | 080.1, 080.2, 034.5, ouroboros 030/040 |
| L10 | 100 | Question generator + auto-mode + freeze->goal | DONE | 080.2, ouroboros 040 |
| L11 | 110 | goal-mode interview hard deny (PreToolUse) | DONE | 022.3, 023 |

### Cluster 2 -- Skill real-content porting (port -> absorb -> search -> hub-rewrite)  [L12-L19]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L12 | 120 | dev hub + pabcd real-content port (always-on discipline core) | DONE | 110_dev_skills_porting |
| L13 | 130 | dev-architecture + dev-debugging <- omo(debugging, ast-grep, comment-checker) | DONE | 110 |
| L14 | 140 | dev-backend + dev-data <- omo(programming) | PLANNED | 110 |
| L15 | 150 | dev-frontend + dev-uiux-design <- omo(frontend, visual-qa, designpowers) | PLANNED | 110 |
| L16 | 160 | dev-testing + dev-code-reviewer <- omo(review-work, remove-ai-slops) | PLANNED | 110 |
| L17 | 170 | dev-security + dev-devops + dev-scaffolding <- omo(refactor, init-deep, git-master) | PLANNED | 110 |
| L18 | 180 | Unified search hub + Korean search intent guard (search ON-DEMAND, `allow_implicit_invocation:false`) <- omo(ultimate-browsing, ultraresearch) | PLANNED | 120_unified_search_hub |
| L19 | 190 | skill_hub REWRITE (codexclaw-specific; default trigger = dev only) | BLOCKED(L12-L17) | 100_skill_hub |

### Cluster 3 -- Expansion ops  [L20-L22]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L20 | 200 | cli-jaw command -> codex-native mapping (doctor/reset self-impl, chat-search wrapper) | ANALYZED | 090_clijaw_command_mapping |
| L21 | 210 | Subagent role .toml + diagnostics/ops (teammode, lcx-*) | ANALYZED | 140_subagent_roles_ops |
| L22 | 220 | Code intelligence (ast-grep adopt; lsp/codegraph deferred) | PLANNED (ast-grep only; Q-130-defer resolved) | 130_code_intelligence |

### Cluster 4 -- Phase 2 (multi-model + GUI)  [L23-L28]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L23 | 230 | Provider bridge (ocx DETECT-ONLY / graceful skip) | PLANNED (Q-P2-2 resolved) | 031_provider_bridge |
| L24 | 240 | Subagent config store (.codexclaw/subagents.json) | PLANNED | 032_subagent_config_store |
| L25 | 250 | Model catalog (ocx catalog + main = n+1) | PLANNED | 033_model_catalog |
| L26 | 260 | GUI scaffold (Vite + React, layout-ref only) | PLANNED (Q-P2-1 resolved) | 034_gui_scaffold |
| L27 | 270 | GUI subagent page (role->model+prompt) + 10100 link bar | PLANNED | 035_gui_subagent_page |
| L28 | 280 | Phase 2 integration + verification (S6-S10) | PLANNED | 036_phase2_verification |

### Cluster 5 -- Phase 3 (scheduled work)  [L29-L30]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L29 | 290 | Scheduler mechanism + `cxc schedule` CLI + job store | DEFERRED (Q-P3-1, Phase 3) | 040, 041/042 |
| L30 | 300 | Result delivery + Phase 3 verification | DEFERRED (Q-P3-2, Phase 3) | 040, 043/044 |

### Cluster 6 -- Deferred  [L31]
| Loop | Decade | Slug | Status | Source-of-record |
|------|--------|------|--------|------------------|
| L31 | 310 | Channel delivery (telegram/discord) | PLANNED defer | 150_channel_delivery |

## Open decisions gating loops (jun)

| ID | Loop | Fork |
|----|------|------|
| ~~T4~~ | L9 | RESOLVED -> A: **main-agent owns loop (prompt-only)**; hook injects directives only; state in `.codexclaw/` |
| ~~T7~~ | L9 | RESOLVED -> A: **main-session-only Mind dispatch**; nested session -> skip interview (inline fallback last resort) |
| ~~Q-GM-1-f~~ | L11 | RESOLVED (codex-rs 실측, 2026-06-30) -> goal-active 감지 = codexclaw hook이 codex `goals_1.sqlite`를 thread_id(=session_id)로 READ-ONLY 조회 (hook payload엔 goal 필드 없음=INDIRECT). `.codexclaw/goal-active` 마커는 폐기. PreToolUse hard-deny가 `request_user_input`/인터뷰 트리거를 막음 — codex의 게이트 억제가 PARTIAL(continuation 프롬프트만 있고 "묻지마"·request_user_input 비활성화는 없음)이라 codexclaw가 직접 enforce해야 함 |
| ~~130-defer~~ | L22 | RESOLVED -> ast-grep only (lazy install); lsp/codegraph explicitly deferred (post-MVP) |
| ~~Q-P2-2~~ | L23/L25 | RESOLVED (ocx 소스 실측, jun 2026-06-30) -> ocx = DETECT ONLY, auto-ensure 안 함(감지만: ocx 설치 여부 + 서브에이전트/모델 목록). 멀티모델은 ocx 부재여도 동작: codex 네이티브 카탈로그를 소스로 사용. 근거 = opencodex `src/codex-catalog.ts:43` `NATIVE_OPENAI_MODELS`(gpt-5.5/5.4/5.4-mini/5.3-codex-spark)를 codex live catalog(CODEX_MODELS_CACHE_PATH)에서 읽어 allowlist 필터. L25 "ocx 없으면 default 1개"는 폐기 |
| ~~Q-P2-1~~ | L26 | RESOLVED (jun 2026-06-30) -> opencodex GUI는 **레이아웃/구조만 참조**하고 내부 콘텐츠는 codexclaw가 신규 구현. 파일 복사/벤더링 금지(D5와 일관). opencodex GUI는 API-driven(Subagents.tsx가 `/api/*` fetch) 이므로 레이아웃 패턴만 차용 |
| ~~Q5-ocx-ensure~~ | L23 | RESOLVED -> detect-only 확정. `ocx ensure` 자동 실행 안 함. 감지 대상 = ocx 설치 여부 + 서브에이전트 목록. (필요 시 명시적 `cxc` 명령으로 분리, MVP 범위 밖) |
| ~~Q-P3-1~~ | L29 | DEFERRED -> first research whether codex app has a built-in schedule; fall back to OS scheduler. Phase 3 deferred |
| ~~Q-P3-2~~ | L30 | DEFERRED (Phase 3) -> revisit with L29 |

## ★ Cluster 1 구조 확정 — A안 (codex-rs 실측, jun 2026-06-30)

codexclaw는 **FSM만 소유하고, goal 생명주기는 codex 내장에 위임**한다 (HITL/HOTL 병존의 토대).

- **FSM (IDLE/I/P/A/B/C/D)**: codexclaw가 `.codexclaw/` 세션 스코프로 소유. (L1~L7 구현 완료)
- **goal 생명주기 + 자율 continuation**: codex 내장 `ThreadGoal`에 **continuation 구동만** 위임한다.
  codexclaw는 goal을 만들지 않지만, plan hash / checkpoints / assumptions / phase-evidence 같은
  **감사추적은 codexclaw 소유 보조 ledger(`.codexclaw/`)에 둔다** (R-1 정정, 007 findings). jawcode
  (`.jwc/goal/ledger.jsonl`)·omo(`.omo/ulw-loop/`) 둘 다 native goal은 continuation에만 쓰고 ledger는
  파일로 따로 든다 — "100% 위임"은 overclaim이었다. 실측 근거:
  - `ThreadGoal` 영속 = `codex-rs/state/src/model/thread_goal.rs:11` (status Active/Paused/Blocked/
    UsageLimited/BudgetLimited/Complete), thread-scoped `goals_1.sqlite`.
  - 자율 재주입 = `codex-rs/core/src/goals.rs:156` `MaybeContinueIfIdle` → `:1341` 새 턴 생성 →
    `:1421` `continuation_prompt` 주입. (= cli-jaw `[goal-continuation]`의 codex-native 등가물)
- **goal-active 감지 (Q-GM-1-f)**: hook payload엔 goal 필드 없음(INDIRECT). codexclaw hook이
  codex `goals_1.sqlite`를 thread_id(=session_id)로 READ-ONLY 조회해 판정. 자체 마커 파일 안 만듦.
- **HOTL 게이트 억제 (L11 필수 이유)**: codex의 억제는 PARTIAL — continuation 프롬프트는 "계속
  전진"만 있고 "묻지마"·`request_user_input` 비활성화는 **없다**. 따라서 "goal 모드에서 인터뷰/
  `request_user_input` 금지"는 codexclaw PreToolUse hook이 **직접 hard-deny**로 enforce한다.
  이것이 HITL(IDLE-IPABCD)과 HOTL(goal) 모드 경계를 지키는 지점이다.
- **⚠ supersede ≠ skip (R-3)**: native goal continuation은 "계속 일해"라 PABCD를 통째로 건너뛸 위험이
  있다. continuation 턴에 phase directive를 주입하고 증거 없는 전진을 막아, goal 모드여도 P→A→B→C→D를
  실제로 돈다. "no questions"가 "no PABCD"가 되면 안 된다.

### ⚠ 구현실전 보강 (007_impl_reality_findings.md — cli-jaw/jawcode/omo 3-레퍼런스 교차검증)
Cluster 1 구현 전 반드시 반영할 high 갭(전체 13건은 007 참조):
- **R-2 attest 게이트**: shipped `fsm.ts`는 A/C entry가 무조건 open + flag만 — cli-jaw의 증거게이트가
  prompt prose로 격하됨. FSM에 플러그인-네이티브 구조적 attest enforcement 필요(신규 L1 보강 loop).
- **R-4 IDLE/complete 상태**: shipped phase에 IDLE/complete 없음(default `I`, D 다음 null) — 철학문서의
  "D→IDLE로 스코프 drift 제어"와 코드가 모순. IDLE/닫힘 상태 추가 필요(신규 L1 보강 loop).
- **R-5 evidence carry**: freeze가 objective+hash만 넘김 — interview tracker/seed/AC/research를 구조적
  evidence bundle로 freeze해 goal 진입 시 주입(L8/L10.3).
- **R-6 stop/pause 감사**: HOTL 완료/중단에 독립리뷰+evidence 감사 게이트 포팅(신규 loop).
- **R-7~R-13**: native create_goal 활성화 bridge, continuation 턴 hook 커버리지 실측, fail-closed deny,
  narrow hook matcher, transcript idempotency, PostCompact/SubagentStop 등록, install bootstrap 경계 — 007 참조.

### Q2 — L3 budget deny 유지 (RESOLVED, jun 2026-06-30)
- create_goal에 `token_budget`/`objective` 외 키가 붙으면 PreToolUse **deny 유지**(무제한 goal 강제,
  omo 패턴). 내장 goal과 무모순: codex create_goal은 `objective`+optional `token_budget`만 받으므로
  (`codex-rs/core/src/tools/handlers/goal.rs:23`), deny가 "objective-only 무제한 goal"로 좁히는
  정책 레이어로 작동한다. (L3 = 구현 완료, 유지)

## Per-loop doc template (every 0X0_L<n>_*.md MUST follow)

```
# L<n> (Decade 0X0) -- <Title>

Status: <DONE | FROZEN | PLANNED | ANALYZED | BLOCKED(<id>)>
Cluster: <n> · Phase: <1|2|3|expansion> · Shorthand: cxc
Source-of-record: <old decade files this consolidates>

## Goal (one slice)
<the single outcome this loop ships>

## Why now / dependencies
<upstream loops that must be at D first; downstream this unblocks>

## Scope (decision-complete)
- Files to add/edit (absolute or repo-relative paths)
- Exact behavior; Must-NOT-Have

## IPABCD micro-cycle
- I (if interview-bearing): trigger + flags
- P: diff-level plan summary
- A: audit angle + who (subagent role)
- B: implementation steps
- C: check (node --test target / CLI stdout / real surface)
- D: done = <acceptance>

## Acceptance (1-3 testable criteria)
## QA channel (node:test path / CLI stdout / tmux / data dump)
## Commit unit (one atomic conventional commit)
## Blocked-on (jun decision id, if any)
## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
```

## Subagent build provenance
- L-docs authored by parallel gpt-5.5 subagents over disjoint decade ranges (see `000_BUILD_LOG.md`).
- Each doc grounded in source-of-record + codex-rs/omo where cited.
