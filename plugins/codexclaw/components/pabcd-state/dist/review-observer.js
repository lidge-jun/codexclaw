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
import { readState } from "./state.js";
import { readGoalplan, writeGoalplan, effectiveActiveWorkPhaseId, appendGoalplanLedger } from "./goalplan.js";
import { roundByLaunchId, parseSignoff, recordVerdict } from "./review-round.js";


/**
 * Record a reviewer's verdict, or do nothing. Returns "" always — this hook is a
 * side effect, not a decision.
 */
export function handleReviewObserver(raw        )         {
  try {
    const payload = JSON.parse(raw)                       ;
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
    if (!state.slug) return "";

    const plan = readGoalplan(cwd, state.slug);
    if (!plan) return "";

    // Find the round by its launch id before checking anything else. The sign-off
    // names its own round, and looking it up first means every refusal below is
    // about a round we can name — which is what makes it worth recording.
    const round = roundByLaunchId(plan, "plan_audit", signoff.launchId);
    if (!round) return "";

    const ignore = (reason        )         => {
      // Diagnosis only. A reviewer answered and the verdict is not being taken;
      // saying why is the difference between a closed gate and a silent one.
      try {
        appendGoalplanLedger(cwd, state.slug, {
          ts: new Date().toISOString(),
          slug: state.slug,
          event: "review_signoff_ignored",
          detail: `${signoff.verdict} sign-off was not recorded: ${reason}`,
          roundId: round.roundId,
          launchId: signoff.launchId,
        });
      } catch {
        // FAIL-OPEN: a note that cannot be written must not break the child's exit
      }
      return "";
    };

    if (state.phase !== "A") return ignore("the session left A before the reviewer finished");
    if (round.ownerSessionId !== sessionId) return ignore("the round belongs to another session");
    if (round.planEpoch !== state.planEpoch) return ignore("the plan was re-planned after this round opened");
    const activeWp = effectiveActiveWorkPhaseId(plan);
    if (round.workPhaseId !== activeWp) {
      return ignore(`the round audited work-phase ${round.workPhaseId ?? "none"}, but ${activeWp ?? "none"} is active`);
    }

    const result = recordVerdict(plan, {
      purpose: "plan_audit",
      roundId: round.roundId,
      launchId: signoff.launchId,
      verdict: signoff.verdict,
      reviewerSession: payload.agent_id ?? "",
    });
    if (result.kind !== "ok") {
      return ignore("reason" in result ? result.reason : result.kind);
    }
    writeGoalplan(cwd, result.plan);
    return "";
  } catch {
    return ""; // FAIL-OPEN: never break a subagent's exit
  }
}
