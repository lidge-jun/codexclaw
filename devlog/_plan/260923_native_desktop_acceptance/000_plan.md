# Native desktop acceptance for Tauri, Swift and menu-bar work

Agents that touched OpenCodex's Tauri tray app checked source, host-only CI and screenshots of the wrong surface, and the gaps surfaced one by one at user acceptance and in release dry-runs (issue #232). This unit gives codexclaw a native-desktop acceptance owner: a matrix that separates UI, runtime, packaging and distribution verdicts, binds evidence to the final artifact, and says which macOS approval prompts only a person may answer. It also lets a goalplan criterion declare a `desktop` surface so the final gate asks for QA evidence. Nothing here builds a desktop app. Release 0.2.37 ships it, and #208 closes on evidence already observed.

Reader: a maintainer deciding whether to merge and release; familiarity with codexclaw's dev skills and goalplan is assumed.

## Loop contract

- Loop archetype: satisfy-spec HOTL, docs-first (LOOP-DOCS-FIRST-01).
- Trigger: user request on 2026-09-23 to strengthen the skills for Tauri/Swift work, add menu-bar approval handling, research with Aside, close the finished issue and publish a new GitHub release via cxc-loop.
- Goal: codexclaw 0.2.37 with the owner references, routing, `desktop` criterion surface, published release, #208 closed and #232 resolved or split honestly.
- Non-goals: building or modifying any desktop app; OpenCodex changes; SSH/local installation and hook retrust (not authorized this turn); render-observation and receipt-schema changes (D5, split to a follow-up issue); native Codex host changes.
- Verifier: `npm test` (repo root, full suite through plugins/codexclaw/scripts/test.mjs; reads every test glob listed in package.json:24 including pabcd-state and subagent-config tests), `npm run build` (regenerates committed dist; test/dist-freshness.test.mjs fails on drift), `npm run gate`, `node plugins/codexclaw/scripts/inventory.mjs --check --tests <total>` (ci.yml:62), `node plugins/codexclaw/scripts/check-versions.mjs 0.2.37` (release.yml:178), hosted CI on dev and main at exact SHAs, release.yml dry-run then publish, local SHA256SUMS verification. Skill prose has no automated reader beyond link/inventory checks; its rows are human review (PLAN-VERIFIER-REAL-01).
- Stop condition: all six goalplan criteria met with fresh evidence, or a real blocker after root-cause work.
- Memory artifact: this unit plus .codexclaw/evidence/01a0cadc-5dcb-7541-89bc-ab381777b661/.
- Expected terminal outcomes: DONE (release published, issues updated); BLOCKED (CI or release infrastructure outside scope); NEEDS_HUMAN (missing permission); UNSAFE (a step would expose signing or other secrets).
- Escalation: missing GitHub permission, protected-branch refusal, or a release gate failure whose fix leaves this scope.
- Resource bounds: tools are this checkout, gh with the user's credentials, Aside codemode for public docs. Writes limited to the IN scope below. No token or wall-clock bound was stated; native limits apply.

## Scope and file map

IN:

```
plugins/codexclaw/components/pabcd-state/{src,dist,test}   desktop surface (010)
plugins/codexclaw/components/subagent-config/{src,dist,test} final-gate guard copy (010)
plugins/codexclaw/skills/loop/references/durable-goalplan.md CLI doc line (010)
plugins/codexclaw/skills/dev-devops/references/            two new owner references (020)
plugins/codexclaw/skills/{dev,dev-devops,dev-testing,qa,dev-frontend,dev-debugging}  routing rows and stubs (020)
version metadata, READMEs, CHANGELOG, inventory, structure/INDEX.md (030)
```

OUT: see non-goals.

## Ordered work phases

- wp1 (this cycle): docs-only roadmap. 001 research, 010/020/030 diff-level docs. No production edits.
- wp2: `desktop` criterion surface across the whole field chain (010). Foundation, because 020's skill text names the value.
- wp3: native-desktop acceptance owner and macOS approval reference, routing and stubs (020).
- wp4: version 0.2.37, measured test badge, CHANGELOG, PR to dev, promotion to main, release, issue updates (030).

One branch (codex/native-desktop-acceptance), ordered commits, one ordinary PR to dev, then the usual dev to main promotion PR. No native stacks. Main owns Git, FSM and delivery.

## Architect consultation

- Handle: agent 01a0cc8c-a9d6-78a1-b0b9-3af8e550196a (V1 transport, CXC-ROLE: architect, dev + dev-architecture attached). Proposal decisions D1-D7, recorded in 002_architect_consultation.md.
- Dispositions: D1 accepted (two references under dev-devops, no new skill). D2 accepted. D3 accepted (`desktop`). D4 accepted, no schema bump, CHANGELOG states the reader requirement. D5 accepted as residual, split into a follow-up issue in wp4. D6 accepted; the `+codex.<stamp>` is hand-set in the release commit, as 7ad32cf5 did. D7 accepted. Amendments: no macOS 26 menu-bar behavior is stated unless a primary source was read; `sfltool dumpbtm` moves to the authorization-required list because it can need administrator rights.
- Reflection: recorded in 002 after this plan revision is sent back.

## Issue #232 acceptance mapping

| Issue acceptance test | Where it lands |
|---|---|
| Swift native-panel change needs native evidence; non-UI Swift model change does not demand screenshots | 020 trigger rules (skill guidance) |
| React dashboard screenshot cannot satisfy the native-panel composition row | 020 matrix rule |
| Ad-hoc arm64 .app receipt cannot satisfy a universal Developer ID/DMG/updater row | 020 artifact identity rule |
| CLI digest/source or signing change invalidates only affected rows | 020 invalidation rule |
| Failure before launch leaves downstream rows unverified | 020 downstream rule |
| Wrong `lipo` argument order rejected by an independent behavioral oracle | 020 states the rule with the man-page grammar; an automated oracle is residual (follow-up issue) |
| No-local-tests yields hosted-only or not-verified | 020 no-local-execution path |
| Baseline with no desktop surface yields new-feature obligations | 020 baseline rule |
| Native desktop can be expressed as its own criterion surface | 010 |
| Render observation for native changes; artifact identity inside receipts | Residual, follow-up issue (D5) |

## Source of truth sync

C of wp3 patches the cxc-dev-devops skill inventory row in structure/INDEX.md:166 (one-cell description change) and skill-ownership.md; C of wp4 patches CHANGELOG, README badges and the docs-site skills guide line.
