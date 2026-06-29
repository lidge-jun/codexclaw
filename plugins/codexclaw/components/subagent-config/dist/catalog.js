/**
 * catalog.ts — selectable model catalog (L25 / 250-252).
 *
 * Source = Codex-native catalog (always) + ocx-backed models (when ocx is
 * detected and exposes a catalog). Native entries come first; entries are
 * deduplicated by stable model id keeping the native one. No network fetch, no
 * vendored ocx files, no selected-model persistence (L24 owns that).
 *
 * Native source: the Codex live catalog cache at CODEX_MODELS_CACHE_PATH, read
 * through an allowlist. When the cache is absent/unreadable, fall back to the
 * documented NATIVE_OPENAI_MODELS set (opencodex src/codex-catalog.ts:44).
 */
import { existsSync, readFileSync } from "node:fs";

export const NATIVE_OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"]         ;

                                           

                               
             
                      
                
 

                                                                                       

                          
                      
                          
 

/** Provider status as exposed by the L23 bridge (subset this loop needs). */
                                       
                                                                        
                                        
                                                                               
                                                                                
                       
 

                              
                                                                            
                                          
                                               
                                        
 

/** Read the Codex live catalog cache (CODEX_MODELS_CACHE_PATH) through the
 *  allowlist. Returns ids or null when absent/unreadable. */
export function readNativeCacheDefault(env                    = process.env)                  {
  const path = env.CODEX_MODELS_CACHE_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"))           ;
    const list = Array.isArray(parsed) ? parsed : (parsed                        )?.models;
    if (!Array.isArray(list)) return null;
    const ids = list
      .map((m) => (typeof m === "string" ? m : typeof (m                    )?.id === "string" ? (m                  ).id : null))
      .filter((x)              => typeof x === "string");
    // allowlist: only ship ids that are in the documented native set.
    const allowed = ids.filter((id) => (NATIVE_OPENAI_MODELS                     ).includes(id));
    return allowed.length ? allowed : null;
  } catch {
    return null;
  }
}

function nativeEntries(deps             )                 {
  const ids = (deps.readNativeCache ?? readNativeCacheDefault)() ?? [...NATIVE_OPENAI_MODELS];
  return ids.map((id) => ({ id, source: "native"         , label: `${id} (native)` }));
}

/**
 * Build the merged catalog. Native first, ocx appended, dedup by id keeping
 * native. ocx present-but-no-catalog -> unsupported-ocx-catalog state.
 */
export function buildCatalog(deps              = {})          {
  const native = nativeEntries(deps);
  const status = deps.providerStatus;

  if (!status || status.mode !== "provider") {
    return { state: "native-catalog", entries: native };
  }

  // ocx is active. If it exposes no catalog interface, report unsupported.
  if (status.ocxModels === undefined) {
    return { state: "unsupported-ocx-catalog", entries: native };
  }

  const seen = new Set(native.map((e) => e.id));
  const ocx                 = [];
  for (const id of status.ocxModels) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (seen.has(id)) continue; // dedup, native wins
    seen.add(id);
    ocx.push({ id, source: "ocx", label: `${id} (ocx)` });
  }
  return { state: "ocx-active", entries: [...native, ...ocx] };
}
