---
name: cxc-recall
description: "Use for past-session context recovery. Triggers: recall, last time, previous session, chat search, memory search, 그때, 지난번, 저번 세션, 예전에 했던, 기억나?, 리콜, 지난 세션, 이전 작업, 뭐였지, 어떻게 했었지."
metadata:
  short-description: "Read-only recall search over ~/.codex: past chats (FTS-indexed) + memory store."
---

# recall — Past-Session Recall Search

Codex already persists every session (`~/.codex/sessions/**/rollout-*.jsonl`) and a
per-thread memory store (`~/.codex/memories/`). This skill is the discipline for
SEARCHING that history instead of asking the user to repeat themselves.

Injected `memory_summary.md` and SessionStart snippets are locators, never proof.
Search, then open the winning file, before answering a past-work question.

## Recall Lookup Scope (read first)

When ANY of these happen, search BEFORE asking the user:

- A term, file, decision, or codename from prior work is unfamiliar.
- Context seems lost after a compact, restart, or session handoff.
- The user references earlier work: "그때 그거", "지난번에 하던 거", "저번 세션에서",
  "예전에 만든", "last time", "the thing we did earlier", "as discussed previously".
- You are about to write "I don't have context about X" — search X first.

Never call `memories.add_ad_hoc_note` from this skill.

## Natural-language → keyword ladder

Do not start with the user's sentence. Rewrite, then search. Each rewrite is its
own query (`--days 0`, chat then memory unless the noun is known to live in notes):

1. Proper nouns / versions / hostnames / filenames as a single token
   (`BundledPluginsMarketplace`, `2.49.0`, a thread id).
2. Korean/English synonym pair of that noun (`도그푸딩` and `dogfooding`,
   `플러그인` and `plugin restart`, `배포` and `provenance` / `SLSA`).
3. Short 2–3 word keyword query (`로컬 소스 서비스`, `2.49.0 배포 npm`).
4. `cxc chat search "<keywords>" --days 0 --no-tools` — find the conversation.
   Add `--context 2`. Add `--source all` if the work was delegated.
5. `cxc memory search "<keywords>"` — durable summary. Omit `--no-chat` so empty
   memory can backfill up to 5 raw messages labelled `(chat/chat)`.
6. Open the winning rollout / memory file (`rollout_path` is on the hit). Do not
   answer from the excerpt.
7. Only if the rewritten queries miss, ask the user and list what you searched.

## Result checks (before treating a hit as the answer)

- Request vs completion: a user line or "진행할게" is a locator, not proof.
  Prefer assistant text that names the outcome (healthz, npm latest, recovered).
- Correction history: later ad-hoc notes and MEMORY.md entries override older
  summaries. If two hits disagree, read the newer file, then the rollout.
- `--any` hits are not evidence by mere existence.

## Conditional References

| Condition | Reference |
| --- | --- |
| Selecting a version match | [Result checks](references/result-checks.md) |
| Running chat/memory commands, selecting flags, scoring results, diagnosing or requeuing extraction | [Commands and engines](references/commands.md) |
| Delegated work, managed worktree, project/home scope, native memory tools, empty results or JSON output | [Scope and results](references/scope-and-results.md) |
| Aside or kim_wiki is installed and extra memory evidence is needed | [Optional memory lanes](references/optional-memory-lanes.md) |
| Index maintenance or understanding SessionStart/compaction injection | [Index and injection](references/index-and-injection.md) |
