## Subagent Skill Attachment (attach cxc-search, not prose)

Do not hand-write a tool directive in the spawn message. Attach `cxc-search`
through the preferred `[$cxc-search](skill://<abs SKILL.md path>)` form, or the
plugin-native `$codexclaw:cxc-search` fallback when the path is not link-safe,
so each Luna subagent can load the proof ladder where the surface delivers the skill (Tier 1
`web_search` + Tier 2 open-the-source) at launch. The skill body is the single
source of truth for the tool list; this skill only adds the lane assignment and
the Luna model.

The shared payload form is a **link-form mention in the spawn message**. V1 parses it on
the child's first turn. On plaintext V2 provider/proxy paths, the codexclaw spawn hook
inlines the recognized skill's full SKILL.md body; native ChatGPT-backend V2 gives the
hook ciphertext, so normalization and inlining are no-ops there. When no body can be
inlined, the hook instead appends a plaintext `[CXC-SKILL-AFFORDANCE]` block telling the
child to self-load any `$cxc-<folder>` / `$codexclaw:cxc-<folder>` mention from
`<skillsDir>/<folder>/SKILL.md`; fork inheritance remains a secondary channel:

```text
message: "[$cxc-search](skill://<cxc-search SKILL.md absolute path>)
TASK: one lane in a Luna search swarm. LANE: <source class / query family>. Run 5-10 distinct queries; open the source for every result that matters. Return 3-5 findings with URLs, dates, source type, primary-or-lead flag. No edits, no questions."
```

On the v1 surface the structured `items` channel is equivalent (exact selection)
when routing through the spawn-wrapper builder:

```text
items: [
  { type: "skill", name: "cxc-search", path: "<cxc-search SKILL.md absolute path>" },
  { type: "text",  text: "TASK: one lane in a Luna search swarm. LANE: <source class / query family>. Run 5-10 distinct queries; open the source for every result that matters. Return 3-5 findings with URLs, dates, source type, primary-or-lead flag. No edits, no questions." }
]
```

(v2 `deny_unknown_fields` rejects `items`; the hook-inlined attachment applies only
on plaintext V2 paths.)

Do not duplicate the Tier 1/2 tool list as inline prose — the attached skill
already carries it. A subagent that cannot open pages must flag every finding as
`candidate — unverified snippet` in its return.
