# Reader-first documents and deep research — roadmap

Loop-spec: satisfy-spec; trigger: user's 2026-09-08 request to stop agents from writing
probe/evidence dumps where a reader needs a narrative, add a deep-research mode with Aside
to cxc-search, integrate open PR #84, then release 0.2.24 and deploy to the established SSH
hosts. Goal: an agent asked for a document, report or visualization produces something a
newcomer can follow (answer first, then why, then evidence), and asked for deep research
produces a cited report through a defined loop. Non-goals: runtime rewrites, new dependencies,
account changes, third-party messages, unrelated PR cleanup. Verifier: per work-phase
(skill-catalog test, link/frontmatter check, independent forward-use trials, component tests,
CI/release/deploy receipts). Stop: all five goalplan criteria met and D closes. Memory
artifact: this unit plus .codexclaw/evidence/<session>/. Outcomes: DONE with observed proof;
capability or host gaps reported as limitations; external authority gaps NEEDS_HUMAN.
Escalation: main reclaims a slice after two distinct leaf failures; new worker scope is
amended here before dispatch. Resource bounds: no user cap; bounded processes; Opus-5 and
Astra leaves and Aside browsing are authorized without limit; push/PR/merge/release/SSH
deployment are user-authorized in this session.

Class C3 (cross-skill guidance contract plus a release surface, which promotes wp5 to C4
care). Five work-phases, one PABCD cycle each. This first cycle is docs-only
(LOOP-DOCS-FIRST-01): research ledger and diff-level decade docs; no skill edits.

## Problem statement

Current skills tell agents to keep evidence (probes, receipts, ledgers), which is right for
the audit trail. They never say how a *reader deliverable* differs from that trail, so a
report or visualization becomes a list of what was checked. `dev-diagram-viewer` has one
sentence ("Introduce the decision in a report, show its evidence, then expose detail"),
`plan-output.md` defines the loop-spec header but not a reader summary, `phase-check.md`
asks for evidence only, and `kwrite` polishes sentences without a structure pass. The
`cxc-search` Tier 3 section names waves and a claim ledger but has no scope/plan step,
gap matrix, source hierarchy, report template, artifact delivery or Aside lane, and its
trigger list lacks 딥리서치/심층 조사.

## Baseline (observed 2026-09-08)

- Worktree: /Users/jun/Developer/new/700_projects/codexclaw-narrative at origin/dev
  50b7309c (v0.2.23 released, main d249c4af). FSM bound with --cwd.
- Skills touched and their sizes: dev/SKILL.md (router), dev/references/skill-ownership.md,
  dev-diagram-viewer/SKILL.md (134 lines), dev-diagram-viewer/reference/document-pdf.md
  (169), pabcd/references/plan-output.md (31), phase-check.md, dev-scaffolding/references/
  implementation-log.md (77), kwrite/SKILL.md (74), search/SKILL.md (268).
- Tests observing skills: plugins/codexclaw/test/skill-catalog.test.mjs (catalog/badges);
  quick_validate.py via /usr/local/bin/python3 (frontmatter). Neither reads prose.
- PR #84 (thisisjun786, fix/worktree-source-binding) is CONFLICTING against dev; it adds
  `cxc session source <worktree>` and touches pabcd-state src/dist, hooks, qa, docs.
- Installed hosts: local 0.2.23; macmini-cf and suji 0.2.22; desktop-c795oh4 0.2.21+0.2.22
  caches. lidge/intmb/cursor have Codex but no codexclaw manifests; oracle/ocx-ci/win
  unreachable in the last probe. Established deployment set = macmini-cf, suji,
  desktop-c795oh4 (+ local).

## Work-phase map (dependency order)

| wp | Doc | Delivers | Verifiable close |
|---|---|---|---|
| wp1 | 000/001 | this roadmap, source ledger, diff-level 010-050 | independent audit PASS |
| wp2 | 010 | dev/references/reader-documents.md + routing edits in diagram-viewer, pabcd, scaffolding, kwrite | catalog test, links, forward-use trial |
| wp3 | 020 | search/references/deep-research.md, SKILL.md Tier 3 rewrite, Aside lane, triggers | catalog test, links, forward-use trial |
| wp4 | 030 | PR #84 resolved onto dev, tests green | pabcd-state + qa tests on merged head |
| wp5 | 040/050 | 0.2.24 version surfaces, PRs, merge, promote, release, deploy | CI/release/deploy receipts |

wp2, wp3, wp4 depend only on wp1 and can land as separate PRs; wp5 depends on all three.

## Ownership

- New canonical owner "Reader-facing document structure" = dev/references/reader-documents.md;
  stubs in dev-diagram-viewer, pabcd plan-output/phase-check, dev-scaffolding
  implementation-log, kwrite. Recorded in skill-ownership.md.
- New canonical owner "Deep research protocol" = search/references/deep-research.md; stub in
  search SKILL.md Tier 3 and dev browser-routing (Aside lane pointer).
- Agents: Opus-5 research/audit/trial leaves with cxc-search attached; Astra high for
  code-conflict review in wp4. Leaves write only under the unit's evidence/ directory.

## Verification preflight (run in wp1)

See 001_sources.md for research and 002_verifiers.md for commands with observed exit codes.


## Attestation log

- wp1 P→A (2026-09-08): roadmap + ledger written; verifiers observed (002).
- wp1 A→B: independent Opus-5 audit NEAR-PASS; five blockers folded (tag-path release,
  CHANGELOG heading rule, refusal acceptance, Aside guard-default permission, stub of
  diagram-viewer line 71), rollback trigger added to 050, link checker written.

- wp2 P (re-entry): previous D closed wp1 DONE with the roadmap locked. Direction unchanged:
  implement 010 as written (anchors re-verified at this P: dev/SKILL.md:197,
  diagram-viewer:55/67/71, document-pdf:39, plan-output end, phase-check SoT paragraph,
  pabcd/SKILL.md:84, implementation-log:70, kwrite:67, skill-ownership:30).
- wp2 D: DONE at 8095ecfe; fresh reader found one gap in the trial report (PR #84 payload
  not described) which is a property of the input dump, not of the reference; direction kept.
- wp3 P (re-entry): implement 020 as written; SKILL.md Tier 3 replacement is net-negative
  (268 -> 240 lines); Aside permission text uses guard default per audit fold.
