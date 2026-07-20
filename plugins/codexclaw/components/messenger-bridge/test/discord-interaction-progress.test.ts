import { test } from "node:test";
import assert from "node:assert/strict";
import type { DiscordApi } from "../src/discord-api.ts";
import {
  createDiscordInteractionProgress,
  DISCORD_INTERACTION_HANDOFF_MS,
  DISCORD_INTERACTION_PROGRESS_EDIT_MS,
  type DiscordInteractionProgressDeps,
} from "../src/discord-interaction-progress.ts";
import { createToolProgressFilter, type ToolProgressMode } from "../src/tool-progress.ts";

function harness(options: {
  filter?: Parameters<typeof createDiscordInteractionProgress>[0]["progressFilter"];
  toolProgress?: ToolProgressMode;
  handoffSendOk?: boolean;
  pointerOk?: boolean;
  initialOk?: boolean;
} = {}) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const original: unknown[] = [];
  const sends: string[] = [];
  const sendOptions: unknown[] = [];
  const edits: unknown[] = [];
  const logs: string[] = [];
  const deps: DiscordInteractionProgressDeps = {
    now: () => now,
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout: (id) => timers.delete(id as number),
  };
  const api = {
    editOriginalInteractionResponse: async (_app: string, _token: string, data: unknown) => {
      original.push(data);
      if (original.length === 1 && options.initialOk === false) return { ok: false, status: 500, error: "initial failed" };
      if (original.length > 1 && options.pointerOk === false) return { ok: false, status: 401, error: "pointer failed" };
      return { ok: true, status: 200, data: { id: "original" } };
    },
    sendMessage: async (_channel: string, content: string, sendOpts?: unknown) => {
      sends.push(content);
      sendOptions.push(sendOpts);
      if (options.handoffSendOk === false) return { ok: false, status: 500, error: "handoff failed" };
      return { ok: true, status: 200, data: { id: "handoff" } };
    },
    editMessage: async (_channel: string, id: string, content: string, embeds: unknown[]) => {
      edits.push({ id, content, embeds });
      return { ok: true, status: 200, data: { id } };
    },
  } as unknown as DiscordApi;
  const progress = createDiscordInteractionProgress({
    api,
    applicationId: "app",
    interactionToken: "token",
    channelId: "channel",
    guildId: "guild",
    progressFilter: options.toolProgress ? createToolProgressFilter(options.toolProgress) : options.filter,
    deps,
    log: (line) => logs.push(line),
  });
  const advance = async (ms: number) => {
    now += ms;
    const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
    for (const [id, timer] of due) {
      timers.delete(id);
      timer.callback();
    }
    for (let drain = 0; drain < 6; drain += 1) await Promise.resolve();
  };
  return { progress, original, sends, sendOptions, edits, timers, logs, advance };
}

test("progress modes render full, per-kind summary, drop, and message bypass", async () => {
  const full = harness();
  await full.progress.start();
  full.progress.onEvent({ kind: "tool_call", phase: "started", callId: "1", name: "exec", input: "secret args" });
  await full.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.match(JSON.stringify(full.original.at(-1)), /exec secret args/);

  const summary = harness({ filter: () => "summary" });
  await summary.progress.start();
  summary.progress.onEvent({ kind: "tool_call", phase: "started", callId: "1", name: "exec", input: "hidden" });
  await summary.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.match(JSON.stringify(summary.original.at(-1)), /exec/);
  assert.doesNotMatch(JSON.stringify(summary.original.at(-1)), /hidden/);
  summary.progress.onEvent({ kind: "file_change", path: "src/a.ts", action: "delete" });
  await summary.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.match(JSON.stringify(summary.original.at(-1)), /src\/a.ts/);
  assert.doesNotMatch(JSON.stringify(summary.original.at(-1)), /delete/);
  summary.progress.onEvent({ kind: "thinking", text: "private reasoning" });
  await summary.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.match(JSON.stringify(summary.original.at(-1)), /Thinking: thinking/);
  assert.doesNotMatch(JSON.stringify(summary.original.at(-1)), /private reasoning/);
  summary.progress.onEvent({ kind: "status", label: "sensitive status detail" });
  await summary.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.match(JSON.stringify(summary.original.at(-1)), /Coding: status/);
  assert.doesNotMatch(JSON.stringify(summary.original.at(-1)), /sensitive status detail/);

  const drop = harness({ filter: () => "drop" });
  await drop.progress.start();
  drop.progress.onEvent({ kind: "status", label: "ignored" });
  await drop.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.equal(drop.original.length, 1);
  drop.progress.onEvent({ kind: "message", text: "latest answer" });
  await drop.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  assert.match(JSON.stringify(drop.original.at(-1)), /latest answer/);
});

