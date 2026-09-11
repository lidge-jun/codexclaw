/**
 * chat-fallback.test.ts — R5: memory search backfills an empty result from the
 * chat corpus, with tool logs excluded and the substitution announced.
 *
 * searchChat arrives by injection, so most cases assert against a recording
 * stub; the last one runs the real engine over the shared fixture home.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchMemory, type ChatSearchFn } from "../src/memory-search.ts";
import { searchChat, type ChatSearchOptions, type ChatSearchResult } from "../src/chat-search.ts";
import { formatMemoryResult } from "../src/format.ts";
import { main as cliMain } from "../src/cli.ts";
import { buildCodexHome } from "./fixtures.ts";

function chatHit(over: Partial<ChatSearchResult["hits"][number]> = {}) {
  return {
    ts: "2026-09-08T04:05:06.000Z",
    role: "user",
    text: "we agreed to ship the pangolin migration on friday",
    matchField: "content" as const,
    threadId: "019f2222-0000-7000-8000-00000000aaaa",
    title: "pangolin planning",
    cwd: "/proj/here",
    gitBranch: null,
    source: "main" as const,
    file: "/home/sessions/2026/09/08/rollout-pangolin.jsonl",
    context: [],
    ...over,
  };
}

/** Records the options it was called with and returns canned hits. */
function stubChat(hits: ReturnType<typeof chatHit>[]): { fn: ChatSearchFn; calls: ChatSearchOptions[] } {
  const calls: ChatSearchOptions[] = [];
  const fn = ((_query: string, opts: ChatSearchOptions = {}) => {
    calls.push(opts);
    return {
      hits,
      warnings: [],
      scannedFiles: 0,
      matchedFiles: hits.length,
      totalFiles: 1,
      elapsedMs: 1,
      mode: "index" as const,
    };
  }) as ChatSearchFn;
  return { fn, calls };
}

function emptyHome(prefix: string): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(home, "memories"), { recursive: true });
  return home;
}

