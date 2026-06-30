# 070 — agbrowse Adapt + ultraresearch Protocol (impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 070 · class C3 (skill/runtime)

> Source gap: `../lazygap/007` (search engine + deep research) incl. its DECISION UPDATE
> (do NOT port omo's insane-search engine; adapt agbrowse instead). A-gate (Harvey, gpt-5.4) ran
> agbrowse live and returned SAFE-TO-WRITE with precise constraints, all folded below. This is a
> Tier-2 ENRICHMENT of the shipped 3-tier ladder + a Tier-3 explorer-attached protocol — NOT a
> new tier and NOT a server.

## Why

`cxc-search` Tier 2 (proof) currently leans on Browser Use / Computer Use prose. agbrowse is the
already-built, server-free distillation of cli-jaw's browse layer: HTTP-first proof with local
browser only as escalation. Adopting it as a lazy, opt-in proof helper makes "open the source and
confirm" a concrete command, while the ultraresearch protocol gives Tier 3 a real method. Per the
locked decision we do NOT rebuild omo's `engine/`.

## Ground Truth (read before edit — agbrowse + shipped, A-gate ran these live)

- agbrowse entrypoint: `package.json#bin` `agbrowse -> bin/agbrowse.mjs` (`agbrowse/package.json:8`,
  `bin/agbrowse.mjs:1`); CLI hub `skills/browser/browser.mjs:10`. It is a thin Node shim that
  imports package-relative modules (contract frozen by `bin-shim-contract.test.mjs:15`) — NOT a
  single self-contained binary.
- Proof commands (verified live):
  - `agbrowse fetch <url> --json --browser never` → adaptive-fetch envelope (HTTP, pure Node
    fetch `adaptive-fetch/fetcher.mjs:34`; browser skipped in `never` mode `index.mjs:651`). This
    is the HTTP-first proof path.
  - `agbrowse search --verify <url> --json --browser never` → compact verdict envelope, schema
    `agbrowse-search-verify-v1` (`search.mjs:122`).
- WARNING (A-gate, live-confirmed): plain `agbrowse search "<query>"` is NOT hosted discovery —
  without `--stdin-results` it FABRICATES google candidate URLs (`search.mjs:166`). So 070 must
  NOT present `agbrowse search` as a Tier-1 search engine; only `fetch`/`search --verify` (proof
  of a known URL) are used.
- `search --verify` CANNOT browser-escalate (its dispatch has no browser deps; `--browser
  required` returns `browser_required`, `browser.mjs:2292`). Only `fetch` escalates, and that
  needs a running local Chrome/CDP (`browser.mjs:1233`).
- Dependency radius (A-gate): NOT "playwright-core only" — package deps include `archiver`,
  `fast-glob`, `playwright-core` (`package.json:85`), and `browser.mjs` top-level-imports web-ai
  which pulls more. The HTTP path is pure-fetch at runtime but still needs the installed package
  present. Optional shell-outs (`curl-impersonate`, `yt-dlp`, `python3+camoufox`) exist but are
  opt-in.
- Server-free: each command is a short-lived process (`README.md:31`, dispatch `browser.mjs:2292`).
  Caveat: `agbrowse start` keeps a persistent local Chrome profile under `~/.browser-agent` — 070
  does NOT use `start`; it uses one-shot `fetch`/`verify` only (no persistent profile, no daemon).
- ast-grep resolution template: `ast_grep_helper.py:246` (override → cache → npm → PATH → Homebrew
  → install hint). Reusable in SPIRIT, but the agbrowse target is a package/bin shim, not a lone
  binary; NO Homebrew path exists for agbrowse (do not promise one).
- cxc-search current text: Tier-2 at `search/SKILL.md:31-38`; the `## Notes` line
  "there is no `agbrowse` binary dependency" at `search/SKILL.md:87`; Tier-3 swarm at `:40-45`.
- ultraresearch-as-attached-skill is already the locked principle: `lazygap/007:36`,
  `lazygap/008:12,28` (roles stay three; protocol rides on base `explorer`).

## Design (diff-level)

### (A) Lazy agbrowse resolver (mirrors ast-grep, targets the shim)

New `plugins/codexclaw/skills/search/scripts/agbrowse_helper.py` (or `.mjs`) resolving the
executable in order, returning a runnable command (NOT copying a binary):

```
1. $CODEXCLAW_AGBROWSE_PATH         (explicit override — abs path to bin/agbrowse.mjs or `agbrowse`)
2. `agbrowse` on PATH                (npm -g install)
3. an adjacent checkout              (…/agbrowse/bin/agbrowse.mjs, if present)
4. else: print an install hint       ("npm i -g agbrowse" or "cd <checkout> && npm i && npm link")
```

No Homebrew step (agbrowse has none). The resolver verifies the target is a real shim, not a
vendored copy. Resolution failure is a HINT, never a crash — Tier 2 falls back to Browser Use.

### (B) cxc-search Tier-2 rewrite (enrichment, not a new tier)

Edit `search/SKILL.md` Tier-2 (`:31-38`) to prefer agbrowse HTTP proof BEFORE Browser Use:

```text
### Tier 2 — Proof (default): agbrowse HTTP-first, then Browser Use
Prefer `agbrowse fetch "<url>" --json --browser never` to PROVE a candidate URL via HTTP /
public endpoints first (it returns ok/verdict/source/finalUrl/content/evidence). Use
`agbrowse search --verify "<url>" --json --browser never` for a compact verdict on a known URL.
If HTTP proof is blocked/JS-only and a local Chrome is available, escalate with
`agbrowse fetch "<url>" --json --browser auto` (local CDP only). If agbrowse is not resolvable,
fall back to Browser Use / Computer Use (the Codex-native proof path), exactly as today.
`agbrowse` is OPT-IN and lazily resolved; never a hard dependency.
NOTE: do NOT use plain `agbrowse search "<query>"` as discovery — it fabricates candidate URLs;
discovery stays Tier 1 (hosted web_search).
```

Correct the `## Notes` lines (`:87-89`): replace "there is no `agbrowse` binary dependency" with
"agbrowse is an OPT-IN, lazily-resolved Tier-2 proof helper (HTTP-first; local-CDP escalation
only); it is not bundled and not required." Keep the 3-tier structure (`:23-45`) unchanged.

