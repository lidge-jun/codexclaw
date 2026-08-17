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
 * `^worker$`); this observer excludes exactly that type, so a read-only audit is
 * never held to a receipt it was designed to skip (DISPATCH-AGENT-TYPE-01), and
 * the two hooks cannot race over the same child.
 *
 * The exclusion is stated as "not worker" rather than "is explorer" on purpose
 * (050). The v1 spawn surface has no `agent_type` field at all, so a dispatch
 * cannot label its reviewer and the payload reaches us blank — an "is explorer"
 * test drops every v1 sign-off before the round can even be named.
 *
 * Dropping that test costs identity, so the round re-earns it: the first
 * sign-off BINDS the round to its agent id, and a later sign-off from a
 * different child is refused (050 §3b). Launch ids are minted from a round
 * number and a timestamp, so they are guessable — they name a round, they do
 * not authenticate a reviewer. Child hooks also inherit the PARENT session id
 * (cli.ts), so ownerSessionId cannot separate two children of one session.
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
    // A worker's exit belongs to the receipt gate; everything else is decided by
    // the sign-off below. Not "=== explorer": v1 spawns carry no agent_type.
    if (payload.agent_type === "worker") return "";

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
    // One round, one reviewer. The first sign-off binds the round to its agent
    // id; a second child cannot overwrite that judgement (050 §3b). Child hooks
    // share the parent session id, so this is the only check that separates two
    // children of the same session.
    const agentId = payload.agent_id ?? "";
    const boundReviewer = round.lane.reviewerSession;
    if (boundReviewer !== undefined && boundReviewer !== agentId) {
      return ignore(`round ${round.roundId} was already signed by ${boundReviewer}`);
    }
    const activeWp = effectiveActiveWorkPhaseId(plan);
    if (round.workPhaseId !== activeWp) {
      return ignore(`the round audited work-phase ${round.workPhaseId ?? "none"}, but ${activeWp ?? "none"} is active`);
    }

    const result = recordVerdict(plan, {
      purpose: "plan_audit",
      roundId: round.roundId,
      launchId: signoff.launchId,
      verdict: signoff.verdict,
      reviewerSession: agentId,
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
