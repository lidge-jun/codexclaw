# 000 — Thread-dispatch loops: plan

## Objective

A user asking for a dispatched-thread loop should get lanes that actually loop. Today one
session loops and the lanes it creates do not, and the cause is a sentence in our own
skill rather than anything the host forbids.

## What the host actually allows (measured 2026-09-20, evidence in 001)

| Question | Answer | Where |
|---|---|---|
| Can a user reference several tasks in one prompt? | Yes. No cap, no slice; duplicates collapse by (hostId, threadId) and a same-host self-reference is dropped | `app.asar@33375677`, `@39928665`, `@6908509` |
| How is a lane addressed? | `thread://<threadId>[?hostId=<encoded>]`, serialized into the prompt as `[@Title](thread://…)` | `app.asar@30013343`, `@32878148` |
| How many lanes can one wait watch? | 1–8 targets, `timeoutMs` 0–120000, default 120000 | `app.asar@29668809`, `@29669315` |
| Is a freshly created lane addressable? | Only when it returns `threadId`; a queued worktree returns `clientThreadId`, and no model-visible resolver exists | `app.asar@29662466`, `@37995186` |
| Is there a cap on running tasks? | None found app-side; per-thread turns queue instead | `app.asar@28405259`, `@28400600` |
| Is there a cap on subagents? | Yes — `DEFAULT_AGENT_MAX_THREADS = Some(6)` for V1; V2 uses `max_concurrent_threads_per_session - 1` | `codex-rs/core/src/config/mod.rs:207,1438-1452` |
| Does a finished lane wake its coordinator? | No. Completion notifies its own task only | `app.asar@37741319` |

So lanes are a host-supported shape and subagents are the bounded resource — the inverse
of the assumption that "unlimited parallel subagents" is the cheap path.

## The defect

`plugins/codexclaw/skills/loop/SKILL.md:28-29` says: "Only the main session owns host
goals and PABCD transitions. A delegated task follows its packet; loading loop never
authorizes a leaf to start a goal or spawn." Written for subagents, it reads as covering
every dispatched task, and it contradicts the same file's statement that a thread has its
own goal and PABCD state. A lane that reads it concludes it may not run a loop, so the
coordinator is the only looping session.

## Constraints

- Documentation and tests only; no runtime component changes.
- Nothing here grants new authority. A lane still loops only when its packet says so, and
  merge authority stays a separate, explicit grant.
- Commits land on `dev` directly; release promotes `dev` to `main` and dispatches
  `release.yml` with the full promoted SHA.

## Work phases

| Phase | Unit | Doc | Depends on |
|---|---|---|---|
| wp1 | This roadmap | `000`, `001` | — |
| wp2 | Lane-loop authority: fix the blocking sentence, add the packet contract | `010` | wp1 |
| wp3 | Addressing, wave batching and fan-out caps wired into the dispatch references | `020` | wp2 |
| wp4 | Release 0.2.33 | `030` | wp3 |
| wp5 | Reinstall from dev on every SSH host that has codexclaw | `040` | wp4 |

## Non-goals

No change to `aside-visualizer`, no new runtime dependency, no hook that dispatches
anything automatically, and no attempt to raise the subagent cap from inside a session.
