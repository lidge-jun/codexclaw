/**
 * git-write-guard.test.ts — #284 WORKTREE-GUARD-04 and SHELL-SUBST-01.
 */
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { bindSessionSource } from "../src/session-source.ts";
import { defaultState, writeState } from "../src/state.ts";
import {
  evaluateGitSafety,
  findSubstitutions,
  handleGitWriteGuardPreTool,
  parseGitCall,
  riskyMutation,
} from "../src/git-write-guard.ts";

const BT = "`";
const session = "019a0000-0000-7000-8000-000000000284";
const noBinding = { startDir: tmpdir(), sessionCwd: tmpdir(), sessionId: "" };

// --- substitution scanner ----------------------------------------------------

test("findSubstitutions: outer-shell forms only", () => {
  assert.deepEqual(
    findSubstitutions(`echo "a ${BT}git log${BT} b"`).map((s) => [s.kind, s.body, s.inDoubleQuotes]),
    [["backtick", "git log", true]],
  );
  assert.deepEqual(findSubstitutions("echo $(git rev-parse HEAD)").map((s) => s.body), ["git rev-parse HEAD"]);
  assert.deepEqual(findSubstitutions("echo $(echo $(pwd))").map((s) => s.body), ["echo $(pwd)"]);
  assert.equal(findSubstitutions(`echo '${BT}git push${BT} $(git push)'`).length, 0, "single quotes are literal");
  assert.equal(findSubstitutions("echo $((1 + 2))").length, 0, "arithmetic is not a substitution");
  assert.equal(findSubstitutions(`echo \\${BT}x\\${BT}`).length, 0, "escaped backticks are literal");
  assert.equal(findSubstitutions(`echo "${BT}unterminated"`).length, 0);
});

test("findSubstitutions: quoted heredoc bodies are literal, unquoted ones expand", () => {
  const quoted = `cat > notes.md <<'EOF'\nrun ${BT}git cherry-pick a..b${BT}\nEOF\necho done`;
  assert.equal(findSubstitutions(quoted).length, 0);
  const dashQuoted = `cat <<-"EOF"\n\t${BT}git push${BT}\n\tEOF`;
  assert.equal(findSubstitutions(dashQuoted).length, 0);
  const afterHeredoc = `cat <<'EOF'\nliteral ${BT}x${BT}\nEOF\necho ${BT}git push${BT}`;
  assert.deepEqual(findSubstitutions(afterHeredoc).map((s) => s.body), ["git push"]);
  const unquoted = `cat <<EOF\n${BT}git push${BT}\nEOF`;
  assert.deepEqual(findSubstitutions(unquoted).map((s) => s.body), ["git push"]);
});

test("riskyMutation and parseGitCall classify verbs", () => {
  assert.equal(riskyMutation("git cherry-pick 961a4b569..ada7ec14b1"), "git cherry-pick");
  assert.equal(riskyMutation("gh pr merge 12 --squash"), "gh pr merge");
  assert.equal(riskyMutation("GIT_DIR=x git push origin dev"), "git push");
  assert.equal(riskyMutation("git rev-parse HEAD"), null);
  assert.equal(riskyMutation("git merge-base a b"), null);
  assert.equal(riskyMutation("git branch --show-current"), null);
  assert.equal(riskyMutation("gh pr view 12"), null);
  assert.equal(parseGitCall("git branch -D old", "/")?.write, true);
  assert.equal(parseGitCall("git cherry-pick --abort", "/")?.write, false);
  assert.equal(parseGitCall("git -C /x -c a=b commit -m m", "/")?.dir, "/x");
  assert.deepEqual(parseGitCall("git --git-dir=/r/.git --work-tree /r push", "/")?.probeArgs, ["--git-dir=/r/.git", "--work-tree=/r"]);
});

// --- SHELL-SUBST-01 -----------------------------------------------------------

test("SHELL-SUBST-01: interpolated Markdown that runs a git write is denied without a binding", () => {
  const incident = `perl -0pi -e "s/X/run ${BT}git cherry-pick 961a4b569..ada7ec14b1${BT} then ${BT}gh pr merge <n>${BT}/" plan.md`;
  const verdict = evaluateGitSafety(incident, noBinding);
  assert.equal(verdict.action, "deny");
  assert.match((verdict as { reason: string }).reason, /SHELL-SUBST-01.*git cherry-pick/);
  assert.equal(evaluateGitSafety(`zsh -lc 'echo "${BT}git push${BT}"'`, noBinding).action, "deny", "-c payload is scanned");
  assert.equal(evaluateGitSafety("echo $(gh pr close 4)", noBinding).action, "deny");
  assert.equal(evaluateGitSafety("echo $(echo $(git reset --hard))", noBinding).action, "deny", "nested");
});

