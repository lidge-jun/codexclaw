// Darwin-only recording fixtures; definitions do not spawn until called.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tempRoot, put, putJson, readJson, isolatedEnv } from "./filesystem.mjs";
import { doctorReport } from "./evidence.mjs";

// Rename preserves every byte; only path ownership changes. The replacement
// stays inside the fixture base, outside the recorder's isolated run tree.
function replaceIdentity(phase) {
  const prefix = phase + "-same-byte-";
  if (!f.scenario.startsWith(prefix)) return;
  const target = f.identities[f.scenario.slice(prefix.length)];
  if (!target) throw new Error("unknown identity replacement fixture");
  renameSync(target, f.replacement);
  symlinkSync(f.replacement, target);
}

function mutateProvenance(phase) {
  const prefix = `${phase}-provenance-`;
  if (!f.scenario.startsWith(prefix)) return;
  const key = f.scenario.slice(prefix.length);
  const git = args => {
    const r = spawnSync("/usr/bin/git", args, { cwd: f.sourceRoot, encoding: "utf8", timeout: 10000,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_AUTHOR_DATE: "2026-01-02T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-02T00:00:00Z" } });
    if (r.error || r.status !== 0) throw new Error("fixture Git mutation failed");
  };
  if (key === "source-head") {
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
      "-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "--quiet", "-m", "changed source identity"]);
  } else if (key === "source-untracked") {
    git(["config", "status.showUntrackedFiles", "no"]);
    writeFileSync(join(f.sourceRoot, "untracked.txt"), "untracked source drift\n");
  } else if (key.endsWith("-delete")) unlinkSync(f.provenance[key.slice(0, -7)]);
  else {
    if (key === "source-hidden") git(["update-index", "--assume-unchanged", "fixture.txt"]);
    const target = f.provenance[key];
    if (!target) throw new Error("unknown provenance fixture");
    appendFileSync(target, "\n");
  }
}

// These script bodies are written only under each test's canonical temp root.
// The fake dispatcher and Codex never read shared settings or invoke a provider.
function fakeDispatcher() {
  const args = process.argv.slice(2);
  if (args[0] === "probe-dispatch") {
    appendFileSync(f.candidateMarker, "candidate\n");
    process.exit(0);
  }
  if (JSON.stringify(args) !== JSON.stringify(["doctor", "--json"])) process.exit(91);
  appendFileSync(f.doctorLog, "doctor\n");
  const count = readFileSync(f.doctorLog, "utf8").trim().split("\n").length;
  if (count === 2) appendFileSync(f.postflightMarker, "postflight\n");
  const checks = ["manifest", "hooks", "hook-trust", "install-root"].map(name => ({ name, severity: "PASS" }));
  if (f.scenario === "trust-warn") checks[2].severity = "WARN";
  if (!existsSync(f.dist)) checks[1].severity = "FAIL";
  process.stdout.write(JSON.stringify({ checks }) + "\n");
  if (count === 1 && f.scenario.startsWith("predoctor-")) {
    const target = { "predoctor-config": f.config, "predoctor-payload": f.dist, "predoctor-launcher": f.cxcLauncher }[f.scenario];
    appendFileSync(target, "\n// initial doctor drift\n");
  }
  if (f.scenario === "postdoctor-mutation" && count === 2) appendFileSync(f.config, "# postdoctor drift\n");
  replaceIdentity(count === 1 ? "preflight" : "postdoctor");
  mutateProvenance(count === 1 ? "preflight" : "postdoctor");
}

async function fakeCodex() {
  const args = process.argv.slice(2);
  const expected = ["exec", "-m", "gpt-6-astra", "-c", 'model_reasoning_effort="high"',
    "-c", 'service_tier="priority"', "--dangerously-bypass-approvals-and-sandbox", "--json", "-o", f.final];
  if (JSON.stringify(args) !== JSON.stringify(expected)) process.exit(92);
  let prompt = "";
  for await (const chunk of process.stdin) prompt += chunk;
  if (prompt !== "Harmless synthetic fixture.\n") process.exit(93);
  appendFileSync(f.execMarker, "exec\n");
  if (f.scenario === "dispatch") {
    const resolution = spawnSync("/bin/sh", ["-c", "command -v cxc; command -v codex"], { encoding: "utf8" });
    if (resolution.error || resolution.status !== 0) process.exit(94);
    writeFileSync(f.resolution, resolution.stdout);
    const child = spawnSync("cxc", ["probe-dispatch"], { encoding: "utf8" });
    if (child.error || child.status !== 0) process.exit(95);
  }
  if (f.scenario === "payload-symlink") {
    unlinkSync(f.dispatcher);
    symlinkSync(f.externalDispatcher, f.dispatcher);
  }
  replaceIdentity("execution");
  mutateProvenance("execution");
  if (f.scenario === "config-drift") appendFileSync(f.config, "# execution drift\n");
  if (f.scenario === "launcher-drift") appendFileSync(f.cxcLauncher, "# execution drift\n");
  writeFileSync(f.final, "SYNTHETIC_FIXTURE_OK\n", { mode: 0o600 });
  process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "abc" }) + "\n");
  process.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\n");
}

