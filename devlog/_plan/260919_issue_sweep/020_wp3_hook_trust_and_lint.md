# 020 — wp3: hook trust and comment-lint gates (#196, #186)

This phase executes first. #196 denies ordinary Markdown `apply_patch` calls, and it
denied one of this unit's own documents, so every later documentation phase is blocked
until it is fixed. Evidence: `001_advisor_findings.md`, section "#196 reproduced against
this unit".

## #196 — the linter scans prose as if it were code

`comment-lint.ts:53-61` (`addedLines()`) discards the patch's file headers, so
`lintApplyPatch()` at `:67-73` sees a flat list of added lines with no idea which file
each belongs to. It then applies three code patterns to all of them. The cast pattern at
`:30` is the one the issue reports, but all three share the same scope error, so fixing
one leaves prose false positives behind.

Host serialization is correct and is not the cause:
`codex-rs/core/src/tools/handlers/apply_patch.rs:459-463` supplies the patch as
`tool_input.command`, which is exactly what this handler consumes. Stale packaging is
also ruled out: the installed payload is identical to the checkout.

**MODIFY** `plugins/codexclaw/components/pabcd-state/src/comment-lint.ts`

- Before: `for (const line of addedLines(toolInputCommand))`
- After: iterate added records that retain the current target path, and skip all three
  code-pattern checks when the target is an explicit prose or document file —
  `.md`, `.markdown`, `.mdx`, `.txt`, `.rst`, `.adoc`.
- Recognize the native `*** Add File:`, `*** Update File:` and `*** Move to:`
  boundaries as well as the existing `+++ b/...` fixtures, and reset the target between
  files so a later code hunk in a mixed patch is still scanned.
- Keep the exported `addedLines()` behaviour unchanged for its existing consumers.
- Keep code files linted even under `/tmp`: do not exempt a path merely because it sits
  outside a repository. Preserve the fail-open error handling and the justification escape.
- No hook JSON change, so no new trust churn.

**MODIFY** `plugins/codexclaw/components/pabcd-state/test/comment-lint.test.ts`

New cases: the exact sentence from the issue body allowed in Markdown; a quoted or fenced
bug report allowed; `.txt` allowed; a real cast in a `.ts` file still denied; a mixed
Markdown-plus-TypeScript patch still denied for its code hunk; Add, Update and Move
boundaries; CRLF; and `/tmp/example.ts` still scanned.

**Verification.**
`node --test plugins/codexclaw/components/pabcd-state/test/comment-lint.test.ts plugins/codexclaw/components/pabcd-state/test/crlf-inputs.test.ts`.
Baseline is 9 passed with no prose case, which is why the defect shipped; the new cases
fail before the change and pass after. The component ships compiled output, so
`npm run build` must regenerate `dist/comment-lint.js`.

**Risk.** Code examples inside document files intentionally stop being blocked. Incorrect
file-boundary tracking could exempt a later code hunk, so the mixed-file and rename cases
are the essential regressions. English comments inside source files remain a separate
lexical limitation and are not addressed here.

## #186 — the diagnostic contradicts the host's trust model

All five hooks are declared in `plugins/codexclaw/.codex-plugin/plugin.json:36`,
including the memory protection hook at `:47`; 29 synchronous handlers were enumerated,
so missing packaging is ruled out. Trust is per hook identity, not an inherited plugin
signature: `codex-rs/hooks/src/engine/discovery.rs:775-808` hashes normalized
event/matcher/handler configuration, classifies absent hashes Untrusted and mismatches
Modified, and `:713-718` excludes both from execution unless `bypass_hook_trust` is on.
Approval writes `current_hash` at `codex-rs/tui/src/hooks_rpc.rs:58-87`, and startup
review already exists at `codex-rs/tui/src/startup_hooks_review.rs:69-80,142-165`.

So the issue's "silently inactive" is justified as far as trust records go, but the
universal "silent host failure" is unproven. The defect codexclaw actually owns is its
own diagnostic telling the user the opposite.

**MODIFY** `plugins/codexclaw/components/cxc-ops/src/doctor.ts`

- Before (`:464`): `"trusted_hash drift (reinstall updates it; hooks still run)"`
- After: separate counts and identities for missing versus modified records, stating that
  approval is required under host trust enforcement and that execution was not verified.
- Remove the unconditional drift-only downgrade justified by "hooks still run" at `:497`,
  while keeping the two categories distinct.
- Before (`:618`): `line += \` (repair: \${c.repair})\``
- After: emit the repair as its own indented line.

**MODIFY** `plugins/codexclaw/components/cxc-ops/src/cli.ts:118`

- Before: `runMapAffordanceSessionStart(readStdinSync(), process.cwd())`
- After: read the payload once, run the existing read-only trust check for the resolved
  installed plugin, and pass a compact warning into the existing SessionStart envelope.

**MODIFY** `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:296` — add an
optional trust-warning argument appended once to the existing `lines` array. Handle
malformed or ambiguous configuration without claiming successful verification.

Reuse the already-established SessionStart hook deliberately: a newly added warning hook
could itself be untrusted. The warning cannot fire when that existing hook is also
untrusted, and the document says so rather than overselling it.

**Retrust stays explicit.** `hook-trust.ts:429-461` already appends missing entries.
Automatic approval keyed on a familiar plugin name would move the host's permission
boundary, so it is not done.

**Verification.**
`node --test plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts plugins/codexclaw/components/cxc-ops/test/cxc-ops.test.ts`.
`hook-trust.test.ts:256-259` currently asserts the incorrect drift-keeps-running
behaviour and must be corrected as part of the change, not worked around.

**Risk.** Diagnostic wording must keep stored trust distinct from effective execution,
including bypass, disabled hooks and layered configuration. Changed doctor severity
affects existing assertions and consumers.
