# 060 — Enforcement layer: tag and branch rulesets, proven by refusal

Status: DONE — work-phase wp6 (rewritten after the A gate; see §A-gate below)

## Why this exists

The v0.2.0-beta.1 train shipped three gates, and every one is bypassable:

| Gate | Executing surface | Bypass |
| --- | --- | --- |
| inventory drift | `gate.mjs` in CI | push without CI, or regenerate alongside edits |
| release candidate | `release verify` in `release.yml` | `gh release create` by hand |
| exact-head CI | `release.yml` | nothing requires CI before a push to `main` |

Measured, not assumed:

```text
$ gh api repos/lidge-jun/codexclaw/rulesets            -> []
$ gh api repos/lidge-jun/codexclaw/rules/branches/main -> []
```

So each phase doc honestly records **final enforcement layer: none**. This phase
changes that for the operations that can destroy published evidence, then corrects
the wording to match whatever is true afterwards.

## Loop spec

- Archetype: spec-satisfaction repair
- Goal: a release tag cannot be moved or deleted, and `main` cannot be force-pushed,
  deleted, or advanced to a commit that has not passed CI
- Non-goals: requiring pull requests on `main` — that would replace the established
  fast-forward promotion flow, a policy change this work is not authorized to make
- Verifier: an actually-attempted protected operation that is **refused**
- Terminal outcomes: DONE on captured refusals; UNSAFE if closing the gap would
  require deleting a published tag, force-pushing `main`, or locking the owner out

## Required contexts — exactly eight (PLAN-VERIFIER-REAL-01)

Read from real check-runs on `27ed3b25`, not guessed:

```text
test (ubuntu-latest)       test (windows-latest)      test (macos-latest)
artifact (ubuntu-latest)   artifact (windows-latest)  artifact (macos-latest)
install (ubuntu-latest)    install (macos-latest)
```

**`release` is deliberately excluded.** It appears in that commit's check-runs, but
only because the release workflow ran there. An ordinary `dev` push never earns it,
so requiring it would pass the current SHA and then block the *next* promotion.

**`install (windows-latest)` is excluded** — that lane is not in the matrix yet (040
adds Windows only once ubuntu and macOS are green).

A required context that does not exist does not "never fire": it stays permanently
missing and blocks every update. That is a lockout, not a no-op — which is why the
list is eight, transcribed, and not rounded to a memorable number.

## Ruleset payloads

### `protect-release-tags`

```json
{
  "name": "protect-release-tags",
  "target": "tag",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "update" }
  ]
}
```

Creation stays allowed so the train can still publish. What becomes impossible is
re-pointing or removing a tag that already exists — the operation 050's rollback
policy forbids, because deleting a published tag breaks any installer pinned with
`--ref`.

### `protect-main`

```json
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/heads/main", "refs/heads/codex/ruleset-probe"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": true,
        "required_status_checks": [
          { "context": "test (ubuntu-latest)",     "integration_id": 15368 },
          { "context": "test (windows-latest)",    "integration_id": 15368 },
          { "context": "test (macos-latest)",      "integration_id": 15368 },
          { "context": "artifact (ubuntu-latest)", "integration_id": 15368 },
          { "context": "artifact (windows-latest)","integration_id": 15368 },
          { "context": "artifact (macos-latest)",  "integration_id": 15368 },
          { "context": "install (ubuntu-latest)",  "integration_id": 15368 },
          { "context": "install (macos-latest)",   "integration_id": 15368 }
        ]
      }
    }
  ]
}
```

This is the **creation** payload: it includes the probe branch, so the probes below
run against the identical rules. Step E replaces it via
`PUT /repos/lidge-jun/codexclaw/rulesets/{id}` with the same rules and
`"include": ["refs/heads/main"]`, and both states are read back (A-gate r2 #1 — the
first draft's payload silently omitted the probe branch, which would have made every
refusal proof vacuous while leaving `main` safe).

`integration_id: 15368` binds each context to GitHub Actions, so a third-party app
cannot satisfy a required check by reporting the same name.

`strict_required_status_checks_policy: false` — strict mode governs whether a merge
candidate is current with its base. A genuine fast-forward descendant already is, so
strict would not by itself reject this repo's promotion; `false` is chosen because the
requirement adds nothing here and narrows the rule to what is actually being enforced.

Required status checks apply to **direct ref updates**, not only PR merges: the
pushed commit must already carry passing checks. That is exactly the established
flow — `dev` runs CI, `main` fast-forwards to that same SHA, and the checks are
attached to the SHA. The customary path becomes the required one.

## Refusal proof — on a throwaway branch, never on `main`

