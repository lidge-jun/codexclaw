# 050 — Hook Consolidation: merge edit-path PreToolUse hooks (follow-up, C2)

User feedback: 15 registered hooks is too many. This cycle merges the TWO
PreToolUse hooks sharing matcher `^(apply_patch|Write|Edit)$` (comment lint +
IDLE-edit advisory) into ONE registration — count 15 → 14 and one fewer node
spawn per edit call. Near-equivalent behavior (audit Low #2): a lint DENY now
skips the advisory leg for that call, so `idleEditNudges` no longer increments
on denied edits — cosmetic cadence shift, arguably better.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

New combined FAIL-OPEN event `pre-tool-use-edit`, dispatched before the legacy
branches (which stay for back-compat / direct invocation):

```ts
} else if (event === "pre-tool-use-edit") {
  // 260714 050: combined edit-path event — lint (deny-capable) first; a lint
  // deny wins; otherwise the IDLE-edit advisory may inject context. Both legs
  // FAIL-OPEN individually; a crash in either must never deny the edit.
  output = handleApplyPatchLint(raw);
  if (output === "") output = handleIdleEditAdvisory(raw);
}
```

(`handleApplyPatchLint` returns a deny envelope or ""; the merge is safe because
lint has no allow-with-context output.)

## MODIFY hooks registration

- `hooks/pre-tool-use-linting-apply-patch.json`: command event `pre-tool-use-lint`
  → `pre-tool-use-edit`; statusMessage "(codexclaw) Checking structured edit".
- DELETE `hooks/pre-tool-use-advising-idle-edit.json` + its plugin.json entry
  (15 → 14). `cxc hooks retrust` afterward.

## MODIFY docs (audit Med #1 — registration truth changes)

- `docs-site/src/content/docs/reference/hooks.md:32` — lint hook command/status.
- `structure/INDEX.md:188` — same reference.

Audit notes: retrust never PRUNES — the deleted hook's `[hooks.state."…advising-
idle-edit"]` section stays as harmless orphan residue in ~/.codex/config.toml
(optional manual removal). Combined branch must live INSIDE the fail-open try.

## TESTS

- `plugins/codexclaw/test/hook-e2e.test.mjs`: hooks length 15 → 14; assert the
  lint hook JSON's command names `pre-tool-use-edit` (registration truth). The
  L060 lint e2e self-adapts via readHookCommand (audit-verified) but becomes
  environment-coupled once the advisory leg rides it — pass `emptyCodexHome()`
  env + tmp cwd on the empty-stdout cases (audit Low #3).
- Existing lint/idle-edit unit tests unchanged (handlers untouched).

## Verification (C)

Repo-root `npm run build` + `npm test`; standalone: pipe an edit PreToolUse
payload with a doctored IDLE+loopArmSeen session through `hook pre-tool-use-edit`
→ advisory envelope; pipe a comment-violating apply_patch → lint deny envelope;
`cxc hooks retrust`. Ship/track: no new dist file (cli.js already tracked).
