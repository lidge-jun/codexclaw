# Issue train 2026-09-27: hook runtime fixes, agent-thread permissions, goalplan decisions

Codexclaw has four confirmed defects in its hook runtime, one host workaround worth shipping, and three small opt-in improvements among the 22 open issues. The defects are: ordinary prompt words inject PABCD directives (#250), the SubagentStop evidence gate blocks Codex's built-in `worker` in sessions that never used PABCD (#251), the Stop hook blocks every session with an active native goal even when no goalplan is bound (#253), and SessionStart creates unignored `.codexclaw` state in fresh working directories (#255, partial fix). The host workaround covers threads that Codex Desktop creates through `create_thread` with reduced permission even when the user runs full access. This unit fixes #250/#251/#253, partially fixes #255 by adding a `.gitignore` at first directory creation, adds the opt-in permission hook and advisory, adds a PABCD off switch (#252), a per-turn Stop budget (#254) and plan-local pending decisions (#262), and records a triage decision for every open issue (001).

Reader: a maintainer deciding whether to merge these changes into dev; familiarity with the pabcd-state hook component and the goalplan CLI is assumed.

## Loop contract

- Loop archetype: satisfy-spec HOTL, docs-first (LOOP-DOCS-FIRST-01).
- Trigger: user request on 2026-09-27 to fix the real issues and worthwhile improvements among the open issues, plus the agent-thread permission problem found in the same chat, and put them into dev, through cxc-loop with unlimited gpt-6-sol dispatch.
- Goal: wp2-wp4 merged into `dev` through ordinary PRs after hosted CI; every open issue has a recorded decision; fully fixed issues are closed with PR links; #255 stays open with the partial-fix PR linked and lazy creation deferred.
- Non-goals: dev to main promotion, release, version bump, tags, npm publish; Codex core or Desktop changes; other repositories; the deferred and declined proposals in 001.
- Verifier: per-phase focused `node --test` files named in each decade doc; at every C, `npm run build`, the focused tests through `cxc receipt test`, then full `npm test`, `node plugins/codexclaw/scripts/gate.mjs`, `node plugins/codexclaw/scripts/inventory.mjs --check --tests <measured total>` and `node plugins/codexclaw/scripts/platform-smoke.mjs`; hosted CI on each PR head (jobs actually ran, head SHA, event, run id). Skill prose changes are read by no test; their review is human (PLAN-VERIFIER-REAL-01).
- Stop condition: all seven goalplan criteria met with fresh evidence, or a real blocker after root-cause work.
- Memory artifact: this unit and `.codexclaw/evidence/01a0e313-aa5c-72a0-aecc-59a966bfca9c/`.
- Expected terminal outcomes: DONE (PRs merged, issues dispositioned); BLOCKED (CI infrastructure or branch protection outside scope); NEEDS_HUMAN (a default-on behavior change the user must choose); UNSAFE (a change would weaken a safety gate).
- Resource bounds: this checkout (`/Users/jun/.codex/worktrees/902d/codexclaw`), task-owned worktrees created with `create_worktree` for parallel builders, `gh` with the user's credentials. Writes limited to the IN scope below. No token or wall-clock bound was stated; host limits apply.

## Scope and file map

IN (details in each decade doc):

```
plugins/codexclaw/components/pabcd-state/{src,dist,test}        wp2 (010 overview, 011_issue255_codexclaw_gitignore.md, 012-016), wp3 (020), wp4 (030)
plugins/codexclaw/components/cxc-ops/{src,dist,test}            wp2 (011 first-directory writers), wp3 (hook-trust)
plugins/codexclaw/components/bg-wake, subagent-config, messenger-bridge/{src,dist,test} wp2 (011 cwd first-directory writers)
plugins/codexclaw/hooks/*.json, .codex-plugin/plugin.json        wp3 (two new hooks)
plugins/codexclaw/skills/{pabcd,loop,dev}/references/*.md        wp2 (015, 012), wp3 (021), wp4 (030)
plugins/codexclaw/inventory.json, README family counts           every phase that changes tests or hooks
```

OUT: Codex core/Desktop, host automation mutation handler (#213), SessionStart family detection from the host (#247), anything listed as defer or decline in 001.

## Ordered work phases

- wp1 (this cycle): docs-only roadmap: 001 triage, 002 architect consultation, 010-016, 020-021, 030, 040. No production edits.
- wp2: hook runtime fixes (010 overview; 011_issue255_codexclaw_gitignore.md, #255 partial fix; 012 #252 PABCD switch, 013 #253 IDLE goal release, 014 #254 per-turn Stop budget, 015 #251 worker gate, 016 #250 trigger narrowing). Foundation first: 011 adds the shared first-directory helper without changing SessionStart state creation; 012 adds the switch every later PABCD handler consults; 013 and 014 then change Stop continuation; 015 and 016 are leaf policy changes. Built in parallel by gpt-6-sol builders on separate branches in task-owned worktrees, merged in that order.
- wp3: agent-created thread permissions (020 hook and advisory, 021 dispatch guidance plus #265 checkpoint guidance). After wp2 so the read-only advisory can follow 011's directory contract and 012's switch semantics.
- wp4: goalplan pending decisions (030, #262). Independent of wp3; after wp2 so Stop/IDLE logic changes are settled before readiness semantics change.
- wp5: delivery and issue disposition (040).

Delivery: one ordinary PR per implementation work phase from a `codex/issue-train-wpN` branch into `dev`, each merged after its hosted CI passes and the next phase rebased onto the new `dev`. No native stacks. Main owns git, the FSM, integration and delivery; gpt-6-sol subagents draft docs, build within disjoint scopes or task-owned worktrees, and review.

## Issue acceptance mapping

| Issue | Decision | Where it lands |
|---|---|---|
| #250 | fix | 016 |
| #251 | fix | 015 |
| #252 | implement (narrowed) | 012 |
| #253 | fix | 013 |
| #254 | implement | 014 |
| #255 | partial fix (gitignore); lazy creation deferred because stateless sessions affect evidence/goal gates and atomic publication | 011_issue255_codexclaw_gitignore.md |
| #262 | implement | 030 |
| #265 | guidance only | 021 |
| agent-thread permissions (no issue) | implement | 020, 021 |
| #209 #213 #247 #256 #257 #258 #259 #260 #263 #264 #266 #267 #268 | defer | 001 |
| #261 | decline | 001 |
