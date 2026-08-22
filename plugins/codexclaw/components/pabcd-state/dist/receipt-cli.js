/**
 * receipt-cli.ts — `cxc receipt test` (075).
 *
 * Runs a command and records what happened. The point is that the agent does not
 * choose the numbers: exitCode and command are observed here rather than typed
 * into an attestation. That only holds for receipts this producer wrote — the gate
 * cannot authenticate provenance, so a hand-written file is still possible.
 *
 * Source identity is captured before AND after the run with the same exclusion the
 * C>D gate uses. Capturing once would mark the receipt stale the moment it is
 * written, and a command that rewrites tracked files (a formatter, a snapshot
 * update) has no business closing a check with the tree it just changed.
 */
import { spawnSync } from "node:child_process";
import { commandInvocation } from "./win-exec.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState } from "./state.js";
import { captureSourceIdentity, compareSource } from "./source-identity.js";
import { STATE_DIR, sanitizeKey } from "./state.js";










/** Everything after `--` is the command; nothing before it is. */
export function parseReceiptCliArgs(argv          , cwd        )                                        {
  const verb = (argv[0] ?? "").toLowerCase();
  if (verb !== "test") return { error: `unknown receipt verb '${argv[0] ?? ""}' (expected test)` };
  const out                 = { verb: "test", cwd, command: [] };
  let i = 1;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { i++; break; }
    if (a === "--session") out.session = argv[++i];
    else if (a === "--cwd") out.cwd = argv[++i] ?? cwd;
    else return { error: `unexpected argument '${a}' before --` };
  }
  out.command = argv.slice(i).filter((a) => typeof a === "string" && a.length > 0);
  return out;
}

/** One receipt per session, at a fixed name, so a failed re-run cannot leave an
 *  earlier success behind under a different filename. */
export function receiptPathFor(cwd        , sessionId        )         {
  return join(cwd, STATE_DIR, "evidence", sanitizeKey(sessionId), "test-receipt.json");
}



export function runReceiptCli(args                )                   {
  const session = (args.session ?? "").trim();
  if (session.length === 0) return { output: "receipt test: --session <id> is required", code: 1 };
  if (args.command.length === 0) {
    return { output: "receipt test: a command is required after `--`, e.g. `cxc receipt test --session <id> -- npm test`", code: 1 };
  }
  const state = readState(args.cwd, session);
  if (state.phase !== "C") {
    return { output: `receipt test: session is at ${state.phase}, not C — a check receipt is produced during Check`, code: 1 };
  }
  if (!state.checkEpoch) {
    return {
      output: "receipt test: no check binding on this session. Step back with `cxc orchestrate B` and re-enter `cxc orchestrate C` to mint one (this cycle predates CHECK-BINDING-01).",
      code: 1,
    };
  }

  const path = receiptPathFor(args.cwd, session);
  // Clear first: a stale success must not survive a failing re-run.
  rmSync(path, { force: true });

  const before = captureSourceIdentity(args.cwd, { excludeCodexclawArtifacts: true });
  const [bin, ...rest] = args.command;
  // Issue #40: `npm` is the command people actually pass here, and a bare
  // shell-less spawn of it cannot work on Windows - the name alone skips PATHEXT
  // (ENOENT) and the resolved `npm.cmd` is refused outright (EINVAL). Resolving
  // through win-exec routes only .cmd/.bat via a caret-escaped ComSpec line, so
  // shell:false still holds and the recorded command stays the argv the user gave.
  const invocation = commandInvocation(bin, rest);
  const run = spawnSync(invocation.file, invocation.args, {
    cwd: args.cwd,
    stdio: "inherit",
    shell: false,
    ...invocation.options,
  });
  const after = captureSourceIdentity(args.cwd, { excludeCodexclawArtifacts: true });

  if (run.error || typeof run.status !== "number") {
    return { output: `receipt test: the command did not run to completion (${run.error?.message ?? "terminated by signal"}); no receipt written`, code: 1 };
  }
  if (run.status !== 0) {
    return { output: `receipt test: the command exited ${run.status}; no receipt written`, code: run.status };
  }
  const cmp = compareSource(before, after);
  if (cmp.kind === "different") {
    return { output: `receipt test: the command changed the source while running (${cmp.detail}); no receipt written — a check cannot certify a tree it rewrote`, code: 1 };
  }
  if (cmp.kind === "unavailable") {
    return { output: `receipt test: git could not resolve the source identity (${cmp.reason}); no receipt written`, code: 1 };
  }

  const receipt = {
    kind: "test"         ,
    sourceIdentity: after,
    command: args.command.join(" "),
    exitCode: run.status,
    createdAt: new Date().toISOString(),
    ownerSessionId: session,
    checkEpoch: state.checkEpoch,
  };
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return { output: path, code: 0 };
}
