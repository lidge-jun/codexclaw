import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { clearStateRootCache, resolveStateRoot } from "../src/state-root.ts";
import { runDevlogCli, runStateCli } from "../src/state-cli.ts";
import { runPlanCli } from "../src/plan-cli.ts";
import { validatePlanArtifacts } from "../src/plan-gate.ts";

let scratch = "";
let saved: Record<string, string | undefined> = {};
const KEYS = ["CODEXCLAW_HOME", "CODEXCLAW_STATE_ROOT", "CODEXCLAW_STATE_MODE"] as const;
const ID = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", ["-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8", env: { ...process.env, ...ID } });
  assert.equal(r.status, 0, args.join(" ") + ": " + r.stderr);
  return r.stdout.trim();
}

function checkout(origin: string): string {
  const dir = realpathSync(mkdtempSync(join(scratch, "co-")));
  git(dir, "init", "-q");
  git(dir, "remote", "add", "origin", origin);
  writeFileSync(join(dir, "README.md"), "x\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "init");
  clearStateRootCache();
  return dir;
}

function envFor(base: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, ...ID, CODEXCLAW_STATE_ROOT: base, ...extra };
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  scratch = realpathSync(mkdtempSync(join(tmpdir(), "cxc-state-cli-")));
  process.env.CODEXCLAW_HOME = join(scratch, "home");
  delete process.env.CODEXCLAW_STATE_ROOT;
  delete process.env.CODEXCLAW_STATE_MODE;
  clearStateRootCache();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  clearStateRootCache();
  rmSync(scratch, { recursive: true, force: true });
});

test("state path and devlog path report the resolved layout", () => {
  const co = checkout("https://github.com/acme/app.git");
  const env = envFor(join(scratch, "base"));
  const text = runStateCli(["path"], co, env).output;
  assert.match(text, /^mode: external \(auto: origin owner github.com\/acme is not allowlisted\)/);
  const json = JSON.parse(runStateCli(["path", "--json"], co, env).output);
  assert.equal(json.durableDir, join(scratch, "base", json.projectId, "state"));
  assert.equal(runDevlogCli(["path"], co, env).output, join(scratch, "base", json.projectId, "devlog"));
  assert.match(runDevlogCli(["path", "--explain"], co, env).output, /\nmode: external/);
  const none = runDevlogCli(["path"], co, { ...env, CODEXCLAW_STATE_MODE: "none" });
  assert.equal(none.code, 1);
  assert.match(runStateCli(["path"], co, { ...env, CODEXCLAW_STATE_MODE: "none" }).output, /cannot be satisfied in mode none/);
});

test("plan init writes into the external devlog and P>A accepts that absolute unit", () => {
  const co = checkout("https://github.com/acme/app.git");
  process.env.CODEXCLAW_STATE_ROOT = join(scratch, "base");
  const res = runPlanCli({ verb: "init", slug: "thing", phases: 1, cwd: co, date: "261020" } as never);
  assert.equal(res.code, 0, res.output);
  const unit = join(resolveStateRoot(co).devlogDir!, "_plan", "261020_thing");
  assert.ok(existsSync(join(unit, "000_plan.md")));
  assert.ok(res.output.includes("planUnit for P -> A: " + unit), res.output);
  assert.equal(existsSync(join(co, "devlog")), false);
  const gate = validatePlanArtifacts({ from: "P", to: "A", did: "x", planUnit: unit } as never, co);
  assert.equal(gate.ok, true);
  assert.equal(git(co, "status", "--porcelain"), "");
});

test("plan init in an explicitly repo-mode foreign repository warns", () => {
  const co = checkout("https://github.com/acme/app.git");
  process.env.CODEXCLAW_STATE_MODE = "repo";
  const res = runPlanCli({ verb: "init", slug: "thing", phases: 1, cwd: co, date: "261020" } as never);
  assert.equal(res.code, 0);
  assert.match(res.output, /warning: writing devlog\/ into a repository owned by github.com\/acme/);
});

