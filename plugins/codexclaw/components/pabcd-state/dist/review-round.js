/**
 * review-round.ts — round lifecycle for plan audits and final gates (WP10 / plan 010).
 *
 * A->B today accepts a pasted reviewer verdict and the main agent's own call, so
 * approving a plan, editing it, and then entering B on that approval all passes.
 * Provenance is unprovable, but round identity and the plan hash are locally
 * checkable facts, and this module makes them durable.
 *
 * Pure: every function takes a Goalplan and returns a new one. No file IO — the
 * caller reads the plan document and computes its sha256, and the caller persists
 * the result with writeGoalplan.
 *
 * This slice ships the state machine only. Wiring it into the A->B attest gate
 * needs the CLI to exist first; turning the gate on before then would demand a
 * `review-round open` that nobody can run.
 */






















const TERMINAL                                 = new Set(["approved", "changes_requested", "inconclusive"]);

/**
 * pass and near-pass both approve. A near-pass whose blockers were folded into
 * the plan changes the document, so its planSha256 no longer matches and
 * `staleness` reports "stale" — freshness, not status, is what actually gates
 * the next A->B. That is intended: an edited plan deserves another look.
 */
const TERMINAL_FOR_VERDICT                                           = {
  pass: "approved",
  "near-pass": "approved",
  fail: "changes_requested",
};

function cursorField(purpose               )                                                      {
  return purpose === "plan_audit" ? "activePlanAuditRoundId" : "activeFinalGateRoundId";
}

function rounds(plan          )                     {
  return plan.reviewRounds ?? [];
}

