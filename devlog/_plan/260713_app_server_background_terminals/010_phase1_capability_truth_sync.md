# Phase 1 — capability truth sync

## Loop-spec header

- Inherits: `000_plan.md` loop specification.
- Research prerequisite: `001_codex_rs_runtime_guide.md` has passed source audit.
- Trigger: current native-capability doctrine stops at model-visible `exec_command` / `write_stdin`.
- Goal: correct the general source of truth without claiming a new callable model tool.
- Non-goals: no skill edit, test, CLI, runtime client, or historical `_fin/` rewrite.
- Verifier: focused `rg`, source links, and `git diff --check` over `structure/60_native_capabilities.md`.
- Stop condition: ownership, experimental gate, loaded-thread/same-instance rule, nullable metrics, and scheduling boundary are explicit.
- Memory artifact: this phase document plus the updated capability matrix.
- Expected outcomes: `DONE`, or `BLOCKED` if the installed binary/schema contradicts the pinned upstream contract.
- Next dependency: phase 2 consumes this corrected terminology.

## Outcome

Update the durable native-capability source of truth so background-terminal lifecycle management is represented accurately and remains distinct from model terminal I/O and durable scheduling.

## Files

### MODIFY `structure/60_native_capabilities.md`

Current row:

```md
| `exec_command` / `write_stdin` | PTY unified exec: long-lived interactive sessions | `cxc-dev` (already core) |
```

Planned replacement/addition:

```md
| `exec_command` / `write_stdin` | Model-visible unified exec: create, poll, write, and interrupt a known live session | `cxc-dev` |
| `thread/backgroundTerminals/list|terminate|clean` | Experimental app-server v2 inventory and teardown for a thread loaded in the same app-server instance; requires `experimentalApi` | `cxc-dev` reference; host client only |
```

Add a short boundary block immediately after the table:

- These JSON-RPC methods are not currently model-visible tools.
- `command/exec` uses a separate process manager and is not listed.
- `turn/interrupt` does not terminate surviving terminals.
- `osPid`, `cpuPercent`, and `rssKb` are nullable and are currently emitted as `null`; no host metrics are promised.
- Planning-turn observation only: Desktop `0.144.0-alpha.4` used a private stdio connection with no discovered attachable plugin endpoint. Promote this into the general capability matrix only after Phase 3 records it in `003_live_probe_evidence.md`; otherwise keep it labeled as an observed-host limitation, not a universal app-server rule.
- This surface does not replace goals, automations, or OS scheduling.

Update the matrix status/source date from its previous verification date to `2026-07-13`, and name the pinned PR/merge/release plus the installed `0.144.0-alpha.4` schema probe as the dated source.

Add upstream provenance links to PR #26041, merge commit, release, README contract, and the detailed codexclaw reference planned in phase 2.

## Must not change

- Existing browser/computer-use capability rows.
- Historical version evidence for unrelated tools.
- Any `_fin/` record that documented the pre-0.140.0 state.

## Acceptance

1. A reader can identify which surface creates/interacts with a terminal and which surface inventories/terminates it.
2. The document says `experimentalApi`, loaded thread, same app-server instance, and nullable host metrics.
3. The document does not claim a callable model tool when none is visible.

## Check

```bash
rg -n "2026-07-13|backgroundTerminals|experimentalApi|command/exec|turn/interrupt|same app-server|osPid|cpuPercent|rssKb" structure/60_native_capabilities.md
git diff --check -- structure/60_native_capabilities.md
```

## SoT sync

`structure/60_native_capabilities.md` is itself the general source of truth for this capability; no second architecture index entry is needed unless a runtime component is later added.