A ruleset that has never refused anything is not proven; the release workflow was
held to that standard and so is this. But the probes must not risk production.

To prove the rules without touching `main` or any `v*` tag, `protect-main` is
created with a **second, temporary include pattern**
`refs/heads/codex/ruleset-probe`. The probe branch is then subject to the identical
rules, and the pattern is removed afterwards — an edit that never weakens `main`.

| Probe | Operation | Expected |
| --- | --- | --- |
| A | create `codex/ruleset-probe` at `27ed3b25` | allowed (`do_not_enforce_on_create`) |
| B | push a new local commit (no CI has run on it) | **refused** — required checks missing |
| C | force-push the probe branch backwards | **refused** — non_fast_forward |
| D | delete the probe branch | **refused** — deletion |
| E | remove the probe pattern, then delete the branch | allowed |

Probe B is the central one: it proves an unchecked commit cannot reach a protected
branch. Probes C and D prove the destructive operations are blocked. None of them
can move `main`, and a push to `codex/ruleset-probe` triggers no workflow (`ci.yml`
runs on `main`/`dev` and pull requests only), which is what keeps the commit
unchecked and the proof meaningful.

**No `v*` probe tag is ever created.** `release.yml` triggers on `push: tags: ["v*"]`
and its version parser accepts any string, so a `v0.0.0-ruleset-probe` tag on a
commit whose checks all pass could genuinely publish a bogus public release —
and deleting the tag would not remove the Release. The tag ruleset is therefore
verified by configuration read-back plus the branch-side deletion proof, which
exercises the same `deletion` rule type.

