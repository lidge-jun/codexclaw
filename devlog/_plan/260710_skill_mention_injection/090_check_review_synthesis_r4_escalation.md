# 090 — C-Gate r4 Synthesis + Escalation to Conservative Scanner

Kierkegaard r4: FAIL (3 High — over-cap fallback ends inside quoted title;
nested container fences bypass; escaped destinations checked without
unescaping). All prior rounds' blockers verified closed, but this is the 3rd
consecutive round producing NEW High blockers in the same markdown-fidelity
family. The 080 escalation clause fires: abandon incremental CommonMark
hardening; rebuild as the conservative line-based scanner.

## Conservative design (FAILSAFE-SPAN-01 maximal)

Per-line processing; protection is the default, rewriting the exception:

1. Size guard: >256KiB => identity (kept).
2. Fence state (line-based): strip up to 8 leading container tokens
   (`>`, `-`, `*`, `+`, `N.`, `N)`, spaces) then a run of 3+ backticks/tildes
   toggles OPEN (record char + run len). CLOSE only on marker char match, run
   >= open len, and only spaces (+ optional `\r`) after. In-fence lines are
   protected; unclosed fence protects to EOM.
3. Any line containing a backtick outside fences => whole line protected
   (inline-code ambiguity is not worth parsing).
4. Link repair only in the unambiguous shape: a line that (after optional
   container prefix) consists ENTIRELY of one
   `[$(codexclaw:)?cxc-<f>](<target-with-no-space/paren/quote/backslash/angle>)`
   link. Existing /SKILL.md target (after optional skill:// strip) => byte
   identical; else known folder => whole-link canonical replacement. Any other
   link/bracket construct is left untouched.
5. Bare-token normalization only on lines with NO backtick and NO `[`/`]`.
   Token rules unchanged (longest-match prefixed-first, [a-z0-9-], trailing
   boundary not in [A-Za-z0-9_:-], folder must exist; link-unsafe skillsDir =>
   prefixed form).

Rationale: eliminates the parser-fidelity bug class structurally — no tail
parsing, no title grammar, no escape semantics, no cross-line inline-code
state. False negatives (mention left bare on a mixed line) are acceptable per
FAILSAFE-SPAN-01; the fixed emitters (directives/wrapper/docs) are the primary
channel and normalization is the safety net. All r4 blockers die by
construction: quoted-title/over-cap/escaped links are simply "not the
unambiguous shape" => untouched; nested container fences => prefix-stripped
toggle or, at worst, backtick-line protection.
