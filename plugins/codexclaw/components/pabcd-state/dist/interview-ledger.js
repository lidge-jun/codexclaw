/**
 * interview-ledger.ts — durable interview question/answer capture (L12 / 120, WP4).
 *
 * The scan-evidence ledger (state.ts appendInterviewEvent) records that a
 * contradiction scan ran. THIS module records the other half of the interview
 * loop: the actual questions asked via `request_user_input` and the answers the
 * user selected. Both share the per-session `.codexclaw/interviews/<id>.jsonl`
 * file, distinguished by the `event` discriminator.
 *
 * Event ids are DERIVED from `(sessionId, turnId, questionId, eventKind)` so a
 * re-fired PostToolUse hook in the same turn does not double-record (idempotent,
 * matching the UserPromptSubmit injectedTurns discipline). All readers/writers
 * are total: malformed input is skipped, never thrown.
 *
 * Ground truth (codex-rs):
 *  - PostToolUse input: hooks/src/schema.rs:318 (tool_input, tool_response, tool_use_id)
 *  - request_user_input args: protocol/src/request_user_input.rs
 *      tool_input  = { questions: [{ id, header, question, options? }] }
 *      tool_response = { answers: { <questionId>: { answers: [string, ...] } } }
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR, INTERVIEWS_SUBDIR, sanitizeKey } from "./state.js";
import { splitLines } from "./text-lines.js";


















function isRecord(v         )                               {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * 260802 — the host may hand the hook a request_user_input payload either as a
 * structured object or as a JSON STRING. Before this coercion existed, a string
 * `tool_response` made `parseAnswers` return {} and the answer branch of
 * `captureInterviewAnswers` never ran: every shipped ledger held
 * `question_asked` rows and ZERO `answer_recorded` rows, so the interview never
 * accumulated a single answer and each question was generated from a blank
 * slate. `hook.ts` already applies the same string tolerance on the friction
 * path.
 *
 * Total by construction: a parse failure, or a valid-JSON non-object such as
 * `"null"`, `"[]"` or `"5"`, yields undefined and the caller degrades to empty
 * exactly as it did before. Evidence + the shape argument:
 * devlog/_plan/260802_interview_answer_capture/004_wire_capture.md
 */
function asRecord(v         )                                      {
  if (isRecord(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed          = JSON.parse(v);
      // Double-encoded payloads were observed in the wild: JSON.parse once
      // yields another JSON string. Recurse rather than dropping the round.
      return isRecord(parsed) ? parsed : typeof parsed === "string" ? asRecord(parsed) : firstRecord(parsed);
    } catch {
      return undefined;
    }
  }
  // Content-block transports hand over an array of parts; the payload is the
  // first element that is (or decodes to) an object.
  if (Array.isArray(v)) return firstRecord(v);
  return undefined;
}

/**
 * Content-block arrays (`custom_tool_call_output` style) wrap the real payload
 * in `[{ type: "input_text", text: "<json>" }, ...]`. Return the first element
 * that is, or decodes to, a record — checking a `text`/`output` field before
 * giving up. Bounded to the first few entries so a hostile array cannot make
 * this walk forever.
 */
function firstRecord(v         )                                      {
  if (!Array.isArray(v)) return undefined;
  for (const part of v.slice(0, 8)) {
    if (isRecord(part)) {
      if (isRecord(part.answers) || Array.isArray(part.questions)) return part;
      for (const key of ["text", "output", "content"]) {
        const inner = part[key];
        if (typeof inner === "string") {
          const decoded = asRecord(inner);
          if (decoded) return decoded;
        }
      }
      return part;
    }
    if (typeof part === "string") {
      const decoded = asRecord(part);
      if (decoded) return decoded;
    }
  }
  return undefined;
}

/** Derive the idempotency key for an event (no hashing — readable + stable). */
export function deriveEventId(turnId        , questionId        , kind                 )         {
  return `${turnId}:${questionId}:${kind}`;
}

function ledgerPath(cwd        , sessionId        )         {
  return join(cwd, STATE_DIR, INTERVIEWS_SUBDIR, `${sanitizeKey(sessionId)}.jsonl`);
}