test("tool progress modes preserve generic off state and gate lifecycle edits", async () => {
  for (const mode of ["off", "new", "all", "verbose"] as const) {
    const h = harness({ toolProgress: mode });
    await h.progress.start();
    h.progress.onEvent({ kind: "thinking", text: "ignored" });
    h.progress.onEvent({ kind: "tool_call", phase: "started", callId: "1", name: "read", input: "a.ts" });
    await h.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
    h.progress.onEvent({
      kind: "tool_call", phase: "completed", callId: "1", name: "read", input: "a.ts",
      outcome: "success", resultSummary: "done",
    });
    await h.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
    const rendered = JSON.stringify(h.original);
    if (mode === "off") assert.equal(h.original.length, 1);
    else assert.match(rendered, /▶ read a\.ts/);
    if (mode === "all") assert.match(rendered, /✓ read/);
    if (mode === "verbose") assert.match(rendered, /✓ read — done/);
    if (mode === "new") assert.doesNotMatch(rendered, /✓ read/);
    assert.doesNotMatch(rendered, /ignored/);
    await h.progress.finish({ ok: true });
  }
});

test("checked failures keep the reachable target and never reject finish", async () => {
  const initial = harness({ initialOk: false });
  await initial.progress.start();
  assert.match(initial.logs.join("\n"), /initial failed/);
  await initial.progress.finish({ ok: true });

  const sendFailure = harness({ handoffSendOk: false });
  await sendFailure.progress.start();
  await sendFailure.advance(DISCORD_INTERACTION_HANDOFF_MS);
  await sendFailure.advance(0);
  await sendFailure.progress.finish({ ok: false, error: "turn failed" });
  assert.equal(sendFailure.edits.length, 0);
  assert.match(JSON.stringify(sendFailure.original.at(-1)), /turn failed/);
  assert.match(sendFailure.logs.join("\n"), /handoff failed/);

  const pointerFailure = harness({ pointerOk: false });
  await pointerFailure.progress.start();
  await pointerFailure.advance(DISCORD_INTERACTION_HANDOFF_MS);
  await pointerFailure.advance(0);
  await pointerFailure.progress.finish({ ok: true });
  assert.match(pointerFailure.logs.join("\n"), /pointer failed/);
  assert.match(JSON.stringify(pointerFailure.edits.at(-1)), /Done/);
});

test("finish joins a started handoff before choosing one terminal target", async () => {
  let timerCallback: (() => void) | undefined;
  let releaseSend!: () => void;
  const sendGate = new Promise<void>((resolve) => { releaseSend = resolve; });
  const original: unknown[] = [];
  const edits: unknown[] = [];
  const api = {
    editOriginalInteractionResponse: async (_app: string, _token: string, data: unknown) => {
      original.push(data);
      return { ok: true, status: 200, data: { id: "original" } };
    },
    sendMessage: async () => {
      await sendGate;
      return { ok: true, status: 200, data: { id: "handoff" } };
    },
    editMessage: async (_channel: string, id: string, content: string, embeds: unknown[]) => {
      edits.push({ id, content, embeds });
      return { ok: true, status: 200, data: { id } };
    },
  } as unknown as DiscordApi;
  const progress = createDiscordInteractionProgress({
    api,
    applicationId: "app",
    interactionToken: "token",
    channelId: "channel",
    deps: {
      now: () => 0,
      setTimeout: (callback) => { timerCallback = callback; return 1; },
      clearTimeout: () => {},
    },
  });
  await progress.start();
  timerCallback?.();
  const finishing = progress.finish({ ok: true });
  await Promise.resolve();
  assert.equal(edits.length, 0);
  releaseSend();
  await finishing;
  assert.equal(edits.filter((entry) => JSON.stringify(entry).includes("Done")).length, 1);
  assert.equal(original.filter((entry) => JSON.stringify(entry).includes("Done")).length, 0);
});

test("handoff occurs at 14 minutes and all later edits use the channel message", async () => {
  const h = harness();
  await h.progress.start();
  await h.advance(DISCORD_INTERACTION_HANDOFF_MS - 1);
  assert.deepEqual(h.sends, []);
  await h.advance(1);
  await h.advance(0);
  assert.deepEqual(h.sends, ["Working…"]);
  assert.deepEqual(h.sendOptions, [{ suppressNotifications: true }]);
  assert.match(JSON.stringify(h.original.at(-1)), /discord.com\/channels\/guild\/channel\/handoff/);
  h.progress.onEvent({ kind: "status", label: "after handoff" });
  await h.advance(DISCORD_INTERACTION_PROGRESS_EDIT_MS);
  await h.progress.finish({ ok: true });
  assert.match(JSON.stringify(h.edits[0]), /after handoff/);
  assert.match(JSON.stringify(h.edits.at(-1)), /Done/);
  assert.equal(h.timers.size, 0);
});

test("finish cancels an unstarted handoff and writes exactly one terminal edit", async () => {
  const h = harness();
  await h.progress.start();
  await h.progress.finish({ ok: false, error: "boom" });
  await h.advance(DISCORD_INTERACTION_HANDOFF_MS);
  assert.deepEqual(h.sends, []);
  assert.equal(h.original.filter((entry) => JSON.stringify(entry).includes("Error: boom")).length, 1);
  assert.equal(h.timers.size, 0);
});
