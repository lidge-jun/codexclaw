/** Shared browser/MCP settings contract. Scope paths are host-owned, never request paths. */
import { configScope, readSettings, resetRole, setRole, ROLES, type RoleName, type SubagentSettings } from './store.ts';

export function getSettings(cwd: string, scope?: unknown): SubagentSettings {
  return readSettings(cwd, configScope(scope));
}

export function updateSettings(cwd: string, body: unknown): SubagentSettings {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('missing body');
  const b = body as Record<string, unknown>;
  const role = b.role as RoleName;
  if (!ROLES.includes(role)) throw new Error(`unknown role "${String(b.role)}"`);
  const scope = configScope(b.scope);
  if (b.inherit !== undefined && typeof b.inherit !== 'boolean') throw new Error('inherit must be a boolean');
  const patch: Record<string, unknown> = {};
  for (const key of ['mode', 'model', 'effort', 'promptOverride']) {
    if (b[key] !== undefined) patch[key] = b[key];
  }
  if (b.inherit === true) {
    if (Object.keys(patch).length) throw new Error('inherit cannot be combined with role settings');
    resetRole(cwd, role, scope);
  } else {
    setRole(cwd, role, patch, scope);
  }
  return readSettings(cwd, scope);
}

export function settingsResponse(operation: () => SubagentSettings): { status: number; body: unknown } {
  try { return { status: 200, body: operation() }; }
  catch (err) { return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } }; }
}