test("state sync is a no-op outside external mode or without a git base", () => {
  const co = checkout("git@github.com:lidge-jun/x.git");
  assert.match(runStateCli(["sync"], co, envFor(join(scratch, "base"))).output, /nothing to sync/);
  const foreign = checkout("https://github.com/acme/app.git");
  const base = join(scratch, "plainbase");
  mkdirSync(base);
  const r = runStateCli(["sync"], foreign, envFor(base));
  assert.equal(r.code, 0);
  assert.match(r.output, /not a git repository/);
  const nested = join(scratch, "outer");
  mkdirSync(join(nested, "inner"), { recursive: true });
  git(nested, "init", "-q");
  assert.equal(runStateCli(["sync"], foreign, envFor(join(nested, "inner"))).code, 1);
});

function twoMachines(): { remote: string; a: string; b: string; co: string; dirA: string; dirB: string } {
  const remote = join(scratch, "remote.git");
  git(scratch, "init", "-q", "--bare", remote);
  const a = join(scratch, "macA");
  git(scratch, "clone", "-q", remote, a);
  writeFileSync(join(a, "README.md"), "private state\n");
  git(a, "add", "README.md");
  git(a, "commit", "-q", "-m", "init");
  git(a, "push", "-q", "-u", "origin", "main");
  const b = join(scratch, "macB");
  git(scratch, "clone", "-q", remote, b);
  const co = checkout("https://github.com/acme/app.git");
  const id = resolveStateRoot(co, envFor(a)).projectId!;
  return { remote, a, b, co, dirA: join(a, id, "state"), dirB: join(b, id, "state") };
}

test("two machines: divergent ledgers union-merge, new files arrive, nothing is forced", () => {
  const m = twoMachines();
  mkdirSync(m.dirA, { recursive: true });
  appendFileSync(join(m.dirA, "ledger.jsonl"), '{"m":"A1"}\n');
  let r = runStateCli(["sync"], m.co, envFor(m.a));
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /pushed/);
  assert.match(readFileSync(join(m.a, ".gitattributes"), "utf8"), /\*\.jsonl text eol=lf merge=union/);

  mkdirSync(join(m.dirB, "goalplans", "g1"), { recursive: true });
  appendFileSync(join(m.dirB, "ledger.jsonl"), '{"m":"B1"}\n');
  writeFileSync(join(m.dirB, "goalplans", "g1", "goalplan.json"), '{"slug":"g1"}\n');
  r = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(r.code, 0, r.output);
  const ledgerB = readFileSync(join(m.dirB, "ledger.jsonl"), "utf8");
  assert.ok(ledgerB.includes('"A1"') && ledgerB.includes('"B1"'), ledgerB);
  // Everything is committed and pushed. Under a global core.autocrlf=true (the CI crlf leg)
  // the clone's README keeps the CRLF its checkout wrote; sync deliberately leaves that
  // line-ending-only difference uncommitted, so only content changes are checked there.
  assert.equal(git(m.b, "rev-parse", "HEAD"), git(m.b, "rev-parse", "@{u}"));
  const dirty = git(m.b, "status", "--porcelain").split("\n").filter(Boolean);
  for (const line of dirty) {
    const p = line.replace(/^\s*\S+\s+/, "");
    assert.ok(readFileSync(join(m.b, p)).toString("latin1").replace(/\r\n/g, "\n") === git(m.b, "show", "HEAD:" + p) + "\n", line);
  }

  r = runStateCli(["sync"], m.co, envFor(m.a));
  assert.equal(r.code, 0, r.output);
  assert.ok(readFileSync(join(m.dirA, "ledger.jsonl"), "utf8").includes('"B1"'));
  assert.equal(readFileSync(join(m.dirA, "goalplans", "g1", "goalplan.json"), "utf8"), '{"slug":"g1"}\n');
  assert.equal(existsSync(join(m.a, ".cxc-sync.lock")), false);
  assert.equal(git(m.a, "ls-files", ".cxc-sync.lock"), "");
});

