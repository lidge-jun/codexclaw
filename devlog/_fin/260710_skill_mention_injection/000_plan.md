# 000 — Subagent $skill Mention Injection Fix (plan)

- Date: 2026-07-10
- Session: 019f485b-2210-79b1-97df-66c00662ca55
- Class: C2 (conventional multi-file slice inside one component family + doc text)
- Loop-spec: archetype=spec-satisfaction repair; trigger=user report (explorer dispatch
  failed to load $-mentioned skill); goal=every codexclaw-taught spawn channel injects
  the SKILL.md body; non-goals=agbrowse binary, FSM/transition logic, goal DB;
  verifier=`npm test` + live probe subagent; stop=criteria cr1-cr4 met; memory
  artifact=this devlog unit + goalplan `wp1-patch-agbrowse-helper-path-resolution-hook-t`;
  terminal outcomes=DONE|BLOCKED|NEEDS_HUMAN; escalation=hook output contract changes.

## Symptom

A gpt-5.6-sol explorer dispatched with `[$codexclaw:cxc-search](/abs/path/SKILL.md)`
(plain markdown link, not skill://) plus prose referencing `scripts/agbrowse_helper.py`
could not load the skill: "지정된 스킬 경로가 현재 작업공간에서 그대로 열리지 않아".
Initial misdiagnosis blamed the helper's relative path; the user corrected: the real
bug is $-slug skill attachment failing on subagent dispatch.

## Probe evidence (live, 260710, gpt-5.6-sol explorers)

| Probe | Mention form | Injected? |
|-------|--------------|-----------|
| A (Boyle) | `[$cxc-search](skill:///abs/.../search/SKILL.md)` | YES — `<skill>` body present |
| B (Kant) | plain `$cxc-search` | **NO** — catalog shows `codexclaw:cxc-search`, bare token stays literal |
| C (James) | v1 `items` `{type:"skill",name,path}` | YES |
| D (Plato) | plain `$codexclaw:cxc-search` | YES |
| E (Anscombe) | hook-fire canary: `[CXC-LEAF-GUARD]` marker in received message | NO marker — expected: v1 spawn path adds no leaf guard |

PROBE-E disposition (audit r1): the "matcher never fires for namespaced tool names"
hypothesis was REBUTTED — codex-rs canonicalizes v1/v2 spawn calls to hook-facing
`spawn_agent` (registry.rs:713). No matcher change needed. See 020_audit_synthesis_r1.md.

## Root cause

codex-rs registers plugin skills under the plugin-prefixed display name
(`codexclaw:cxc-<folder>`). Name-based mention matching therefore only fires for the
prefixed form; the bare `$cxc-<folder>` slug matches nothing and is silently left as
literal text (no error). Path-based matching (`skill://<abs SKILL.md>`) and v1 `items`
attachments bypass names entirely and work. codexclaw's own surfaces teach/emit the
bare form:

- `spawn-wrapper.ts skillMention()` link-unsafe fallback emits plain `$cxc-<folder>`.
- pabcd-state `hook.ts` phase directives (B: "put the surface's $cxc-dev-* mention in
  the spawn message"; C: "$cxc-dev-code-reviewer mentioned in the spawn message").
- SKILL.md doctrine (pabcd AUDIT-LOOP-01 dispatch packet, search SEARCH-ATTACH-01
  example block, dev delegation lines) — full emitter list from the read-only sweep
  in `010_sweep_findings.md`.
- The `pre-tool-use-attaching-skills` hook (spawn-attach-hook.ts) does NOT rescue
  broken mentions: v2 path = leaf guard only, v1 path = model routing only.

## Fix design (diff-level)

1. **spawn-attach-hook.ts — mention normalization (runtime rescue, v1+v2).**
   New pure `normalizeSkillMentions(message, skillsDir)` — a single-pass span-aware
   scanner (audit B1), not a blind regex replace:
   - Protected spans skipped whole: fenced code blocks, inline code spans, and
     complete markdown link spans `[label](target)` (both label and target) —
     EXCEPT link-repair (audit r2 B1, narrowed r3/r4): when the label is a known
     cxc mention (`$cxc-<f>`/`$codexclaw:cxc-<f>`, folder exists under skillsDir)
     and the target is BROKEN, the WHOLE link is atomically replaced by the
     canonical `skill://<skillsDir>/<f>/SKILL.md` link. Broken means: after
     stripping an optional `skill://` prefix, the target path does NOT end in
     `/SKILL.md`, OR that filesystem path does not exist. Any existing target
     ending in `/SKILL.md` — skill:// URI or plain path, codexclaw's or another
     root's — is preserved verbatim (codex-rs recognizes plain SKILL.md paths,
     injection.rs:250,279; duplicate-name disambiguation stays caller-owned).
     Unknown-label links stay protected unconditionally. Covers the
     originally-reported failure `[$codexclaw:cxc-loop](/nonexistent/or/non-skill
     /path)`. Regression tests: alternate-existing skill:// target untouched;
     alternate-existing plain-path /SKILL.md target untouched.
   - Token grammar: longest match first — `$codexclaw:cxc-<folder>` then
     `$cxc-<folder>`; `<folder>` charset `[a-z0-9-]`, case-sensitive lowercase; the
     char after the token must NOT be a mention char `[A-Za-z0-9_:-]` (so
     `$cxc-dev_extra` is untouched).
   - Rewrite only when `<skillsDir>/<folder>/SKILL.md` exists; unknown folders and
     non-cxc mentions untouched. Rewrite target: link form
     `[$cxc-<folder>](skill://<abs SKILL.md>)`; when skillsDir is not link-safe
     (space/paren), rewrite to `$codexclaw:cxc-<folder>` instead (PROBE-D-proven).
   - skillsDir resolution: env `CXC_SKILLS_DIR` override (tests/e2e) ->
     script-relative `<component>/dist/../../../skills` -> unresolvable = no-op.
     Total, never throws.
   - Wiring: D1 deny check stays FIRST; then normalization; v2 path emits an allow
     envelope when normalization OR leaf guard changed the message; v1 path emits
     when normalization OR model injection changed anything (updatedInput echoes
     all original keys, replaces only message/model).
2. **spawn-wrapper.ts — stop emitting the broken fallback.**
   `skillMention()` non-link-safe fallback emits `$codexclaw:cxc-<folder>` (works
   per PROBE-D). Link form stays primary. Audit B2: restore the skill channel in the
   dormant v2 builders — `resolveSpawnPayloadWithSkills` and `routeDispatch` prepend
   `buildSkillMentionBlock` (role base + surfaces + explicit/intent extras) to the
   message again; flip spawn-wrapper.test.ts:214,293 absence-assertions to
   presence-assertions and :242 fallback-form assertion to the prefixed form.
3. **pabcd-state hook.ts directive text** — A (L170), B (L181), C (L188) directives
   teach `$codexclaw:cxc-*` prefixed mentions (or skill:// link form); never the bare
   slug for spawn messages. DELETE the A-directive claim "the spawn-attach hook fills
   in missing baselines" (hook.ts:172) — the hook repairs mentions, it does not invent
   them. Add pabcd-state test asserting no spawn-bound bare form in emitted directives.
4. **Docs (audit B3 full map)** — teach only working forms and delete stale
   "hook auto-prepends skills" claims: skills/dev/SKILL.md:143-156,
   skills/pabcd/SKILL.md:133,443-447, skills/search/SKILL.md:189-217,
   skills/lunasearch/SKILL.md:47, structure/10_subagent_skill_routing.md:44,102-123,
   structure/INDEX.md:186, structure/20_pabcd_dispatch_doctrine.md:169,
   structure/40_enforcement_methods.md:51, docs-site guides/skills.md:31-41,
   guides/subagents.md:44, reference/hooks.md:55 (audit r2 B2).
   Intent extras: INTENT_EXTRA_SKILL_FOLDERS.research = ["search"] only —
   ultraresearch is a deprecated redirect (audit r2 B4).
5. **Tests (audit B1/B4)** — spawn-attach-hook.test.ts adversarial normalization
   cases (bare->link, prefixed->link, unknown folder untouched, inside link
   label/target untouched, inside code fence/inline code untouched, `$cxc-dev_extra`
   untouched, case sensitivity, normalize-only v2 envelope, v1 envelope carries
   normalized message + model, D1 deny unaffected, prefix pinned to plugin.json
   name, link-repair cases: bad-target known-label link replaced / canonical link
   untouched / unknown-label link untouched); spawn-wrapper.test.ts updates;
   plugins/codexclaw/test/hook-e2e.test.mjs (audit r2 B3): TWO resolution cases —
   (a) snapshot + CXC_SKILLS_DIR env override, (b) cache-shaped fixture
   `<tmp>/plugin/components/subagent-config/dist/` + sibling `<tmp>/plugin/skills/`
   with env unset (script-relative branch) — plus bare-mention spawn cases (v1, v2
   normalization-only, guard composition, D1 denial).

## Accept criteria

Goalplan cr1-cr4 (unit tests green via `npm test`, live probe re-verification with a
bare mention post-patch, no remaining spawn-bound bare-form emitters, docs teach
working forms). Activation scenario (C-ACTIVATION-GROUNDING-01): C-phase probe spawns
a child whose message contains ONLY the bare `$cxc-search` mention plus the explicit
instruction "quote the first heading line of any injected skill body verbatim"; PASS
iff the child quotes `# search — Unified Search Hub`.

## OUT of scope

agbrowse binary/helper behavior, FSM transitions, goal DB, subagents.json schema,
upstream codex-rs mention parser.