test("SHELL-SUBST-01: read-only substitutions pass; Markdown backticks get an advisory", () => {
  assert.equal(evaluateGitSafety('git log -1 --format=%h "$(git rev-parse HEAD)"', noBinding).action, "allow");
  assert.equal(evaluateGitSafety("git status && gh pr view 3", noBinding).action, "allow");
  assert.equal(evaluateGitSafety("git push origin codex/x", noBinding).action, "allow", "a direct push is not a substitution");
  const advised = evaluateGitSafety(`git commit -m "fix ${BT}parseArgs${BT} edge"`, noBinding);
  assert.equal(advised.action, "advise");
  assert.match((advised as { context: string }).context, /advisory.*parseArgs/);
  assert.equal(evaluateGitSafety(`git commit -m 'fix ${BT}parseArgs${BT}'`, noBinding).action, "allow");
});

// --- WORKTREE-GUARD-04 --------------------------------------------------------

function fixture(t: TestContext) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-git-guard-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const native = join(root, "native");
  const source = join(root, "source");
  const other = join(root, "other");
  mkdirSync(native);
  mkdirSync(other);
  for (const dir of [native, other]) {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
    git("init", "-q");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(dir, "seed"), "seed");
    git("add", ".");
    git("commit", "-qm", "seed");
  }
  execFileSync("git", ["worktree", "add", "-qb", "work", source], { cwd: native, stdio: "pipe" });
  writeState(native, { ...defaultState(session), phase: "A" });
  bindSessionSource(native, session, source);
  return { native, source, other, ctx: { startDir: native, sessionCwd: native, sessionId: session } };
}

test("WORKTREE-GUARD-04: a git write in the native checkout is denied, naming both roots", (t) => {
  const f = fixture(t);
  const verdict = evaluateGitSafety("git cherry-pick 961a4b569..ada7ec14b1", f.ctx);
  assert.equal(verdict.action, "deny");
  const reason = (verdict as { reason: string }).reason;
  assert.match(reason, /WORKTREE-GUARD-04/);
  assert.ok(reason.includes(f.native) && reason.includes(f.source), reason);
  assert.equal(evaluateGitSafety("git status && git commit -m x", f.ctx).action, "deny");
  assert.equal(evaluateGitSafety(`git -C ${f.native} push`, { ...f.ctx, startDir: f.source }).action, "deny");
});

test("WORKTREE-GUARD-04: the source worktree, recovery flags, reads, and other repos are allowed", (t) => {
  const f = fixture(t);
  assert.equal(evaluateGitSafety(`git -C ${f.source} cherry-pick a..b`, f.ctx).action, "allow");
  assert.equal(evaluateGitSafety(`cd ${f.source} && git commit -m x`, f.ctx).action, "allow");
  assert.equal(evaluateGitSafety("git commit -m x", { ...f.ctx, startDir: f.source }).action, "allow");
  assert.equal(evaluateGitSafety("git cherry-pick --abort", f.ctx).action, "allow");
  assert.equal(evaluateGitSafety("git log --oneline && git diff && git status", f.ctx).action, "allow");
  assert.equal(evaluateGitSafety(`git -C ${f.other} commit -m x`, f.ctx).action, "allow");
  assert.equal(evaluateGitSafety("git commit -m x", { ...f.ctx, sessionId: "019a0000-0000-7000-8000-000000000999" }).action, "allow", "no binding for this session");
});

test("PreToolUse handler: deny envelope, workdir field honored, advisory envelope allows", (t) => {
  const f = fixture(t);
  const payload = (command: string, extra: Record<string, unknown> = {}) => JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: session,
    cwd: f.native,
    tool_name: "Bash",
    tool_input: { command, ...extra },
  });
  const deny = JSON.parse(handleGitWriteGuardPreTool(payload("git cherry-pick a..b"))).hookSpecificOutput;
  assert.equal(deny.permissionDecision, "deny");
  assert.match(deny.permissionDecisionReason, /WORKTREE-GUARD-04/);
  assert.equal(handleGitWriteGuardPreTool(payload("git cherry-pick a..b", { workdir: f.source })), "");
  assert.equal(handleGitWriteGuardPreTool(payload("git status")), "");
  const advise = JSON.parse(handleGitWriteGuardPreTool(payload(`echo "${BT}x${BT}"`))).hookSpecificOutput;
  assert.equal(advise.permissionDecision, "allow");
  assert.match(advise.additionalContext, /SHELL-SUBST-01 advisory/);
  assert.equal(handleGitWriteGuardPreTool("not json"), "");
  assert.equal(handleGitWriteGuardPreTool(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "apply_patch", cwd: f.native, tool_input: { command: "x" } })), "");
});
