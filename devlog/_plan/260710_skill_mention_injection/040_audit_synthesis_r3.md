# 040 — Audit Round 3 Synthesis (Galileo, VERDICT: FAIL, blockers 1)

## B1 (High, ACCEPT) — link repair must not override valid foreign targets
RCA: r3 defined "noncanonical" as "not codexclaw's own canonical path", which
would silently rewrite a caller's explicit selection of a same-named skill from
another plugin/personal root (codex-rs uses linked paths for duplicate-name
disambiguation, injection.rs:368,388).
Fold-back: repair fires ONLY when the link target is broken — target is not a
`skill://` URI ending in `/SKILL.md`, or its filesystem path does not exist.
Any EXISTING `skill://.../SKILL.md` target is preserved verbatim even when it
differs from skillsDir. Regression test: alternate-existing-target link stays
untouched.

r3 confirmations: B2 doc map, B3 dual resolution branches, A-directive deletion,
B4 research extras all verified correct.
