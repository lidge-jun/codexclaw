import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor, rollup, renderDoctor } from "../src/doctor.ts";
import { runReset, parseResetScope } from "../src/reset.ts";
import { chatSearch, renderChatSearch } from "../src/chat-search.ts";

// ---- doctor ---------------------------------------------------------------

function makePluginRoot(opts: { hooks?: string[]; skills?: string[]; brokenSkill?: boolean; roles?: string[] } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-doctor-"));
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  const hooks = opts.hooks ?? ["./hooks/a.json"];
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ hooks }));
  for (const h of hooks) {
    const p = join(root, h);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, "{}");
  }
  for (const s of opts.skills ?? ["dev"]) {
    mkdirSync(join(root, "skills", s, "agents"), { recursive: true });
    writeFileSync(join(root, "skills", s, "SKILL.md"), "---\nname: x\n---\n");
    if (!opts.brokenSkill) writeFileSync(join(root, "skills", s, "agents", "openai.yaml"), "policy: {}\n");
  }
  mkdirSync(join(root, "agents"), { recursive: true });
  for (const r of opts.roles ?? ["explorer"]) writeFileSync(join(root, "agents", `${r}.toml`), `name="${r}"\n`);
  return root;
}

test("rollup: FAIL > WARN > PASS", () => {
  assert.equal(rollup([{ name: "a", severity: "PASS", evidence: "" }, { name: "b", severity: "WARN", evidence: "" }]), "WARN");
  assert.equal(rollup([{ name: "a", severity: "WARN", evidence: "" }, { name: "b", severity: "FAIL", evidence: "" }]), "FAIL");
  assert.equal(rollup([{ name: "a", severity: "PASS", evidence: "" }]), "PASS");
});

test("doctor: healthy plugin root -> PASS with evidence on every check", () => {
  const root = makePluginRoot();
  const report = runDoctor(root);
  assert.equal(report.overall, "PASS");
  for (const c of report.checks) assert.ok(c.evidence.length > 0, `check ${c.name} has no evidence`);
  assert.match(renderDoctor(report), /overall: PASS/);
});

test("doctor: missing hook file -> FAIL on hooks", () => {
  const root = makePluginRoot({ hooks: ["./hooks/present.json"] });
  // add a manifest hook that points at a missing file
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ hooks: ["./hooks/present.json", "./hooks/ghost.json"] }));
  const report = runDoctor(root);
  const hooks = report.checks.find((c) => c.name === "hooks");
  assert.equal(hooks?.severity, "FAIL");
  assert.match(hooks?.evidence ?? "", /ghost\.json/);
  assert.equal(report.overall, "FAIL");
});

test("doctor: skill missing openai.yaml -> FAIL on skills", () => {
  const root = makePluginRoot({ brokenSkill: true });
  const report = runDoctor(root);
  assert.equal(report.checks.find((c) => c.name === "skills")?.severity, "FAIL");
});

// ---- reset ----------------------------------------------------------------

function makeStateTree(): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-reset-"));
  const sd = join(cwd, ".codexclaw");
  mkdirSync(join(sd, "sessions"), { recursive: true });
  writeFileSync(join(sd, "sessions", "s1.json"), "{}");
  writeFileSync(join(sd, "sessions", "s2.json"), "{}");
  writeFileSync(join(sd, "ledger.jsonl"), "{}\n");
  mkdirSync(join(sd, "interview"), { recursive: true });
  writeFileSync(join(sd, "interview", "freeze.json"), "{}");
  return cwd;
}

test("parseResetScope: flags map to scopes, default state", () => {
  assert.equal(parseResetScope([]), "state");
  assert.equal(parseResetScope(["--all"]), "all");
  assert.equal(parseResetScope(["--generated"]), "generated");
});

test("reset --state: removes only session json + ledger, leaves interview/ intact", () => {
  const cwd = makeStateTree();
  const r = runReset(cwd, "state");
  assert.equal(r.removed.filter((p) => p.endsWith(".json") || p.endsWith(".jsonl")).length, 3);
  // interview/ must survive
  assert.ok(existsSync(join(cwd, ".codexclaw", "interview", "freeze.json")), "interview/ must be untouched by --state");
  // sessions dir emptied of json
  assert.equal(readdirSync(join(cwd, ".codexclaw", "sessions")).length, 0);
});

test("reset --generated: removes interview/ only, leaves session state", () => {
  const cwd = makeStateTree();
  runReset(cwd, "generated");
  assert.ok(!existsSync(join(cwd, ".codexclaw", "interview")), "interview/ should be gone");
  assert.ok(existsSync(join(cwd, ".codexclaw", "sessions", "s1.json")), "session state must survive --generated");
});

test("reset --all: removes the whole .codexclaw subtree and nothing above it", () => {
  const cwd = makeStateTree();
  // a sibling file outside .codexclaw must never be touched
  writeFileSync(join(cwd, "sibling.txt"), "keep me");
  runReset(cwd, "all");
  assert.ok(!existsSync(join(cwd, ".codexclaw")), ".codexclaw should be gone");
  assert.ok(existsSync(join(cwd, "sibling.txt")), "files outside .codexclaw must never be touched");
});

// ---- chat-search ----------------------------------------------------------

test("chatSearch: empty term -> unavailable", async () => {
  const out = await chatSearch("  ");
  assert.equal(out.status, "unavailable");
});

test("chatSearch: ok results from a stub app-server", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ results: [{ thread_id: "t1", snippet: "hello" }] }), { status: 200 })) as unknown as typeof fetch;
  const out = await chatSearch("hello", { fetchImpl });
  assert.equal(out.status, "ok");
  assert.match(renderChatSearch(out), /t1/);
});

test("chatSearch: empty results -> no_results", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ results: [] }), { status: 200 })) as unknown as typeof fetch;
  const out = await chatSearch("nope", { fetchImpl });
  assert.equal(out.status, "no_results");
});

test("chatSearch: connection failure -> unavailable (graceful, never throws)", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  const out = await chatSearch("x", { fetchImpl });
  assert.equal(out.status, "unavailable");
  assert.match(renderChatSearch(out), /unavailable/);
});

test("chatSearch: HTTP error -> unavailable", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
  const out = await chatSearch("x", { fetchImpl });
  assert.equal(out.status, "unavailable");
});
