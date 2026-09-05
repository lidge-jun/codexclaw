# CodexClaw licensing and provenance notice

Copyright (c) 2026 lidge-jun

SPDX-License-Identifier: MIT

Except for separately licensed third-party material, CodexClaw is distributed
under the MIT License in LICENSE. This project declaration does not replace
third-party licenses or retroactively revoke licenses accompanying earlier
distributions.

## Acknowledgements: OMO / LazyCodex

CodexClaw's workflow design draws on ideas studied in OMO / oh-my-openagent
(https://github.com/code-yeongyu/oh-my-openagent), by Yeongyu Kim and contributors.
CodexClaw is a separate project, not an official OMO distribution; no affiliation
or endorsement is implied.

This is not a claim that every file was written without upstream code.
Known adapted material came from the historical MIT-licensed LazyCodex/OMO
snapshot, not from the current oh-my-openagent SUL license:

- Source: https://github.com/code-yeongyu/lazycodex/tree/db0f80f0aecdd43f95c6b739f12fdeb747cc250f
- Original copyright: Copyright (c) 2026 Yeongyu Kim.
- Original grant: https://github.com/code-yeongyu/lazycodex/blob/db0f80f0aecdd43f95c6b739f12fdeb747cc250f/LICENSE
- ast-grep skill/helper: adapted with CodexClaw command, runtime-path and
  environment-variable handling; the original MIT text is retained at
  skills/ast-grep/LICENSE in the plugin payload.
- components/pabcd-state/src/transcript.ts and its compiled counterpart: OMO
  transcript-guard reference adapted for CodexClaw phase markers and fail-open
  behavior; the same historical MIT grant accompanies this material.

The plugin payload is plugins/codexclaw/ in a repository checkout; the paths above
are relative to it. Preserve the upstream copyright and permission notice with
copies of the adapted material. This acknowledgement does not grant rights to
unrelated or later OMO code, text, artwork or trademarks.

## Other third-party notices

- skills/repo-map/scripts/: RepoMapper, MIT License, Copyright (c) 2025 Pete Davis.
  Its original LICENSE and NOTICE.md are retained in that directory.
- skills/repo-map/scripts/queries/: tree-sitter query files derived from Aider
  (github.com/Aider-AI/aider), Apache License 2.0. Attribution and local changes
  are recorded in skills/repo-map/scripts/NOTICE.md.

Other separately licensed material and dependencies retain their original
licenses and notices; the project license does not relicense them.
