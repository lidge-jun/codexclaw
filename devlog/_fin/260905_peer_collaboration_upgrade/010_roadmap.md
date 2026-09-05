# 010 — Docs-only roadmap (wp0)

Goal: lock the exact [020 patch](020_peer_guidance.md) and its checks.
P writes 000/010/020 and evidence/check-docs.mjs. A audits scope and source anchors.
B creates 011_roadmap_review.md with actual findings, dispositions and roadmap lock;
no product edits. C checks documents and captures a source-bound receipt. D closes
wp0 after its task/criterion have real evidence, then re-enters P for wp1.

## Exact file delivery

- NEW 000_plan.md: outcome, constraints, dependency map, accepted boundaries.
- NEW 010_roadmap.md: this cycle's file map and executable verification.
- NEW 020_peer_guidance.md: full apply_patch payload for the next cycle.
- NEW evidence/check-docs.mjs: read-only document/patch/link/frontmatter checks.
  This is a devlog verifier, not shipped production tooling.
- B NEW 011_roadmap_review.md: actual reviewer verdict, dispositions, lock and checks.

## Commands

From the bound repository root, wp0:

    node devlog/_plan/260905_peer_collaboration_upgrade/evidence/check-docs.mjs --roadmap

During C:

    cxc receipt test --session 01a07026-2e97-7b53-9234-9e8aae6b15c2 -- node devlog/_plan/260905_peer_collaboration_upgrade/evidence/check-docs.mjs --roadmap

wp1 C:

    node devlog/_plan/260905_peer_collaboration_upgrade/evidence/check-docs.mjs --payload
    node plugins/codexclaw/scripts/inventory.mjs --check
    node --test --test-concurrency=1 plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/inventory.test.mjs plugins/codexclaw/test/manifest-policy.test.mjs

Wrap the wp1 commands in one receipt via sh -ec. Do not declare generated paths to
hide source changes. Finish edits/staging/commits before final receipt. It binds the
whole nonignored tree, not merely tested files. D uses the actual generated path.
Record outputs before the final receipt and rerun if source changes.

Run preflight before A. An absent target cannot pass silently. Check the verifier
with missing-file and broken-link negative fixtures. Semantic behavior is independent
scenario work, never a phrase-presence assertion in Markdown.

## wp1 behavior checks

Isolated subagents only; no live user task sends or other-worktree writes.
Raw cases: relevant idle peer, explicit user stop, unknown stop intent, absent tools,
unrelated trivial work, material outbound impact, incoming question on an old stopped
goal, active authorized HOTL continuation, advisory-only idle notification, ACK without
acceptance, and missing material exception. Ask for concrete next
actions and facts, not whether the agent likes the skill. Do not supply answer keys.

Run a same-fixture baseline without the new reference to find actual decision deltas.
Retain no-delta results honestly. Fresh final review grades outputs against accepted
boundaries. Simulations do not establish real transport or a production quality lift.
Relevant activation evidence must exist before any instruction-effect claim.

## P preflight results

check-docs --self-test: missing-file and broken-link probes failed as expected,
valid-file probe passed. --roadmap then passed all numbered docs and 8 patch targets.
An initial trailing-whitespace error in fenced patch blank context was corrected
without changing product source. inventory --check passed. The three targeted
Node suites passed 20/20, exit 0 (about 1.4 seconds); no full suite ran.
