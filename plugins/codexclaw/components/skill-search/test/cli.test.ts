import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseFlags } from "../src/cli.ts";
import { JAW_REGISTRY_URL } from "../src/sources.ts";
import type { FetchText } from "../src/types.ts";

function isolateCache(t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), "cxc-skcli-"));
  const prev = process.env.CODEXCLAW_HOME;
  process.env.CODEXCLAW_HOME = dir;
  t.after(() => {
    if (prev === undefined) delete process.env.CODEXCLAW_HOME;
    else process.env.CODEXCLAW_HOME = prev;
    rmSync(dir, { recursive: true, force: true });
  });
}

function captureStdout(t: { after: (fn: () => void) => void }): { out: () => string } {
  let buf = "";
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    buf += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  t.after(() => {
    process.stdout.write = orig;
  });
  return { out: () => buf };
}

const registry = JSON.stringify({
  skills: {
    "telegram-send": { name: "Telegram Send", description: "send telegram messages", category: "communication" },
    tdd: { name: "TDD", description: "test driven development loop", superseded_by: "dev-testing" },
  },
});

const fetchWith = (extra: Record<string, string> = {}): FetchText => async (url) => {
  if (url === JAW_REGISTRY_URL) return registry;
  if (extra[url] !== undefined) return extra[url];
  throw new Error(`unexpected fetch ${url}`);
};

test("parseFlags: source/limit/json/refresh + positional rest", () => {
  const f = parseFlags(["telegram", "bot", "--source", "all", "--limit", "3", "--json", "--refresh"]);
  assert.deepEqual(f.rest, ["telegram", "bot"]);
  assert.equal(f.source, "all");
  assert.equal(f.limit, 3);
  assert.ok(f.json && f.refresh);
});

test("search --json returns scored rows with superseded demotion visible", async (t) => {
  isolateCache(t);
  const cap = captureStdout(t);
  const code = await main(["search", "tdd", "--json"], fetchWith());
  assert.equal(code, 0);
  const rows = JSON.parse(cap.out());
  assert.equal(rows[0].id, "tdd");
  assert.equal(rows[0].supersededBy, "dev-testing");
});

test("search plain output includes footer pointer and raw url", async (t) => {
  isolateCache(t);
  const cap = captureStdout(t);
  const code = await main(["search", "telegram"], fetchWith());
  assert.equal(code, 0);
  assert.match(cap.out(), /telegram-send \(jaw/);
  assert.match(cap.out(), /raw\.githubusercontent\.com/);
  assert.match(cap.out(), /cxc skill show/);
});

test("show prepends the adapter preamble to the fetched body", async (t) => {
  isolateCache(t);
  const cap = captureStdout(t);
  const bodyUrl = "https://raw.githubusercontent.com/lidge-jun/cli-jaw-skills/main/telegram-send/SKILL.md";
  const code = await main(["show", "telegram-send"], fetchWith({ [bodyUrl]: "# Telegram Send\nbody" }));
  assert.equal(code, 0);
  const out = cap.out();
  assert.match(out, /codexclaw external skill adapter/);
  assert.match(out, /cxc-dev\) always wins/);
  assert.match(out, /# Telegram Send/);
  assert.ok(out.indexOf("external skill adapter") < out.indexOf("# Telegram Send"));
});

test("show for unknown id exits 1 with stderr note", async (t) => {
  isolateCache(t);
  const cap = captureStdout(t);
  const code = await main(["show", "nope"], fetchWith());
  assert.equal(code, 1);
  assert.equal(cap.out(), "");
});

test("no command prints usage", async (t) => {
  const cap = captureStdout(t);
  const code = await main([], fetchWith());
  assert.equal(code, 0);
  assert.match(cap.out(), /cxc skill/);
});
