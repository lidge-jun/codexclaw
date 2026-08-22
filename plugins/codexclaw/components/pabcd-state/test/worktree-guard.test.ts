/**
 * worktree-guard.test.ts — 260804 unit (010 rev2 case list).
 * Detection / canonicalization / SessionStart / UserPromptSubmit dedupe /
 * command grammar / PreToolUse deny incl. subagent-stamped payloads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, sep } from "node:path";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";
import {
  buildSessionStartContext,
  candidateWorktreeRoots,
  canonicalize,
  detectManagedWorktree,
  detectRenameIntent,
  evaluateCommand,
  handleWorktreeGuard,
  handleWorktreeGuardPreTool,
  splitSegments,
  tokenize,
} from "../src/worktree-guard.ts";

interface Rig {
  home: string;
  codexHome: string;
  worktreesDir: string;
  slotRoot: string;
  checkoutRoot: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => void;
}

/** tmp HOME + CODEX_HOME with worktrees/<slot>/<repo>/.git (gitfile, like a real worktree). */
function makeRig(): Rig {
  // realpath: macOS tmpdir is a /var → /private/var symlink; detection canonicalizes.
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-wg-home-")));
  const codexHome = join(home, ".codex");
  const worktreesDir = join(codexHome, "worktrees");
  const slotRoot = join(worktreesDir, "7627");
  const checkoutRoot = join(slotRoot, "opencodex");
  mkdirSync(checkoutRoot, { recursive: true });
  writeFileSync(join(checkoutRoot, ".git"), "gitdir: /fake/main/.git/worktrees/7627\n");
  const env: NodeJS.ProcessEnv = { CODEX_HOME: codexHome };
  return {
    home,
    codexHome,
    worktreesDir,
    slotRoot,
    checkoutRoot,
    env,
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

// --- 1. detection -----------------------------------------------------------

test("detect: cwd under default worktrees root is managed with slot/checkout split", () => {
  const rig = makeRig();
  try {
    const nested = join(rig.checkoutRoot, "src", "deep");
    mkdirSync(nested, { recursive: true });
    const id = detectManagedWorktree(nested, rig.env);
    assert.equal(id.managed, true);
    assert.equal(id.slot, "7627");
    assert.equal(id.slotRoot, rig.slotRoot);
    assert.equal(id.checkoutRoot, rig.checkoutRoot);
  } finally {
    rig.cleanup();
  }
});

test("detect: CODEX_HOME override is honored", () => {
  const rig = makeRig();
  try {
    const id = detectManagedWorktree(rig.checkoutRoot, { CODEX_HOME: rig.codexHome });
    assert.equal(id.managed, true);
    // a different CODEX_HOME no longer covers the path
    const other = detectManagedWorktree(rig.checkoutRoot, { CODEX_HOME: join(rig.home, "elsewhere") });
    assert.equal(other.managed, false);
  } finally {
    rig.cleanup();
  }
});

test("detect: CODEXCLAW_WORKTREE_ROOTS extra root (POSIX list) is honored", () => {
  const rig = makeRig();
  try {
    const extraRoot = join(rig.home, "custom-root");
    const extraCheckout = join(extraRoot, "ab12", "repo");
    mkdirSync(extraCheckout, { recursive: true });
    writeFileSync(join(extraCheckout, ".git"), "gitdir: /fake\n");
    const env = {
      CODEX_HOME: join(rig.home, "nowhere"),
      CODEXCLAW_WORKTREE_ROOTS: [join(rig.home, "unused"), extraRoot].join(delimiter),
    };
    const id = detectManagedWorktree(extraCheckout, env);
    assert.equal(id.managed, true);
    assert.equal(id.slot, "ab12");
    assert.equal(id.checkoutRoot, extraCheckout);
    // candidateWorktreeRoots parses the platform delimiter list
    assert.deepEqual(candidateWorktreeRoots(env), [
      join(rig.home, "nowhere", "worktrees"),
      join(rig.home, "unused"),
      extraRoot,
    ]);
  } finally {
    rig.cleanup();
  }
});

test("detect: Windows-style drive-letter root survives path.delimiter parsing", () => {
  if (process.platform === "win32") {
    // ";" delimiter keeps the drive letter intact (round-2 B6: naive ":" split corrupts it).
    const winRoot = "C:\\Codex\\worktrees";
    const roots = candidateWorktreeRoots({ CODEX_HOME: "/x", CODEXCLAW_WORKTREE_ROOTS: winRoot });
    assert.deepEqual(roots, [join("/x", "worktrees"), winRoot]);
    return;
  }
  // POSIX: delimiter is ":", so multi-entry lists split on ":"; a single
  // entry without a colon survives whole.
  const roots = candidateWorktreeRoots({ CODEX_HOME: "/x", CODEXCLAW_WORKTREE_ROOTS: "/opt/wt" });
  assert.deepEqual(roots, [join("/x", "worktrees"), "/opt/wt"]);
});

test("detect: worktrees root itself and unrelated paths are not managed", () => {
  const rig = makeRig();
  try {
    assert.equal(detectManagedWorktree(rig.worktreesDir, rig.env).managed, false);
    assert.equal(detectManagedWorktree(rig.home, rig.env).managed, false);
    assert.equal(detectManagedWorktree("/tmp", rig.env).managed, false);
    assert.equal(detectManagedWorktree("", rig.env).managed, false);
  } finally {
    rig.cleanup();
  }
});

test("detect: no .git entry anywhere up to slotRoot → managed but checkoutRoot null", () => {
  const rig = makeRig();
  try {
    rmSync(join(rig.checkoutRoot, ".git"));
    const id = detectManagedWorktree(rig.checkoutRoot, rig.env);
    assert.equal(id.managed, true);
    assert.equal(id.slotRoot, rig.slotRoot);
    assert.equal(id.checkoutRoot, null); // never falls back to slotRoot (audit B2)
    const ctx = buildSessionStartContext(id, rig.checkoutRoot);
    assert.match(ctx, /unconfirmed/);
  } finally {
    rig.cleanup();
  }
});

// --- 2. canonicalization ------------------------------------------------------

test("canonicalize: symlinked cwd resolves into the real managed path (symlink-in)", (t) => {
  // The link target is the checkout DIRECTORY, so a junction expresses it and
  // this case runs unprivileged on Windows instead of passing silently.
  if (!supportsSymlinks().dir) {
    t.skip("directory links unavailable on this host: symlink-in canonicalization not exercised");
    return;
  }
  const rig = makeRig();
  try {
    const link = join(rig.home, "link-checkout");
    symlinkDirSync(rig.checkoutRoot, link);
    const id = detectManagedWorktree(link, rig.env);
    assert.equal(id.managed, true);
    assert.equal(id.checkoutRoot, rig.checkoutRoot);
  } finally {
    rig.cleanup();
  }
});

test("canonicalize: non-existent target resolves via nearest existing ancestor", () => {
  const rig = makeRig();
  try {
    const ghost = join(rig.slotRoot, "no-such", "path");
    // macOS: tmpdir is /var → /private/var symlink; the real ancestor wins.
    const realSlot = canonicalize(rig.slotRoot);
    assert.equal(canonicalize(ghost), join(realSlot, "no-such", "path"));
  } finally {
    rig.cleanup();
  }
});

test("guard: symlink pointing OUT of the slot does not leak protection or management", (t) => {
  // Same shape: the escape hatch points at a directory, so a junction suffices.
  if (!supportsSymlinks().dir) {
    t.skip("directory links unavailable on this host: symlink-out leak check not exercised");
    return;
  }
  const rig = makeRig();
  try {
    const outside = mkdtempSync(join(tmpdir(), "cxc-wg-outside-"));
    try {
      const linkInside = join(rig.slotRoot, "escape");
      symlinkDirSync(outside, linkInside);
      // lexical path is inside the slot but canonicalizes OUT: not managed
      const id = detectManagedWorktree(join(linkInside, "x"), rig.env);
      assert.equal(id.managed, false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  } finally {
    rig.cleanup();
  }
});

// --- 3. SessionStart injection --------------------------------------------------

test("SessionStart: managed cwd emits WORKTREE-GUARD-01 naming the checkout root", () => {
  const rig = makeRig();
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = rig.codexHome;
  try {
    const out = handleWorktreeGuard(JSON.stringify({
      hook_event_name: "SessionStart",
      session_id: "019fcd00-0000-7000-8000-000000000001",
      cwd: rig.checkoutRoot,
    }));
    assert.notEqual(out, "");
    const env = JSON.parse(out).hookSpecificOutput;
    assert.equal(env.hookEventName, "SessionStart");
    assert.match(env.additionalContext, /WORKTREE-GUARD-01/);
    assert.ok(env.additionalContext.includes(rig.checkoutRoot));
    assert.match(env.additionalContext, /ADOPT IN PLACE/);
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
    rig.cleanup();
  }
});

test("SessionStart: non-managed cwd is silent", () => {
  const out = handleWorktreeGuard(JSON.stringify({
    hook_event_name: "SessionStart",
    session_id: "019fcd00-0000-7000-8000-000000000002",
    cwd: "/tmp",
  }));
  assert.equal(out, "");
});

// --- 4. UserPromptSubmit rename guidance ----------------------------------------

test("rename intent regex: ko/en positives and non-matches", () => {
  assert.equal(detectRenameIntent("워크트리 이름 바꾸고 싶어"), true);
  assert.equal(detectRenameIntent("rename the worktree please"), true);
  assert.equal(detectRenameIntent("워크트리에서 계속 작업해"), false);
  assert.equal(detectRenameIntent("이름 짓자"), false);
  assert.equal(detectRenameIntent(""), false);
});

test("UserPromptSubmit: managed + rename intent injects once per session (dedupe marker)", () => {
  const rig = makeRig();
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = rig.codexHome;
  const session = "019fcd00-0000-7000-8000-000000000003";
  const payload = () => JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    session_id: session,
    cwd: rig.checkoutRoot,
    prompt: "워크트리 이름 바꾸고 시작하자",
  });
  try {
    const first = handleWorktreeGuard(payload());
    assert.match(first, /WORKTREE-GUARD-02/);
    const marker = join(rig.checkoutRoot, ".codexclaw", "worktree-guard", `${session}.json`);
    assert.equal(existsSync(marker), true);
    const second = handleWorktreeGuard(payload());
    assert.equal(second, "");
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
    rig.cleanup();
  }
});

test("UserPromptSubmit: unrelated prompt or non-managed cwd is silent", () => {
  const rig = makeRig();
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = rig.codexHome;
  try {
    assert.equal(handleWorktreeGuard(JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      session_id: "019fcd00-0000-7000-8000-000000000004",
      cwd: rig.checkoutRoot,
      prompt: "테스트 계속 돌려줘",
    })), "");
    assert.equal(handleWorktreeGuard(JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      session_id: "019fcd00-0000-7000-8000-000000000005",
      cwd: "/tmp",
      prompt: "rename the worktree",
    })), "");
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
    rig.cleanup();
  }
});