### (C) ultraresearch protocol as an explorer-attached skill (Tier 3)

New on-demand skill `plugins/codexclaw/skills/ultraresearch/SKILL.md` carrying the EXPAND / wave /
journal / claim-ledger / verified-claims protocol + convergence rules (spawn-floor, 2-wave
minimum, 3-no-lead / 5-wave cap). It is ATTACHED to base `explorer` subagents by the 020
role×intent map (`research X` → `explorer` + `[cxc-search, ultraresearch]`) — NOT a new role.
Tier-3 text in `search/SKILL.md:40-45` gains a one-line pointer to this skill; the swarm still
spawns base explorers.

## Honest scope (what 070 does and does NOT claim)

- agbrowse is a Tier-2 PROOF helper for known URLs, NOT a Tier-1 discovery engine.
- HTTP-first (`--browser never`) is the default; local-CDP escalation (`--browser auto`) is opt-in
  and needs a running local Chrome. Remote/hosted CDP modes are OUT (no-server boundary).
- agbrowse is opt-in + lazily resolved; if absent, Tier 2 is exactly today's Browser Use path.
- Adopting agbrowse does NOT introduce a server/daemon; 070 uses one-shot commands only (never
  `agbrowse start`/persistent profile).
- Real dep radius is broader than playwright-core; 070 states this and keeps agbrowse optional so
  codexclaw's own npm graph stays lean.
- ultraresearch is an attached skill/protocol on base `explorer`; NO new subagent role.
- web-ai / vision-click are DEFERRED (heavy browser-runtime + Codex CLI coupling).

