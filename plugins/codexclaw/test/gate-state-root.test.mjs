import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { devlogRootFor, mvpHardPathFor, checkVerifierClaims } from "../scripts/gate.mjs";

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "init.defaultBranch=main", "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

test("261020: gate.mjs reads the devlog through the state resolver (external mode keeps the checkout clean)", () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "cxc-gate-state-")));
  const saved = { root: process.env.CODEXCLAW_STATE_ROOT, mode: process.env.CODEXCLAW_STATE_MODE };
  try {
    const co = join(scratch, "co");
    mkdirSync(co);
    git(co, "init", "-q");
    git(co, "remote", "add", "origin", "https://github.com/acme/app.git");
    writeFileSync(join(co, "README.md"), "x\n");
    git(co, "add", "README.md");
    git(co, "commit", "-q", "-m", "init");
    delete process.env.CODEXCLAW_STATE_MODE;
    process.env.CODEXCLAW_STATE_ROOT = join(scratch, "base");
    const devlog = devlogRootFor(co);
    assert.ok(devlog.startsWith(join(scratch, "base")), devlog);
    assert.equal(mvpHardPathFor(co), join(devlog, "_plan", "mvp_hard"));
    mkdirSync(join(devlog, "_plan", "u1"), { recursive: true });
    writeFileSync(join(devlog, "_plan", "u1", "000_plan.md"), "# plan\n");
    assert.equal(checkVerifierClaims(co).ok, true);
    assert.equal(git(co, "status", "--porcelain"), "");
    process.env.CODEXCLAW_STATE_MODE = "repo";
    assert.equal(devlogRootFor(co), join(co, "devlog"));
  } finally {
    if (saved.root === undefined) delete process.env.CODEXCLAW_STATE_ROOT; else process.env.CODEXCLAW_STATE_ROOT = saved.root;
    if (saved.mode === undefined) delete process.env.CODEXCLAW_STATE_MODE; else process.env.CODEXCLAW_STATE_MODE = saved.mode;
    rmSync(scratch, { recursive: true, force: true });
  }
});
