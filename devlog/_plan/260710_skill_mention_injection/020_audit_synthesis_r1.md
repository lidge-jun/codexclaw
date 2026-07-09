# 020 — Audit Round 1 Synthesis (Galileo/gpt-5.6-sol, VERDICT: FAIL)

REVIEW-SYNTHESIS-01 record. Four High blockers; all ACCEPTED. One main-agent
hypothesis REBUTTED by reviewer evidence.

## B1 (High, ACCEPT) — no safe token grammar for normalization
RCA: plan hand-waved "rewrite every bare token except link targets"; context-free
regex can nest links, corrupt code fences/URLs, or rewrite the prefix of
`$cxc-dev_extra` (codex-rs mention chars include `_`/`:`, injection.rs:298).
Fold-back: single-pass span-aware scanner with protected spans (fenced code,
inline code, complete markdown link spans), longest-match `$codexclaw:cxc-<f>`
before `$cxc-<f>`, trailing-boundary = next char is not a mention char
([A-Za-z0-9_:-]), folder charset [a-z0-9-] lowercase-only, unknown folder =>
untouched. Link-unsafe skillsDir (space/paren) => rewrite to `$codexclaw:cxc-<f>`
(PROBE-D-proven) instead of the link form. Adversarial unit tests per case.

## B2 (High, ACCEPT) — wrapper skill routing is dormant
RCA: 260709 dev2 switch stripped buildSkillMentionBlock from
resolveSpawnPayloadWithSkills/routeDispatch ("hook keeps only leaf guard"),
leaving v2 builder dispatches with NO skill channel at all; tests
(spawn-wrapper.test.ts:214,293) lock the absence in.
Fold-back: restore the mention block (working forms) in BOTH builders —
role base + surfaces + intent extras — prepended to message; flip the two
absence-assertions to presence-assertions of the link form.

## B3 (High, ACCEPT) — emitter sweep incomplete
RCA: plan item 3 said "B/C directives" though A (hook.ts:170) also emits bare
mentions; stale docs also claim the spawn hook auto-prepends role baselines
(it does not, and normalization will not either).
Fold-back: fix A+B+C directive strings; doc file map now also includes
pabcd/SKILL.md:447, structure/10_subagent_skill_routing.md:44,
structure/INDEX.md:186, docs-site guides/subagents.md:44, guides/skills.md,
search/SKILL.md:215-217 (stale hook claim), sparksearch:47. Add pabcd-state
test assertions that directives contain no spawn-bound bare form.

## B4 (High, ACCEPT) — verification does not exercise manifest-path resolution
RCA: hook-e2e copies dist/ outside the plugin tree, so `dist/../../../skills`
cannot resolve there and normalization silently no-ops; current e2e spawn case
carries no mention; live-probe oracle underspecified.
Fold-back: skillsDir resolution order = env override `CXC_SKILLS_DIR` (e2e/test
hook) -> script-relative `../../../skills` -> no-op; hook-e2e adds a
cache-shaped fixture with a skills dir + bare-mention spawn cases (v1 envelope,
v2 normalization-only, guard composition, D1 denial unaffected); live probe
instructs the child to quote the injected skill heading verbatim.

## REBUTTED (main-agent hypothesis, withdrawn)
PROBE-E "matcher never fires for namespaced tool names": reviewer verified
codex-rs canonicalizes v1/v2 spawn calls to hook-facing `spawn_agent`
(registry.rs:713). PROBE-E was a v1 spawn — the v1 path adds no leaf guard, so
the missing marker is expected behavior, not a matcher failure. The
`(^|__)spawn_agent$` matcher amendment is WITHDRAWN from the plan.

## Validated premises (carried into B)
- Normalization-only allow envelope is legal (updatedInput full replacement,
  registry.rs:114); keep D1 deny before normalization.
- `dist/../../../skills` correct in dev tree AND plugin cache (PLUGIN_ROOT layout).
- Prefix derives from plugin manifest `name` (plugin_namespace.rs:27) ->
  hardcoded `codexclaw:` OK; pin with a test reading .codex-plugin/plugin.json.
- spawn-wrapper.test.ts:242 bare-fallback assertion must flip with the impl.