test("sync stops before moving the branch when a goalplan is locked or a non-ledger file differs", () => {
  const m = twoMachines();
  mkdirSync(join(m.dirA, "goalplans", "g1"), { recursive: true });
  writeFileSync(join(m.dirA, "goalplans", "g1", "goalplan.json"), '{"v":1}\n');
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.b)).code, 0);
  writeFileSync(join(m.dirA, "goalplans", "g1", "goalplan.json"), '{"v":2}\n');
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);

  mkdirSync(join(m.dirB, "goalplans", "g1", ".goalplan.lock"));
  const before = git(m.b, "rev-parse", "HEAD");
  const r = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /locked by a writer/);
  assert.equal(git(m.b, "rev-parse", "HEAD"), before);
  assert.equal(readFileSync(join(m.dirB, "goalplans", "g1", "goalplan.json"), "utf8"), '{"v":1}\n');

  rmSync(join(m.dirB, "goalplans", "g1", ".goalplan.lock"), { recursive: true });
  const ok = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(ok.code, 0, ok.output);
  assert.equal(readFileSync(join(m.dirB, "goalplans", "g1", "goalplan.json"), "utf8"), '{"v":2}\n');
});

test("migrate: dry run changes nothing; apply moves, merges jsonl, keeps conflicts, skips tracked and symlinks; rerun is a no-op", () => {
  const co = checkout("https://github.com/acme/app.git");
  const env = envFor(join(scratch, "base"));
  const legacy = join(co, ".codexclaw");
  mkdirSync(join(legacy, "goalplans", "g1"), { recursive: true });
  mkdirSync(join(legacy, "evidence", "s1"), { recursive: true });
  mkdirSync(join(legacy, "sessions"), { recursive: true });
  writeFileSync(join(legacy, "ledger.jsonl"), '{"n":1}\n{"n":2}\n');
  writeFileSync(join(legacy, "goalplans", "g1", "goalplan.json"), '{"receipt":".codexclaw/evidence/s1/r.json"}\n');
  writeFileSync(join(legacy, "evidence", "s1", "r.json"), "legacy\n");
  writeFileSync(join(legacy, "sessions", "s1.json"), JSON.stringify({ phase: "IDLE" }));
  symlinkSync(join(co, "README.md"), join(legacy, "evidence", "s1", "link.json"));
  mkdirSync(join(co, "devlog", "_plan", "u1"), { recursive: true });
  writeFileSync(join(co, "devlog", "_plan", "u1", "000_plan.md"), "plan\n");
  writeFileSync(join(co, "devlog", "tracked.md"), "t\n");
  git(co, "add", "devlog/tracked.md");
  git(co, "commit", "-q", "-m", "tracked devlog file");

  const root = resolveStateRoot(co, env);
  mkdirSync(join(root.durableDir, "evidence", "s1"), { recursive: true });
  writeFileSync(join(root.durableDir, "ledger.jsonl"), '{"n":0}\n{"n":1}\n');
  writeFileSync(join(root.durableDir, "evidence", "s1", "r.json"), "external\n");

  const dry = runStateCli(["migrate"], co, env);
  assert.equal(dry.code, 0, dry.output);
  assert.match(dry.output, /dry run/);
  assert.match(dry.output, /stale after migration/);
  assert.ok(existsSync(join(legacy, "ledger.jsonl")));

  writeFileSync(join(legacy, "sessions", "s1.json"), JSON.stringify({ phase: "B" }));
  const blocked = runStateCli(["migrate", "--apply"], co, env);
  assert.equal(blocked.code, 1);
  assert.match(blocked.output, /mid-cycle/);
  writeFileSync(join(legacy, "sessions", "s1.json"), JSON.stringify({ phase: "IDLE" }));

  const applied = runStateCli(["migrate", "--apply"], co, env);
  assert.equal(applied.code, 0, applied.output);
  assert.equal(readFileSync(join(root.durableDir, "ledger.jsonl"), "utf8"), '{"n":0}\n{"n":1}\n{"n":2}\n');
  assert.ok(existsSync(join(root.durableDir, "goalplans", "g1", "goalplan.json")));
  assert.equal(readFileSync(join(root.durableDir, "evidence", "s1", "r.json"), "utf8"), "external\n");
  assert.equal(readFileSync(join(legacy, "evidence", "s1", "r.json"), "utf8"), "legacy\n", "conflict keeps both");
  assert.ok(existsSync(join(legacy, "evidence", "s1", "link.json")), "symlink left in place");
  assert.ok(existsSync(join(root.devlogDir!, "_plan", "u1", "000_plan.md")));
  assert.equal(existsSync(join(co, "devlog", "_plan")), false);
  assert.ok(existsSync(join(co, "devlog", "tracked.md")), "tracked file untouched");
  assert.ok(existsSync(join(legacy, "sessions", "s1.json")), "volatile state stays");
  assert.equal(existsSync(join(legacy, "ledger.jsonl")), false);

  const again = runStateCli(["migrate", "--apply"], co, env);
  assert.equal(again.code, 0, again.output);
  assert.match(again.output, /move 0, already there 0, jsonl union 0, conflicts 1/);
});

