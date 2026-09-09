/**
 * registry.ts — record shape, daemon-free status reconciliation, and wake selection.
 *
 * There is no watcher process. `bg run` spawns a shell that writes <id>.exit when the
 * command finishes; readers reconcile from that file plus PID liveness. See contract
 * 010 "상태 판정 (데몬 없음)".
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  appendLedger,
  mtimeMs,
  atomicWrite,
  disabledPath,
  enabledAtPath,
  exitPath,
  listRecordIds,
  readJsonOrNull,
  readTextOrNull,
  recordPath,
} from "./store.js";




















/** Max completions handed over in one wake (000_plan "꺼 둔 동안 쌓인 완료 처리"). */
export const WAKE_BATCH_LIMIT = 5;

/** How long a half-written exit file is tolerated before the job is called failed. */
export const PENDING_EXIT_GRACE_MS = 15_000;

export function isRecord(value         )                    {
  if (!value || typeof value !== "object") return false;
  const r = value                           ;
  return typeof r.id === "string" && typeof r.cwd === "string" && Array.isArray(r.command) && typeof r.status === "string";
}

export function writeRecord(rec          )       {
  atomicWrite(recordPath(rec.cwd, rec.id), JSON.stringify(rec, null, 2) + "\n");
}

export function readRecord(cwd        , id        )                  {
  const raw = readJsonOrNull          (recordPath(cwd, id));
  return isRecord(raw) ? raw : null;
}

/**
 * Process start fingerprint. POSIX `ps -o lstart=` is stable across the life of a PID;
 * on Windows there is no cheap equivalent, so the token is null and reconciliation falls
 * back to liveness alone (documented limitation, 000_plan).
 */