function roundOrder(roundId        )         {
  const n = Number.parseInt(roundId.replace(/^r/, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The live round for a purpose.
 *
 * The cursor is a hint, not the truth: it can dangle, point at a terminal round,
 * or name another purpose after a hand edit or a partial write. In that case we
 * recover from the list, the same way effectiveActiveWorkPhaseId does. When more
 * than one non-terminal round survives, the highest id wins.
 */
export function effectiveRound(plan          , purpose               )                          {
  const all = rounds(plan);
  const cursor = plan[cursorField(purpose)];
  if (cursor) {
    const hit = all.find((r) => r.roundId === cursor);
    if (hit && hit.purpose === purpose && !TERMINAL.has(hit.status)) return hit;
  }
  const open = all.filter((r) => r.purpose === purpose && !TERMINAL.has(r.status));
  if (open.length === 0) return null;
  return open.reduce((best, r) => (roundOrder(r.roundId) > roundOrder(best.roundId) ? r : best));
}

function withRounds(plan          , next                    , purpose               , cursor                    )           {
  const out           = { ...plan, reviewRounds: next };
  if (cursor === undefined) delete out[cursorField(purpose)];
  else out[cursorField(purpose)] = cursor;
  return out;
}

function replaceRound(list                    , updated                  )                     {
  return list.map((r) => (r.roundId === updated.roundId ? updated : r));
}

function nextRoundId(plan          )         {
  const highest = rounds(plan).reduce((n, r) => Math.max(n, roundOrder(r.roundId)), 0);
  return `r${highest + 1}`;
}

function mintLaunchId(roundId        , now        )         {
  return `${roundId}-${now.replace(/[^0-9]/g, "").slice(0, 14)}`;
}









/**
 * Open a round for a purpose.
 *
 * A live `launching` or `in_flight` round is closed as `inconclusive` rather than
 * refused. Processes die before their receipt lands, and a gate that then needs a
 * human to tidy state becomes a gate that blocks work. The closed round stays in
 * the list, so the history is still auditable.
 *
 * A `pending` round is reused when it targets the same document — nothing has
 * been launched yet, so only the hash needs refreshing. A different planPath
 * means a different audit, so that pending round is closed too.
 */
export function openRound(plan          , input                )                    {
  if (!input.planSha256) {
    return { kind: "invalid_input", reason: "planSha256 is required: a round without a plan hash cannot be judged fresh or stale" };
  }
  if (!input.planPath) {
    return { kind: "invalid_input", reason: "planPath is required" };
  }
  const now = input.now?.() ?? new Date().toISOString();
  let list = rounds(plan).slice();

  const live = effectiveRound(plan, input.purpose);
  if (live && live.status === "pending" && live.planPath === input.planPath) {
    const refreshed                   = { ...live, planSha256: input.planSha256 };
    list = replaceRound(list, refreshed);
    return { kind: "ok", plan: withRounds(plan, list, input.purpose, refreshed.roundId), round: refreshed };
  }

  // close every non-terminal round of this purpose, not just the cursor one
  list = list.map((r) =>
    r.purpose === input.purpose && !TERMINAL.has(r.status)
      ? { ...r, status: "inconclusive"                     , closedAt: now }
      : r,
  );

  const roundId = nextRoundId(plan);
  const round                   = {
    roundId,
    purpose: input.purpose,
    planPath: input.planPath,
    planSha256: input.planSha256,
    status: "pending",
    lane: { launchId: mintLaunchId(roundId, now) },
    openedAt: now,
  };
  list.push(round);
  return { kind: "ok", plan: withRounds(plan, list, input.purpose, roundId), round };
}

/**
 * The round a launch id belongs to, whatever the cursor says.
 *
 * A sign-off names its own round. Asking which round is "active" instead is how a
 * verdict ended up landing nowhere: the observer read the cursor while the gate
 * read the highest round, and a reviewer answering the second one was dropped in
 * silence.
 */
export function roundByLaunchId(plan          , purpose               , launchId        )                          {
  if (!launchId) return null;
  return rounds(plan).find((r) => r.purpose === purpose && r.lane.launchId === launchId) ?? null;
}

/**
 * True when a later round of the same purpose exists.
 *
 * Ordering, not status: a round left in_flight while a newer one opened is still
 * superseded, and reading status alone would call that a CAS failure instead.
 */
function isSuperseded(plan          , purpose               , round                  )          {
  return rounds(plan).some((r) => r.purpose === purpose && roundOrder(r.roundId) > roundOrder(round.roundId));
}

function requireRound(
  plan          ,
  purpose               ,
  roundId        ,
  launchId        ,
)                                       {
  const byLaunch = roundByLaunchId(plan, purpose, launchId);
  if (byLaunch && byLaunch.roundId === roundId) {
    // Supersession is decided before the CAS: a verdict arriving late for a round
    // that has already been rolled past is stale, not a second verdict on a live one.
    if (isSuperseded(plan, purpose, byLaunch)) {
      return { kind: "stale", reason: `round ${roundId} was superseded before this verdict arrived` };
    }
    return byLaunch;
  }
  const byId = rounds(plan).find((r) => r.purpose === purpose && r.roundId === roundId);
  if (byId) {
    return { kind: "stale", reason: `launch ${launchId} was superseded by ${byId.lane.launchId}` };
  }
  return { kind: "not_found", reason: `no ${purpose} round for launch ${launchId}` };
}

function isResult(v                                      )                         {
  return "kind" in v;
}

function advance(
  plan          ,
  purpose               ,
  roundId        ,
  launchId        ,
  expect                   ,
  mutate                                           ,
  clearCursor = false,
)                    {
  const found = requireRound(plan, purpose, roundId, launchId);
  if (isResult(found)) return found;
  if (found.status !== expect) {
    return { kind: "cas_failed", reason: `round ${roundId} is ${found.status}, expected ${expect}`, actual: found.status };
  }
  const updated = mutate(found);
  const list = replaceRound(rounds(plan), updated);
  return {
    kind: "ok",
    plan: withRounds(plan, list, purpose, clearCursor ? undefined : roundId),
    round: updated,
  };
}

export function markLaunching(
  plan          ,
  purpose               ,
  roundId        ,
  launchId        ,
  workspaceRoot        ,
)                    {
  return advance(plan, purpose, roundId, launchId, "pending", (r) => ({
    ...r,
    status: "launching",
    lane: { ...r.lane, workspaceRoot },
  }));
}

export function markInFlight(plan          , purpose               , roundId        , launchId        )                    {
  return advance(plan, purpose, roundId, launchId, "launching", (r) => ({ ...r, status: "in_flight" }));
}












export function recordVerdict(plan          , input              )                    {
  const now = input.now?.() ?? new Date().toISOString();
  return advance(
    plan,
    input.purpose,
    input.roundId,
    input.launchId,
    "in_flight",
    (r) => {
      const lane             = { ...r.lane, verdict: input.verdict };
      if (input.artifactSha256 !== undefined) lane.artifactSha256 = input.artifactSha256;
      if (input.reviewerSession !== undefined) lane.reviewerSession = input.reviewerSession;
      if (input.sourceIdentity !== undefined) lane.sourceIdentity = input.sourceIdentity;
      return { ...r, status: TERMINAL_FOR_VERDICT[input.verdict], lane, closedAt: now };
    },
    true,
  );
}

/**
 * Has the plan document moved since this round judged it?
 *
 * "open" means the round has not reached a verdict yet, so freshness is not a
 * meaningful question.
 */

/**
 * REVIEW-BINDING-01 (060): the highest-numbered round for a purpose, terminal or
 * not. The A>B gate reads this rather than effectiveRound(), which skips terminal
 * rounds and so cannot see an approval at all — and would happily return an older
 * approved round while a newer one is still in flight.
 */

/**
 * Close rounds an earlier epoch left behind (032).
 *
 * A re-plan mints a new epoch, and every sign-off still in flight for the old one
 * is already unspendable at the gate. Leaving those rounds open is what stranded a
 * cycle: the gate saw an in_flight round it could never approve. Cleaning up is
 * the job of the edge that caused it.
 *
 * Scoped deliberately: same session, same purpose, that one earlier epoch. Another
 * session's rounds and the current epoch's rounds are untouched.
 */
export function supersedeStaleRounds(
  plan          ,
  purpose               ,
  sessionId        ,
  previousEpoch               ,
)                                       {
  if (!previousEpoch) return { plan, closed: [] };
  const now = new Date().toISOString();
  const closed           = [];
  const next = rounds(plan).map((r) => {
    if (r.purpose !== purpose) return r;
    if (TERMINAL.has(r.status)) return r;
    if (r.ownerSessionId !== sessionId) return r;
    if (r.planEpoch !== previousEpoch) return r;
    closed.push(r.roundId);
    return { ...r, status: "inconclusive"                     , closedAt: now };
  });
  if (closed.length === 0) return { plan, closed: [] };
  return { plan: withRounds(plan, next, purpose, undefined), closed };
}

export function latestRound(plan          , purpose               )                          {
  const all = rounds(plan).filter((r) => r.purpose === purpose);
  if (all.length === 0) return null;
  return all.reduce((best, r) => (roundOrder(r.roundId) > roundOrder(best.roundId) ? r : best));
}

/**
 * Close the live round as inconclusive. There is deliberately no verdict argument:
 * an agent may abandon a round, never approve one. Approval belongs to the
 * SubagentStop observer, which only fires when a reviewer actually ran.
 */
export function abortRound(plan          , purpose               , reason        )                    {
  const live = effectiveRound(plan, purpose);
  if (!live) return { kind: "not_found", reason: `no open ${purpose} round` };
  const now = new Date().toISOString();
  const closed                   = {
    ...live,
    status: "inconclusive",
    closedAt: now,
    lane: { ...live.lane, reviewerSession: live.lane.reviewerSession ?? `aborted: ${reason}` },
  };
  const list = replaceRound(rounds(plan).slice(), closed);
  return { kind: "ok", plan: withRounds(plan, list, purpose, undefined), round: closed };
}

/** A reviewer's sign-off, as the observer expects to find it. */





/**
 * Parse the last two non-empty lines of a reviewer's final message.
 *
 * Strict by position, not by search: a packet that quotes the expected format as
 * an instruction would otherwise sign itself off. Only the closing lines count.
 *
 *   LAUNCH: r3-20260815181200
 *   VERDICT: PASS
 *
 * GO-WITH-FIXES maps to near-pass, matching what reviewers actually write.
 */
export function parseSignoff(message                           )                       {
  if (typeof message !== "string") return null;
  const lines = message.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const launchLine = lines[lines.length - 2];
  const verdictLine = lines[lines.length - 1];
  const launchMatch = /^LAUNCH\s*:\s*(\S+)$/i.exec(launchLine);
  if (!launchMatch) return null;
  const verdictMatch = /^VERDICT\s*:\s*(.+)$/i.exec(verdictLine);
  if (!verdictMatch) return null;
  const raw = verdictMatch[1].trim().toUpperCase();
  const verdict                       =
    raw === "PASS" ? "pass"
    : raw === "FAIL" ? "fail"
    : raw === "NEAR-PASS" || raw === "GO-WITH-FIXES" ? "near-pass"
    : null;
  if (!verdict) return null;
  return { launchId: launchMatch[1], verdict };
}

export function staleness(plan          , roundId        , currentPlanSha        )            {
  const round = rounds(plan).find((r) => r.roundId === roundId);
  if (!round) return "open";
  if (!TERMINAL.has(round.status)) return "open";
  return round.planSha256 === currentPlanSha ? "fresh" : "stale";
}
