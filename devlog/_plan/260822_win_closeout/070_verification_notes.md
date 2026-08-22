# 070 - what dual-platform verification actually costs

Notes from running this campaign's checks on a real Windows host and a real WSL
distro, kept because each one cost time to discover.

## Node version is not incidental

CI pins Node 24. The host's PATH `node` was 22.14, which does not strip TypeScript
types without a flag, so `npm test` failed on EVERY file with
`ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".ts"`. That looks like a
catastrophic breakage and is actually a version mismatch. The same applied inside
WSL, where the distro's `node` was also 22.

Use the Node the CI matrix uses before concluding anything about a red suite.

## The two WSL checkouts are not interchangeable

The WSL workflow deliberately tests twice: once on `/mnt/c` (drvfs) and once on
native ext4. They are different filesystems with different locking and permission
behavior, and the doctor is expected to TELL THEM APART. A green run on one says
nothing about the other.

## Some failures are the host, not the tree

Three classes showed up locally that CI cannot reproduce:

- `~/.codexclaw` exists on a real installation and does not exist on a runner. That
  difference hid a production bug where the GUI resolved the user's entire home
  directory as the project root - green in CI, red locally.
- Symlink creation needs elevation on Windows. Junctions do not, which is why most of
  the guards could be converted to run rather than skip.
- The WindowsApps `codex.EXE` alias only exists where the Codex desktop app is
  installed, which is exactly the population that hit #33.

A runner-only verification story would have missed all three.

## Flakes hide behind "unrelated"

Two failures during this campaign looked unrelated to the change under test and were
real defects in the tests themselves:

- A CRLF equivalence test compared a second-resolution timestamp across two CLI
  calls. It only fails when the calls straddle a second boundary, which a loaded CI
  runner does and a developer machine usually does not.
- The bridge server harness fell back to port 0 when `address()` came back unusable,
  so a failed bind surfaced several assertions later as `fetch failed: bad port` and
  read like a routing bug. It now throws at the bind.

Neither was caused by the work in flight, and both would have kept costing time.
