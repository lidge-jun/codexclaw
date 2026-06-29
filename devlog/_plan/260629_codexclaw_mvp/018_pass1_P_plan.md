# 018 — Pass 1 (P): IPABCD State Engine — diff-level plan (REV: session-scoped)

Status: P (PLANNING)  ·  Phase 1 · Loop Pass 1/7 (see 017) · scoping per 016 (Finding C)
Unit: IPABCD state engine = T-022a (state) + T-022b (fsm). NO hooks/skills/gates this pass.
Toolchain: Node v24 native TS (type-strip) + `node:test` (both verified). No tsc/vitest for Pass 1.

## Scope boundary (this pass only)
- IN: `state.ts` (session-scoped read/write + shared ledger), `fsm.ts` (pure predicates), unit tests, test script.
- OUT: directive hook (Pass 2 reads session_id from payload), goal gate (Pass 3), skills (4), roles (5).
- KEY DECISION (016): phase state is PER-SESSION, keyed by `sessionId`, NOT per-cwd singleton.

## State layout (per working tree, gitignored under `.codexclaw/`)
- `<cwd>/.codexclaw/sessions/<sanitize(sessionId)>.json` — one phase-state per codex session.
- `<cwd>/.codexclaw/ledger.jsonl` — SHARED append-only audit; every entry tagged with `sessionId`.

## File change map
### NEW `plugins/codexclaw/components/pabcd-state/src/state.ts`
```ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export type Phase = "I" | "P" | "A" | "B" | "C" | "D";
export interface Flags { interview: boolean; auditPassed: boolean; checkPassed: boolean }
export interface State {
  phase: Phase; sessionId: string; slug: string; updatedAt: string;
  flags: Flags; supersededBy: string | null;
}
export interface LedgerEntry {
  ts: string; sessionId: string; from: Phase | null; to: Phase; reason: string; evidence?: string;
}

export const STATE_DIR = ".codexclaw";
export const SESSIONS_SUBDIR = "sessions";
export const LEDGER_FILE = "ledger.jsonl";

// omo-style key sanitization (filesystem-safe session id).
export function sanitizeKey(value: string): string {
  const s = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "missing";
}

export function defaultState(sessionId: string, slug = ""): State {
  return { phase: "I", sessionId, slug, updatedAt: new Date().toISOString(),
    flags: { interview: false, auditPassed: false, checkPassed: false }, supersededBy: null };
}

function statePath(cwd: string, sessionId: string): string {
  return join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${sanitizeKey(sessionId)}.json`);
}

export function readState(cwd: string, sessionId: string): State {
  try {
    const raw = readFileSync(statePath(cwd, sessionId), "utf8");
    const p = JSON.parse(raw);
    if (!p || typeof p.phase !== "string") return defaultState(sessionId);
    return { ...defaultState(sessionId, p.slug ?? ""), ...p, sessionId,
      flags: { ...defaultState(sessionId).flags, ...(p.flags ?? {}) } };
  } catch { return defaultState(sessionId); }   // missing/corrupt -> safe default, never throw
}

export function writeState(cwd: string, next: State): void {
  const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
  mkdirSync(dir, { recursive: true });
  const finalPath = statePath(cwd, next.sessionId);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2));
  renameSync(tmp, finalPath);                    // atomic
}

export function appendLedger(cwd: string, entry: LedgerEntry): void {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LEDGER_FILE), JSON.stringify(entry) + "\n");
}
```

### NEW `plugins/codexclaw/components/pabcd-state/src/fsm.ts`
```ts
import type { Phase, State } from "./state.ts";

export const ORDER: Phase[] = ["I", "P", "A", "B", "C", "D"];

export function canEnter(to: Phase, state: State): { ok: boolean; reason?: string } {
  switch (to) {
    case "P": return state.flags.interview ? { ok: true }
      : { ok: false, reason: "interview not completed (I->P needs interview flag)" };
    case "A": return { ok: true };                 // A starts once a plan exists (P done)
    case "B": return state.flags.auditPassed ? { ok: true }
      : { ok: false, reason: "audit gate closed (need auditPassed)" };
    case "C": return { ok: true };
    case "D": return state.flags.checkPassed ? { ok: true }
      : { ok: false, reason: "check gate closed (need checkPassed)" };
    case "I": return { ok: true };
    default: return { ok: false, reason: `unknown phase ${to}` };
  }
}

export function nextPhase(state: State): Phase | null {
  const i = ORDER.indexOf(state.phase);
  return i < 0 || i + 1 >= ORDER.length ? null : ORDER[i + 1];
}

export const isAuditGateOpen = (s: State) => s.phase === "A" || s.flags.auditPassed;
export const isBuildGateOpen = (s: State) => s.flags.auditPassed;
export const isDone = (s: State) => s.phase === "D" && s.flags.checkPassed;
```

### NEW `plugins/codexclaw/components/pabcd-state/test/state.test.ts`  (`node:test`)
- missing dir → default (phase "I", carries sessionId); corrupt JSON → default (no throw).
- write→read roundtrip per session; flags merge.
- **two different sessionIds in the same cwd do NOT clobber** (core Finding-C regression test).
- appendLedger creates `ledger.jsonl`, appends NDJSON, each line has `sessionId`.
- isolated cwd via `mkdtempSync(os.tmpdir())`; cleanup after.

### NEW `plugins/codexclaw/components/pabcd-state/test/fsm.test.ts`  (`node:test`)
- table-driven: I→P blocked w/o interview, allowed with it; B blocked w/o auditPassed; D blocked
  w/o checkPassed; nextPhase order + terminal null at D; isDone only at D+check.

### MODIFY `plugins/codexclaw/components/pabcd-state/package.json`
- add `"scripts": { "test": "node --test" }` (keep name/version/type/main/description).

### UNCHANGED this pass
- `src/cli.ts` keeps stub; Pass 2 wires the hook and passes `session_id` from payload into state.ts.

### `.gitignore` — already covers `.codexclaw/` (verified line 3). No change.

## Accept criteria (Pass 1 done = small C/D)
- `node --test` green (state + fsm).
- Session isolation proven: distinct sessionIds keep distinct phase files in one repo.
- readState never throws on missing/corrupt; writeState atomic; FSM pure.

## A-phase audit targets (next, small A)
- Re-confirm session-scope decision (016) against omo path shape — DONE (matches).
- Confirm shared ledger with per-entry sessionId is the right audit shape (vs per-session ledger).
