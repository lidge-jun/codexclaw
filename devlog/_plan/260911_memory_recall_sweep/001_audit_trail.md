# 001 — audit trail for the wp1 roadmap

Three rounds, all by independent `xai/grok-4.6` reviewers in fresh contexts. The
main session folded; it did not rebut. This document exists so a later reader can
see which parts of the roadmap were wrong before they were right.

## Round 1 — two reviewers, split lenses, both FAIL

Reviewer A read 010/020/030 (search, index, CLI core). Reviewer B read
040/050/060/070 (freshness, regex, write gate, publication). Five blockers.

| # | Document | Finding | Fold |
|---|---|---|---|
| B1 | 010 §4.3, §6.1 | `canonicalCwdSql(expr)` interpolates `expr` about twelve times, so the proposed test `db.prepare(\`SELECT ${canonicalCwdSql("?")} AS n\`).get(q)` has a dozen bind slots and binds one value. The named test throws even after the helper exists. | `expr` is now documented as never a bind placeholder; the test binds once through `FROM (SELECT ? AS v)`. |
| B2 | 000, 010, 020, 030 | File ownership of `memory-search.ts` disagreed across four documents: 000 said L1 and L2 wrote it, 010 forbade any L1 production edit, 020 hedged on an L1 rewrite, and 030 was a third writer nobody listed. | L1 does not touch the file. L2 writes it first, L3 second. All four documents now say that. |
| B3 | 020 §4.2 vs §5.1 | The file-span fallback excerpted raw file bytes through `excerptAround` (`memory-search.ts:409-414`), so a CRLF file keeps `\r` — while Test A asserted an excerpt without `\r`, which only holds for paragraph chunks built by `splitLines(...).join("\n")`. The copy-paste AFTER block failed its own test. | The excerpt is taken from `splitLines(content).join("\n")` and the assertion stands. |
| B4 | 060 §5.4, §6.2 | **Security boundary.** The spec let an unknown `-*` flag consume the next token. PowerShell switch parameters take no value, so `Set-Content -Force <path>`, `Out-File -Append <path>` and `New-Item -ItemType File -Force <path>` all return `[]` — a widened matcher that still lets a real memory write through. | Switch parameters must not consume the following token, and those three command lines are named regressions that must fail on today's code. |
| B5 | 070 §1 | The document told the implementer to create `dev` at `6aae1c97`. By then `origin/dev` already existed at `a267b398`, and the fallback rule would have replayed the stack onto a stale ancestor of main. | `dev` is read, never written. The decision rule is explicit and refuses to race the peer session. |

Folded in `3723072a`.

## Round 2 — one reviewer, FAIL on two leftovers

- **030 still named L1 a writer** of `memory-search.ts` at its §4.2 preamble and in
  its layer-interactions section. The round-1 fold had been dispatched for 010, 020
  and 060 but not for 030, and 030 was the document that introduced the third
  writer in the first place. Root cause: the fold was scoped to the documents the
  blocker named, not to the documents the blocker was ABOUT.
- **The `dev` language survived in two headings** even though the bodies were
  corrected: the work-phase map still said wp8 "restores `dev`", and 070's title
  was still "restore `dev`". A reader who skims titles would have done the wrong
  thing.
- Residual noted and also fixed: `070`'s rebase command still used `6aae1c97` as
  the base, which stopped being an ancestor of the chain the moment L0 was rebased
  onto `origin/dev`.

Folded in `dc1aca69`.

## Round 3 — narrow confirmation, PASS

Verdict PASS, `NEW ISSUES: NONE`. The reviewer verified the tree claim with git
rather than taking it on trust: `6aae1c97` and `a267b398` both carry tree
`904bbe09`, `a267b398` is an ancestor of HEAD and `6aae1c97` is not.

## What the audit says about the plan's weak spots

Two of the five round-1 blockers were **tests that could not have passed** — a bind
mismatch and a CRLF assertion. Both came from documents that otherwise read as
precise. The lesson for wp2-wp7: a named test in a PRD is a claim, and the
implementer must run it red before trusting the document that specified it.

One blocker (B4) was a security widening that looked like a fix. The layer that
implements it must prove the three switch-parameter command lines fail on the
parent tip, not merely that the new matcher passes its own happy path.

