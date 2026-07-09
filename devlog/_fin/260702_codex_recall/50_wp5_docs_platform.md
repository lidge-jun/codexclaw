---
created: 2026-07-02
tags: [codexclaw, recall, codex-source-verification, windows, linux, portability]
aliases: [recall WP5 doc-alignment and platform log]
---

# WP5 — alignment with actual Codex source + Windows/Linux compatibility

Owner directive (2026-07-02): base recall on the actual current Codex documentation and
make it Windows/Linux compatible. Verified directly against the upstream clone at
`~/developer/codex/121_openai-codex/codex-rs` (plus an independent codex-rescue
verification pass).

## Source-confirmed layout facts

| Assumption | Verdict | Upstream evidence |
| --- | --- | --- |
| `CODEX_HOME` env override, else `home_dir()/.codex` | CONFIRMED | `utils/home-dir/src/lib.rs:13` (`find_codex_home`); `dirs::home_dir` maps to USERPROFILE on Windows — matches our `node:os homedir()` use |
| `sessions/YYYY/MM/DD/` tree | CONFIRMED | `rollout/src/recorder.rs:1330-1343` — built from **local time** (`OffsetDateTime::now_local`) |
| `rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl` filename | CONFIRMED | same block; `-` instead of `:` for filesystem compatibility — our `dateFromRolloutName` regex matches |
| LF-only line terminator on ALL platforms | CONFIRMED | `rollout/src/recorder.rs:1655` (`json.push('\n')`, no writeln!/CRLF) — byte-offset append parsing is Windows-safe |
| `archived_sessions/` flat subdir | CONFIRMED | `rollout/src/lib.rs:24` (`ARCHIVED_SESSIONS_SUBDIR`) |
| `state_5.sqlite` / `memories_1.sqlite` names | CONFIRMED | `state/src/lib.rs:83-84` constants — our highest-N `state_(\d+).sqlite` glob future-proofs version bumps |

Note on dates: directory dates are LOCAL time while our pruning cutoff compares in UTC;
worst case is ±1 day of extra directories scanned, and the exact per-message ISO
timestamp cutoff keeps results correct regardless.

## Independent verifier pass (codex-rescue, 2026-07-02)

All 6 layout assumptions PASS against upstream `51a41f5` (2026-06-28), spot-checked
against the newer fork `129ea2a` (2026-07-01). Verifier caveats folded in same-day:

- `function_call_output.output` can be a STRUCTURED content array, not just a string
  (protocol models.rs:1458-1467) → `toolOutputText()` extracts text from
  string/array/object shapes (regression test; no more `[object Object]` pollution).
- Date-directory pruning now compares LOCAL-time date strings (recorder uses
  `now_local()`); the UTC-cutoff skew is gone.
- cwd prefix filters are separator-aware in both engines (`/repo` no longer matches
  `/repo2`; `\`-separated Windows paths handled; LIKE patterns escape the backslash
  separator correctly under `ESCAPE '\'`).
- Memory relpaths normalize to `/` on every platform (Codex memory backend parity).
- `codexHome()` resolves an explicit `CODEX_HOME` to an absolute path
  (canonicalization-lite, mirroring home-dir/lib.rs).
- Accepted residuals (documented, not fixed): same-size-same-mtime rewrite staleness
  (self-heals on any later change), thread-list ordering differs from Codex's
  timestamp+UUID sort (message recency is what recall orders by), non-local thread
  stores are invisible to a filesystem reader (inherent to the design).

## Platform work landed

- CRLF-safe memory chunking (`paragraphChunks` strips trailing `\r`; CRLF fixture test).
- Byte-offset boundaries computed on Buffers (UTF-8/Korean safe on any platform).
- Rollout ordering keyed on (date, basename) — path-separator neutral.
- No shell-outs, no POSIX-only APIs anywhere in the component; sqlite via `node:sqlite`.
- Windows home resolution identical to Codex's own (`homedir()` ≙ `dirs::home_dir`).
