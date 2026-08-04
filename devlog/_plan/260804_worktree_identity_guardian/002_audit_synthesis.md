# 002 — Audit synthesis, round 1 (reviewer: Hubble, sol/medium, VERDICT: FAIL)

Per REVIEW-SYNTHESIS-01: per-blocker RCA + accept/rebut before re-planning.

## B1 (High) — `git worktree move` on the ACTIVE worktree is unsafe → ACCEPT
RCA: the plan copied git-level safety (lane Volta) without checking session/app-level
safety: moving the current worktree invalidates the session's cwd (next tool call
ENOENT — the exact incident shape) and app rebinding after a manual move is
undocumented. FOLD: adopt-in-place becomes THE default procedure (stay, create/rename
branch, commit; thread title is renamed by the user in the app). `git worktree move`
is demoted to non-current/inactive worktrees only, with the cwd caveat stated.

## B2 (High) — slot dir modeled as worktree root → ACCEPT
RCA: modeling shortcut. FOLD: `slotRoot` (<root>/<slot>, deletion boundary) and
`checkoutRoot` (nearest ancestor of cwd containing a `.git` entry, capped at
slotRoot; identity display + git command target) are separate fields.

## B3 (High) — subagent early-exit disables the guard for the riskiest caller → ACCEPT
RCA: composition bug — inheriting cli.ts's subagent early-exit (designed to stop
root-only CONTEXT leaking into children) also disabled ENFORCEMENT for children.
FOLD: split surfaces. Context injections (SessionStart/UserPromptSubmit) keep the
early-exit; the PreToolUse deletion guard gets its own CLI event
`hook worktree-guard-pretool` dispatched ABOVE the early-exit (like subagent-stop).

## B4 (High) — matcher omission premise wrong → ACCEPT
RCA: assumed shell tool names vary by surface; actually codex-rs canonicalizes to
`Bash` (core/src/tools/hook_names.rs `bash()` → "Bash"; shell payload
`tool_input.command` per core/src/tools/handlers/shell_tests.rs; repo precedent
hooks/_deprecated/pre-tool-use-advising-on-friction.json `^Bash$`). Main session
verified both codex-rs anchors. FOLD: matcher `^Bash$`, read `tool_input.command`.

## B5 (High) — minimal tokenizer bypasses common shell forms → ACCEPT
RCA: under-specified parser claiming deterministic enforcement. FOLD: expanded
grammar — split on `&&`/`||`/`;`/`|`; executable basename matching (`/bin/rm`);
long flags (`--recursive`/`--force`); `--` separator; `sudo`/`env`/`command`
prefixes; `git -C <path>`; conservative deny when a destructive token
(rm/rmdir/unlink/remove) co-occurs with a reference to the slot/worktrees path but
the parser cannot classify. `git worktree prune` DROPPED from the deny grammar
(no path argument; does not delete an existing dir — auditor's FQ9 correction).
Residual bypass classes (variable/glob indirection without a literal path mention)
are documented in the skill as accepted defense-in-depth limits.

## B6 (High) — custom worktree root not detected → ACCEPT (scope narrowing)
RCA: app settings are closed-source; no verified readable source for a custom root.
FOLD: detection = default `$CODEX_HOME/worktrees` + `CODEX_HOME` override + new
`CODEXCLAW_WORKTREE_ROOTS` env (colon-separated extra roots, documented escape
hatch). Feature claims and injection wording narrowed to "default root + configured
extra roots"; skill documents the limitation and the env fix.

## B7 (Medium) — symlink/case canonicalization → ACCEPT
FOLD: canonicalize with `realpathSync.native`; for non-existent targets, realpath
the nearest existing ancestor and append the remainder. Symlink-in/symlink-out/case
tests added to 010's test list.

## B8 (Medium) — skill discovery contract → ACCEPT
FOLD: add `skills/worktree-guardian/agents/openai.yaml` (display_name
`cxc-worktree-guardian`, allow_implicit_invocation: true, per skills/loop precedent);
injection text references `$codexclaw:cxc-worktree-guardian`.

## B9 (Medium) — SoT sync vs scope gate contradiction → ACCEPT
FOLD: README.md (badge + "18 hooks" texts → 21), structure/INDEX.md hook table,
skills/README.md (if it lists skills) enter explicit scope in 010/020; 030's scope
check enumerates them.

## B10 (Medium) — git >= 2.35 claim false → ACCEPT
RCA: lane checked the 2.35 docs and over-generalized; auditor opened the 2.30 docs
showing move+repair present. FOLD: drop version gates; skill/hook text recommends
feature detection (`git worktree move -h`) instead of version arithmetic.

## FQ6 (advisory) — rename-intent false positives / repeat injection → PARTIAL ACCEPT
FOLD: rename guidance injects once per session (marker
`.codexclaw/worktree-guard/<session>.json`). Negation/meta-discussion false
positives are ACCEPTED as advisory-only residual (injection is guidance, not a
gate) — documented in 010.

## Rebutted: none. All ten blockers accepted.

Amendments applied: 000_research.md (move-safety finding + version correction),
010_guard_hooks.md rev2 (identity model, events, matcher, grammar, dedupe, tests),
020_guardian_skill.md rev2 (adopt-in-place default, openai.yaml, limits section),
030_validation_publish.md rev2 (SoT scope, live-fire additions).
