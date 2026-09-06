import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveNativeSession } from "./session-binding.js";
import { ALL_PHASES, ensureState, SESSIONS_SUBDIR, STATE_DIR,            } from "./state.js";





/** Read raw identity before any defaulting/normalization by readState. */
function inspectState(cwd        , sessionId        )             {
  const root = join(cwd, STATE_DIR);
  const dir = join(root, SESSIONS_SUBDIR);
  const path = join(dir, `${sessionId}.json`);
  try {
    for (const directory of [root, dir]) {
      let stat;
      try { stat = lstatSync(directory); }
      catch (err) {
        if ((err                         ).code === "ENOENT") return { ok: true, stateExists: false, phase: null };
        throw err;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        return { ok: false, error: "State directories must be real directories, not symlinks or non-directory files." };
      }
    }
    let stat;
    try { stat = lstatSync(path); }
    catch (err) {
      if ((err                         ).code === "ENOENT") return { ok: true, stateExists: false, phase: null };
      throw err;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, error: "State must be a regular file, not a symlink or directory." };
    }
    // Recheck the opened file so a replaced symlink/FIFO cannot redirect/block
    // this read. Parent-directory tampering by a hostile same-user is out of scope.
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let parsed         ;
    try {
      if (!fstatSync(fd).isFile()) return { ok: false, error: "State must be a regular file." };
      parsed = JSON.parse(readFileSync(fd, "utf8"));
    } finally { closeSync(fd); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "State JSON is corrupt; existing bytes were preserved." };
    }
    const state = parsed                           ;
    if (state.sessionId !== sessionId) {
      return { ok: false, error: "State sessionId does not match the native session; existing bytes were preserved." };
    }
    if (typeof state.phase !== "string" || !ALL_PHASES.includes(state.phase         )) {
      return { ok: false, error: "State phase is invalid; existing bytes were preserved." };
    }
    return { ok: true, stateExists: true, phase: state.phase          };
  } catch {
    return { ok: false, error: "State is unreadable or corrupt; existing bytes were preserved. Inspect the state file before retrying." };
  }
}

export function runSessionCli(argv          , cwd        , env                    = process.env)                                   {
  const json = argv.includes("--json");
  const fail = (error        ) => ({
    code: 1,
    output: json ? JSON.stringify({ ok: false, error, hooksVerified: false }) : `${error}\nhooksVerified: false`,
  });
  const [command, ...flags] = argv;
  if ((command !== "current" && command !== "bind") || flags.length > 1 || (flags.length === 1 && flags[0] !== "--json")) {
    return fail("Usage: cxc session current [--json] | cxc session bind [--json]");
  }
  const identity = resolveNativeSession(cwd, env);
  if (!identity.ok) return fail(identity.error);
  let state = inspectState(identity.cwd, identity.sessionId);
  if (!state.ok) return fail(state.error);
  let created = false;
  if (command === "bind") {
    try {
      created = ensureState(identity.cwd, identity.sessionId);
    } catch {
      return fail("Could not create session state exclusively. Check state directory access and retry; no existing state was reset.");
    }
    // A concurrent creator may have won. Validate its bytes too; do not report
    // success merely because ensureState returned false for an existing path.
    state = inspectState(identity.cwd, identity.sessionId);
    if (!state.ok) return fail(state.error);
    if (!state.stateExists) return fail("Session state disappeared during bind. Retry after the concurrent operation finishes.");
  }
  const output = {
    ok: true,
    sessionId: identity.sessionId,
    cwd: identity.cwd,
    source: "CODEX_THREAD_ID",
    dbPath: identity.dbPath,
    statePath: join(identity.cwd, STATE_DIR, SESSIONS_SUBDIR, `${identity.sessionId}.json`),
    stateExists: state.stateExists,
    phase: state.phase,
    created,
    hooksVerified: false,
  };
  return {
    code: 0,
    output: json ? JSON.stringify(output) : Object.entries(output).map(([key, value]) => `${key}: ${value}`).join("\n"),
  };
}