test("migrate refuses when the checkout resolves to repo mode", () => {
  const co = checkout("git@github.com:lidge-jun/x.git");
  const r = runStateCli(["migrate", "--apply"], co, envFor(join(scratch, "base")));
  assert.equal(r.code, 1);
  assert.match(r.output, /mode repo/);
});

test("review r1: sync refuses disabled roots, never applies symlink/scratch entries or ledger deletions, cleans up after a failed merge worktree", () => {
  const co = checkout("https://github.com/acme/app.git");
  const inside = runStateCli(["sync"], co, envFor(join(co, "state")));
  assert.equal(inside.code, 1);
  assert.match(inside.output, /inside the checkout/);

  const m = twoMachines();
  mkdirSync(join(m.dirA, "goalplans", "g1"), { recursive: true });
  appendFileSync(join(m.dirA, "goalplans", "g1", "ledger.jsonl"), '{"e":1}\n');
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.b)).code, 0);
  rmSync(join(m.dirA, "goalplans", "g1", "ledger.jsonl"));
  // Git for Windows commits links as plain files unless core.symlinks is on.
  const links = process.platform !== "win32";
  if (links) symlinkSync("/etc/hosts", join(m.dirA, "link"));
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  const r = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /append-only ledger deleted on the other side/);
  if (links) assert.match(r.output, /entry mode 120000/);
  assert.ok(existsSync(join(m.dirB, "goalplans", "g1", "ledger.jsonl")));
  assert.equal(existsSync(join(m.dirB, "link")), false);

  mkdirSync(join(m.b, ".git", "hooks"), { recursive: true });
  writeFileSync(join(m.b, ".git", "hooks", "post-checkout"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const before = git(m.b, "worktree", "list").split("\n").length;
  runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(git(m.b, "worktree", "list").split("\n").length, before);
  assert.equal(existsSync(join(m.b, ".cxc-sync.lock")), false);
});

test("review r1: sync refuses tracked scratch files and redacts credentials in git errors", () => {
  const m = twoMachines();
  mkdirSync(join(m.dirA, "goalplans", "g1", ".goalplan.lock"), { recursive: true });
  writeFileSync(join(m.dirA, "goalplans", "g1", ".goalplan.lock", "owner.json"), "{}\n");
  git(m.a, "add", "-f", ".");
  git(m.a, "commit", "-q", "-m", "oops");
  const r = runStateCli(["sync"], m.co, envFor(m.a));
  assert.equal(r.code, 1);
  assert.match(r.output, /lock or scratch files are tracked/);
  git(m.a, "rm", "-r", "-q", "--cached", ".");
  git(m.a, "commit", "-q", "-m", "untrack");
  rmSync(join(m.dirA, "goalplans", "g1", ".goalplan.lock"), { recursive: true });
  git(m.a, "remote", "set-url", "origin", "https://user:SECRET@127.0.0.1:1/x.git?access_token=SECRET2");
  const f = runStateCli(["sync"], m.co, envFor(m.a));
  assert.equal(f.code, 1);
  assert.ok(!f.output.includes("SECRET"), f.output);
});

