# wp1 C semantic clarifications

Galileo independently derived four coherent scenario plans but found record-scope and verification wording tensions. Accept: automatic C0/C1 duties must not revive merely because a log exists; explicit user/release record requests remain controlling. Manual C1 repro must be observed with limits. PABCD C must explicitly allow docs-only verification.

## MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
When a worklog or changelog is provided, add one factual entry per changed file:
`### [filename] — [reason]`, then `Changes`, `Impact`, and `Verification`
(command + result). Keep entries concise.
`````

After:

`````text
For C2+ work with a supplied log, add a concise factual change/reason/verification entry.
C0/C1 automatic record duties follow §0.1; merely finding a devlog or changelog does
not reinstate them. An explicit user request or a documented release-record contract
still governs its named log. Do not create an unrelated record to satisfy this section.
`````

## MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
| C0/C1 | Smallest relevant proof; text/docs edits use consistency checks, behavior edits use the focused test or checker |
`````

After:

`````text
| C0/C1 | Smallest relevant proof: text consistency for C0; focused test/checker for C1, or an observed repro with stated limits when automation does not fit |
`````

## MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
4. **C — Check**: Run the real verification — build, typecheck, and targeted tests, plus adversarial review. Capture fresh command output as evidence.
`````

After:

`````text
4. **C — Check**: Run the relevant real verification at the dev §3 work-class floor, plus adversarial review. Runnable source changes use the applicable build/typecheck/tests; docs-only changes use document/contract checks and semantic review, not unrelated product suites. Capture fresh output as evidence.
`````
