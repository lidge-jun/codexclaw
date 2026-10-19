import { closeSync, constants as fsConstants, lstatSync, mkdirSync, openSync, rmdirSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { DurableStateDisabledError, ensurePrivacyExcludes, isInside, realpathLoose, resolveStateRoot } from "./state-root.js";

export const GITIGNORE_TEXT = "# CodexClaw wrote this when it created .codexclaw; everything here is local runtime state.\n*\n!.gitignore\n!rules/\n!rules/*.md\n";
/** Written instead of GITIGNORE_TEXT when the state mode keeps codexclaw out of git (local/external/none). */
export const PRIVATE_GITIGNORE_TEXT = "# CodexClaw wrote this when it created .codexclaw; this checkout keeps codexclaw out of git.\n*\n";

function ignoreTextFor(cwd        )         {
  try {
    return resolveStateRoot(cwd).mode === "repo" ? GITIGNORE_TEXT : PRIVATE_GITIGNORE_TEXT;
  } catch {
    return GITIGNORE_TEXT;
  }
}

/** Only the process that first creates the project-local root may publish its ignore file. */
export function ensureCodexclawDir(
  cwd        ,
  writeIgnore                                                                = writeFileSync,
)         {
  const dir = join(cwd, ".codexclaw");
  try {
    mkdirSync(dir);
  } catch (err) {
    if ((err                         )?.code === "EEXIST") return dir;
    throw err;
  }
  try {
    writeIgnore(join(dir, ".gitignore"), ignoreTextFor(cwd), { flag: "wx" });
  } catch (err) {
    if ((err                         )?.code === "EEXIST") return dir;
    try { rmdirSync(dir); } catch { /* A concurrent writer made the directory non-empty. */ }
    throw err;
  }
  return dir;
}

/**
 * Create (if needed) and return the DURABLE state directory for cwd (state-root.ts).
 * repo/local: the checkout's .codexclaw; external: <base>/<projectId>/state, created 0700 with a
 * project.json beside it; disabled (mode none or an unsafe root): DurableStateDisabledError.
 */
export function ensureDurableDir(cwd        , env                    = process.env)         {
  const root = resolveStateRoot(cwd, env);
  if (root.disabledReason) throw new DurableStateDisabledError(root.disabledReason);
  if (root.mode !== "external" || !root.projectDir) {
    ensureCodexclawDir(cwd);
    if (root.mode === "local") ensurePrivacyExcludes(cwd, env);
    return root.durableDir;
  }
  mkdirSync(root.durableDir, { recursive: true, mode: 0o700 });
  const verify = ()       => {
    for (const p of [root.projectDir          , root.durableDir]) {
      if (lstatSync(p).isSymbolicLink()) throw new DurableStateDisabledError("external state path " + p + " is a symlink");
      if (isInside(realpathLoose(p), realpathLoose(root.checkoutRoot))) {
        throw new DurableStateDisabledError("external state path " + p + " resolves inside the checkout");
      }
    }
  };
  verify();
  try {
    const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
    const fd = openSync(
      join(root.projectDir, "project.json"),
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | noFollow,
      0o600,
    );
    try {
      writeSync(fd, JSON.stringify({ schema: 1, projectId: root.projectId, origin: root.originKey }, null, 2) + "\n");
    } finally {
      closeSync(fd);
    }
  } catch (err) {
    if ((err                         )?.code !== "EEXIST") throw err;
  }
  // Re-check after the writes: a directory swapped for a link between the first check and
  // here is reported instead of trusted (same-user race; residual documented in 010).
  verify();
  ensurePrivacyExcludes(cwd, env);
  return root.durableDir;
}
