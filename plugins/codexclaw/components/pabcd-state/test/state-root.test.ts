import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStateRootCache, DurableStateDisabledError, deriveProjectId, normalizeRemoteUrl, readGitInfo,
  resolveStateRoot,
} from "../src/state-root.ts";
import { ensureCodexclawDir, ensureDurableDir, PRIVATE_GITIGNORE_TEXT } from "../src/codexclaw-dir.ts";
import { appendLedger, LEDGER_FILE } from "../src/state.ts";
import { hasValidReceipt } from "../src/subagent-evidence.ts";
import { writeInterviewPolicy } from "../src/interview-policy.ts";
import { buildGoalplan, GoalplanExistsError, readGoalplan, writeGoalplan } from "../src/goalplan.ts";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "src", "cli.ts");
const SAVED = ["CODEXCLAW_HOME", "CODEXCLAW_STATE_ROOT", "CODEXCLAW_STATE_MODE"] as const;
let saved: Record<string, string | undefined> = {};
let scratch = "";

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function repo(origin: string | null): string {
  const dir = realpathSync(mkdtempSync(join(scratch, "repo-")));
  git(dir, "init", "-q");
  if (origin) git(dir, "remote", "add", "origin", origin);
  writeFileSync(join(dir, "README.md"), "x\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "init");
  clearStateRootCache();
  return dir;
}

beforeEach(() => {
  saved = Object.fromEntries(SAVED.map((k) => [k, process.env[k]]));
  scratch = realpathSync(mkdtempSync(join(tmpdir(), "cxc-state-root-")));
  process.env.CODEXCLAW_HOME = join(scratch, "home");
  delete process.env.CODEXCLAW_STATE_ROOT;
  delete process.env.CODEXCLAW_STATE_MODE;
  clearStateRootCache();
});

afterEach(() => {
  for (const k of SAVED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  clearStateRootCache();
  rmSync(scratch, { recursive: true, force: true });
});

test("normalizeRemoteUrl: ssh, scp, https with credentials, .git suffix and case all agree", () => {
  const forms = [
    "git@github.com:Acme/App.git",
    "ssh://git@github.com/acme/app",
    "https://user:tok3n@github.com/ACME/app.git?x=1#frag",
    "https://github.com/acme/app/",
    "git://github.com:9418/acme/app.git",
  ];
  for (const f of forms) assert.deepEqual(normalizeRemoteUrl(f), { key: "github.com/acme/app", host: "github.com", owner: "acme" }, f);
  assert.equal(normalizeRemoteUrl("/srv/git/app.git"), null);
  assert.equal(normalizeRemoteUrl("file:///srv/git/app.git"), null);
  assert.equal(normalizeRemoteUrl("https://github.com/only"), null);
  assert.equal(normalizeRemoteUrl("https://github.com/../etc"), null);
  assert.equal(normalizeRemoteUrl(""), null);
});

test("project id: readable, collision-resistant, and never carries credentials", () => {
  const a = deriveProjectId("/x", null, normalizeRemoteUrl("https://u:secret@github.com/acme/app.git"));
  assert.match(a, /^github\.com__acme__app-[0-9a-f]{32}$/);
  assert.ok(!a.includes("secret"));
  const b = deriveProjectId("/x", null, normalizeRemoteUrl("https://gitlab.com/acme/app"));
  assert.notEqual(a, b);
});

test("auto mode: allowlisted owner -> repo, foreign owner -> external, no origin -> local, no git -> repo", () => {
  assert.equal(resolveStateRoot(repo("git@github.com:lidge-jun/codexclaw.git")).mode, "repo");
  const foreign = repo("https://github.com/acme/app.git");
  const r = resolveStateRoot(foreign);
  assert.equal(r.mode, "external");
  assert.equal(r.durableDir, join(scratch, "home", "projects", r.projectId!, "state"));
  assert.equal(r.devlogDir, join(scratch, "home", "projects", r.projectId!, "devlog"));
  assert.equal(resolveStateRoot(repo(null)).mode, "local");
  const plain = realpathSync(mkdtempSync(join(scratch, "plain-")));
  const p = resolveStateRoot(plain);
  assert.equal(p.mode, "repo");
  assert.equal(p.durableDir, join(plain, ".codexclaw"));
  assert.equal(p.devlogDir, join(plain, "devlog"));
});

test("precedence: env mode > config project > config mode; relative roots and in-checkout config are ignored", () => {
  const dir = repo("https://github.com/acme/app.git");
  mkdirSync(join(scratch, "home"), { recursive: true });
  writeFileSync(join(scratch, "home", "config.json"), JSON.stringify({
    state: { mode: "none", projects: { "github.com/acme/app": "local" }, root: "relative/dir" },
  }));
  assert.equal(resolveStateRoot(dir).mode, "local");
  process.env.CODEXCLAW_STATE_MODE = "external";
  process.env.CODEXCLAW_STATE_ROOT = "not/absolute";
  const r = resolveStateRoot(dir);
  assert.equal(r.mode, "external");
  assert.equal(r.stateBase, join(scratch, "home", "projects"));
  assert.ok(r.warnings.some((w) => w.includes("CODEXCLAW_STATE_ROOT")));
  process.env.CODEXCLAW_STATE_ROOT = join(scratch, "private-state");
  assert.equal(resolveStateRoot(dir).stateBase, join(scratch, "private-state"));

  // A config living inside the checkout must not steer it.
  process.env.CODEXCLAW_HOME = join(dir, ".cfg");
  mkdirSync(join(dir, ".cfg"));
  writeFileSync(join(dir, ".cfg", "config.json"), JSON.stringify({ state: { mode: "repo" } }));
  delete process.env.CODEXCLAW_STATE_MODE;
  delete process.env.CODEXCLAW_STATE_ROOT;
  const inside = resolveStateRoot(dir);
  assert.equal(inside.mode, "external");
  assert.ok(inside.warnings.some((w) => w.includes("inside the checkout")));
  // ...and neither may an external root that points back into it.
  process.env.CODEXCLAW_HOME = join(scratch, "home");
  process.env.CODEXCLAW_STATE_MODE = "external";
  process.env.CODEXCLAW_STATE_ROOT = join(dir, "state");
  const loop = resolveStateRoot(dir);
  assert.match(loop.disabledReason ?? "", /inside the checkout/);
  assert.throws(() => ensureDurableDir(dir), DurableStateDisabledError);
});

test("worktrees of one repository share the external root, and it survives removing a worktree", () => {
  const main = repo("https://github.com/acme/app.git");
  const wt = join(scratch, "wt-feature");
  git(main, "worktree", "add", "-q", "-b", "feature", wt);
  clearStateRootCache();
  const a = resolveStateRoot(main);
  const b = resolveStateRoot(wt);
  assert.equal(readGitInfo(wt)!.commonDir, join(main, ".git"));
  assert.equal(a.projectId, b.projectId);
  assert.equal(a.durableDir, b.durableDir);
  appendLedger(wt, { ts: "t", sessionId: "s1", from: "IDLE", to: "P", reason: "test" } as never);
  git(main, "worktree", "remove", "--force", wt);
  assert.equal(existsSync(wt), false);
  assert.match(readFileSync(join(a.durableDir, LEDGER_FILE), "utf8"), /"sessionId":"s1"/);
  assert.ok(existsSync(join(a.projectDir!, "project.json")));
  // Nothing durable landed in either checkout.
  assert.equal(existsSync(join(main, ".codexclaw", LEDGER_FILE)), false);
});

test("no-origin worktrees share one local fallback id keyed by the common git dir", () => {
  const main = repo(null);
  const wt = join(scratch, "wt-b");
  git(main, "worktree", "add", "-q", "-b", "b", wt);
  clearStateRootCache();
  assert.equal(deriveProjectId(main, readGitInfo(main), null), deriveProjectId(wt, readGitInfo(wt), null));
});

test("local/external hide codexclaw files via info/exclude (idempotent); repo mode never touches it", () => {
  const foreign = repo("https://github.com/acme/app.git");
  ensureDurableDir(foreign);
  ensureCodexclawDir(foreign);
  ensureDurableDir(foreign);
  const exclude = readFileSync(join(foreign, ".git", "info", "exclude"), "utf8");
  assert.equal(exclude.split("\n").filter((l) => l === "/.codexclaw/").length, 1);
  assert.ok(exclude.includes("/codexclaw.json"));
  assert.equal(readFileSync(join(foreign, ".codexclaw", ".gitignore"), "utf8"), PRIVATE_GITIGNORE_TEXT);
  writeInterviewPolicy(foreign, "always");
  assert.equal(existsSync(join(foreign, "codexclaw.json")), false);
  assert.equal(git(foreign, "status", "--porcelain"), "");

  const local = repo(null);
  ensureDurableDir(local);
  mkdirSync(join(local, "devlog", "_plan"), { recursive: true });
  writeFileSync(join(local, "devlog", "_plan", "x.md"), "x\n");
  assert.equal(git(local, "status", "--porcelain"), "");

  const own = repo("git@github.com:lidge-jun/x.git");
  const before = readFileSync(join(own, ".git", "info", "exclude"), "utf8");
  ensureDurableDir(own);
  assert.equal(readFileSync(join(own, ".git", "info", "exclude"), "utf8"), before);
});

test("mode none: durable writes are refused or skipped, never created", () => {
  const dir = repo("https://github.com/acme/app.git");
  process.env.CODEXCLAW_STATE_MODE = "none";
  assert.throws(() => ensureDurableDir(dir), DurableStateDisabledError);
  appendLedger(dir, { ts: "t", sessionId: "s1", from: "IDLE", to: "P", reason: "test" } as never);
  assert.equal(existsSync(resolveStateRoot(dir).durableDir), false);
  assert.equal(existsSync(join(dir, ".codexclaw", LEDGER_FILE)), false);
  assert.equal(hasValidReceipt(dir, join(dir, ".codexclaw", "evidence", "r.json")), false);
});

test("mode none: hook entry points exit 0", () => {
  const dir = repo("https://github.com/acme/app.git");
  const env = { ...process.env, CODEXCLAW_STATE_MODE: "none", CODEX_HOME: join(scratch, "codex"), CODEX_SQLITE_HOME: join(scratch, "codex") };
  const events: Array<[string, Record<string, unknown>]> = [
    ["session-start", { hook_event_name: "SessionStart", session_id: "sess-none", cwd: dir, source: "startup" }],
    ["user-prompt-submit", { hook_event_name: "UserPromptSubmit", session_id: "sess-none", cwd: dir, prompt: "orchestrate P" }],
    ["subagent-stop", { hook_event_name: "SubagentStop", session_id: "sess-none", cwd: dir, agent_type: "worker", agent_id: "a1", last_assistant_message: "done" }],
    ["stop", { hook_event_name: "Stop", session_id: "sess-none", cwd: dir, stop_hook_active: false }],
  ];
  for (const [event, payload] of events) {
    const r = spawnSync(process.execPath, [CLI, "hook", event], { input: JSON.stringify(payload), env, encoding: "utf8", cwd: dir });
    assert.equal(r.status, 0, event + ": " + r.stderr);
  }
  assert.equal(existsSync(join(dir, ".codexclaw", LEDGER_FILE)), false);
});

test("evidence guard follows the external root and keeps rejecting symlinks and the legacy dir", () => {
  const dir = repo("https://github.com/acme/app.git");
  const ev = join(ensureDurableDir(dir), "evidence", "sess");
  mkdirSync(ev, { recursive: true });
  const good = join(ev, "receipt.json");
  writeFileSync(good, "{}\n");
  assert.equal(hasValidReceipt(dir, good), true);

  const outside = join(scratch, "outside.json");
  writeFileSync(outside, "{}\n");
  symlinkSync(outside, join(ev, "leaf-link.json"));
  assert.equal(hasValidReceipt(dir, join(ev, "leaf-link.json")), false);

  mkdirSync(join(scratch, "real-sub"));
  writeFileSync(join(scratch, "real-sub", "r.json"), "{}\n");
  symlinkSync(join(scratch, "real-sub"), join(ev, "dir-link"));
  assert.equal(hasValidReceipt(dir, join(ev, "dir-link", "r.json")), false);

  mkdirSync(join(ev, "inner"));
  writeFileSync(join(ev, "inner", "r.json"), "{}\n");
  symlinkSync(join(ev, "inner"), join(ev, "inner-link"));
  assert.equal(hasValidReceipt(dir, join(ev, "inner-link", "r.json")), false, "a link that stays inside is still a link");

  assert.equal(hasValidReceipt(dir, join(ev, "..", "..", "..", "escape.json")), false);

  const legacy = join(dir, ".codexclaw", "evidence", "sess");
  mkdirSync(legacy, { recursive: true });
  writeFileSync(join(legacy, "receipt.json"), "{}\n");
  assert.equal(hasValidReceipt(dir, ".codexclaw/evidence/sess/receipt.json"), false);
});

test("a symlinked external project dir disables durable state", () => {
  const dir = repo("https://github.com/acme/app.git");
  const r = resolveStateRoot(dir);
  mkdirSync(r.stateBase!, { recursive: true });
  mkdirSync(join(scratch, "elsewhere"));
  symlinkSync(join(scratch, "elsewhere"), r.projectDir!);
  assert.match(resolveStateRoot(dir).disabledReason ?? "", /symlink/);
  assert.throws(() => ensureDurableDir(dir), DurableStateDisabledError);
});

test("goalplan create is exclusive: a second create never replaces the first", () => {
  const dir = repo("https://github.com/acme/app.git");
  const first = buildGoalplan({ objective: "ship the thing", criteria: [{ scenario: "first" }] });
  writeGoalplan(dir, first, { exclusive: true });
  const second = buildGoalplan({ objective: "ship the thing", criteria: [{ scenario: "second" }] });
  assert.throws(() => writeGoalplan(dir, second, { exclusive: true }), GoalplanExistsError);
  assert.equal(readGoalplan(dir, first.slug)?.criteria[0].scenario, "first");
  assert.ok(existsSync(join(resolveStateRoot(dir).durableDir, "goalplans", first.slug, "goalplan.json")));
});

test("review r1: '..name' children count as inside the checkout", () => {
  const dir = repo("https://github.com/acme/app.git");
  process.env.CODEXCLAW_STATE_ROOT = join(dir, "..private");
  assert.match(resolveStateRoot(dir).disabledReason ?? "", /inside the checkout/);
});

test("review r1: a disabled root accepts no receipt, even one planted where it would live", () => {
  const dir = repo("https://github.com/acme/app.git");
  process.env.CODEXCLAW_STATE_MODE = "none";
  const planted = join(resolveStateRoot(dir).durableDir, "evidence", "s");
  mkdirSync(planted, { recursive: true });
  writeFileSync(join(planted, "r.json"), "{}\n");
  assert.equal(hasValidReceipt(dir, join(planted, "r.json")), false);
  delete process.env.CODEXCLAW_STATE_MODE;
  const r = resolveStateRoot(dir);
  mkdirSync(join(scratch, "elsewhere", "state", "evidence", "s"), { recursive: true });
  writeFileSync(join(scratch, "elsewhere", "state", "evidence", "s", "r.json"), "{}\n");
  mkdirSync(r.stateBase!, { recursive: true });
  symlinkSync(join(scratch, "elsewhere"), r.projectDir!);
  assert.equal(hasValidReceipt(dir, join(r.durableDir, "evidence", "s", "r.json")), false);
});

test("review r1: origin parsing follows git quoting and inline comments", () => {
  const dir = repo(null);
  const cfg = join(dir, ".git", "config");
  writeFileSync(cfg, readFileSync(cfg, "utf8") + '[remote "origin"]\n\turl = "https://github.com/acme/app.git" # mirror\n');
  clearStateRootCache();
  const r = spawnSync("git", ["-C", dir, "config", "--get", "remote.origin.url"], { encoding: "utf8" });
  assert.equal(readGitInfo(dir)!.originUrl, r.stdout.trim());
  assert.equal(resolveStateRoot(dir).originKey, "github.com/acme/app");
});

test("review r1: info/exclude is never followed out of the git dir", () => {
  const dir = repo("https://github.com/acme/app.git");
  rmSync(join(dir, ".git", "info", "exclude"), { force: true });
  symlinkSync(join(dir, "README.md"), join(dir, ".git", "info", "exclude"));
  ensureDurableDir(dir);
  assert.equal(readFileSync(join(dir, "README.md"), "utf8"), "x\n");
});

test("review r1: long names keep distinct ids, and a project dir of another origin is not shared", () => {
  const long = "a".repeat(64);
  const a = deriveProjectId("/x", null, normalizeRemoteUrl("https://github.com/acme/" + long + "45581"));
  const b = deriveProjectId("/x", null, normalizeRemoteUrl("https://github.com/acme/" + long + "111323"));
  assert.notEqual(a, b);
  const dir = repo("https://github.com/acme/app.git");
  const r = resolveStateRoot(dir);
  mkdirSync(r.projectDir!, { recursive: true });
  writeFileSync(join(r.projectDir!, "project.json"), JSON.stringify({ origin: "github.com/other/app" }));
  assert.match(resolveStateRoot(dir).disabledReason ?? "", /belongs to origin/);
});

test("review r2: origin url split by a backslash continuation reads like git", () => {
  const dir = repo(null);
  const cfg = join(dir, ".git", "config");
  writeFileSync(cfg, readFileSync(cfg, "utf8") + '[remote "origin"]\n\turl = "https://github.com/acme/\\\napp.git"\n');
  clearStateRootCache();
  const r = spawnSync("git", ["-C", dir, "config", "--get", "remote.origin.url"], { encoding: "utf8" });
  assert.equal(readGitInfo(dir)!.originUrl, r.stdout.trim());
  assert.equal(resolveStateRoot(dir).originKey, "github.com/acme/app");
});
