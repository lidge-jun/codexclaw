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
import type {
  Goalplan,
  ReviewLane,
  ReviewPurpose,
  ReviewRoundState,
  ReviewRoundStatus,
} from "./goalplan.ts";
import type { SourceIdentity } from "./source-identity.ts";

export type ReviewVerdict = "pass" | "near-pass" | "fail";

export type ReviewRoundResult =
  | { kind: "ok"; plan: Goalplan; round: ReviewRoundState }
  /** a superseded round or a superseded launch — the late arrival was ignored. */
  | { kind: "stale"; reason: string }
  | { kind: "cas_failed"; reason: string; actual: ReviewRoundStatus }
  | { kind: "not_found"; reason: string }
  /** rejected before any state was examined (bad argument, not bad state). */
  | { kind: "invalid_input"; reason: string };

export type Staleness = "fresh" | "stale" | "open";

const TERMINAL: ReadonlySet<ReviewRoundStatus> = new Set(["approved", "changes_requested", "inconclusive"]);

/**
 * pass and near-pass both approve. A near-pass whose blockers were folded into
 * the plan changes the document, so its planSha256 no longer matches and
 * `staleness` reports "stale" — freshness, not status, is what actually gates
 * the next A->B. That is intended: an edited plan deserves another look.
 */
const TERMINAL_FOR_VERDICT: Record<ReviewVerdict, ReviewRoundStatus> = {
  pass: "approved",
  "near-pass": "approved",
  fail: "changes_requested",
};

function cursorField(purpose: ReviewPurpose): "activePlanAuditRoundId" | "activeFinalGateRoundId" {
  return purpose === "plan_audit" ? "activePlanAuditRoundId" : "activeFinalGateRoundId";
}

function rounds(plan: Goalplan): ReviewRoundState[] {
  return plan.reviewRounds ?? [];
}

