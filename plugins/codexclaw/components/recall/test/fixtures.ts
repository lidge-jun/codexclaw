/**
 * fixtures.ts — build a synthetic CODEX_HOME for recall tests: date-structured
 * rollout JSONL files (main + subagent + stale), a threads state db, and a
 * memories tree with a stage1_outputs db. All content is deterministic; dates
 * derive from Date.now() so --days pruning is testable.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const THREAD_MAIN = "019f0000-0000-7000-8000-00000000aaaa";
export const THREAD_SUB = "019f0000-0000-7000-8000-00000000bbbb";
export const THREAD_OLD = "019f0000-0000-7000-8000-00000000cccc";
export const THREAD_ARCHIVED = "019f0000-0000-7000-8000-00000000eeee";

export function dateParts(daysAgo: number): { y: string; m: string; d: string; iso: string } {
  const t = new Date(Date.now() - daysAgo * 86_400_000);
  const y = String(t.getUTCFullYear());
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return { y, m, d, iso: t.toISOString() };
}

function line(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

function sessionMeta(id: string, cwd: string, subagent: boolean, iso: string): string {
  const payload: Record<string, unknown> = {
    id,
    timestamp: iso,
    cwd,
    originator: subagent ? "codex_exec" : "codex-tui",
    cli_version: "0.130.0",
    // Long padding mirrors real session_meta first lines (22-44KB observed) so the
    // grow-until-newline head reader is exercised above its initial 32KB buffer.
    instructions: "x".repeat(40_000),
  };
  if (subagent) {
    payload.thread_source = "subagent";
    payload.source = { subagent: { parent_thread_id: THREAD_MAIN, depth: 1 } };
    payload.agent_nickname = "Popper";
  }
  return line({ timestamp: iso, type: "session_meta", payload });
}

function message(role: string, text: string, iso: string): string {
  const ctype = role === "assistant" ? "output_text" : "input_text";
  return line({
    timestamp: iso,
    type: "response_item",
    payload: { type: "message", role, content: [{ type: ctype, text }] },
  });
}

function toolCall(name: string, args: string, output: string, iso: string): string {
  return (
    line({
      timestamp: iso,
      type: "response_item",
      payload: { type: "function_call", name, arguments: args, call_id: "tool_1" },
    }) +
    line({
      timestamp: iso,
      type: "response_item",
      payload: { type: "function_call_output", call_id: "tool_1", output },
    })
  );
}

export function buildCodexHome(root: string): void {
  // --- recent main rollout (today) ---
  const today = dateParts(0);
  const mainDir = join(root, "sessions", today.y, today.m, today.d);
  mkdirSync(mainDir, { recursive: true });
  writeFileSync(
    join(mainDir, `rollout-${today.y}-${today.m}-${today.d}T01-00-00-${THREAD_MAIN}.jsonl`),
    sessionMeta(THREAD_MAIN, "/proj/alpha", false, today.iso) +
      message("user", "# AGENTS.md instructions injected preamble mentioning zebra", today.iso) +
      message("user", "please deploy the trigram index for korean search", today.iso) +
      message("assistant", "deployed the trigram index; korean 한글 검색 works now", today.iso) +
      toolCall("exec_command", '{"cmd":"rg zebra-in-tool-arguments"}', "tool output: zebra-in-tool-output", today.iso) +
      message("user", "한글 트라이그램 결과 확인해줘", today.iso) +
      message("assistant", "확인 완료: 트라이그램 인덱스 정상", today.iso),
  );

  // --- recent subagent rollout (today) ---
  const subDir = mainDir;
  writeFileSync(
    join(subDir, `rollout-${today.y}-${today.m}-${today.d}T02-00-00-${THREAD_SUB}.jsonl`),
    sessionMeta(THREAD_SUB, "/proj/alpha/sub", true, today.iso) +
      message("user", "subagent task about the trigram index", today.iso) +
      message("assistant", "subagent reply mentioning zebra too", today.iso),
  );

  // --- stale main rollout (40 days ago) ---
  const old = dateParts(40);
  const oldDir = join(root, "sessions", old.y, old.m, old.d);
  mkdirSync(oldDir, { recursive: true });
  writeFileSync(
    join(oldDir, `rollout-${old.y}-${old.m}-${old.d}T01-00-00-${THREAD_OLD}.jsonl`),
    sessionMeta(THREAD_OLD, "/proj/beta", false, old.iso) +
      message("user", "ancient question about the trigram index", old.iso) +
      message("assistant", "ancient answer", old.iso),
  );

  // --- archived rollout (10 days ago; flat dir, date lives in the filename) ---
  const arch = dateParts(10);
  const archDir = join(root, "archived_sessions");
  mkdirSync(archDir, { recursive: true });
  writeFileSync(
    join(archDir, `rollout-${arch.y}-${arch.m}-${arch.d}T05-00-00-${THREAD_ARCHIVED}.jsonl`),
    sessionMeta(THREAD_ARCHIVED, "/proj/alpha", false, arch.iso) +
      message("user", "archived aardwolf question about the trigram index", arch.iso) +
      message("assistant", "archived aardwolf answer", arch.iso),
  );

  // --- threads state db (versioned name; resolver must pick the highest N) ---
  const stateDb = new DatabaseSync(join(root, "state_2.sqlite"));
  stateDb.exec(
    "CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT ''," +
      " cwd TEXT NOT NULL DEFAULT '', git_branch TEXT, updated_at_ms INTEGER)",
  );
  const ins = stateDb.prepare("INSERT INTO threads (id, title, cwd, git_branch, updated_at_ms) VALUES (?, ?, ?, ?, ?)");
  ins.run(THREAD_MAIN, "deploy trigram index", "/proj/alpha", "main", Date.now());
  ins.run(THREAD_SUB, "subagent lane", "/proj/alpha/sub", null, Date.now());
  stateDb.close();
  // Decoy older version to prove the resolver prefers state_2.
  const decoy = new DatabaseSync(join(root, "state_1.sqlite"));
  decoy.exec("CREATE TABLE threads (id TEXT PRIMARY KEY)");
  decoy.close();

  // --- memories tree ---
  const memDir = join(root, "memories", "rollout_summaries");
  mkdirSync(memDir, { recursive: true });
  writeFileSync(
    join(root, "memories", "MEMORY.md"),
    "# Task Group: search infrastructure\n\n## Task 1: ship the trigram sidecar index, success\n\nkeywords: trigram, sidecar, 한글 검색\n",
  );
  // CRLF-authored memory file (Windows parity).
  writeFileSync(
    join(root, "memories", "windows-notes.md"),
    "# CRLF notes\r\n\r\nthe wombat migration finished on windows\r\n",
  );
  writeFileSync(
    join(memDir, "summary-aaa.md"),
    `thread_id: ${THREAD_MAIN}\nupdated_at: ${today.iso}\n\n# Deployed the trigram index\n\nRollout context: korean trigram deployment succeeded.\n`,
  );

  // --- stage1 memories db ---
  const memDb = new DatabaseSync(join(root, "memories_1.sqlite"));
  memDb.exec(
    "CREATE TABLE stage1_outputs (thread_id TEXT PRIMARY KEY, source_updated_at INTEGER NOT NULL," +
      " raw_memory TEXT NOT NULL, rollout_summary TEXT NOT NULL)",
  );
  const mins = memDb.prepare(
    "INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary) VALUES (?, ?, ?, ?)",
  );
  // Same thread as the md summary (must dedupe) + a db-only thread (must surface).
  mins.run(THREAD_MAIN, Math.floor(Date.now() / 1000), "raw memory about trigram deployment", "summary duplicate");
  mins.run(THREAD_SUB, Math.floor(Date.now() / 1000), "db-only memory row about quagga migrations", "quagga summary");
  memDb.close();
}
