/** Shared browser/MCP settings contract. Scope paths are host-owned, never request paths. */
import { configScope, readSettings, resetRole, setRole, ROLES,                                      } from './store.js';

export function getSettings(cwd        , scope          )                   {
  return readSettings(cwd, configScope(scope));
}

export function updateSettings(cwd        , body         )                   {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('missing body');
  const b = body                           ;
  const role = b.role            ;
  if (!ROLES.includes(role)) throw new Error(`unknown role "${String(b.role)}"`);
  const scope = configScope(b.scope);
  if (b.inherit !== undefined && typeof b.inherit !== 'boolean') throw new Error('inherit must be a boolean');
  const patch                          = {};
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

export function settingsResponse(operation                        )                                    {
  try { return { status: 200, body: operation() }; }
  catch (err) { return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } }; }
}
