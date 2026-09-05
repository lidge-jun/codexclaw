# MIT selection and verified OMO provenance

Owner follow-up: use MIT and make upstream acknowledgement visible at the top of
the README as well as the legal notices. Supersedes the AGPL selection in `000_plan.md`.
No cleanup reversal, runtime rewrite, release, installation or Git history rewriting.

## Evidence before changing attribution

- `transcript.ts` has a `ported from omo` comment; introduction `2a579e4c` records
  OMO guard parity. Keep that provenance rather than relabelling it as fully original.
- `f9c715e1` explicitly adopted the OMO ast-grep helper with path/environment changes.
  Comparison against the pre-import LazyCodex snapshot shows those limited changes;
  it is not accurate to describe the whole helper as independent code.
- The actual historical source is `code-yeongyu/lazycodex` at
  `db0f80f0aecdd43f95c6b739f12fdeb747cc250f` (2026-06-29). Both its root LICENSE
  and `plugins/omo/skills/ast-grep/LICENSE` are MIT, Copyright (c) 2026 Yeongyu Kim.
  Confirmed from the existing read-only reference clone and opened public raw URLs:
  https://raw.githubusercontent.com/code-yeongyu/lazycodex/db0f80f0aecdd43f95c6b739f12fdeb747cc250f/LICENSE
  https://raw.githubusercontent.com/code-yeongyu/lazycodex/db0f80f0aecdd43f95c6b739f12fdeb747cc250f/plugins/omo/skills/ast-grep/LICENSE
- Current `code-yeongyu/oh-my-openagent` SUL is not the license of this pinned source.
  Source acknowledgement is not a blanket grant to copy future SUL material.

## Scoped change map

- Restore standard MIT with lidge-jun copyright in root/payload LICENSE.
- Root/payload NOTICE: MIT project scope; OMO acknowledgement, pinned historical
  MIT grant, known adapted paths and modification summary, no affiliation/endorsement;
  preserve RepoMapper/Aider terms and prior-distribution licensing.
- Restore upstream `skills/ast-grep/LICENSE` byte-for-byte; add source/license pointers
  in the helper and transcript comment. Regenerate only the resulting transcript dist.
- Change root package/lock/plugin SPDX, README badges/license sections, docs manifest
  and SoftwareApplication license URL. Add honest top-of-README credits in all three
  languages, plus a visible docs-site acknowledgement. No blanket independence claim.
- Update existing packaging/ast-grep checks for MIT, upstream-grant inclusion and
  root/payload parity. Keep dependency metadata and existing third-party notices intact.

## Verification

Focused packaging, ast-grep, transcript and dist-freshness tests; content gate;
full-byte upstream license comparison; no executable-code delta beyond comments;
no repository-wide local suite. Independent review is technical scope/provenance
verification, not a guarantee about every historical copyright or trademark issue.

## Completed verification

- Implementation `8895582921f6a793761a7f5e092c93a84235d219` restores MIT across
  both distribution boundaries and all public metadata/README surfaces.
- Focused checks: **24 passed, 0 failed/skipped**; build **156 files**, gate and
  `git diff --check` passed. Rebuilt runtime output differs only in attribution comments.
- Restored upstream LICENSE exactly matches the pinned source:
  SHA-256 `b083425948376611de9b92b0aeb7377e604505756ea427e541a34d9b030d4dc1`.
  The packaging test pins this grant and checks that it is tracked/in the payload.
- Root/payload LICENSE and NOTICE copies match. Dependency lock metadata changed
  only at the project license field; existing RepoMapper/Aider files are unchanged.
- Independent reviewer Carver (`01a0716c-4608-7041-a492-dd3e90e402a0`) confirmed
  the scoped notices against historical MIT sources, retained port provenance and
  lack of any blanket independence claim; reran the 24 tests. **VERDICT: PASS**.
