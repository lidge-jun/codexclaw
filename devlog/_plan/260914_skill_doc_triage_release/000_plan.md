# 000 — Ship the #170-#173 reference-doc fixes as codexclaw 0.2.28

## Objective

Take the four skill-reference fixes already green on PR #174 through the full
promotion path — dev, then main, then a published Release — and close #170-#173.

## Why this is a unit and not a fast-path record

The code change itself is C1 (documentation only, no runtime behavior). The
DELIVERY is not: it crosses two protected-ish integration lines, regenerates the
release inventory, and ends in an irreversible publication whose gate fails closed.
UNIT-RESIDENCE-01 applies to the release, and LOOP-DOCS-FIRST-01 is STRICT for a
HOTL goal loop, so the roadmap is written to diff level before the first merge.

## Constraints

- User authorization (2026-09-14): run as cxc-loop, push dev, merge to main, and
  deploy/release. Nothing wider.
- No local product suite, typecheck, build or install. The only admissible proof is
  hosted CI at the exact head SHA plus the Release workflow's own gate.
- The release gate reads workflow conclusions BY SHA. A green run from a
  neighbouring commit does not count.
- Do not implement the #175 branch-deletion fix in this unit. Report only.

## Starting state (measured 2026-09-14)

| Fact | Value |
|---|---|
| PR #174 | base `dev`, head `7036f9b8`, MERGEABLE / CLEAN, 14/14 checks pass |
| Version, every surface | `0.2.27` (manifest and inventory carry `+codex.20260913080217`) |
| Measured suite, hosted | `tests 3150` — CI run 34790437740, job 103813520900 |
| Published tests badge | `3,150` — already agrees, so the badge does not move |
| `dev` | recreated this session at `main` tip `9e279a45` after it was deleted |
| Open issues to close | #170, #171, #172, #173 |

## Work-phase map

| Phase | Deliverable | Doc | Depends on |
|---|---|---|---|
| wp1 | This roadmap, committed before any merge or version edit | `000` | — |
| wp2 | #174 merged to `dev`; exact-SHA CI + WSL + Packed install green on the new `dev` head | `010` | wp1 |
| wp3 | 0.2.28 prepared on `dev`: every version surface, CHANGELOG, regenerated inventory | `020` | wp2 |
| wp4 | Promotion PR merged to `main`; Release workflow publishes v0.2.28; #170-#173 closed; `dev` restored | `030` | wp3 |

## Release path (docs-site/src/content/docs/development/release.md)

1. Land on `dev`, green on that exact commit.
2. Bump every surface `check-versions.mjs` enumerates.
3. Regenerate the inventory with the measured test count.
4. Merge the `dev` -> `main` promotion PR.
5. Run the Release workflow against `main`.

## Known hazard carried through every phase

`delete_branch_on_merge` is **true** on this repository, and `dev` is not
protected. The promotion PR's head branch IS `dev`, so merging wp4 deletes `dev`
immediately. This already happened once after PR #169 and is why `dev` was missing
at the start of this session. wp4 therefore ends by recreating `dev` from `main`.
Issue #175 tracks the permanent fix; it is out of scope here.

## Terminal outcomes

DONE requires all eight registered criteria met with proof captured this session.
BLOCKED is a hosted check that fails and cannot be resolved in scope. NEEDS_HUMAN
is a burned version tag or a gate demand outside the authorized scope. UNSAFE is
any force-push of a shared branch or any fabricated receipt — never do either.

