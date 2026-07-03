/** runner.test.ts — buildExecArgs / parseExecEvent (pure) + runTurn against a fake codex bin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildExecArgs, parseExecEvent, runTurn } from "../src/runner.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-codex.mjs");
chmodSync(FAKE, 0o755);

function withMode(mode: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.FAKE_CODEX_MODE;
  process.env.FAKE_CODEX_MODE = mode;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.FAKE_CODEX_MODE;
    else process.env.FAKE_CODEX_MODE = prev;
  });
}

test("buildExecArgs: new run reads prompt from stdin (not in argv)", () => {
  const args = buildExecArgs({ prompt: "hello", model: "gpt-5.5" });
  assert.deepEqual(args, [
    "exec",
    "-m",
    "gpt-5.5",
    "--dangerously-bypass-approvals-and-sandbox",
    "--skip-git-repo-check",
    "--json",
  ]);
  assert.ok(!args.includes("hello"));
});

test("buildExecArgs: resume guards SESSION_ID + PROMPT behind -- (flag-injection safe)", () => {
  const args = buildExecArgs({ threadId: "th-9", prompt: "again", model: null });
  assert.deepEqual(args, [
    "exec",
    "resume",
    "--dangerously-bypass-approvals-and-sandbox",
    "--skip-git-repo-check",
    "--json",
    "--",
    "th-9",
    "again",
  ]);
  // A dash-prefixed prompt lands after `--`, never parsed as a flag.
  const evil = buildExecArgs({ threadId: "t", prompt: "-c model=x", model: null });
  const sep = evil.indexOf("--");
  assert.ok(sep >= 0 && evil[sep + 2] === "-c model=x");
});

test("buildExecArgs: fullAccess=false drops the bypass flag", () => {
  const args = buildExecArgs({ prompt: "x", fullAccess: false });
  assert.ok(!args.includes("--dangerously-bypass-approvals-and-sandbox"));
});

test("parseExecEvent: recognizes each event kind, ignores noise", () => {
  assert.deepEqual(parseExecEvent('{"type":"thread.started","thread_id":"t1"}'), {
    kind: "thread",
    threadId: "t1",
  });
  assert.deepEqual(
    parseExecEvent('{"type":"item.completed","item":{"type":"agent_message","text":"hi"}}'),
    { kind: "message", text: "hi" },
  );
  assert.deepEqual(
    parseExecEvent('{"type":"item.started","item":{"type":"command_execution","command":"ls -la"}}'),
    { kind: "status", label: "$ ls -la" },
  );
  assert.deepEqual(parseExecEvent('{"type":"turn.completed","usage":{"input_tokens":3}}'), {
    kind: "done",
    usage: { input_tokens: 3 },
  });
  assert.deepEqual(parseExecEvent('{"type":"turn.failed","error":{"message":"boom"}}'), {
    kind: "fail",
    message: "boom",
  });
  assert.equal(parseExecEvent("not json"), null);
  assert.equal(parseExecEvent(""), null);
  assert.equal(
    parseExecEvent('{"type":"item.completed","item":{"type":"agent_message","text":"  "}}'),
    null,
  );
});

test("runTurn: new run captures thread id, streams events, returns text", async () => {
  await withMode("ok", async () => {
    const events: string[] = [];
    const result = await runTurn({
      workdir: here,
      prompt: "1+1?",
      codexBin: FAKE,
      onEvent: (e) => events.push(e.kind),
    });
    assert.equal(result.ok, true);
    assert.equal(result.threadId, "thread-fresh-1");
    assert.match(result.text, /reply to: 1\+1\?/);
    assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 5 });
    assert.ok(events.includes("thread"));
    assert.ok(events.includes("message"));
    assert.ok(events.includes("done"));
  });
});

test("runTurn: turn.failed surfaces as ok:false with the message", async () => {
  await withMode("fail", async () => {
    const result = await runTurn({ workdir: here, prompt: "x", codexBin: FAKE });
    assert.equal(result.ok, false);
    assert.equal(result.error, "model refused");
  });
});

test("runTurn: resume with lost rollout triggers the re-seed fallback branch", async () => {
  await withMode("lost", async () => {
    const status: string[] = [];
    const result = await runTurn({
      workdir: here,
      prompt: "hi",
      threadId: "dead-thread",
      codexBin: FAKE,
      reseedBlock: "[context re-seed] prior turns...",
      onEvent: (e) => {
        if (e.kind === "status") status.push(e.label);
      },
    });
    // Fake returns "lost" for BOTH the resume and the re-seed new-run (mode is
    // global), so the final result is still a failure — but the re-seed status
    // must have been emitted, proving the fallback branch executed.
    assert.ok(status.includes("re-seeding session"));
    assert.equal(result.ok, false);
  });
});

test("runTurn: timeout terminates the child and reports timeout", async () => {
  await withMode("hang", async () => {
    const result = await runTurn({
      workdir: here,
      prompt: "x",
      codexBin: FAKE,
      timeoutMs: 500,
    });
    assert.equal(result.ok, false);
    assert.match(String(result.error), /timed out/);
  });
});

test("buildExecArgs: effort appends -c model_reasoning_effort in both branches; default omitted", () => {
  const fresh = buildExecArgs({ prompt: "p", effort: "high" });
  const ci = fresh.indexOf("-c");
  assert.ok(ci > -1);
  assert.equal(fresh[ci + 1], "model_reasoning_effort=high");

  const none = buildExecArgs({ prompt: "p", effort: "default" });
  assert.equal(none.includes("-c"), false);
  const absent = buildExecArgs({ prompt: "p" });
  assert.equal(absent.includes("-c"), false);

  const resume = buildExecArgs({ prompt: "p", threadId: "t-1", effort: "minimal", model: "m1" });
  const sep = resume.indexOf("--");
  const cIdx = resume.indexOf("-c");
  assert.ok(cIdx > -1 && cIdx < sep, "effort flag must precede -- in resume argv");
  assert.equal(resume[cIdx + 1], "model_reasoning_effort=minimal");
});