// --- 5. command grammar -----------------------------------------------------------

test("tokenizer: segments split on &&, ||, ;, | with quote protection", () => {
  assert.deepEqual(splitSegments('a && b || c; d | e'), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(splitSegments("echo 'a;b' && ls"), ["echo 'a;b'", "ls"]);
  assert.deepEqual(tokenize('rm -rf "some dir/"'), ["rm", "-rf", "some dir/"]);
});

function verdictFor(cmd: string, rig: Rig, cwd?: string) {
  const id = detectManagedWorktree(cwd ?? rig.checkoutRoot, rig.env);
  return evaluateCommand(cmd, cwd ?? rig.checkoutRoot, id);
}

test("grammar: git worktree remove variants on own checkout are denied", () => {
  const rig = makeRig();
  try {
    for (const cmd of [
      `git worktree remove ${rig.checkoutRoot}`,
      `git worktree remove --force ${rig.checkoutRoot}`,
      `git -C /tmp worktree remove ${rig.checkoutRoot}`,
      `git worktree remove ${rig.slotRoot}`,
    ]) {
      const v = verdictFor(cmd, rig);
      assert.equal(v.action, "deny", cmd);
      if (v.action === "deny") assert.match(v.reason, /WORKTREE-GUARD-03/);
    }
  } finally {
    rig.cleanup();
  }
});

test("grammar: rm/rmdir variants targeting the protected tree are denied", () => {
  const rig = makeRig();
  try {
    const cases = [
      `rm -rf ${rig.slotRoot}`,
      `sudo rm -rf ${rig.slotRoot}`,
      `env FOO=1 rm -rf ${rig.slotRoot}`,
      `command rm -rf ${rig.slotRoot}`,
      `builtin rm -rf ${rig.slotRoot}`,
      `/bin/rm -rf .`, // cwd == checkoutRoot
      `rm --recursive --force ${rig.checkoutRoot}`,
      `rm -rf -- ${rig.checkoutRoot}`,
      `rmdir ${rig.checkoutRoot}`,
      `cd /tmp && rm -rf ${rig.slotRoot}`, // compound
      `rm -rf ..`, // ancestor of cwd (slotRoot)
    ];
    for (const cmd of cases) {
      assert.equal(verdictFor(cmd, rig).action, "deny", cmd);
    }
  } finally {
    rig.cleanup();
  }
});

test("grammar: conservative fallback denies destructive ops with unresolvable protected mention", () => {
  const rig = makeRig();
  try {
    // $X is unresolvable; the slot id is only mentioned in a later echo segment.
    const v = verdictFor(`rm -rf "$X" && echo cleaning 7627`, rig);
    assert.equal(v.action, "deny");
    if (v.action === "deny") assert.match(v.reason, /unresolvable/);
  } finally {
    rig.cleanup();
  }
});

test("grammar: benign and out-of-scope commands are allowed", () => {
  const rig = makeRig();
  try {
    const cases = [
      "git status",
      "git worktree list",
      "git worktree prune",
      "git worktree remove /some/other/place",
      "rm -rf ./build",
      "rm -f ./dist/bundle.js", // no recursive → file op
      `unlink ${rig.checkoutRoot}/somefile`, // file-only op → allow
      "ls -la",
    ];
    for (const cmd of cases) {
      assert.equal(verdictFor(cmd, rig).action, "allow", cmd);
    }
  } finally {
    rig.cleanup();
  }
});

test("guard: non-managed cwd never denies, even for rm -rf of its own dir", () => {
  const outside = mkdtempSync(join(tmpdir(), "cxc-wg-plain-"));
  try {
    const id = detectManagedWorktree(outside, { CODEX_HOME: join(outside, "nope") });
    assert.equal(evaluateCommand(`rm -rf ${outside}`, outside, id).action, "allow");
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

// --- 6. PreToolUse handler ----------------------------------------------------------

function preToolPayload(rig: Rig, command: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: "019fcd00-0000-7000-8000-000000000006",
    cwd: rig.checkoutRoot,
    tool_name: "Bash",
    tool_input: { command },
    ...extra,
  });
}

test("PreToolUse: deny envelope for self-deletion, empty for benign", () => {
  const rig = makeRig();
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = rig.codexHome;
  try {
    const denyOut = handleWorktreeGuardPreTool(preToolPayload(rig, `git worktree remove ${rig.checkoutRoot}`));
    assert.notEqual(denyOut, "");
    const env = JSON.parse(denyOut).hookSpecificOutput;
    assert.equal(env.hookEventName, "PreToolUse");
    assert.equal(env.permissionDecision, "deny");
    assert.match(env.permissionDecisionReason, /WORKTREE-GUARD-03/);
    assert.equal(typeof env.additionalContext, "string");
    assert.equal(handleWorktreeGuardPreTool(preToolPayload(rig, "git status")), "");
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
    rig.cleanup();
  }
});

test("PreToolUse: subagent-stamped payload is STILL denied (audit B3)", () => {
  const rig = makeRig();
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = rig.codexHome;
  try {
    const out = handleWorktreeGuardPreTool(preToolPayload(rig, `rm -rf ${rig.slotRoot}`, {
      agent_id: "child-agent-1",
      agent_type: "worker",
    }));
    assert.match(out, /"permissionDecision":"deny"/);
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
    rig.cleanup();
  }
});

test("PreToolUse: malformed JSON, wrong tool, missing command all fail open", () => {
  assert.equal(handleWorktreeGuardPreTool("not json"), "");
  assert.equal(handleWorktreeGuardPreTool(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: {}, cwd: "/tmp" })), "");
  assert.equal(handleWorktreeGuardPreTool(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {}, cwd: "/tmp" })), "");
});