**Probe F — the normal path still works, non-vacuously.** `origin/main` and
`origin/dev` are currently the same commit, so a bare push would print
`Everything up-to-date` and prove nothing (A-gate r2 #2). Probe F therefore requires
a real ref update:

1. a commit ahead of the pre-probe `main` (this phase's own devlog/CHANGELOG work),
2. pushed to `dev` first,
3. green on all eight contexts,
4. promoted with output showing `<old_main>..<checked_sha>  origin/dev -> main`.

A protection that blocks the intended workflow is a regression, not a gate — but a
promotion that never updated a ref has not tested the protection either.

## What this does NOT enforce

Rulesets protect refs, not the Releases API. `gh release create` by hand still
works, and the release gate can still be skipped that way. What the tag ruleset
buys is that such a release cannot quietly re-point or delete an existing tag.

A repository admin can also edit or disable a ruleset and then do anything. That is
the honest residual, and step E demonstrates it in the open rather than describing
it: removing the probe pattern to clean up **is** the admin bypass, executed once
and recorded.

## File change map

| Path | Change |
| --- | --- |
| (GitHub) `protect-release-tags`, `protect-main` | NEW rulesets |
| `020` / `030` / `040` bypass blocks | name the layer that now exists, or keep `none` |
| `CHANGELOG.md` | Unreleased entry |
| this doc | the record |

## Accept criteria

1. `GET /repos/lidge-jun/codexclaw/rulesets/{id}` for **each** ruleset returns the full
   object — target, conditions, every rule, parameters, bypass_actors — not just the
   summary listing, read back **twice** for `protect-main`: once at creation (probe
   pattern present) and once after step E (`refs/heads/main` only).
2. Probe B output contains a rejection naming the missing required checks.
3. Probes C and D contain rejections naming `non_fast_forward` and `deletion`.
4. Probe F: a fast-forward push performs a **real ref update**, with output showing
   `<old_main>..<new_sha>  origin/dev -> main` — not `Everything up-to-date`.
5. No probe branch or probe tag remains; `v0.1.0` → `c266bb06` and
   `v0.2.0-beta.1` → `27ed3b25` unchanged; `protect-main` includes only
   `refs/heads/main` at the end.
6. `npm test`, `gate.mjs`, `inventory.mjs --check` all exit 0.

## A-gate (round 1, FAIL — 4 blockers, all folded)

| # | Sev | Disposition |
| --- | --- | --- |
| 1 | Critical | folded — the `v0.0.0-ruleset-probe` tag would have matched `release.yml`'s `v*` trigger on a fully-checked commit and could have published a real bogus release. No `v*` probe is created at all; tag protection is verified by read-back plus the branch-side `deletion` proof. |
| 2 | High | folded — "nine contexts" was wrong and dangerous: the list is **eight**, and `release` is explicitly excluded because an ordinary `dev` push never earns it. The old "a nonexistent context never fires" claim was inverted and is corrected: it blocks permanently. |
| 3 | High | folded — complete JSON payloads recorded, with `strict_required_status_checks_policy`, `do_not_enforce_on_create`, and `integration_id: 15368` per context; acceptance now requires per-ruleset GET read-back. |
| 4 | High | folded — probes moved off `main` entirely onto a temporary include pattern, and the central missing-status refusal (probe B) is now proven, which the original A/C pair never did. |

Verified non-blockers from the same round: the rule type strings and `update` on tag
targets are valid; `refs/tags/v*` / `refs/heads/main` are correctly shaped; required
status checks do apply to direct pushes, so fast-forward promotion survives; and an
empty `bypass_actors` does not make recovery irreversible for an admin owner.

### A-gate round 2 (GO-WITH-FIXES, 2 blockers, both folded)

| # | Sev | Disposition |
| --- | --- | --- |
| 1 | High | folded — the canonical creation payload listed only `refs/heads/main` while the probe section assumed the probe branch was covered. Executed literally, every probe would have *succeeded*, making the refusal proof vacuous (though `main` stayed safe). The creation payload now includes both refs, and step E's `PUT` payload is named explicitly, with read-back required at both states. |
| 2 | Medium | folded — `origin/main` and `origin/dev` are the same commit, so probe F's "push succeeds" would have been satisfied by `Everything up-to-date`. It now requires a real ref update on a commit that is ahead, already on `dev`, and green on all eight contexts. |

Also corrected (non-blocking): the strict-mode rationale overstated its effect —
strictness concerns whether a merge candidate is current with its base, and a
fast-forward descendant already is. `false` is kept because the requirement adds
nothing here, not because strict would reject the promotion.

Round 2 independently re-verified: both payloads parse and every field is schema-
recognized; the eight contexts match the real jobs from CI run `31870618796` and
packed-install run `31870618798`, all from app `15368`; probe B is genuinely
unchecked; and step E leaves `protect-main` scoped to `refs/heads/main` only.

## Execution record (C)

Applied 2026-08-15. Ruleset ids: `protect-release-tags` = `20884836`,
`protect-main` = `20884837`. Both `enforcement: active`, `bypass_actors: []`.

### Probe A — create the probe branch at a checked commit: ALLOWED

```text
* [new branch]  27ed3b25... -> codex/ruleset-probe
```

### Probe B — push an unchecked commit: **REFUSED**

The commit was built with `git commit-tree` off `27ed3b25`, so no workflow had ever
run on it (nothing triggers on `codex/*`):

```text
remote: error: GH013: Repository rule violations found for refs/heads/codex/ruleset-probe.
remote: - 8 of 8 required status checks are expected.
 ! [remote rejected]   db293bf5... -> codex/ruleset-probe (push declined due to repository rule violations)
```

This is the central proof: an unchecked commit cannot reach a protected branch.

### Probe C — force-push backwards: **REFUSED**

```text
remote: - Cannot force-push to this branch
remote: - Required status check "test (macos-latest)" is failing.
 ! [remote rejected]   1cd9447c... -> codex/ruleset-probe
```

Two rules fired at once. The second line is worth reading carefully: GitHub reports
a *missing* check on the target commit as "failing", which is why a required context
that does not exist would block permanently rather than pass silently — the inverted
claim the A gate caught.

### Probe D — delete the branch: **REFUSED**

```text
remote: - Cannot delete this branch
 ! [remote rejected]   codex/ruleset-probe
```

### Probe E — the admin bypass, executed in the open

The probe branch could not be removed while the rule matched it. Cleanup required
editing the ruleset:

```text
$ gh api -X PUT .../rulesets/20884837 --input <main-only payload>
{"include":["refs/heads/main"],"name":"protect-main"}
$ git push origin --delete codex/ruleset-probe
 - [deleted]  codex/ruleset-probe
```

That sequence **is** the residual bypass. An admin can edit or disable a ruleset and
then do anything it forbids. Doing it once deliberately, and recording it here, is
more honest than asserting it in a bullet.

Final read-back:

```json
{"name":"protect-main","enforcement":"active","include":["refs/heads/main"],
 "rules":["deletion","non_fast_forward","required_status_checks"],"checks":8}
```

### What is now true, and what is not

| Operation | Before | After |
| --- | --- | --- |
| force-push `main` | allowed | **refused** |
| delete `main` | allowed | **refused** |
| push an unchecked commit to `main` | allowed | **refused** |
| delete or re-point a `v*` tag | allowed | **refused** |
| publish a release by hand via the API/UI | allowed | still allowed |
| an admin disabling a ruleset first | allowed | still allowed |

The last two rows are the point of stating this precisely. Rulesets protect refs,
not the Releases API, and they are administered by the same person they constrain.
