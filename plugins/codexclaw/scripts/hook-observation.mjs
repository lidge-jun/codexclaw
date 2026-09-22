/** Metadata-only invocation diagnostics, not authenticated host attestations.
 * Latest records are partitioned by session, actor and entrypoint/event. No
 * payload, prompt or handler result is retained. Writers never affect hooks.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const MAX_RAW_BYTES = 4 * 1024 * 1024;
const MAX_RECORD_BYTES = 8192;
export const HOOK_OBSERVATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const metadata = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x20\x7f]/.test(value);
const slug = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,95}$/.test(value);
const home = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');
const actorDir = (codexHome, sessionId, agentId) => join(codexHome, 'codexclaw', 'hook-observations', digest(sessionId), digest(JSON.stringify(agentId)));

function readBounded(path, max = MAX_RECORD_BYTES) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > max) throw new Error('invalid observation input file');
  return readFileSync(path, 'utf8');
}

function payloadIdentity(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_RAW_BYTES) return null;
  const payload = JSON.parse(raw);
  if (!payload || Array.isArray(payload) || !metadata(payload.session_id)) return null;
  const agentId = payload.agent_id ?? null;
  if (agentId !== null && !metadata(agentId)) return null;
  // A child stamp without its identity must never become a root observation.
  if (payload.agent_type && agentId === null) return null;
  return { sessionId: payload.session_id, agentId };
}

function payloadVersion(pluginRoot) {
  const manifest = readBounded(join(pluginRoot, '.codex-plugin/plugin.json'), MAX_RAW_BYTES);
  const version = JSON.parse(manifest).version;
  if (!metadata(version)) throw new Error('missing plugin version');
  return { pluginVersion: version, manifestDigest: digest(manifest) };
}

function entryPath(pluginRoot, entrypoint, component) {
  if (!slug(component) || typeof entrypoint !== 'string') throw new Error('invalid entrypoint');
  const pattern = new RegExp(`^components/${component}/(?:src|dist)/[a-z0-9-]+\\.(?:ts|js)$`);
  if (!pattern.test(entrypoint)) throw new Error('invalid component entrypoint');
  const path = realpathSync(join(pluginRoot, entrypoint));
  if (!path.startsWith(pluginRoot + sep)) throw new Error('entrypoint outside payload');
  return path;
}

/** Called only at the CLI ingress, after its single stdin read. Returns a
 * boolean for diagnostic callers; storage failure never writes to either stream.
 */
export function recordHookInvocation(raw, component, event, entrypoint) {
  let temporary;
  try {
    const identity = payloadIdentity(raw);
    if (!identity || !slug(component) || !slug(event)) return false;
    const absolute = entrypoint.startsWith('file:') ? fileURLToPath(entrypoint) : resolve(entrypoint);
    const pluginRoot = realpathSync(resolve(dirname(absolute), '../../..'));
    const local = relative(pluginRoot, realpathSync(absolute)).split(sep).join('/');
    const target = entryPath(pluginRoot, local, component);
    const record = {
      schemaVersion: 1, ...identity, component, event,
      observedAt: new Date().toISOString(), pluginRoot, ...payloadVersion(pluginRoot),
      entrypoint: local, entrypointDigest: digest(readBounded(target, MAX_RAW_BYTES)), outcome: 'invoked',
    };
    const directory = actorDir(home(), identity.sessionId, identity.agentId);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const destination = join(directory, digest(JSON.stringify([component, event, local])) + '.json');
    temporary = join(directory, `.${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, destination);
    temporary = undefined;
    return true;
  } catch {
    // Diagnostics must not change the original handler's stdout or exit status.
    return false;
  } finally {
    if (temporary) { try { unlinkSync(temporary); } catch { /* best effort own temporary only */ } }
  }
}

/** Explicit actor and freshness filter; no fallback to another session/actor. */
export function readHookObservations({ pluginRoot, codexHome = home(), sessionId, agentId = null,
  now = Date.now(), maxAgeMs = HOOK_OBSERVATION_MAX_AGE_MS }) {
  const result = { observations: [], ignored: 0, reason: null };
  if (!metadata(sessionId) || (agentId !== null && !metadata(agentId))) {
    return { ...result, reason: 'session/actor identity unavailable' };
  }
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    return { ...result, reason: 'invalid freshness filter' };
  }
  try {
    pluginRoot = realpathSync(pluginRoot);
    const version = payloadVersion(pluginRoot);
    const directory = actorDir(codexHome, sessionId, agentId);
    let files;
    try { files = readdirSync(directory); }
    catch (error) {
      return { ...result, reason: error.code === 'ENOENT' ? 'no invocation records' : 'invocation store unreadable' };
    }
    for (const name of files) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      try {
        const record = JSON.parse(readBounded(join(directory, name)));
        if (record.schemaVersion !== 1 || record.outcome !== 'invoked' || record.sessionId !== sessionId ||
          record.agentId !== agentId || record.pluginRoot !== pluginRoot ||
          record.pluginVersion !== version.pluginVersion || record.manifestDigest !== version.manifestDigest ||
          !slug(record.component) || !slug(record.event)) throw new Error('mismatched observation');
        if (typeof record.observedAt !== 'string') throw new Error('invalid observation time');
        const when = Date.parse(record.observedAt);
        if (!Number.isFinite(when) || when > now || now - when > maxAgeMs) throw new Error('stale observation');
        const target = entryPath(pluginRoot, record.entrypoint, record.component);
        if (record.entrypointDigest !== digest(readBounded(target, MAX_RAW_BYTES))) throw new Error('changed entrypoint');
        if (name !== digest(JSON.stringify([record.component, record.event, record.entrypoint])) + '.json') throw new Error('wrong slot');
        // Project only approved metadata even if a same-user writer added fields.
        result.observations.push({ sessionId, agentId, component: record.component, event: record.event,
          observedAt: record.observedAt, entrypoint: record.entrypoint, outcome: 'invoked' });
      } catch { result.ignored++; }
    }
    result.observations.sort((a, b) => a.entrypoint.localeCompare(b.entrypoint) || a.event.localeCompare(b.event));
    return result;
  } catch {
    return { ...result, reason: 'payload or invocation store unreadable' };
  }
}
