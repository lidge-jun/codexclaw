import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";

                                                      
export const PHASES                   = ["I", "P", "A", "B", "C", "D"];

                        
                     
                       
                       
 

                        
               
                    
               
                    
               
                              
                          
                                  
                               
 

                              
             
                    
                     
            
                 
                    
 

export const STATE_DIR = ".codexclaw";
export const SESSIONS_SUBDIR = "sessions";
export const LEDGER_FILE = "ledger.jsonl";

export function sanitizeKey(value        )         {
  const sanitized = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "missing";
}

export function defaultState(sessionId        , slug = "")        {
  return {
    phase: "I",
    sessionId,
    slug,
    updatedAt: new Date().toISOString(),
    flags: { interview: false, auditPassed: false, checkPassed: false },
    supersededBy: null,
    injectedTurns: [],
    lastInjectedPhase: null,
    orchestrationActive: false,
  };
}

function sessionsDir(cwd        )         {
  return join(cwd, STATE_DIR, SESSIONS_SUBDIR);
}

function statePath(cwd        , sessionId        )         {
  return join(sessionsDir(cwd), `${sanitizeKey(sessionId)}.json`);
}

export function readState(cwd        , sessionId        )        {
  try {
    const raw = readFileSync(statePath(cwd, sessionId), "utf8");
    const parsed = JSON.parse(raw)                         ;
    if (!parsed || typeof parsed.phase !== "string" || !PHASES.includes(parsed.phase         )) {
      return defaultState(sessionId);
    }
    const base = defaultState(sessionId, typeof parsed.slug === "string" ? parsed.slug : "");
    // strict reconstruction: only known fields survive (omo-style discipline, no unknown-key passthrough)
    return {
      phase: parsed.phase         ,
      sessionId,
      slug: base.slug,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : base.updatedAt,
      flags: {
        interview: parsed.flags?.interview === true,
        auditPassed: parsed.flags?.auditPassed === true,
        checkPassed: parsed.flags?.checkPassed === true,
      },
      supersededBy: typeof parsed.supersededBy === "string" ? parsed.supersededBy : null,
      injectedTurns:
        Array.isArray(parsed.injectedTurns) && parsed.injectedTurns.every((x) => typeof x === "string")
          ? parsed.injectedTurns
          : [],
      lastInjectedPhase:
        typeof parsed.lastInjectedPhase === "string" && PHASES.includes(parsed.lastInjectedPhase         )
          ? (parsed.lastInjectedPhase         )
          : null,
      orchestrationActive: parsed.orchestrationActive === true,
    };
  } catch {
    return defaultState(sessionId);
  }
}

export function writeState(cwd        , next       )       {
  const dir = sessionsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const finalPath = statePath(cwd, next.sessionId);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2));
    renameSync(tmp, finalPath);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup of orphan tmp; ignore
    }
    throw err;
  }
}

export function appendLedger(cwd        , entry             )       {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LEDGER_FILE), `${JSON.stringify(entry)}\n`);
}