test("review r1: migrate never writes through or reads through symlinks", () => {
  if (process.platform === "win32") return; // file symlinks need a privilege the Windows runner may lack
  const co = checkout("https://github.com/acme/app.git");
  const env = envFor(join(scratch, "base"));
  mkdirSync(join(co, ".codexclaw"), { recursive: true });
  writeFileSync(join(co, ".codexclaw", "ledger.jsonl"), '{"n":1}\n');
  const root = resolveStateRoot(co, env);
  mkdirSync(root.durableDir, { recursive: true });
  const victim = join(scratch, "victim.txt");
  writeFileSync(victim, "keep\n");
  symlinkSync(victim, join(root.durableDir, "ledger.jsonl"));
  const r = runStateCli(["migrate", "--apply"], co, env);
  assert.equal(r.code, 0, r.output);
  assert.equal(readFileSync(victim, "utf8"), "keep\n");
  assert.ok(existsSync(join(co, ".codexclaw", "ledger.jsonl")));

  const co2 = checkout("https://github.com/acme/other.git");
  const outside = join(scratch, "outside-cc");
  mkdirSync(outside);
  writeFileSync(join(outside, "ledger.jsonl"), '{"n":1}\n');
  symlinkSync(outside, join(co2, ".codexclaw"));
  runStateCli(["migrate", "--apply"], co2, env);
  assert.ok(existsSync(join(outside, "ledger.jsonl")));
});

test("review r2: sync refuses a symlinked .gitignore or .gitattributes in the base", () => {
  if (process.platform === "win32") return;
  const m = twoMachines();
  const victim = join(scratch, "victim.txt");
  writeFileSync(victim, "keep\n");
  symlinkSync(victim, join(m.a, ".gitattributes"));
  const r = runStateCli(["sync"], m.co, envFor(m.a));
  assert.equal(r.code, 1);
  assert.match(r.output, /not a regular file/);
  assert.equal(readFileSync(victim, "utf8"), "keep\n");
  assert.equal(existsSync(join(m.a, ".cxc-sync.lock")), false);
});

test("review r2: CRLF checkouts of a ledger do not duplicate events, and scratch files are never staged", () => {
  const m = twoMachines();
  git(m.b, "config", "core.autocrlf", "true");
  mkdirSync(m.dirA, { recursive: true });
  appendFileSync(join(m.dirA, "ledger.jsonl"), '{"n":1}\n');
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.b)).code, 0);
  appendFileSync(join(m.dirB, "ledger.jsonl"), '{"n":3}\n');
  appendFileSync(join(m.dirA, "ledger.jsonl"), '{"n":2}\n');
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  const r = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(r.code, 0, r.output);
  const lines = readFileSync(join(m.dirB, "ledger.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(lines, ['{"n":1}', '{"n":2}', '{"n":3}']);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  const linesA = readFileSync(join(m.dirA, "ledger.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(linesA, ['{"n":1}', '{"n":2}', '{"n":3}']);

  writeFileSync(join(m.a, ".gitignore"), "");
  mkdirSync(join(m.dirA, ".probe-x"), { recursive: true });
  writeFileSync(join(m.dirA, ".probe-x", "f"), "x");
  writeFileSync(join(m.dirA, "x.json.123.tmp"), "x");
  const s = runStateCli(["sync"], m.co, envFor(m.a));
  assert.equal(s.code, 0, s.output);
  assert.equal(git(m.a, "ls-files", "--", "*.tmp", "*.probe-x*", ".cxc-sync.lock"), "");
});