function roundOrder(roundId: string): number {
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
export function effectiveRound(plan: Goalplan, purpose: ReviewPurpose): ReviewRoundState | null {
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

function withRounds(plan: Goalplan, next: ReviewRoundState[], purpose: ReviewPurpose, cursor: string | undefined): Goalplan {
  const out: Goalplan = { ...plan, reviewRounds: next };
  if (cursor === undefined) delete out[cursorField(purpose)];
  else out[cursorField(purpose)] = cursor;
  return out;
}

function replaceRound(list: ReviewRoundState[], updated: ReviewRoundState): ReviewRoundState[] {
  return list.map((r) => (r.roundId === updated.roundId ? updated : r));
}

function nextRoundId(plan: Goalplan): string {
  const highest = rounds(plan).reduce((n, r) => Math.max(n, roundOrder(r.roundId)), 0);
  return `r${highest + 1}`;
}

function mintLaunchId(roundId: string, now: string): string {
  return `${roundId}-${now.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

export interface OpenRoundInput {
  purpose: ReviewPurpose;
  planPath: string;
  /** sha256 of the plan document; the caller computes it. */
  planSha256: string;
  now?: () => string;
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
export function openRound(plan: Goalplan, input: OpenRoundInput): ReviewRoundResult {
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
    const refreshed: ReviewRoundState = { ...live, planSha256: input.planSha256 };
    list = replaceRound(list, refreshed);
    return { kind: "ok", plan: withRounds(plan, list, input.purpose, refreshed.roundId), round: refreshed };
  }

  // close every non-terminal round of this purpose, not just the cursor one
  list = list.map((r) =>
    r.purpose === input.purpose && !TERMINAL.has(r.status)
      ? { ...r, status: "inconclusive" as ReviewRoundStatus, closedAt: now }
      : r,
  );

  const roundId = nextRoundId(plan);
  const round: ReviewRoundState = {
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

function requireCursorRound(
  plan: Goalplan,
  purpose: ReviewPurpose,
  roundId: string,
  launchId: string,
): ReviewRoundState | ReviewRoundResult {
  const live = effectiveRound(plan, purpose);
  if (!live) return { kind: "not_found", reason: `no open ${purpose} round` };
  if (live.roundId !== roundId) {
    return { kind: "stale", reason: `round ${roundId} is no longer the active ${purpose} round (now ${live.roundId})` };
  }
  if (live.lane.launchId !== launchId) {
    return { kind: "stale", reason: `launch ${launchId} was superseded by ${live.lane.launchId}` };
  }
  return live;
}

function isResult(v: ReviewRoundState | ReviewRoundResult): v is ReviewRoundResult {
  return "kind" in v;
}

function advance(
  plan: Goalplan,
  purpose: ReviewPurpose,
  roundId: string,
  launchId: string,
  expect: ReviewRoundStatus,
  mutate: (r: ReviewRoundState) => ReviewRoundState,
  clearCursor = false,
): ReviewRoundResult {
  const found = requireCursorRound(plan, purpose, roundId, launchId);
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
  plan: Goalplan,
  purpose: ReviewPurpose,
  roundId: string,
  launchId: string,
  workspaceRoot: string,
): ReviewRoundResult {
  return advance(plan, purpose, roundId, launchId, "pending", (r) => ({
    ...r,
    status: "launching",
    lane: { ...r.lane, workspaceRoot },
  }));
}

export function markInFlight(plan: Goalplan, purpose: ReviewPurpose, roundId: string, launchId: string): ReviewRoundResult {
  return advance(plan, purpose, roundId, launchId, "launching", (r) => ({ ...r, status: "in_flight" }));
}

export interface VerdictInput {
  purpose: ReviewPurpose;
  roundId: string;
  launchId: string;
  verdict: ReviewVerdict;
  artifactSha256?: string;
  reviewerSession?: string;
  sourceIdentity?: SourceIdentity;
  now?: () => string;
}

export function recordVerdict(plan: Goalplan, input: VerdictInput): ReviewRoundResult {
  const now = input.now?.() ?? new Date().toISOString();
  return advance(
    plan,
    input.purpose,
    input.roundId,
    input.launchId,
    "in_flight",
    (r) => {
      const lane: ReviewLane = { ...r.lane, verdict: input.verdict };
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
export function latestRound(plan: Goalplan, purpose: ReviewPurpose): ReviewRoundState | null {
  const all = rounds(plan).filter((r) => r.purpose === purpose);
  if (all.length === 0) return null;
  return all.reduce((best, r) => (roundOrder(r.roundId) > roundOrder(best.roundId) ? r : best));
}

/**
 * Close the live round as inconclusive. There is deliberately no verdict argument:
 * an agent may abandon a round, never approve one. Approval belongs to the
 * SubagentStop observer, which only fires when a reviewer actually ran.
 */
export function abortRound(plan: Goalplan, purpose: ReviewPurpose, reason: string): ReviewRoundResult {
  const live = effectiveRound(plan, purpose);
  if (!live) return { kind: "not_found", reason: `no open ${purpose} round` };
  const now = new Date().toISOString();
  const closed: ReviewRoundState = {
    ...live,
    status: "inconclusive",
    closedAt: now,
    lane: { ...live.lane, reviewerSession: live.lane.reviewerSession ?? `aborted: ${reason}` },
  };
  const list = replaceRound(rounds(plan).slice(), closed);
  return { kind: "ok", plan: withRounds(plan, list, purpose, undefined), round: closed };
}

/** A reviewer's sign-off, as the observer expects to find it. */
export interface ReviewSignoff {
  launchId: string;
  verdict: ReviewVerdict;
}

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
export function parseSignoff(message: string | null | undefined): ReviewSignoff | null {
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
  const verdict: ReviewVerdict | null =
    raw === "PASS" ? "pass"
    : raw === "FAIL" ? "fail"
    : raw === "NEAR-PASS" || raw === "GO-WITH-FIXES" ? "near-pass"
    : null;
  if (!verdict) return null;
  return { launchId: launchMatch[1], verdict };
}

export function staleness(plan: Goalplan, roundId: string, currentPlanSha: string): Staleness {
  const round = rounds(plan).find((r) => r.roundId === roundId);
  if (!round) return "open";
  if (!TERMINAL.has(round.status)) return "open";
  return round.planSha256 === currentPlanSha ? "fresh" : "stale";
}