/** Read all QA events for a session (best-effort; missing file or bad lines -> skipped). */
export function readQaEvents(cwd        , sessionId        )                     {
  let raw        ;
  try {
    raw = readFileSync(ledgerPath(cwd, sessionId), "utf8");
  } catch {
    return [];
  }
  const out                     = [];
  for (const line of splitLines(raw)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t)           ;
      if (isRecord(o) && (o.event === "question_asked" || o.event === "answer_recorded") && typeof o.eventId === "string") {
        out.push(o                    );
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}

/**
 * 260825: which dimensions hold a question the user was actually asked AND
 * actually answered.
 *
 * This exists because `deriveLevel` cannot tell the difference between a
 * dimension settled by an interview and one an agent typed a fact into. Both
 * reach `high`; only the first is evidence. Measured before this was written:
 *
 *   cxc scan record --session s --known goal=x --known constraint=x \
 *                   --known success=x --known ontology=x
 *   -> all four dimensions "high", scanRounds 1, in one command
 *
 * The answer is provenance, and provenance lives in this append-only file
 * rather than on the tracker, which `writeState` rewrites wholesale and which a
 * hand edit can set to anything. A dimension counts only when the SAME file
 * carries all three: the question was asked, it was answered, and a
 * `scan_completed` round attributed that questionId to that dimension.
 *
 * Not tamper-proof: this is a JSONL file, and whoever can write session state
 * can append to it. It closes the accidental path — the one an agent takes
 * because it is cheaper than asking — and leaves forgery a deliberate act.
 */
export function dimensionsBackedByAnswers(cwd        , sessionId        )              {
  let raw        ;
  try {
    raw = readFileSync(ledgerPath(cwd, sessionId), "utf8");
  } catch {
    return new Set();
  }
  const asked = new Set        ();
  const answered = new Set        ();
  // questionId -> dimension, accumulated across every scan round in this session.
  const attribution = new Map                ();

  for (const line of splitLines(raw)) {
    const t = line.trim();
    if (!t) continue;
    let o         ;
    try {
      o = JSON.parse(t);
    } catch {
      continue;
    }
    if (!isRecord(o)) continue;

    if (o.event === "question_asked" && typeof o.questionId === "string") {
      asked.add(o.questionId);
      continue;
    }
    // An empty `answers` array is not an answer. The capture writer only emits
    // the row when the user responded, but a hand-appended row need not.
    if (o.event === "answer_recorded" && typeof o.questionId === "string") {
      if (Array.isArray(o.answers) && o.answers.some((a) => typeof a === "string" && a.trim().length > 0)) {
        answered.add(o.questionId);
      }
      continue;
    }
    if (o.event === "scan_completed" && isRecord(o.map)) {
      for (const [questionId, dimension] of Object.entries(o.map)) {
        if (typeof dimension === "string" && dimension.length > 0) attribution.set(questionId, dimension);
      }
    }
  }

  const backed = new Set        ();
  for (const [questionId, dimension] of attribution) {
    if (asked.has(questionId) && answered.has(questionId)) backed.add(dimension);
  }
  return backed;
}

/** True when an event with this id already exists (dedup guard). */
function alreadyRecorded(cwd        , sessionId        , eventId        )          {
  return readQaEvents(cwd, sessionId).some((e) => e.eventId === eventId);
}

function appendEvent(cwd        , entry                  )       {
  const dir = join(cwd, STATE_DIR, INTERVIEWS_SUBDIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(ledgerPath(cwd, entry.sessionId), `${JSON.stringify(entry)}\n`);
}

/** Extracted question metadata from a request_user_input tool_input payload. */





/** Parse request_user_input tool_input -> the questions asked. Total (never throws). */
export function parseQuestions(toolInput         )                   {
  const input = asRecord(toolInput);
  if (!input || !Array.isArray(input.questions)) return [];
  const out                   = [];
  for (const q of input.questions) {
    if (!isRecord(q)) continue;
    const questionId = typeof q.id === "string" ? q.id : "";
    if (!questionId) continue;
    const question = typeof q.question === "string" ? q.question : typeof q.header === "string" ? q.header : "";
    out.push({ questionId, question });
  }
  return out;
}

/** Parse request_user_input tool_response -> answers by question id. Total. */
export function parseAnswers(toolResponse         )                           {
  const resp = asRecord(toolResponse);
  // Some transports nest the real body under `output`/`text` (a string or an
  // already-decoded record) instead of exposing `answers` at the top level.
  const body = isRecord(resp?.answers)
    ? resp
    : (() => {
        for (const key of ["output", "text", "content", "result"]) {
          const inner = resp?.[key];
          const decoded = typeof inner === "string" || Array.isArray(inner) || isRecord(inner) ? asRecord(inner) : undefined;
          if (decoded && isRecord(decoded.answers)) return decoded;
        }
        return undefined;
      })();
  if (!body || !isRecord(body.answers)) return {};
  // Object.create(null): a question id of `__proto__` would otherwise replace
  // this map's prototype instead of creating an own key, letting a crafted id
  // surface as a forged answer on an unrelated lookup.
  const out                           = Object.create(null)                            ;
  for (const [qid, val] of Object.entries(body.answers)) {
    if (qid === "__proto__" || qid === "constructor" || qid === "prototype") continue;
    if (isRecord(val) && Array.isArray(val.answers)) {
      out[qid] = val.answers.filter((a)              => typeof a === "string");
    }
  }
  return out;
}














/**
 * Capture one request_user_input round into the interview ledger: a
 * `question_asked` event per question and an `answer_recorded` event per answered
 * question. Idempotent via derived event ids. Never throws (best-effort durable
 * record; a write failure simply yields fewer written events).
 */
export function captureInterviewAnswers(input              )                {
  const { cwd, sessionId, turnId, toolInput, toolResponse } = input;
  const written                     = [];
  if (!sessionId) return { written };
  const tid = turnId || "no-turn";
  const questions = parseQuestions(toolInput);
  const answers = parseAnswers(toolResponse);

  for (const q of questions) {
    const askId = deriveEventId(tid, q.questionId, "question_asked");
    if (!alreadyRecorded(cwd, sessionId, askId)) {
      const ev                   = {
        ts: new Date().toISOString(),
        sessionId,
        turnId: tid,
        event: "question_asked",
        questionId: q.questionId,
        eventId: askId,
        question: q.question,
      };
      try {
        appendEvent(cwd, ev);
        written.push(ev);
      } catch {
        // best-effort
      }
    }
    const ans = answers[q.questionId];
    if (ans !== undefined) {
      const ansId = deriveEventId(tid, q.questionId, "answer_recorded");
      if (!alreadyRecorded(cwd, sessionId, ansId)) {
        const ev                   = {
          ts: new Date().toISOString(),
          sessionId,
          turnId: tid,
          event: "answer_recorded",
          questionId: q.questionId,
          eventId: ansId,
          answers: ans,
        };
        try {
          appendEvent(cwd, ev);
          written.push(ev);
        } catch {
          // best-effort
        }
      }
    }
  }
  return { written };
}