test("review r3: a base cloned with core.autocrlf before the attributes existed does not duplicate events", () => {
  const remote = join(scratch, "remote2.git");
  git(scratch, "init", "-q", "--bare", remote);
  const a = join(scratch, "A2");
  git(scratch, "clone", "-q", remote, a);
  const co = checkout("https://github.com/acme/app.git");
  const id = resolveStateRoot(co, envFor(a)).projectId!;
  mkdirSync(join(a, id, "state"), { recursive: true });
  writeFileSync(join(a, id, "state", "ledger.jsonl"), '{"n":1}\n');
  git(a, "add", "-A");
  git(a, "commit", "-q", "-m", "legacy");
  git(a, "push", "-q", "-u", "origin", "main");
  const b = join(scratch, "B2");
  git(scratch, "-c", "core.autocrlf=true", "clone", "-q", remote, b);
  git(b, "config", "core.autocrlf", "true");
  assert.equal(readFileSync(join(b, id, "state", "ledger.jsonl"), "utf8"), '{"n":1}\r\n');
  appendFileSync(join(a, id, "state", "ledger.jsonl"), '{"n":2}\n');
  assert.equal(runStateCli(["sync"], co, envFor(a)).code, 0);
  const r = runStateCli(["sync"], co, envFor(b));
  assert.equal(r.code, 0, r.output);
  assert.equal(readFileSync(join(b, id, "state", "ledger.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).length, 2);
  assert.equal(runStateCli(["sync"], co, envFor(a)).code, 0);
  assert.equal(git(a, "show", "HEAD:" + id + "/state/ledger.jsonl").split(/\r?\n/).filter(Boolean).length, 2);
});

test("review r4: evidence bytes (CRLF inside a binary without NUL) survive a sync unchanged", () => {
  const m = twoMachines();
  mkdirSync(join(m.dirA, "evidence", "s1"), { recursive: true });
  const bytes = Buffer.from("%PDF-1.4\r\nstream\r\n\x01\x02\r\n\xff\xfe\r\nendstream\r\n", "latin1");
  writeFileSync(join(m.dirA, "evidence", "s1", "shot.pdf"), bytes);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  git(m.b, "config", "core.autocrlf", "true");
  const r = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(r.code, 0, r.output);
  assert.ok(readFileSync(join(m.dirB, "evidence", "s1", "shot.pdf")).equals(bytes));
  assert.ok(Buffer.from(git(m.a, "cat-file", "-p", "HEAD:" + m.dirA.slice(m.a.length + 1).split("\\").join("/") + "/evidence/s1/shot.pdf"), "latin1").length > 0);
});

test("review r5: a remote update to a binary file is never mistaken for 'same content'", () => {
  const m = twoMachines();
  mkdirSync(join(m.dirA, "evidence", "s1"), { recursive: true });
  const v1 = Buffer.from([0x53, 0x51, 0xff, 0x0d, 0x0a, 0x01]);
  const v2 = Buffer.from([0x53, 0x51, 0xfe, 0x0d, 0x0a, 0x01]);
  writeFileSync(join(m.dirA, "evidence", "s1", "db.sqlite"), v1);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.b)).code, 0);
  writeFileSync(join(m.dirA, "evidence", "s1", "db.sqlite"), v2);
  assert.equal(runStateCli(["sync"], m.co, envFor(m.a)).code, 0);
  const r = runStateCli(["sync"], m.co, envFor(m.b));
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /db\.sqlite \(modified on the other side/);
  assert.ok(readFileSync(join(m.dirB, "evidence", "s1", "db.sqlite")).equals(v1), "local copy untouched");
  assert.equal(git(m.remote, "cat-file", "-p", "HEAD:" + m.dirA.slice(m.a.length + 1).split("\\").join("/") + "/evidence/s1/db.sqlite").length > 0, true);
});

test("#299: migrate skips tracked files even when the checkout is reached through another spelling of its path", () => {
  const co = checkout("https://github.com/acme/app.git");
  mkdirSync(join(co, "devlog"), { recursive: true });
  writeFileSync(join(co, "devlog", "tracked.md"), "t\n");
  writeFileSync(join(co, "devlog", "free.md"), "f\n");
  git(co, "add", "devlog/tracked.md");
  git(co, "commit", "-q", "-m", "tracked");
  let via = co;
  if (process.platform !== "win32") {
    via = join(scratch, "alias");
    symlinkSync(co, via);
  }
  const env = envFor(join(scratch, "base"));
  const r = runStateCli(["migrate", "--apply"], via + (process.platform === "win32" ? "\\" : "/"), env);
  assert.equal(r.code, 0, r.output);
  assert.ok(existsSync(join(co, "devlog", "tracked.md")), "tracked file untouched");
  assert.equal(existsSync(join(co, "devlog", "free.md")), false, "untracked file moved");
  assert.match(r.output, /skipped tracked 1/);
});

