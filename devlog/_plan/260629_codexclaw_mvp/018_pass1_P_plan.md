# 018 — Pass 1 (P): IPABCD State Engine — diff-level plan

Status: P (PLANNING)  ·  Phase 1 · Loop Pass 1/7 (see 017)
Unit: IPABCD state engine = T-022a (state) + T-022b (fsm). NO hooks/skills/gates this pass.
Toolchain: Node v24 native TS (type-strip) + `node:test`. No tsc/vitest for Pass 1.

## Scope boundary (this pass only)
- IN: `state.ts` (read/write/ledger), `fsm.ts` (pure predicates+transitions), unit tests, component scripts.
- OUT: directive hook (Pass 2), goal gate (Pass 3), skills (Pass 4), roles (Pass 5).
- State dir `.codexclaw/` is per-working-tree + gitignored.

## File change map
### NEW `plugins/codexclaw/components/pabcd-state/src/state.ts`
```ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export type Phase = "I" | "P" | "A" | "B" | "C" | "D";
export interface Flags { interview: boolean; auditPassed: boolean; checkPassed: boolean }
export interface State {
  phase: Phase; slug: string; updatedAt: string; flags: Flags; supersededBy: string | null;
}
export interface LedgerEntry { ts: string; from: Phase | null; to: Phase; reason: string; evidence?: string }

export const STATE_DIR = ".codexclaw";
export const STATE_FILE = "state.json";
export const LEDGER_FILE = "ledger.jsonl";

export function defaultState(slug = ""): State {
  return { phase: "I", slug, updatedAt: new Date().toISOString(),
    flags: { interview: false, auditPassed: false, checkPassed: false }, supersededBy: null };
}

export function readState(cwd: string): State {
  try {
    const raw = readFileSync(join(cwd, STATE_DIR, STATE_FILE), "utf8");
    const p = JSON.parse(raw);
    if (!p || typeof p.phase !== "string") return defaultState();
    return { ...defaultState(p.slug ?? ""), ...p,
      flags: { ...defaultState().flags, ...(p.flags ?? {}) } };
  } catch { return defaultState(); }     // missing/corrupt -> safe default, never throw
}

export function writeState(cwd: string, next: State): void {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, STATE_FILE + ".tmp");
  writeFileSync(tmp, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2));
  renameSync(tmp, join(dir, STATE_FILE));   // atomic
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

// Legal forward transitions + gate conditions (mirror cli-jaw PABCD).
export function canEnter(to: Phase, state: State): { ok: boolean; reason?: string } {
  switch (to) {
    case "P": return state.flags.interview ? { ok: true }
      : { ok: false, reason: "interview not completed (I->P needs interview flag)" };
    case "A": return { ok: true };                 // A may start once a plan exists (P done)
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

### NEW `plugins/codexclaw/components/pabcd-state/test/state.test.ts`
- `node:test` cases: default on missing dir; corrupt JSON -> default (no throw);
  write→read roundtrip; flags merge; appendLedger creates + appends NDJSON lines.
- Uses `mkdtempSync(os.tmpdir())` for an isolated cwd; cleans up.

### NEW `plugins/codexclaw/components/pabcd-state/test/fsm.test.ts`
- Table-driven: I→P blocked w/o interview flag, allowed with it; B blocked w/o auditPassed;
  D blocked w/o checkPassed; nextPhase order incl. terminal null at D; isDone true only at D+check.

### MODIFY `plugins/codexclaw/components/pabcd-state/package.json`
- before: `"main": "dist/cli.js"` only, no scripts.
- after: add
```json
  "scripts": { "test": "node --test" }
```
(keep name/version/type/main/description.)

### UNCHANGED this pass
- `src/cli.ts` keeps its stub (its TODO(mvp-03) is Pass 2). No hook wiring yet.

### Ensure `.gitignore` covers `.codexclaw/`
- Verify root `.gitignore` already ignores `.codexclaw/`; add if missing (MODIFY).

## Accept criteria (Pass 1 done = small C/D)
- `node --test` in the component dir passes (state + fsm suites green).
- readState never throws on missing/corrupt; writeState atomic (tmp+rename).
- FSM predicates pure (no IO); every legal/illegal transition covered.

## A-phase audit targets (next, small A)
- Confirm Node-native `.ts` import (`./state.ts`) works under v24 `node --test` (no loader flag), else
  add minimal `--experimental-strip-types` note. Verify before B if uncertain.
- Confirm `.codexclaw/` gitignored.