function scriptSource(f, fn) {
  return `#!${process.execPath}\nimport { appendFileSync, existsSync, readFileSync, writeFileSync, unlinkSync, symlinkSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
const f = ${JSON.stringify(f)};
${replaceIdentity.toString()}
${mutateProvenance.toString()}
await (${fn.toString()})();\n`;
}

function cleanGitFixture(root) {
  const source = join(root, "source");
  put(source, "fixture.txt", "synthetic source identity\n");
  const env = { ...isolatedEnv(root), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" };
  const git = args => {
    const result = spawnSync("/usr/bin/git", args, { cwd: source, env, encoding: "utf8", timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "--quiet"]);
  git(["add", "fixture.txt"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture"]);
  assert.equal(git(["status", "--porcelain"]), "");
  return { sourceRoot: source, sourceSha: git(["rev-parse", "HEAD"]) };
}

export function recordFixture(t, scenario = "success") {
  const base = tempRoot(t, "cxc-record-");
  const source = cleanGitFixture(base);
  const root = join(base, "run");
  const home = join(root, "home"), installed = join(home, ".codex/plugins/cache/codexclaw/fixture");
  const f = { scenario, root, installed, home, sourceRoot: source.sourceRoot,
    provenance: { approval: join(root, "approval.md"), install: join(root, "install.json"), prompt: join(root, "prompt.txt"),
      source: join(source.sourceRoot, "fixture.txt"), "source-hidden": join(source.sourceRoot, "fixture.txt"),
      codex: join(base, "fake-codex.mjs"), recorder: join(base, "recorder-copy.mjs") },
    dispatcher: join(installed, "bin/cxc.mjs"),
    dist: join(installed, "components/fixture/dist/cli.js"), config: join(home, ".codex/config.toml"),
    cxcLauncher: join(home, "probe-bin/cxc"), final: join(root, "output/final.txt"),
    execMarker: join(base, "exec.marker"), doctorLog: join(base, "doctor.log"),
    candidateMarker: join(base, "candidate.marker"), foreignMarker: join(base, "foreign.marker"),
    linkedMarker: join(base, "linked.marker"), externalDispatcher: join(base, "external.mjs"),
    resolution: join(base, "resolution.txt"), postflightMarker: join(base, "postflight.marker"),
    replacement: join(base, "same-byte-replacement") };
  f.identities = { config: f.config, "installed-root": installed,
    "codex-home": join(home, ".codex"), home, "launcher-root": join(home, "probe-bin"),
    "cxc-launcher": f.cxcLauncher, "codex-launcher": join(home, "probe-bin/codex") };
  mkdirSync(join(root, "work"), { recursive: true });
  put(root, "home/.codex/config.toml", "# isolated synthetic config\n");
  put(root, "prompt.txt", "Harmless synthetic fixture.\n");
  put(root, "approval.md", "Synthetic fixture only; no real approval or model evidence.\n");
  const version = "1.0.0+codex.fixture-one";
  putJson(installed, ".codex-plugin/plugin.json", { name: "codexclaw", version });
  put(installed, "components/fixture/dist/cli.js", "// fixture dist\n");
  put(installed, "bin/cxc.mjs", scriptSource(f, fakeDispatcher));
  put(base, "external.mjs", `import {writeFileSync} from "node:fs";
writeFileSync(${JSON.stringify(f.linkedMarker)}, "executed");
process.stdout.write(${JSON.stringify(JSON.stringify(doctorReport()))});\n`);
  const codexBin = put(base, "fake-codex.mjs", scriptSource(f, fakeCodex), 0o700);
  putJson(root, "install.json", { installedPath: installed });
  const spec = { schemaVersion: 1, candidate: "fixture", root, ...source,
    codexBin, expectedVersion: version, serviceTier: "priority" };
  return { ...f, base, spec };
}

export function recordReport(f) {
  return readJson(join(f.root, "output/run.json"));
}

export function assertNoExec(f) {
  assert.equal(existsSync(f.execMarker), false, "preflight must stop before fake Codex executes");
}