test("#299: comparablePath folds case and separators on win32 only", async () => {
  const { comparablePath } = await import("../src/state-cli.ts");
  const p = join(scratch, "MixedCase");
  mkdirSync(p);
  // The win32 spelling is the native realpath with forward slashes, lower-cased; build the
  // expectation the same way so it holds on every host (on Windows the native path has "\\").
  assert.equal(comparablePath(p, "win32"), comparablePath(p, "linux").replace(/\\/g, "/").toLowerCase());
  assert.ok(!comparablePath(p, "win32").includes("\\"));
  assert.equal(comparablePath(p + sep, "linux"), comparablePath(p, "linux"));
  if (process.platform !== "win32") {
    assert.equal(comparablePath(p, "linux"), realpathSync.native(p), "POSIX keeps the native spelling, backslashes included");
  }
});

test("#299 r1: tracked files survive migrate across case, NFC/NFD and literal-backslash spellings", () => {
  if (process.platform === "win32") return; // backslash is a separator there; case/identity covered by the test above
  const env = envFor(join(scratch, "base"));
  // Case and NFC/NFD aliases only exist on macOS's default filesystem; a literal backslash is
  // a plain filename character on every POSIX system.
  const cases: Array<[string, string]> = [["tracked\\name.md", "tracked\\name.md"]];
  if (process.platform === "darwin") cases.push(["Tracked.md", "tracked.md"], ["caf\u00e9.md", "cafe\u0301.md"]);
  for (const [indexName, diskName] of cases) {
    const co = checkout("https://github.com/acme/app.git");
    mkdirSync(join(co, "devlog"), { recursive: true });
    writeFileSync(join(co, "devlog", indexName), "t\n");
    git(co, "add", "devlog");
    git(co, "commit", "-q", "-m", "tracked");
    const names = readdirSync(join(co, "devlog")) as string[];
    if (!names.includes(diskName) && indexName !== diskName) {
      // case/normalization-preserving FS: rename on disk to the other spelling (git still tracks indexName)
      renameSync(join(co, "devlog", names[0]), join(co, "devlog", diskName));
    }
    const r = runStateCli(["migrate", "--apply"], co, env);
    assert.equal(r.code, 0, r.output);
    assert.equal((readdirSync(join(co, "devlog")) as string[]).length, 1, indexName + ": tracked file left in place");
  }
});

test("#299 r2: a tracked directory spelled with different case (Devlog/, .Codexclaw/) is never moved", () => {
  if (process.platform !== "darwin") return; // needs a case-insensitive filesystem
  const env = envFor(join(scratch, "base"));
  for (const [dir, file] of [["Devlog", "tracked.md"], [".Codexclaw", "ledger.jsonl"]]) {
    const co = checkout("https://github.com/acme/app.git");
    mkdirSync(join(co, dir), { recursive: true });
    writeFileSync(join(co, dir, file), '{"n":1}\n');
    git(co, "add", "-f", dir);
    git(co, "commit", "-q", "-m", "tracked " + dir);
    const r = runStateCli(["migrate", "--apply"], co, env);
    assert.equal(r.code, 0, r.output);
    assert.ok(existsSync(join(co, dir, file)), dir + "/" + file + " left in place");
    assert.equal(git(co, "status", "--porcelain"), "", dir);
  }
});

test("#299 r3: Unicode case aliases in a parent directory (Σ/ς, S/ſ) keep tracked files in place", () => {
  if (process.platform !== "darwin") return;
  const env = envFor(join(scratch, "base"));
  for (const [tracked, alias] of [["\u03a3", "\u03c2"], ["S", "\u017f"]]) {
    const co = checkout("https://github.com/acme/app.git");
    mkdirSync(join(co, tracked, "devlog"), { recursive: true });
    writeFileSync(join(co, tracked, "devlog", "tracked.md"), "t\n");
    git(co, "add", tracked);
    git(co, "commit", "-q", "-m", "tracked");
    const names = readdirSync(co);
    if (!names.includes(alias)) renameSync(join(co, tracked), join(co, alias));
    if (!existsSync(join(co, alias))) continue; // filesystem does not treat them as aliases
    const r = runStateCli(["migrate", "--apply"], join(co, alias), env);
    assert.equal(r.code, 0, r.output);
    assert.ok(existsSync(join(co, alias, "devlog", "tracked.md")), alias + ": tracked file left in place");
  }
});