test("an empty memory result is backfilled from chat and says so", () => {
  const home = emptyHome("recall-fallback-");
  const { fn, calls } = stubChat([chatHit()]);
  try {
    const r = searchMemory("pangolin", { home, searchChat: fn });
    assert.equal(calls.length, 1, "the fallback fired exactly once");
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].origin, "chat");
    assert.equal(r.hits[0].kind, "chat");
    assert.match(r.hits[0].excerpt, /pangolin migration/);
    assert.ok(
      r.warnings.some((w) => w.includes("raw session message")),
      "the substitution is announced, not silent",
    );
    // The label reaches the rendered output too.
    assert.match(formatMemoryResult(r), /\(chat\/chat\)/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the fallback excludes tool logs and never triggers an ingest", () => {
  const home = emptyHome("recall-fallback-opts-");
  const { fn, calls } = stubChat([chatHit()]);
  try {
    searchMemory("pangolin", { home, searchChat: fn });
    assert.equal(calls[0].includeTools, false, "tool logs are the pollution source");
    assert.equal(calls[0].noRefresh, true, "a backfill must not refresh a multi-GB index");
    assert.equal(calls[0].days, 0, "full history, not chat's 7-day default");
    assert.equal(calls[0].home, home);
    assert.equal(calls[0].source, "main");

    // ...and the caller can opt back in.
    const withTools = stubChat([chatHit({ matchField: "tool_log" })]);
    searchMemory("pangolin", { home, searchChat: withTools.fn, chatIncludeTools: true });
    assert.equal(withTools.calls[0].includeTools, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a memory result that already answered is left alone", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-fallback-hit-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nThe pangolin migration is documented here.\n");
    const { fn, calls } = stubChat([chatHit()]);
    const r = searchMemory("pangolin", { home, searchChat: fn });
    assert.equal(calls.length, 0, "the chat engine is never consulted");
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].origin, "file");
    assert.ok(!r.warnings.some((w) => w.includes("raw session message")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("chatFallbackBelow raises the trigger above empty", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-fallback-thresh-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nA single thin pangolin mention.\n");
    const thin = searchMemory("pangolin", { home });
    assert.equal(thin.hits.length, 1);

    const { fn, calls } = stubChat([chatHit()]);
    const r = searchMemory("pangolin", { home, searchChat: fn, chatFallbackBelow: 2 });
    assert.equal(calls.length, 1);
    assert.equal(r.hits[0].origin, "chat");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("--cwd-only stays hard in the backfill; a plain --cwd boost does not filter", () => {
  const home = emptyHome("recall-fallback-scope-");
  try {
    const hard = stubChat([chatHit()]);
    searchMemory("pangolin", { home, searchChat: hard.fn, cwd: "/proj/here", cwdOnly: true });
    assert.equal(hard.calls[0].cwd, "/proj/here");

    const soft = stubChat([chatHit()]);
    searchMemory("pangolin", { home, searchChat: soft.fn, cwd: "/proj/here" });
    assert.equal(soft.calls[0].cwd, null, "a boost must not become a chat filter");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a failing chat engine degrades to the empty memory result", () => {
  const home = emptyHome("recall-fallback-fail-");
  try {
    const boom = (() => {
      throw new Error("index unavailable");
    }) as ChatSearchFn;
    const r = searchMemory("pangolin", { home, searchChat: boom });
    assert.equal(r.hits.length, 0);
    assert.ok(r.warnings.some((w) => w.includes("chat fallback unavailable")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("no injected engine means no fallback at all (default for library callers)", () => {
  const home = emptyHome("recall-fallback-none-");
  try {
    const r = searchMemory("pangolin", { home });
    assert.equal(r.hits.length, 0);
    assert.ok(!r.warnings.some((w) => w.includes("raw session message")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: memory search falls back to the real chat engine, and --no-chat opts out", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-fallback-cli-"));
  buildCodexHome(home);
  const captured: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.push(s);
    return true;
  };
  try {
    // "aardwolf" lives only in an archived session message, never in memories.
    assert.equal(cliMain(["memory", "search", "aardwolf", "--home", home, "--json"]), 0);
    const fell = JSON.parse(captured.join(""));
    assert.ok(fell.hits.length > 0, "the chat corpus answered where memory could not");
    assert.ok(fell.hits.every((h) => h.origin === "chat"));

    captured.length = 0;
    assert.equal(cliMain(["memory", "search", "aardwolf", "--home", home, "--no-chat", "--json"]), 0);
    const off = JSON.parse(captured.join(""));
    assert.equal(off.hits.length, 0, "--no-chat restores the memory-only answer");

    // A phrase that exists ONLY in a tool log stays unreachable: the fixture's
    // zebra-in-tool-output is indexed as tool_log, and the backfill excludes it.
    captured.length = 0;
    assert.equal(cliMain(["memory", "search", "zebra-in-tool-output", "--home", home, "--json"]), 0);
    const tools = JSON.parse(captured.join(""));
    assert.equal(tools.hits.length, 0, "tool output stays excluded through the CLI path");
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
    rmSync(home, { recursive: true, force: true });
  }
});

test("the real chat engine satisfies the injected type", () => {
  // Compile-time parity between the injection seam and the actual function.
  const fn: ChatSearchFn = searchChat;
  assert.equal(typeof fn, "function");
});

test("the chat fallback forwards synonyms and any", () => {
  const home = emptyHome("recall-fallback-syn-");
  try {
    const def = stubChat([]);
    searchMemory("기억", { home, searchChat: def.fn });
    assert.equal(def.calls[0].synonyms, true);
    assert.equal(def.calls[0].any, false);
    assert.equal(def.calls[0].includeTools, false, "tool logs are the pollution source");
    assert.equal(def.calls[0].noRefresh, true, "a backfill must not refresh a multi-GB index");
    assert.equal(def.calls[0].days, 0, "full history, not chat's 7-day default");

    const orMode = stubChat([]);
    searchMemory("기억", { home, searchChat: orMode.fn, any: true });
    assert.equal(orMode.calls[0].any, true);
    assert.equal(orMode.calls[0].synonyms, true);

    const raw = stubChat([]);
    searchMemory("기억", { home, searchChat: raw.fn, synonyms: false });
    assert.equal(raw.calls[0].synonyms, false);
    assert.equal(raw.calls[0].any, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
