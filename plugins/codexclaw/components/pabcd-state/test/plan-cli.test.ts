import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { derivePlanSlug, parsePlanCliArgs, runPlanCli, splitDatePrefix, yymmdd } from "../src/plan-cli.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-plancli-"));
}

function planRoot(cwd: string): string {
  return join(cwd, "devlog", "_plan");
}

test("plan-cli parse: init requires slug; --phases bounds enforced; slug normalized", () => {
  // 260825 wp1: a bare `cxc plan` is now help, not an error — the top-level help
  // points agents at `<cmd> --help` and that pointer used to hit a rejection.
  // An unknown verb is still an error; empty argv is not.
  assert.equal((parsePlanCliArgs([], "/tmp") as { verb: string }).verb, "help");
  assert.match((parsePlanCliArgs(["nope"], "/tmp") as { error: string }).error, /unknown plan verb/);
  assert.match((parsePlanCliArgs(["init"], "/tmp") as { error: string }).error, /requires a <slug>/);
  assert.match((parsePlanCliArgs(["init", "x", "--phases", "0"], "/tmp") as { error: string }).error, /1-9/);
  const ok = parsePlanCliArgs(["init", "My Big Feature!", "--phases", "3"], "/tmp");
  assert.ok(!("error" in ok));
  assert.equal(ok.slug, "my-big-feature");
  assert.equal(ok.phases, 3);
});

test("plan-cli init: scaffolds 000 + N decade stubs with DIFFLEVEL header; refuses overwrite", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "gate-demo", "--phases", "2", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    const unit = join(cwd, "devlog", "_plan", `${yymmdd()}_gate-demo`);
    assert.ok(existsSync(unit));
    const files = readdirSync(unit).sort();
    assert.deepEqual(files, ["000_plan.md", "010_phase1.md", "020_phase2.md"]);
    assert.match(readFileSync(join(unit, "010_phase1.md"), "utf8"), /DIFFLEVEL-ROADMAP-01/);
    // second run refuses
    const again = runPlanCli(args);
    assert.equal(again.code, 1);
    assert.match(again.output, /refusing to overwrite/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("splitDatePrefix parses both separators and passes through bare slugs", () => {
  assert.deepEqual(splitDatePrefix("260821_win-linux-optimization"), {
    date: "260821",
    rest: "win-linux-optimization",
  });
  assert.deepEqual(splitDatePrefix("260821-win-linux"), { date: "260821", rest: "win-linux" });
  assert.deepEqual(splitDatePrefix("win-linux"), { date: null, rest: "win-linux" });
});

test("splitDatePrefix does not eat a non-date numeric prefix", () => {
  assert.deepEqual(splitDatePrefix("12345_thing"), { date: null, rest: "12345_thing" });
  assert.deepEqual(splitDatePrefix("1234567_thing"), { date: null, rest: "1234567_thing" });
});

test("derivePlanSlug preserves underscores", () => {
  assert.equal(derivePlanSlug("my_slug"), "my_slug");
  assert.equal(derivePlanSlug("My Big Feature!"), "my-big-feature");
});

test("a prefixed positional does not double the date", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "260821_win-linux-optimization", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    assert.equal(args.date, "260821");
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    assert.ok(existsSync(join(planRoot(cwd), "260821_win-linux-optimization")));
    const doubled = readdirSync(planRoot(cwd)).filter((d) => /^\d{6}_\d{6}/.test(d));
    assert.deepEqual(doubled, []);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("a hyphen-prefixed positional normalizes to the underscore convention", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "260821-win-linux", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    assert.deepEqual(readdirSync(planRoot(cwd)), ["260821_win-linux"]);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("a bare slug still gets today's date", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "fresh_unit", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    assert.equal(args.date, null);
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    assert.deepEqual(readdirSync(planRoot(cwd)), [`${yymmdd()}_fresh_unit`]);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("a positional that is only a date is rejected", () => {
  const cwd = freshCwd();
  try {
    const parsed = parsePlanCliArgs(["init", "260821_", "--cwd", cwd], cwd);
    assert.match((parsed as { error: string }).error, /no usable slug/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("the success line is relative, not absolute", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "relative-check", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    assert.match(r.output, /devlog/);
    assert.ok(!r.output.includes(cwd), r.output);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("phase docs keep the 3-digit decade convention", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "decade-check", "--phases", "9", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    const unit = join(planRoot(cwd), `${yymmdd()}_decade-check`);
    const files = readdirSync(unit).sort();
    assert.equal(files.length, 10);
    for (const f of files) assert.match(f, /^\d{3}_/);
    assert.equal(files[files.length - 1], "090_phase9.md");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
