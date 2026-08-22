/**
 * worktree-guard-win.test.ts - 100 closeout defect #17: the PreToolUse guard only
 * dispatched on the literal POSIX tokens `rm` and `rmdir`, so every Windows removal
 * verb (Remove-Item, ri, del, erase, rd) reached the trailing `return null` with zero
 * coverage. These cases pin the new branch AND the two POSIX semantics it must not
 * disturb.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectManagedWorktree, evaluateCommand } from "../src/worktree-guard.ts";

interface Rig {
  worktreesDir: string;
  slot: string;
  slotRoot: string;
  checkoutRoot: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => void;
}

/** tmp CODEX_HOME with worktrees/<slot>/<repo>/.git, mirroring worktree-guard.test.ts. */
function makeRig(): Rig {
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-wgwin-home-")));
  const codexHome = join(home, ".codex");
  const worktreesDir = join(codexHome, "worktrees");
  const slot = "7627";
  const slotRoot = join(worktreesDir, slot);
  const checkoutRoot = join(slotRoot, "opencodex");
  mkdirSync(checkoutRoot, { recursive: true });
  writeFileSync(join(checkoutRoot, ".git"), "gitdir: /fake/main/.git/worktrees/7627\n");
  return {
    worktreesDir,
    slot,
    slotRoot,
    checkoutRoot,
    env: { CODEX_HOME: codexHome },
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

function verdictFor(cmd: string, rig: Rig, cwd?: string) {
  const at = cwd ?? rig.checkoutRoot;
  return evaluateCommand(cmd, at, detectManagedWorktree(at, rig.env));
}

/** Deny came from the verb branch, not the conservative unresolvable-target fallback. */
function assertBranchDeny(v: ReturnType<typeof evaluateCommand>, cmd: string) {
  assert.equal(v.action, "deny", cmd);
  if (v.action === "deny") {
    assert.match(v.reason, /WORKTREE-GUARD-03/, cmd);
    assert.doesNotMatch(v.reason, /unresolvable/, cmd);
  }
}

// --- 3. the headline case ---------------------------------------------------

test("100.17: Remove-Item -Recurse -Force <slot> denies", () => {
  const rig = makeRig();
  try {
    for (const cmd of [
      `Remove-Item -Recurse -Force ${rig.slotRoot}`,
      `Remove-Item -Force -Recurse ${rig.checkoutRoot}`,
      `remove-item -recurse ${rig.slotRoot}`, // PowerShell verbs are case-insensitive
    ]) {
      assertBranchDeny(verdictFor(cmd, rig), cmd);
    }
  } finally {
    rig.cleanup();
  }
});

// --- 4. the aliases with zero coverage before this fix ----------------------

test("100.17: del and erase aliases are recognized", () => {
  const rig = makeRig();
  try {
    assertBranchDeny(verdictFor(`del -Recurse ${rig.slotRoot}`, rig), "del");
    assertBranchDeny(verdictFor(`erase -Recurse ${rig.checkoutRoot}`, rig), "erase");
    // /s is the cmd.exe spelling of recursive
    assertBranchDeny(verdictFor(`del /s ${rig.slotRoot}`, rig), "del /s");
  } finally {
    rig.cleanup();
  }
});

// --- 5. value parameters ----------------------------------------------------

test("100.17: Remove-Item -LiteralPath <slot> -Recurse denies", () => {
  const rig = makeRig();
  try {
    assertBranchDeny(
      verdictFor(`Remove-Item -LiteralPath ${rig.slotRoot} -Recurse`, rig),
      "-LiteralPath",
    );
    assertBranchDeny(
      verdictFor(`Remove-Item -Path ${rig.checkoutRoot} -Recurse -Force`, rig),
      "-Path",
    );
  } finally {
    rig.cleanup();
  }
});

// --- 6. the alias mirrors the rm branch, not the rmdir one ------------------

test("100.17: ri -Path <slot> -Force without -Recurse does not deny; with it, denies", () => {
  const rig = makeRig();
  try {
    // The target is the protected checkout, reached relatively: spelling the slot path
    // out would additionally trip the conservative fallback and hide the branch verdict.
    assert.equal(verdictFor("ri -Path . -Force", rig).action, "allow");
    assertBranchDeny(verdictFor("ri -Path . -Force -Recurse", rig), "ri -Recurse");
    // and the fallback still covers a literally-named slot with no recursive flag
    const named = verdictFor(`ri -Path ${rig.slotRoot} -Force`, rig);
    assert.equal(named.action, "deny");
    if (named.action === "deny") assert.match(named.reason, /unresolvable/);
  } finally {
    rig.cleanup();
  }
});

// --- 7. rd mirrors rmdir: directory verb, no recursive requirement ----------

test("100.17: rd <slot> denies with no -Recurse (DIR_REMOVE_VERBS)", () => {
  const rig = makeRig();
  try {
    assertBranchDeny(verdictFor(`rd ${rig.slotRoot}`, rig), "rd slot");
    assertBranchDeny(verdictFor(`rd /q ${rig.checkoutRoot}`, rig), "rd /q checkout");
    assertBranchDeny(verdictFor("rd .", rig), "rd .");
    // and it still keeps its hands off unrelated directories
    assert.equal(verdictFor("rd ./build", rig).action, "allow");
  } finally {
    rig.cleanup();
  }
});

// --- 8. exact-match flag parsing --------------------------------------------

test("100.17: -Confirm:$false is not a target and -Recurse:$false is not recursive", () => {
  const rig = makeRig();
  try {
    // colon-suffixed switches carry no target and must not swallow the real one.
    // Targets stay relative here so the verdicts are the branch's, not the fallback's.
    assertBranchDeny(verdictFor("Remove-Item -Confirm:$false -Recurse .", rig), "-Confirm");
    // -Recurse:$false is an explicitly DISABLED recurse: the file-oriented verb must
    // not deny on it, which the POSIX /[rR]/ substring test would get wrong
    assert.equal(verdictFor("Remove-Item -Recurse:$false .", rig).action, "allow");
    // an unrelated -R-bearing parameter must not imply recursion either
    assert.equal(verdictFor("Remove-Item -Registry .", rig).action, "allow");
  } finally {
    rig.cleanup();
  }
});

// --- 9. malformed argv ------------------------------------------------------

test("100.17: a value parameter at the end of argv does not throw", () => {
  const rig = makeRig();
  try {
    assert.equal(verdictFor("Remove-Item -LiteralPath", rig).action, "allow");
    assert.equal(verdictFor("Remove-Item -Path -Recurse", rig).action, "allow");
    assert.equal(verdictFor("Remove-Item", rig).action, "allow");
  } finally {
    rig.cleanup();
  }
});

// --- 10. REGRESSION GUARD: the two POSIX semantics, pinned in opposition -----

test("100.17: rmdir <slot> still denies with no recursive flag", () => {
  const rig = makeRig();
  try {
    // A merged REMOVE_VERBS set would route rmdir through the `if (!recursive) return
    // null` line and silently drop this verdict on every platform.
    assertBranchDeny(verdictFor(`rmdir ${rig.checkoutRoot}`, rig), "rmdir checkout");
    assertBranchDeny(verdictFor(`rmdir ${rig.slotRoot}`, rig), "rmdir slot");
    assertBranchDeny(verdictFor("rmdir .", rig), "rmdir .");
  } finally {
    rig.cleanup();
  }
});

test("100.17: rm <slot> without -r still returns no opinion", () => {
  const rig = makeRig();
  try {
    // Relative target: the same protected directory `rmdir .` denies above, so the two
    // POSIX semantics are pinned in opposite directions on identical input.
    assert.equal(verdictFor("rm .", rig).action, "allow");
    assert.equal(verdictFor("rm -f .", rig).action, "allow");
    assertBranchDeny(verdictFor("rm -rf .", rig), "rm -rf .");
  } finally {
    rig.cleanup();
  }
});

// --- 11. the POSIX branch is byte-identical ---------------------------------

test("100.17: existing POSIX verdicts are unchanged by the Windows branch", () => {
  const rig = makeRig();
  try {
    for (const cmd of [
      `rm -rf ${rig.slotRoot}`,
      `sudo rm -rf ${rig.slotRoot}`,
      `rm --recursive --force ${rig.checkoutRoot}`,
      `rm -rf -- ${rig.checkoutRoot}`, // the -- sentinel
      `git worktree remove ${rig.checkoutRoot}`,
      `git -C /tmp worktree remove ${rig.checkoutRoot}`,
    ]) {
      assert.equal(verdictFor(cmd, rig).action, "deny", cmd);
    }
    for (const cmd of [
      "git status",
      "git worktree list",
      "git worktree remove /some/other/place",
      "rm -rf ./build",
      "rm -f ./dist/bundle.js",
      `unlink ${rig.checkoutRoot}/somefile`,
    ]) {
      assert.equal(verdictFor(cmd, rig).action, "allow", cmd);
    }
  } finally {
    rig.cleanup();
  }
});

// --- 12. DESTRUCTIVE_HINT covers the Windows verbs --------------------------

test("100.17: the conservative fallback fires for Windows verbs with an unresolvable target", () => {
  const rig = makeRig();
  try {
    // $env:SLOT never resolves to a concrete protected path, so the deny can only come
    // from DESTRUCTIVE_HINT plus the literal slot mention in a later segment.
    for (const cmd of [
      `Remove-Item -Recurse $env:SLOT && echo cleaning ${rig.slot}`,
      `del $env:SLOT && echo cleaning ${rig.slot}`,
      `rd $env:SLOT && echo cleaning ${rig.slot}`,
      `erase $env:SLOT && echo cleaning ${rig.slot}`,
      `ri $env:SLOT && echo cleaning ${rig.slot}`,
    ]) {
      const v = verdictFor(cmd, rig);
      assert.equal(v.action, "deny", cmd);
      if (v.action === "deny") assert.match(v.reason, /unresolvable/);
    }
  } finally {
    rig.cleanup();
  }
});

test("100.17: a Windows verb with no protected mention is still allowed", () => {
  const rig = makeRig();
  try {
    assert.equal(verdictFor("Remove-Item -Recurse $env:BUILD_DIR", rig).action, "allow");
    assert.equal(verdictFor("Remove-Item -Recurse -Force ./dist", rig).action, "allow");
  } finally {
    rig.cleanup();
  }
});
