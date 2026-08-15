/**
 * review-observer.ts — SubagentStop observer that owns plan-audit approval (060).
 *
 * The whole point of REVIEW-BINDING-01 is that the agent cannot write its own
 * approval. An `open`/`close` CLI pair would have been the same self-attestation
 * the A>B gate already had, just spelled with two commands, so closing a round
 * with a verdict is not a command at all — it happens here, when a reviewer
 * subagent actually ends its turn.
 *
 * Never blocks. The existing worker evidence gate does the denying (matcher
 * `^worker$`); this observer matches `^explorer$` only, so a read-only audit is
 * never held to a receipt it was designed to skip (DISPATCH-AGENT-TYPE-01), and
 * the two hooks cannot race over the same child.
 *
 * Fail-open on every IO or parse error: a missed recording costs one more audit
 * round, while a thrown observer would break an unrelated subagent's exit.
 */
import { readState } from "./state.ts";
import { readGoalplan, writeGoalplan, effectiveActiveWorkPhaseId } from "./goalplan.ts";
import { effectiveRound, parseSignoff, recordVerdict } from "./review-round.ts";
import type { SubagentStopPayload } from "./hook.ts";

/**
 * Record a reviewer's verdict, or do nothing. Returns "" always — this hook is a
 * side effect, not a decision.
 */
export function handleReviewObserver(raw: string): string {
  try {
    const payload = JSON.parse(raw) as SubagentStopPayload;
    if (payload.hook_event_name !== "SubagentStop") return "";
    // Only explorers audit. A worker's exit belongs to the receipt gate.
    if (payload.agent_type !== "explorer") return "";

    const { cwd, session_id: sessionId } = payload;
    if (!cwd || !sessionId) return "";

    // last_assistant_message only. Reading the child transcript tail would scan
    // bytes without knowing whose they are, so a LAUNCH/VERDICT example inside the
    // dispatch packet could sign off on itself.
    const signoff = parseSignoff(payload.last_assistant_message);
    if (!signoff) return "";

    const state = readState(cwd, sessionId);
    // The round belongs to an audit in progress; anywhere else it is stale.
    if (state.phase !== "A" || !state.slug) return "";

    const plan = readGoalplan(cwd, state.slug);
    if (!plan) return "";
    const round = effectiveRound(plan, "plan_audit");
    if (!round) return "";
    if (round.lane.launchId !== signoff.launchId) return "";
    // The parent may have moved on between dispatch and exit.
    if (round.ownerSessionId !== sessionId) return "";
    if (round.planEpoch !== state.planEpoch) return "";
    if (round.workPhaseId !== effectiveActiveWorkPhaseId(plan)) return "";

    const result = recordVerdict(plan, {
      purpose: "plan_audit",
      roundId: round.roundId,
      launchId: signoff.launchId,
      verdict: signoff.verdict,
      reviewerSession: payload.agent_id ?? "",
    });
    if (result.kind !== "ok") return "";
    writeGoalplan(cwd, result.plan);
    return "";
  } catch {
    return ""; // FAIL-OPEN: never break a subagent's exit
  }
}

