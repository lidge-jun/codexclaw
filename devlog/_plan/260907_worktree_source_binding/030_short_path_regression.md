# Preserve Windows 8.3 regression coverage

PR #84 merged the native-path fix in bb204ead04935a8970c3b9f70f9019eebb74e8f6.
The runtime behavior and fixture canonicalization are already present on dev and
main. The actual short-name regression from thisisjun786/codexclaw#1 was not
included, so this follow-up carries only that coverage forward.

The test asks cmd.exe for the fixture's real 8.3 alias, binds using short paths,
then checks resolution and byte-preserving repeat binding using long paths.
It also checks the source command's native cwd, pinned source root, B/C
progression, and a validated receipt executed in the linked worktree.
The test explicitly skips outside Windows or when the temporary volume does
not provide 8.3 aliases. Production code is unchanged.

Verification on Node 24.15.0:

- Windows: the new regression passed without skipping.
- WSL Ubuntu: the affected integration file passed 18 tests with zero failures;
  the Windows-only regression skipped. This includes the damaged-symlink case
  and the shipped CLI flow.
- Repository gate and whitespace checks passed.
- Full Windows suite: 2,671 tests, 2,580 passed, 81 skipped, 10 failed. The
  failures are the nine existing session-binding symlink fixtures and the
  damaged-symlink integration case on this host without symlink creation
  permission. The new regression passed. No failing test was weakened or
  suppressed; this is not a green full-suite result.
- Published test-count badges were updated from the measured total using
  `inventory.mjs --write --tests 2671`; the measured-count check passed.

The original version of this regression was verified red before the native-path
fix and green after it in the earlier follow-up. The current run checks the
upstream implementation without replacing it with that earlier patch.
