# Check evidence

## Real-tree gates

```text
focused SessionStart/G2/G3/canonical identity: 16/16 pass
compiled SessionStart process boundary:          5/5 pass
dist freshness + packaging:                     4/4 pass
npm run gate:                                   exit 0
git diff --check:                               exit 0
```

The compiled scenarios cover fresh exact-ID bootstrap followed by immediate `IDLE -> P`, valid and corrupt resume byte preservation, two-process atomic publication, ENOTDIR fail-open, noncanonical identity rejection, and synthetic-child no-write behavior.

## RED to GREEN for the C repair

```text
source canonical tests before dist regeneration: 7/7 pass
old compiled E2E after expanded test:             4/5 pass (expected RED)
regenerated compiled E2E:                         5/5 pass
```

## Independent isolated checkout

Build root: `/tmp/codexclaw-session-bootstrap.csmo3Y/repo`, with its own `.git`, no alternates, deletion-aware current-worktree overlay, and a read-only dependency symlink.

```text
npm run build:              exit 0, 101 files compiled
npm test:                   1,071 total / 1,070 pass / 1 fail
npm run gate:               exit 0
freshness + packaging:      4/4 pass
```

The only failing name is the pre-existing `L11: inactive goal allows I-trigger (interview directive injected)`, caused by the unrelated dirty IDLE reconstruction behavior. Earlier in this work phase the active unrelated diagnostic override contributed four additional baseline failures; after that external override disappeared, those four pass. Neither state was changed by this patch, and no new failure name exists.

Full output: `/tmp/codexclaw-session-bootstrap-isolated-canonical.tap`.

## Preservation and external scope

- Ignored diagnostic SHA-256 remains `32a5c1f18794e97e294bb9545caadac0e91056a060e0cd42d58e271b3c7e965e`.
- Existing valid and corrupt session bytes are preserved; noncanonical inputs create no directory or file.
- No dependency, Git staging/commit/push, release, deployment, or destructive cleanup occurred.
- Read-only GitHub REST, GraphQL, search, events, and direct lookup found zero lifetime issues in `lidge-jun/codexclaw`; unrelated `opencodex` issues #78/#82 were not commented on or closed.

## Review outcome

The initial `GO-WITH-FIXES` Medium identity finding was repaired and the same reviewer returned final `PASS` with no unresolved Critical, High, or Medium finding.