export function processStartToken(pid        )                {
  if (process.platform === "win32") return null;
  try {
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function pidAlive(pid        )          {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means it exists but belongs to someone else — still "alive" for our purposes.
    return (err                         )?.code === "EPERM";
  }
}

/**
 * "no exit file yet" and "exit file half-written" must not look the same as "the shell
 * died without one". The shell writes atomically (tmp + mv), but a filesystem can still
 * hand us an empty read, so an unparseable body means WAIT, not FAIL.
 */


function readExitCode(cwd        , id        )           {
  const raw = readTextOrNull(exitPath(cwd, id));
  if (raw === null) return { state: "absent", code: null };
  const body = raw.trim();
  if (body.length === 0) return { state: "pending", code: null };
  const n = Number.parseInt(body, 10);
  if (!Number.isFinite(n)) return { state: "pending", code: null };
  return { state: "known", code: n };
}

/**
 * Bring a record up to date and persist the correction. Returns the reconciled record.
 * Ordering matters: the exit file is authoritative, because a recycled PID can look alive.
 */
export function reconcile(rec          , now         = new Date().toISOString())           {
  if (rec.status !== "running") return rec;
  const exit = readExitCode(rec.cwd, rec.id);
  if (exit.state === "known") {
    const code = exit.code ?? 0;
    const next           = { ...rec, status: code === 0 ? "complete" : "failed", exitCode: code, endedAt: rec.endedAt ?? now };
    writeRecord(next);
    appendLedger(rec.cwd, { event: "completed", id: rec.id, exitCode: code });
    return next;
  }
  // The shell got as far as creating the exit file, so its code is on the way. Staying
  // "running" for one more poll is far better than freezing a wrong verdict: once a
  // record leaves running we never look at the exit file again.
  //
  // Bounded, though: a truncated file that nobody will ever finish would otherwise pin
  // the job to "running" forever, so give it a grace window and then call it failed.
  if (exit.state === "pending") {
    const stamped = mtimeMs(exitPath(rec.cwd, rec.id));
    const stale = stamped !== null && Date.now() - stamped > PENDING_EXIT_GRACE_MS;
    const dead = rec.pid === null || !pidAlive(rec.pid);
    if (!(stale && dead)) return rec;
    // Fall through to the failure write below. Returning here — or letting the
    // pid === null branch catch it — would pin a truncated exit file to "running"
    // forever, which is exactly what the grace window exists to prevent.
  } else if (rec.pid === null) {
    // No pid and no exit file: nothing will ever finish this record. That happens when
    // the shell failed to spawn at all — and the async 'error' handler cannot be relied
    // on, because the CLI process may exit before its tick runs. Bound it by age rather
    // than leaving it "running" forever.
    const age = Date.now() - Date.parse(rec.startedAt);
    if (!Number.isFinite(age) || age <= PENDING_EXIT_GRACE_MS) return rec;
  } else {
    const alive = pidAlive(rec.pid);
    const tokenMatches = rec.startToken === null || processStartToken(rec.pid) === rec.startToken;
    if (alive && tokenMatches) return rec;
  }
  // Dead, or a different process now owns that PID: the shell went away without writing
  // an exit file, so the outcome is unknown and the honest status is failed.
  const next           = { ...rec, status: "failed", exitCode: null, endedAt: now };
  writeRecord(next);
  appendLedger(rec.cwd, { event: "completed", id: rec.id, exitCode: null, detail: "watcher vanished" });
  return next;
}

export function listRecords(cwd        )             {
  const out             = [];
  for (const id of listRecordIds(cwd)) {
    const rec = readRecord(cwd, id);
    if (rec) out.push(reconcile(rec));
  }
  return out;
}



export function disabledState(cwd        )                {
  const raw = readTextOrNull(disabledPath(cwd));
  if (raw === null) return { disabled: false, since: null };
  const t = raw.trim();
  return { disabled: true, since: t.length > 0 ? t : null };
}

/** Env kill switch. Only reaches sessions started after it was exported (000_plan 제1원칙). */
export function envDisabled(env                    = process.env)          {
  const v = (env.CXC_BGWAKE ?? "").trim().toLowerCase();
  return v === "0" || v === "off" || v === "false" || v === "no";
}

export function wakeSuppressed(cwd        , env                    = process.env)          {
  return envDisabled(env) || disabledState(cwd).disabled;
}

function enabledAt(cwd        )                {
  const raw = readTextOrNull(enabledAtPath(cwd));
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : null;
}

export function isTerminal(status          )          {
  return status === "complete" || status === "failed" || status === "cancelled";
}

/**
 * The five wake conditions from contract 010 "웨이크 대상 판정", in order.
 * Records are NOT mutated here; the caller stamps deliveredAt once it has emitted them.
 */
export function selectWake(cwd        , sessionId               , limit         = WAKE_BATCH_LIMIT)             {
  const gate = enabledAt(cwd);
  const eligible = listRecords(cwd).filter((rec) => {
    if (!isTerminal(rec.status)) return false;
    if (rec.deliveredAt !== null) return false;
    if (sessionId === null) return false;
    if (rec.sessionId !== sessionId && rec.adoptedBy !== sessionId) return false;
    // '<=' not '<': a job that finishes in the same millisecond as 'bg on' finished
    // during the off window, and a one-millisecond race should not turn into a wake.
    if (gate !== null && rec.endedAt !== null && rec.endedAt <= gate) return false;
    return true;
  });
  eligible.sort((a, b) => String(a.endedAt ?? "").localeCompare(String(b.endedAt ?? "")));
  return eligible.slice(0, Math.max(0, limit));
}

/**
 * Stamps each record independently. If one write fails the others still land, and the
 * failed one simply stays undelivered so a later wake picks it up — a re-wake is much
 * cheaper than a silently dropped completion.
 */
export function markDelivered(records            , now         = new Date().toISOString())             {
  const stamped             = [];
  for (const rec of records) {
    try {
      writeRecord({ ...rec, deliveredAt: now });
      appendLedger(rec.cwd, { event: "delivered", id: rec.id, sessionId: rec.adoptedBy ?? rec.sessionId });
      stamped.push(rec);
    } catch {
      // leave it undelivered
    }
  }
  return stamped;
}

/**
 * Adoption (contract 010 "인수 규칙"): after a restart the registering session is gone,
 * so undelivered completions would never wake anyone. Hand them to the live session.
 * Adoption is not delivery — a later Stop/UserPromptSubmit still does that.
 */
export function adoptOrphans(cwd        , sessionId               , now         = new Date().toISOString())             {
  if (sessionId === null) return [];
  const adopted             = [];
  for (const rec of listRecords(cwd)) {
    if (!isTerminal(rec.status)) continue;
    if (rec.deliveredAt !== null) continue;
    if (rec.sessionId === sessionId || rec.adoptedBy === sessionId) continue;
    const next           = { ...rec, adoptedBy: sessionId };
    writeRecord(next);
    appendLedger(cwd, { event: "adopted", id: rec.id, sessionId, at: now });
    adopted.push(next);
  }
  return adopted;
}

/**
 * Counts PARSEABLE records owned by this session, not .json files. A directory holding
 * unreadable junk, or only another session's jobs, should stay quiet rather than
 * advertise a registry this session cannot act on.
 */
export function hasAnyTask(cwd        , sessionId                = null)          {
  const records = listRecords(cwd);
  if (sessionId === null) return records.length > 0;
  return records.some((r) => r.sessionId === sessionId || r.adoptedBy === sessionId);
}

export function durationLabel(rec          )         {
  if (rec.endedAt === null) return "running";
  const ms = Date.parse(rec.endedAt) - Date.parse(rec.startedAt);
  if (!Number.isFinite(ms) || ms < 0) return "?";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  return m + "m" + String(s % 60).padStart(2, "0") + "s";
}

export function describeRecord(rec          )         {
  const code = rec.exitCode === null ? "exit ?" : "exit " + rec.exitCode;
  return "- " + rec.id + " (" + rec.status + ", " + code + ", " + durationLabel(rec) + ") — " + rec.command.join(" ");
}

export function recordExists(cwd        , id        )          {
  return existsSync(recordPath(cwd, id));
}

