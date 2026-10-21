/**
 * pr-record.ts — a merged or green pull request as the completion record (261022).
 *
 * The incident: work was done, its PR merged and CI green, and the gates still
 * refused twice in one day. SOURCE-DELTA-01 refused B>C because the checkout no
 * longer differed from what it was on entry to B (the change had already landed),
 * and GOAL-COMPLETE-GATE-01 then refused completion because that cycle could not
 * close and the bound goalplan's receipts described a source that had moved on.
 *
 * A PR that merged, or that is open with every check passing, is stronger
 * evidence of delivered work than a local receipt. `cxc loop pr-record` verifies
 * that once, through `gh pr view`, and writes a session-scoped record under the
 * evidence root. The hooks then read only that local file: no network call ever
 * runs inside a hook, so the gates stay fast and deterministic.
 *
 * What the record waives and what it does not:
 *  - waives: a cycle still in flight, unfinished work phases, unmet criteria,
 *    and receipt/source checks of the bound plan (GOAL-COMPLETE-GATE-01), and
 *    the unchanged-source refusal at B>C when recorded during the current B.
 *  - keeps: unreadable session state, unverified subagent verdicts, and every
 *    structural plan defect (goalplanStructuralReasons). A PR cannot launder
 *    delegated work nobody verified, and a broken plan still has to be repaired.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { evidenceDir } from "./state-root.js";
import { isCanonicalSessionId } from "./state.js";
import { renameWithRetry } from "./atomic-write.js";


















/** The subset of `gh pr view --json` this module reads. */










export const GH_PR_FIELDS = "url,number,state,mergedAt,mergeCommit,headRefOid,statusCheckRollup";

const PASSING = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

function str(v         )                {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** One rollup entry as name + outcome; CheckRun and StatusContext shapes both occur. */
function checkOutcome(entry         )                                                                     {
  const e = (typeof entry === "object" && entry !== null ? entry : {})                           ;
  const name = str(e.name) ?? str(e.context) ?? "check";
  if (str(e.__typename) === "StatusContext" || (e.state !== undefined && e.conclusion === undefined)) {
    const state = (str(e.state) ?? "PENDING").toUpperCase();
    return { name, outcome: state, passing: state === "SUCCESS", done: state !== "PENDING" && state !== "EXPECTED" };
  }
  const status = (str(e.status) ?? "").toUpperCase();
  const conclusion = (str(e.conclusion) ?? "").toUpperCase();
  const done = status === "COMPLETED";
  return { name, outcome: done ? conclusion || "UNKNOWN" : status || "PENDING", passing: done && PASSING.has(conclusion), done };
}





/** Merged, or open with a non-empty set of finished, passing checks. Nothing else. */
export function classifyPr(view          )                   {
  const state = (str(view.state) ?? "").toUpperCase();
  const rollup = Array.isArray(view.statusCheckRollup) ? view.statusCheckRollup : [];
  const checks = rollup.map(checkOutcome);
  const summary = checks.map((c) => ({ name: c.name, outcome: c.outcome }));
  if (state === "MERGED" && str(view.mergedAt)) return { ok: true, verdict: "merged", checks: summary };
  if (state !== "OPEN") return { ok: false, reason: "PR is " + (state || "in an unknown state").toLowerCase() + ", neither merged nor open" };
  if (checks.length === 0) return { ok: false, reason: "PR is open with no checks, so it is not green" };
  const pending = checks.filter((c) => !c.done).map((c) => c.name);
  if (pending.length > 0) return { ok: false, reason: "PR is open with checks still running: " + pending.slice(0, 5).join(", ") };
  const failing = checks.filter((c) => !c.passing).map((c) => c.name + "=" + c.outcome);
  if (failing.length > 0) return { ok: false, reason: "PR is open with failing checks: " + failing.slice(0, 5).join(", ") };
  return { ok: true, verdict: "green", checks: summary };
}

export function prRecordPath(cwd        , sessionId        )         {
  return join(evidenceDir(cwd), "pr-records", sessionId + ".json");
}

/** The session's record, or null when absent, unreadable, or not this session's. */
export function readPrRecord(cwd        , sessionId        )                  {
  try {
    if (!isCanonicalSessionId(sessionId)) return null;
    const path = prRecordPath(cwd, sessionId);
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, "utf8"))                     ;
    if (raw.schema !== 1 || raw.sessionId !== sessionId) return null;
    if (raw.verdict !== "merged" && raw.verdict !== "green") return null;
    if (typeof raw.url !== "string" || typeof raw.recordedAt !== "string" || Number.isNaN(Date.parse(raw.recordedAt))) return null;
    return raw            ;
  } catch {
    return null;
  }
}

/** True when the record was made at or after `sinceIso` (B entry for SOURCE-DELTA-01). */
export function prRecordSince(record                 , sinceIso                    )          {
  if (!record || !sinceIso) return false;
  const since = Date.parse(sinceIso);
  return !Number.isNaN(since) && Date.parse(record.recordedAt) >= since;
}



export const ghPrView           = (pr, cwd) => {
  const run = spawnSync("gh", ["pr", "view", pr, "--json", GH_PR_FIELDS], { cwd, encoding: "utf8", timeout: 30_000 });
  if (run.error) return { ok: false, error: "gh could not run: " + run.error.message };
  if (run.status !== 0) return { ok: false, error: "gh pr view failed: " + String(run.stderr || run.stdout).trim().slice(0, 300) };
  try {
    return { ok: true, view: JSON.parse(run.stdout)             };
  } catch {
    return { ok: false, error: "gh pr view returned unreadable JSON" };
  }
};







/** `cxc loop pr-record --session <id> --pr <url|number>`. */
export function runPrRecord(
  cwd        ,
  sessionId        ,
  pr        ,
  deps                                          = {},
)                    {
  if (!isCanonicalSessionId(sessionId)) return { code: 1, output: "loop pr-record: session id is not canonical" };
  if (pr.trim() === "") return { code: 1, output: "loop pr-record: --pr <url|number> is required" };
  const fetched = (deps.view ?? ghPrView)(pr.trim(), cwd);
  if (!fetched.ok) return { code: 1, output: "loop pr-record: " + fetched.error + "\nNothing was written." };
  const verdict = classifyPr(fetched.view);
  if (!verdict.ok) return { code: 1, output: "loop pr-record: " + verdict.reason + "\nNothing was written." };
  const mergeCommit = fetched.view.mergeCommit                                        ;
  const record           = {
    schema: 1,
    sessionId,
    url: str(fetched.view.url) ?? pr.trim(),
    number: Number(fetched.view.number ?? 0),
    verdict: verdict.verdict,
    state: str(fetched.view.state) ?? "",
    mergedAt: str(fetched.view.mergedAt),
    mergeCommit: mergeCommit && typeof mergeCommit === "object" ? str(mergeCommit.oid) : null,
    headRefOid: str(fetched.view.headRefOid),
    checks: verdict.checks,
    recordedAt: (deps.now ?? (() => new Date().toISOString()))(),
  };
  const path = prRecordPath(cwd, sessionId);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify(record, null, 2) + "\n");
  renameWithRetry(tmp, path);
  return {
    code: 0,
    record,
    output: "[codexclaw loop pr-record] " + record.url + " is " + record.verdict + "; recorded as this session's completion record (" + path + ")",
  };
}
