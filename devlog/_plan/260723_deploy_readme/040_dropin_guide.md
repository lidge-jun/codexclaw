# 040 — drop-in usage guide (phase 4, diff-level plan)

Appended 2026-07-23 (user request, LOOP-UNIT-CHAIN-01): "사용자가 바로 드랍인해서
사용할 수 있는 방법을 안내핆놔, ../cli-jaw처럼 최소 인스탈 철학으로."

## Reference philosophy (cli-jaw README, read 2026-07-23)

- Lead with the shortest working path: "2 lines to install" — `npm install -g cli-jaw`.
- Default install does everything needed; variants (`JAW_SAFE=1`, one-click curl for
  no-Node users) hide behind `<details>` progressive disclosure.
- Post-install: one verify command, then "what to try first".

codexclaw mapping — the drop-in path already exists, it is just undersold:

1. **2 lines, zero build:** `codex plugin marketplace add` + `codex plugin add` —
   committed component `dist/` means no npm, no build, no config edits.
2. **Activate:** restart Codex, approve the 18 hooks once (content-hash trust).
3. **Use immediately WITHOUT the CLI:** PABCD is drivable from chat — a
   line-anchored `orchestrate <P|A|B|C|D|status>` message is the shipped human
   free-pass (cxc-pabcd §Control surfaces); skills trigger by mention/trigger.
   The `cxc` binary is a power surface, not a prerequisite (D6 default).
4. **Optional CLI:** clone + one alias line, or `npm link`.

## Edits (E10 — continues the 020 numbering)

### README.md / README.ko.md / README.zh.md — Install section → "2 lines" drop-in

Replace the current Install section with:

1. Lead line: "2 lines to install. No build step, no npm, no config edits."
2. The 2-line install block (unchanged commands).
3. "Then:" numbered first-run — restart Codex → approve hooks when prompted →
   try in chat:
   - `orchestrate status` (PABCD FSM, human free-pass)
   - "Interview me first, then draft a diff-level plan."
   - "Plan this with codexclaw PABCD and use multi-model subagents."
   (mirrors plugin.json defaultPrompt)
4. Existing lifecycle block (upgrade/uninstall/re-approval/cxc scope) stays,
   folded under a `<details>` "Update / uninstall / CLI" block to keep the
   primary path visually minimal (cli-jaw pattern).
5. Optional CLI (checkout only): `git clone` + `alias cxc='node <repo>/bin/codexclaw.mjs'`
   or `npm link` — one line each, also inside the details block.

### docs-site/src/content/docs/getting-started/installation.md

- Track 1: add the same "what works immediately" close — restart, approve hooks,
  drive PABCD from chat with `orchestrate status`; CLI stays Track 3.

### docs-site/src/content/docs/getting-started/quickstart.md

- Add one line near the top noting the chat free-pass alternative
  (`orchestrate P` as a chat message) for marketplace-only users who skipped
  the CLI — keeps the page honest for both tracks.

## Non-goals

- No install scripts, no npm wrapper, no config mutation (minimal philosophy).
- No changes to plugin.json defaultPrompt (already aligned).

## Verifier

1. Commands/claims check: every command in the new sections exists in the live CLI
   help or is a documented chat surface.
2. i18n normalized parity (same rule as 020 E7).
3. docs-site `npm run build` green.
4. gate.mjs green.
