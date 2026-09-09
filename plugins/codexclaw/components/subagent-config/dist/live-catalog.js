/** Read-only OCX discovery with a shared, bounded-age last-success cache. */
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readNativeCatalog, reasoningEfforts,                                 } from "./catalog.js";
import { cxcHome } from "./store.js";
import { commandInvocation } from "./win-exec.js";
import { renameWithRetry } from "./atomic-write.js";

export const CATALOG_TTL_MS = 30_000;













const pending = new Map                              ();

export function runOcxModels(env                   )                  {
  const invocation = commandInvocation("ocx", ["models", "live", "--json"], process.platform, env);
  return new Promise((resolve, reject) => {
    execFile(invocation.file, invocation.args, {
      ...invocation.options, env, encoding: "utf8", timeout: 12_000,
      killSignal: "SIGKILL", maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
}

export function parseOcxModels(stdout        )                 {
  const parsed          = JSON.parse(stdout);
  if (!Array.isArray(parsed)) throw new Error("invalid OCX catalog");
  const seen = new Set        ();
  return parsed.flatMap(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid OCX model row");
    const row = raw                           ;
    if (row.disabled === true || row.initialSelectionPending === true) return [];
    const id = typeof row.namespaced === "string" ? row.namespaced : row.native === true ? row.id : undefined;
    if (typeof id !== "string" || !id.trim()) throw new Error("invalid OCX model id");
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, source: row.native === true ? "native"          : "ocx"         ,
      label: typeof row.displayName === "string" && row.displayName.trim() ? `${row.displayName} (${id})` : id,
      reasoningEfforts: reasoningEfforts(row.reasoningEfforts) }];
  });
}

function sourceKey(env                   )         {
  return createHash("sha256").update(JSON.stringify([
    env.CODEX_HOME ?? "", env.CODEX_MODELS_CACHE_PATH ?? "", env.PATH ?? env.Path ?? "", env.OPENCODEX_HOME ?? "",
  ])).digest("hex");
}
function cachedCatalog(path        , key        , now        )                     {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const c = raw.catalog               ;
    if (raw.key !== key || !c || c.status !== "fresh" || !["ocx", "native"].includes(c.source) || !Array.isArray(c.entries)) return null;
    if (!c.fetchedAt || !Number.isFinite(Date.parse(c.fetchedAt)) || Date.parse(c.fetchedAt) > now + 1000) return null;
    if (!c.entries.every(entry => entry && typeof entry.id === "string" && entry.id.length && typeof entry.label === "string"
      && ["ocx", "native"].includes(entry.source) && (entry.reasoningEfforts === null || Array.isArray(entry.reasoningEfforts) && entry.reasoningEfforts.every(e => typeof e === "string")))) return null;
    return c;
  } catch { return null; }
}
function persist(path        , key        , catalog             , home        )          {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    mkdirSync(home, { recursive: true, mode: 0o700 });
    writeFileSync(temp, JSON.stringify({ key, catalog }) + "\n", { flag: "wx", mode: 0o600 });
    renameWithRetry(temp, path);
    return true;
  } catch { return false; }
  finally { try { rmSync(temp, { force: true }); } catch { /* best-effort own temp cleanup */ } }
}

/** Project cwd never participates in cache identity. Explicit CXC home isolates all state. */
export async function readCatalog(options                 = {})                       {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const home = cxcHome(env);
  const path = join(home, "model-catalog.json");
  const key = sourceKey(env);
  const pendingKey = `${path}:${key}`;
  const running = pending.get(pendingKey);
  if (running) return running;
  const cached = cachedCatalog(path, key, now());
  if (!options.forceRefresh && cached && now() - Date.parse(cached.fetchedAt ) < CATALOG_TTL_MS) return cached;
  const query = async ()                       => {
    let source                   = "ocx";
    try {
      let entries                ;
      try { entries = parseOcxModels(await (options.runOcx ?? runOcxModels)(env)); }
      catch (error) {
        if ((error                         ).code !== "ENOENT") throw error;
        source = "native";
        const native = (options.readNative ?? readNativeCatalog)(env);
        if (native === null) throw new Error("native catalog unavailable");
        entries = native;
      }
      if (source === "ocx") {
        const seen = new Set(entries.map(entry => entry.id));
        for (const entry of readNativeCatalog(env, true) ?? []) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          entries.push(entry);
        }
      }
      const catalog              = { state: source === "ocx" ? "ocx-active" : "native-catalog", entries,
        status: "fresh", source, fetchedAt: new Date(now()).toISOString() };
      if (!persist(path, key, catalog, home)) catalog.message = "Model list loaded; its cache could not be saved.";
      return catalog;
    } catch {
      const message = source === "ocx" ? "OCX model discovery failed. Check OCX and refresh." : "Codex model catalog is unavailable. Check its configured path and refresh.";
      return cached ? { ...cached, status: "stale", message: `${message} Showing the last successful list.` }
        : { state: "unavailable", entries: [], status: "unavailable", source, fetchedAt: null, message };
    }
  };
  const request = query();
  pending.set(pendingKey, request);
  try { return await request; } finally { pending.delete(pendingKey); }
}
