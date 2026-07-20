/** telegram-progress.test.ts — attended-turn Telegram progress lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RunnerEvent } from "../src/runner.ts";
import { createTelegramTurnProgress, type TelegramProgressDeps } from "../src/telegram-progress.ts";
import { createToolProgressFilter } from "../src/tool-progress.ts";
import type { TelegramApi, TgResponse } from "../src/telegram-api.ts";

interface TimerEntry {
  at: number;
  callback: () => void;
  intervalMs?: number;
}

function fakeClock(start = 10_000): TelegramProgressDeps & { advance: (ms: number) => Promise<void>; intervalCount: () => number } {
  let now = start;
  let nextId = 1;
  const timers = new Map<number, TimerEntry>();

  const runDue = async () => {
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      const [id, timer] = due;
      if (timer.intervalMs === undefined) timers.delete(id);
      else timer.at += timer.intervalMs;
      timer.callback();
      await settle();
    }
  };

  return {
    now: () => now,
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id as number);
    },
    setInterval(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback, intervalMs: ms });
      return id;
    },
    clearInterval(id) {
      timers.delete(id as number);
    },
    async advance(ms) {
      now += ms;
      await runDue();
    },
    intervalCount: () => [...timers.values()].filter((timer) => timer.intervalMs !== undefined).length,
  };
}

function fakeApi(options: {
  editResults?: TgResponse[];
  editDeferred?: Promise<TgResponse>;
  deleteThrows?: boolean;
} = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const editResults = [...(options.editResults ?? [])];
  const api = {
    async sendMessage(params: unknown) {
      calls.push({ method: "sendMessage", args: [params] });
      return { ok: true, result: { message_id: 77, chat: { id: 1, type: "private" } } };
    },
    async editMessageText(...args: unknown[]) {
      calls.push({ method: "editMessageText", args });
      if (options.editDeferred) return options.editDeferred;
      return editResults.shift() ?? { ok: true, result: { message_id: 77, chat: { id: 1, type: "private" } } };
    },
    async deleteMessage(...args: unknown[]) {
      calls.push({ method: "deleteMessage", args });
      if (options.deleteThrows) throw new Error("delete failed");
      return { ok: true, result: true };
    },
    async sendChatAction(...args: unknown[]) {
      calls.push({ method: "sendChatAction", args });
      return { ok: true, result: true };
    },
    async sendRichMessageDraft(params: unknown) {
      calls.push({ method: "sendRichMessageDraft", args: [params] });
      return { ok: true, result: true };
    },
  } as unknown as TelegramApi;
  return { api, calls };
}

function statusProgress(api: TelegramApi, deps: TelegramProgressDeps, extra: Record<string, unknown> = {}) {
  return createTelegramTurnProgress({
    api,
    chatId: "-100",
    chatType: "supergroup",
    richSupported: false,
    messageThreadId: 44,
    draftId: 12,
    deps,
    ...extra,
  });
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

test("429 suspends edits and flushes only the newest snapshot after retry_after", async () => {
  const clock = fakeClock();
  const { api, calls } = fakeApi({
    editResults: [
      { ok: false, error_code: 429, parameters: { retry_after: 3 } },
      { ok: true },
    ],
  });
  const progress = statusProgress(api, clock);
  await progress.start();

  progress.onEvent({ kind: "status", label: "first" });
  await clock.advance(2_000);
  progress.onEvent({ kind: "status", label: "second" });
  progress.onEvent({ kind: "status", label: "newest" });
  await clock.advance(2_999);
  assert.equal(calls.filter((call) => call.method === "editMessageText").length, 1);
  await clock.advance(1);

  const edits = calls.filter((call) => call.method === "editMessageText");
  assert.equal(edits.length, 2);
  assert.match(String(edits[1].args[2]), /newest/);
  assert.equal(calls.filter((call) => call.method === "sendMessage").length, 1);
  await progress.finish();
});

test("in-flight edits are serialized and coalesce to the last write", async () => {
  const clock = fakeClock();
  let resolveEdit!: (value: TgResponse) => void;
  const editDeferred = new Promise<TgResponse>((resolve) => {
    resolveEdit = resolve;
  });
  const { api, calls } = fakeApi({ editDeferred });
  const progress = statusProgress(api, clock);
  await progress.start();

  progress.onEvent({ kind: "status", label: "first" });
  await clock.advance(2_000);
  progress.onEvent({ kind: "status", label: "superseded" });
  progress.onEvent({ kind: "status", label: "last" });
  await clock.advance(2_000);
  assert.equal(calls.filter((call) => call.method === "editMessageText").length, 1);

  resolveEdit({ ok: true });
  await settle();
  const edits = calls.filter((call) => call.method === "editMessageText");
  assert.equal(edits.length, 2);
  assert.match(String(edits[1].args[2]), /last/);
  await progress.finish();
});

test("finish never throws when edit drain and delete fail, and clears typing", async () => {
  const clock = fakeClock();
  const editDeferred = Promise.reject(new Error("edit failed"));
  editDeferred.catch(() => {});
  const { api } = fakeApi({ editDeferred, deleteThrows: true });
  const logs: string[] = [];
  const progress = statusProgress(api, clock, { log: (line: string) => logs.push(line) });
  await progress.start();
  progress.onEvent({ kind: "status", label: "work" });
  await clock.advance(2_000);

  await assert.doesNotReject(progress.finish());
  assert.equal(clock.intervalCount(), 0);
  assert.ok(logs.some((line) => line.includes("edit")));
  assert.ok(logs.some((line) => line.includes("delete")));
  progress.onEvent({ kind: "status", label: "after finish" });
  await clock.advance(10_000);
});

test("status lane sends once silently in-topic, throttles at 2000ms, and deletes on finish", async () => {
  const clock = fakeClock();
  const { api, calls } = fakeApi();
  const progress = statusProgress(api, clock);
  await progress.start();

  const initial = calls.find((call) => call.method === "sendMessage");
  assert.deepEqual(initial?.args[0], {
    chatId: "-100",
    text: "🔄 Working…",
    messageThreadId: 44,
    disableNotification: true,
  });
  assert.deepEqual(calls.find((call) => call.method === "sendChatAction")?.args, ["-100", 44]);

  progress.onEvent({ kind: "thinking", text: "inspect" });
  await clock.advance(1_999);
  assert.equal(calls.filter((call) => call.method === "editMessageText").length, 0);
  await clock.advance(1);
  assert.equal(calls.filter((call) => call.method === "editMessageText").length, 1);
  await clock.advance(2_000);
  assert.equal(calls.filter((call) => call.method === "sendChatAction").length, 2);
  await progress.finish();
  assert.deepEqual(calls.find((call) => call.method === "deleteMessage")?.args, ["-100", 77]);
});

test("renderer keeps Latest independent and a deduplicated last-five Activity window", async () => {
  const clock = fakeClock();
  const { api, calls } = fakeApi();
  const progress = statusProgress(api, clock);
  await progress.start();
  const events: RunnerEvent[] = [
    { kind: "status", label: "one" },
    { kind: "thinking", text: "two" },
    { kind: "tool_call", phase: "started", callId: "3", name: "shell", input: "three" },
    { kind: "file_change", action: "modify", path: "four.ts" },
    { kind: "status", label: "five" },
    { kind: "status", label: "five" },
    { kind: "status", label: "six" },
    { kind: "message", text: "assistant item" },
  ];
  for (const event of events) progress.onEvent(event);
  await clock.advance(2_000);

  const body = String(calls.find((call) => call.method === "editMessageText")?.args[2]);
  assert.match(body, /^🔄 Working…\n\nLatest\nassistant item\n\nActivity\n/);
  assert.doesNotMatch(body, /\none\n/);
  assert.match(body, /two\nshell three\nmodify four\.ts\nfive\nsix$/);
  assert.equal(body.match(/\nfive(?:\n|$)/g)?.length, 1);
  await progress.finish();
});

test("progressFilter applies per-kind summary/drop semantics but message bypasses it", async () => {
  const clock = fakeClock();
  const { api, calls } = fakeApi();
  const progress = statusProgress(api, clock, {
    progressFilter: (event: RunnerEvent) => event.kind === "thinking" ? "drop" : "summary",
  });
  await progress.start();
  progress.onEvent({ kind: "status", label: "private label" });
  progress.onEvent({ kind: "thinking", text: "secret thought" });
  progress.onEvent({ kind: "tool_call", phase: "started", callId: "1", name: "shell", input: "secret args" });
  progress.onEvent({ kind: "file_change", action: "modify", path: "src/x.ts" });
  progress.onEvent({ kind: "message", text: "always latest" });
  await clock.advance(2_000);

  const body = String(calls.find((call) => call.method === "editMessageText")?.args[2]);
  assert.match(body, /Latest\nalways latest/);
  assert.match(body, /Activity\nstatus\nshell\nsrc\/x\.ts/);
  assert.doesNotMatch(body, /private label|secret thought|secret args/);
  await progress.finish();
});

test("private rich lane uses triggering message id for drafts and no status message", async () => {
  const clock = fakeClock();
  const { api, calls } = fakeApi();
  const progress = createTelegramTurnProgress({
    api,
    chatId: "501",
    chatType: "private",
    richSupported: true,
    draftId: 91,
    deps: clock,
  });
  await progress.start();
  progress.onEvent({ kind: "message", text: "draft text" });
  await settle();

  assert.equal(calls.some((call) => call.method === "sendMessage"), false);
  const draft = calls.find((call) => call.method === "sendRichMessageDraft");
  assert.deepEqual(draft?.args[0], {
    chatId: 501,
    draftId: 91,
    richMessage: { html: "Latest\ndraft text" },
  });
  await progress.finish();
});

test("rendered status remains below Telegram's 4096-character ceiling", async () => {
  const clock = fakeClock();
  const { api, calls } = fakeApi();
  const progress = statusProgress(api, clock);
  await progress.start();
  progress.onEvent({ kind: "message", text: "x".repeat(10_000) });
  await clock.advance(2_000);
  const body = String(calls.find((call) => call.method === "editMessageText")?.args[2]);
  assert.ok(body.length < 4_096);
  await progress.finish();
});

test("toolProgress enforces off/new/all/verbose and neutral completion markers", async () => {
  for (const mode of ["off", "new", "all", "verbose"] as const) {
    const clock = fakeClock();
    const { api, calls } = fakeApi();
    const progress = statusProgress(api, clock, { progressFilter: createToolProgressFilter(mode) });
    await progress.start();
    progress.onEvent({ kind: "thinking", text: "ignored" });
    progress.onEvent({ kind: "tool_call", phase: "started", callId: "1", name: "read", input: "a.ts" });
    progress.onEvent({ kind: "tool_call", phase: "completed", callId: "1", name: "read", input: "a.ts", resultSummary: "line one\nline two" });
    await clock.advance(2_000);
    const body = String(calls.find((call) => call.method === "editMessageText")?.args[2] ?? "");
    if (mode === "off") assert.equal(body, "");
    else assert.match(body, /▶ read a\.ts/);
    if (mode === "all") assert.match(body, /■ read/);
    if (mode === "verbose") assert.match(body, /■ read — line one line two/);
    if (mode === "new") assert.doesNotMatch(body, /■ read/);
    assert.doesNotMatch(body, /ignored/);
    await progress.finish();
  }
});
