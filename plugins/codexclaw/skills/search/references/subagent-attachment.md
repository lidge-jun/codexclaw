### Subagent Skill Attachment (SEARCH-ATTACH-01)
Any search subagent — Tier 3 deep-research explorers, `$cxc-lunasearch` lanes,
or ad-hoc research spawns — should receive THIS skill as a real skill
attachment, not a hand-written tool directive in the message. The subagent
auto-loads the skill at launch and follows its Tier 1/2 tool guidance
(`web_search` for discovery, then open the source for proof). The skill body is
the single source of truth for the tool list; do not duplicate it as prose in
the spawn message.

PABCD A-gate audit/reviewer dispatches are in scope too: a plan auditor must
verify references and external/current claims, so the audit dispatch packet
explicitly names `$codexclaw:cxc-search` alongside
`$codexclaw:cxc-dev-code-reviewer` (AUDIT-LOOP-01). The spawn wrapper's
`ROLE_BASE_SKILLS.reviewer` resolves the same pair when that builder is used.

The shared payload form is a **link-form mention in the spawn message**. On V1 the
child's first turn parses the mention and injects the full SKILL.md body. When a
V2-shaped spawn message reaches the codexclaw hook as plaintext (non-encrypted
provider/proxy paths), the hook recognizes the same mention and inlines the full body.
Plaintext V2 without an inlined body receives a `[CXC-SKILL-AFFORDANCE]` block
asking the child to self-load mentions from `<skillsDir>/<folder>/SKILL.md`.
Native ChatGPT-backend V2 sends ciphertext with a Fernet envelope. The hook
preserves structurally recognized ciphertext byte-for-byte and tells the caller
that hook-added skill text, scope instructions and prompt overrides were omitted;
it cannot attach the plaintext affordance to encrypted task bytes. Native recursion
checks and separate model/effort routing still apply. If the path is not link-safe, use the plugin-native
`$codexclaw:cxc-search` fallback instead:

```text
message: "[$cxc-search](skill://<this skill's SKILL.md absolute path>)
TASK: <lane / query family>"
```

On the v1 surface the structured `items` channel is equivalent and slightly
stronger (exact selection, no parse step) — use it when routing through the
spawn-wrapper builder:

```text
items: [
  { type: "skill", name: "cxc-search", path: "<this skill's SKILL.md absolute path>" },
  { type: "text",  text: "TASK: <lane / query family>" }
]
```

(v2 `deny_unknown_fields` rejects `items`; plaintext V2 paths use the recognized
mention plus the hook-inlined body. The always-on spawn-attach hook never adds
`cxc-search` when the dispatcher omits it.)

Do not write a long inline TOOLS block in either path — the skill already says
"web_search for discovery, then open the source; snippets lie; the page is the
evidence." A subagent that cannot open pages must flag every finding as
`candidate — unverified snippet` in its return.