## Invariants

- agbrowse never a hard dependency; resolver failure → Browser Use fallback, never a crash.
- No new search tier; this is a Tier-2 enrichment + Tier-3 method pointer.
- No server/daemon; one-shot commands only; no persistent Chrome profile via `start`.
- No new subagent role (ultraresearch rides base `explorer`).
- Discovery stays Tier 1; agbrowse is proof-only.

## Acceptance

| Check | Evidence |
|-------|----------|
| Resolver order | override → PATH → adjacent checkout → install hint; failure returns a hint, not an error |
| HTTP proof documented | Tier-2 names `agbrowse fetch <url> --json --browser never` as the first proof step |
| Escalation honest | local-CDP `--browser auto` documented as opt-in needing local Chrome; remote OUT |
| No discovery misuse | doc explicitly forbids plain `agbrowse search` as discovery |
| Notes corrected | the "no agbrowse dependency" note is replaced with the opt-in/lazy wording |
| 3-tier intact | ladder structure unchanged; this is a Tier-2/Tier-3 enrichment |
| ultraresearch attached | new skill exists; 020 map attaches it to `explorer`; no new role |
| Fallback | agbrowse unresolved → Browser Use path identical to today |

## Verification

- `python3 .../search/scripts/agbrowse_helper.py doctor` resolves or prints the install hint.
- a smoke proof: `agbrowse fetch https://example.com --json --browser never` returns an envelope
  (when agbrowse is installed); when not installed, the helper degrades to a hint.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check` (skill-text + new script only).

## Sub-passes

- 070.1 — agbrowse lazy resolver + the Tier-2 `search/SKILL.md` rewrite + Notes correction.
- 070.2 — `ultraresearch` skill (EXPAND/wave/journal/claim-ledger) + 020 role×intent attachment.

## A-gate findings folded (Locke, gpt-5.5)

- ultraresearch skill packaging (B2): a new skill dir needs BOTH `SKILL.md` AND
  `agents/openai.yaml` (doctor `doctor.ts:82-100`; `manifest-policy.test.mjs:47-59`), and it
  MUST be added to `skill-hub/references/catalog.md` or the L19 catalog-coverage test fails
  (`manifest-policy.test.mjs:137-151`). Ship all three.
- research-intent attachment (B3 + note 4): do NOT extend `ROLE_BASE_SKILLS.explorer` (that
  would hit every explorer). Add an internal `INTENT_EXTRA_SKILL_FOLDERS` map and append it
  inside `routeDispatch` — no public signature change, existing 020 callers/tests unaffected.
- agbrowse resolver order (note 8): override → PATH → adjacent checkout → install hint. NO
  runtime/cache/Homebrew steps (agbrowse has none); do not copy ast-grep's full order.
- gate prose (note 6): both `search/SKILL.md` and the new `ultraresearch/SKILL.md` are scanned
  for false-enforcement claims; phrase the swarm/attachment as agent-driven, not hook-enforced.

## PABCD plan (one full cycle)

- P: this diff-level design; confirm HTTP-first proof + opt-in/lazy + no-discovery-misuse.
- A: gpt-5.4 explorer challenges — does any line call `agbrowse search` discovery? is escalation
  honestly local-CDP-only? does the resolver avoid promising a vendored binary or Homebrew? does
  ultraresearch stay an attached skill (no role)?
- B: implement resolver + skill edits + ultraresearch skill + 020 map entry + tests.
- C: build idempotent + helper smoke + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-070): agbrowse Tier-2 proof helper + ultraresearch skill`.

## Depends on / feeds

Depends on `020` (skill-attached dispatch) for the ultraresearch attachment. Enriches the shipped
`cxc-search` Tier 2/3. Independent of `030`/`040`/`050`/`060`. Replaces the old "insane-search
engine port" item in `../lazygap/009`'s L25 row (locked decision).
