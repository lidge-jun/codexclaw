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
 * (050). The v1 spawn surface has no `agent_type` ARGUMENT, so a dispatch cannot
 * label its reviewer — an "is explorer" test drops every v1 sign-off before the
 * round can even be named.
 *
 * 260818: the earlier note that such a payload "reaches us blank" was wrong, and
 * the registered matcher was wrong with it. codex-rs normalises a child with no
 * role to the agent_type `default` (a v1 spawn records `agent_role: null` in its
 * session_meta), so `^(explorer)?$` — which admits only "" and "explorer" —
 * matched nothing and the hook command never ran. That is why a dropped verdict
 * left NO ledger line at all: the refusal below cannot write what was never
 * invoked. The matcher is now `.*` and the worker exclusion here is what keeps
 * the receipt gate and this observer off each other's children. Since the type is
 * no longer a filter, treat every non-worker exit as a possible reviewer and let
 * the sign-off decide.
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
import { readState } from "./state.ts";
import {
  appendGoalplanLedger,
  effectiveActiveWorkPhaseId,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
} from "./goalplan.ts";
import { roundByLaunchId, parseSignoff, recordVerdict } from "./review-round.ts";
import type { SubagentStopPayload } from "./hook.ts";

/**
 * Record a reviewer's verdict, or do nothing. Returns "" always — this hook is a
 * side effect, not a decision.
 */
export function handleReviewObserver(raw: string): string {
  try {
    const payload = JSON.parse(raw) as SubagentStopPayload;
    if (payload.hook_event_name !== "SubagentStop") return "";
    // A worker's exit belongs to the receipt gate; everything else is decided by
    // the sign-off below. Not "=== explorer": a v1 child arrives as "default".
    if (payload.agent_type === "worker") return "";

    const { cwd, session_id: sessionId } = payload;
    if (!cwd || !sessionId) return "";

    // last_assistant_message only. Reading the child transcript tail would scan
    // bytes without knowing whose they are, so a LAUNCH/VERDICT example inside the
    // dispatch packet could sign off on itself.
    const signoff = parseSignoff(payload.last_assistant_message);
    const state = readState(cwd, sessionId);

    // Diagnose before the round is known (260818). The refusal ledger below can
    // only speak once a round has been named, so every earlier drop used to be
    // invisible — a reviewer answered, nothing moved, and the ledger said nothing.
    // Once a session is in A with a live round waiting, a child that exits
    // WITHOUT a parseable sign-off is worth one line: that is the difference
    // between "the reviewer said nothing usable" and "the gate is broken".
    const note = (event: string, detail: string, launchId?: string): string => {
      try {
        if (!state.slug) return "";
        appendGoalplanLedger(cwd, state.slug, {
          ts: new Date().toISOString(),
          slug: state.slug,
          event,
          detail,
          ...(launchId === undefined ? {} : { launchId }),
        });
      } catch {
        // FAIL-OPEN: a note that cannot be written must not break the child's exit
      }
      return "";
    };

    if (!state.slug) return "";
    const locked = withGoalplanWriteLock(cwd, state.slug, (plan): string => {
      if (!signoff) {
        const waiting = plan.reviewRounds?.some(
          (round) => round.purpose === "plan_audit" && round.status === "in_flight",
        );
        if (state.phase === "A" && waiting) {
          return note(
            "review_signoff_unparsed",
            (
              "a subagent exited with no parseable sign-off while a plan_audit round was in flight; "
              + "the closing two lines must be exactly LAUNCH then VERDICT"
            ),
          );
        }
        return "";
      }

      const round = roundByLaunchId(plan, "plan_audit", signoff.launchId);
      if (!round) {
        return note(
          "review_signoff_ignored",
          `${signoff.verdict} sign-off named launch ${signoff.launchId}, which belongs to no plan_audit round`,
          signoff.launchId,
        );
      }
      const ignore = (reason: string): string => {
        appendGoalplanLedger(cwd, state.slug!, {
          ts: new Date().toISOString(),
          slug: state.slug!,
          event: "review_signoff_ignored",
          detail: `${signoff.verdict} sign-off was not recorded: ${reason}`,
          roundId: round.roundId,
          launchId: signoff.launchId,
        });
        return "";
      };
      if (state.phase !== "A") return ignore("the session left A before the reviewer finished");
      if (round.ownerSessionId !== sessionId) return ignore("the round belongs to another session");
      if (round.planEpoch !== state.planEpoch) return ignore("the plan was re-planned after this round opened");
      const agentId = payload.agent_id ?? "";
      if (round.lane.reviewerSession !== undefined && round.lane.reviewerSession !== agentId) {
        return ignore(`round ${round.roundId} was already signed by ${round.lane.reviewerSession}`);
      }
      const activeWorkPhaseId = effectiveActiveWorkPhaseId(plan);
      if (round.workPhaseId !== activeWorkPhaseId) {
        return ignore(
          `the round audited work-phase ${round.workPhaseId ?? "none"}, `
            + `but ${activeWorkPhaseId ?? "none"} is active`,
        );
      }
      const recorded = recordVerdict(plan, {
        purpose: "plan_audit",
        roundId: round.roundId,
        launchId: signoff.launchId,
        verdict: signoff.verdict,
        reviewerSession: agentId,
      });
      if (recorded.kind !== "ok") {
        return ignore("reason" in recorded ? recorded.reason : recorded.kind);
      }
      writeGoalplan(cwd, recorded.plan);
      return "";
    });
    return locked.kind === "ok" ? locked.value : "";
  } catch {
    return ""; // FAIL-OPEN: never break a subagent's exit
  }
}
