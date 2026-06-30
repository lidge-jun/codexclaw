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
import { STATE_DIR, INTERVIEWS_SUBDIR, sanitizeKey } from "./state.ts";

export type InterviewQaKind = "question_asked" | "answer_recorded";

export interface InterviewQaEvent {
  ts: string;
  sessionId: string;
  turnId: string;
  event: InterviewQaKind;
  /** stable per-question id from request_user_input. */
  questionId: string;
  /** derived idempotency key: `${turnId}:${questionId}:${event}`. */
  eventId: string;
  /** question_asked: the prompt text. answer_recorded: omitted. */
  question?: string;
  /** answer_recorded: the user's selected/free-form answer(s). */
  answers?: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Derive the idempotency key for an event (no hashing — readable + stable). */
export function deriveEventId(turnId: string, questionId: string, kind: InterviewQaKind): string {
  return `${turnId}:${questionId}:${kind}`;
}

function ledgerPath(cwd: string, sessionId: string): string {
  return join(cwd, STATE_DIR, INTERVIEWS_SUBDIR, `${sanitizeKey(sessionId)}.jsonl`);
}

/** Read all QA events for a session (best-effort; missing file or bad lines -> skipped). */
export function readQaEvents(cwd: string, sessionId: string): InterviewQaEvent[] {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath(cwd, sessionId), "utf8");
  } catch {
    return [];
  }
  const out: InterviewQaEvent[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as unknown;
      if (isRecord(o) && (o.event === "question_asked" || o.event === "answer_recorded") && typeof o.eventId === "string") {
        out.push(o as InterviewQaEvent);
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}

/** True when an event with this id already exists (dedup guard). */
function alreadyRecorded(cwd: string, sessionId: string, eventId: string): boolean {
  return readQaEvents(cwd, sessionId).some((e) => e.eventId === eventId);
}

function appendEvent(cwd: string, entry: InterviewQaEvent): void {
  const dir = join(cwd, STATE_DIR, INTERVIEWS_SUBDIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(ledgerPath(cwd, entry.sessionId), `${JSON.stringify(entry)}\n`);
}

/** Extracted question metadata from a request_user_input tool_input payload. */
export interface ParsedQuestion {
  questionId: string;
  question: string;
}

/** Parse request_user_input tool_input -> the questions asked. Total (never throws). */
export function parseQuestions(toolInput: unknown): ParsedQuestion[] {
  if (!isRecord(toolInput) || !Array.isArray(toolInput.questions)) return [];
  const out: ParsedQuestion[] = [];
  for (const q of toolInput.questions) {
    if (!isRecord(q)) continue;
    const questionId = typeof q.id === "string" ? q.id : "";
    if (!questionId) continue;
    const question = typeof q.question === "string" ? q.question : typeof q.header === "string" ? q.header : "";
    out.push({ questionId, question });
  }
  return out;
}

/** Parse request_user_input tool_response -> answers by question id. Total. */
export function parseAnswers(toolResponse: unknown): Record<string, string[]> {
  if (!isRecord(toolResponse) || !isRecord(toolResponse.answers)) return {};
  const out: Record<string, string[]> = {};
  for (const [qid, val] of Object.entries(toolResponse.answers)) {
    if (isRecord(val) && Array.isArray(val.answers)) {
      out[qid] = val.answers.filter((a): a is string => typeof a === "string");
    }
  }
  return out;
}

export interface CaptureInput {
  cwd: string;
  sessionId: string;
  turnId: string;
  toolInput: unknown;
  toolResponse: unknown;
}

export interface CaptureResult {
  /** events newly written this call (after dedup). */
  written: InterviewQaEvent[];
}

/**
 * Capture one request_user_input round into the interview ledger: a
 * `question_asked` event per question and an `answer_recorded` event per answered
 * question. Idempotent via derived event ids. Never throws (best-effort durable
 * record; a write failure simply yields fewer written events).
 */
export function captureInterviewAnswers(input: CaptureInput): CaptureResult {
  const { cwd, sessionId, turnId, toolInput, toolResponse } = input;
  const written: InterviewQaEvent[] = [];
  if (!sessionId) return { written };
  const tid = turnId || "no-turn";
  const questions = parseQuestions(toolInput);
  const answers = parseAnswers(toolResponse);

  for (const q of questions) {
    const askId = deriveEventId(tid, q.questionId, "question_asked");
    if (!alreadyRecorded(cwd, sessionId, askId)) {
      const ev: InterviewQaEvent = {
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
        const ev: InterviewQaEvent = {
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
