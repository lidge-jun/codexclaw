# 10 — Phase 1: Subagents dropdown fix + error surfacing (DOD 1)

- Class: C2 (conventional GUI+component slice) · Verification: LIGHT-STANDARD (CLI sub-agent)
- Root cause (confirmed live, see 01): checkbox posts `{mode:"model"}` with no model id →
  `validateRolePatch` rejects patch-alone → 400 → GUI swallows error + unconditional
  "updated" toast → checkbox never enables → ModelSelect permanently disabled.

## Part 1 — plain

Make the "use a specific model" checkbox actually work: ticking it selects a concrete
default model (current role model, else first catalog entry), failures show an error
toast instead of a fake success, and the store accepts a `mode:"model"` patch when the
role already has a model saved.

## Part 2 — diff-level

### MODIFY `plugins/codexclaw/components/subagent-config/src/store.ts`
- `setRole()`: validate the MERGED role, not the bare patch.
  - Before: `const err = validateRolePatch(patch); if (err) throw …; const next = {…merge}`
  - After: merge first → `const err = validateRolePatch(next as Partial<RoleConfig>)`
    (semantics: `mode:"model"` valid iff merged model is non-empty; `mode:"default"`
    still nulls model). `validateRolePatch` itself unchanged (still exported/pure).
- Doc comment updated to state merged-validation semantics.

### MODIFY `plugins/codexclaw/gui/src/api.ts`
- `setSubagentRole()` returns `{ ok: boolean; config: SubagentsConfig; error?: string }`
  instead of silently returning the fallback: parse non-ok responses' `{error}` body,
  network failure → `{ok:false, config:fallback, error:"backend unreachable"}`.

### MODIFY `plugins/codexclaw/gui/src/pages/Subagents.tsx`
- checkbox onChange (checked): `save(role, { mode:"model", model: r.model ?? catalog[0]?.id ?? null })`;
  when catalog empty AND no current model → error toast "no models available", no request.
- `save()`: use new result shape — `ok` → success toast + setConfig(result.config);
  `!ok` → `toast(error, "err")` (toast tones are "ok"|"err"|"info", toast.tsx:11-14 —
  audit fix: "danger" does not exist), keep existing config (no state overwrite).
- ModelSelect onChange unchanged (already sends model with mode).

### Tests
- `components/subagent-config/test/store.test.ts` (MODIFY): add cases —
  (a) role with saved model accepts `{mode:"model"}` alone;
  (b) fresh default role still rejects `{mode:"model"}` alone;
  (c) `{mode:"default"}` still nulls model. Update any case asserting old patch-only
  rejection semantics.
- `gui/test/handlers.test.ts` (MODIFY if it covers postSubagents): mirror case (a)/(b).

### Build/verify
- `node --test` on subagent-config + gui suites · `npm run build` (components) ·
  gui `vite build` so the live serve picks up the fixed bundle.

## Risks (audit-corrected 2026-07-03)
- setRole consumers: gui/server/handlers.ts, messenger-bridge api-compat.ts (compiled
  dist), subagent-config cli.ts:93-99, mcp.ts:82-89 — all benefit identically from
  merged validation; no per-consumer code change needed, but `npm run build` must
  rebuild dists AND long-lived processes (running `cxc serve`, MCP server) need a
  RESTART to load the new store.js (static imports at process start).
- Merged validation is strictly-stricter only for final-state invalid roles, matching
  the reconstructRole fail-safe (store.ts:49-55). Audit confirmed no existing test in
  store.test.ts / handlers.test.ts breaks; new cases are additive.
- Audit verdict: FAIL → plan fixed (toast tone "err", consumer list, restart note) →
  re-checked against audit findings: PASS.
