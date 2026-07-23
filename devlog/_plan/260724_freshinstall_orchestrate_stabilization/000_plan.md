# 000 — Fresh-install orchestrate stabilization: objective + roadmap

Session: `019f8fd8-d4c3-7633-9e5e-7577937031d9` · Goalplan:
`stabilize-codexclaw-orchestrate-pabcd-for-fresh` · Date: 2026-07-24

## Objective

On a fresh marketplace install (`codex plugin marketplace add` + `codex plugin
add codexclaw@codexclaw`), the orchestrate/PABCD surface must work
out-of-the-box: every command the plugin's own injections and skills tell the
model to run must actually resolve. Then finish production deployment prep:
push main, create a `dev` integration branch (opencodex convention), and
polish the README to release quality.

## Root cause (evidence: 001_rca.md)

**Install/payload gap, NOT a prompting gap.** The marketplace payload is only
`plugins/codexclaw/` (`.agents/plugins/marketplace.json`), but the `cxc` bin
maps from repo-root `package.json` → `bin/codexclaw.mjs`, outside the payload.
Local dev works because npm bin-linking puts `cxc` on PATH; a marketplace user
has no `cxc`, so every injected directive (`LOOP_ARM_DIRECTIVE`,
`STOP_NEXT_COMMAND`, goal-gate deny remedies, map/skill/recall banners) and
every SKILL.md command line dies with `command not found`. The dist CLIs fully
support direct `node .../dist/cli.js <verb>` invocation — but no payload text
ever says so. Bonus defect: `cxc scan evidence` (hook.ts:968) has no backing
subcommand anywhere.

## Constraints

- Payload-only fix: a marketplace install gets exactly `plugins/codexclaw/`;
  no postinstall scripts, no PATH mutation, no global config writes.
- Local dev UX (`cxc` on PATH) must keep working unchanged.
- Do not touch `devlog/_plan/260722_260722-repo-governance-config/` (user's
  untracked work) or `~/.codex` global config.
- Push to origin main is pre-approved; `dev` branch creation is requested.

## Dependency-ordered work-phase map (PHASE-SPLIT-01)

| WP | Decade doc | Delivers | Depends on |
|----|-----------|----------|------------|
| WP0 | this cycle | RCA + all decade docs to diff level; D locks goalplan | — |
| WP1 | `010_payload_cxc_dispatcher.md` | payload-resident `bin/cxc.mjs` dispatcher + runtime cxc-resolution in injected directives + `cxc scan evidence` fix + tests | WP0 |
| WP2 | `020_readme_release_polish.md` | README(.ko/.zh) + docs claims aligned with the now-true fresh-install story | WP1 (docs must describe the shipped fix) |
| WP3 | `030_push_dev_branch.md` | push main, create+push `dev` branch, final release-readiness verification | WP1+WP2 landed |

## Acceptance criteria (goalplan CR-A..CR-F)

- CR-A: RCA doc names the exact first-run failure mechanism with payload-only
  sandbox evidence.
- CR-B: payload-only sandbox shows orchestrate end-to-end (status, P entry,
  attested edge) with the shipped fix and no repo-root files.
- CR-C: touched component suites + `plugins/codexclaw/scripts/gate.mjs` green.
- CR-D: per-work-phase commits pushed to origin/main.
- CR-E: `dev` branch created per opencodex convention and pushed.
- CR-F: README consistent with shipped reality.

## Loop-spec header (C2+)

- Archetype: spec-satisfaction repair (verifier = sandbox sim + tests + gate).
- Trigger: user report "다운받았을때 orchestrate 잘 쓰지 않는 문제".
- Goal: fresh installs use orchestrate as reliably as local dev.
- Non-goals: npm publish, GUI feature work, opencodex changes.
- Verifier: payload-only sandbox transcript; `node --test` suites; gate.mjs.
- Stop: all CR met, or Terminal outcome with evidence.
- Memory artifact: this unit + goalplan ledger.
- Escalation: release-gating user decisions (e.g. gui/dist D1) → honest
  labeling instead of blocking; anything else NEEDS_HUMAN.
- HOTL bounds: repo-scope writes only; no external sends beyond approved git
  push; wall-clock this session; subagents = Sol explorer/reviewer/executor.
