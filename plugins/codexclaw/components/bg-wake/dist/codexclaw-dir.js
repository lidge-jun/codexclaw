import { mkdirSync, rmdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const GITIGNORE_TEXT = "# CodexClaw wrote this when it created .codexclaw; everything here is local runtime state.\n*\n!.gitignore\n!rules/\n!rules/*.md\n";

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
    writeIgnore(join(dir, ".gitignore"), GITIGNORE_TEXT, { flag: "wx" });
  } catch (err) {
    if ((err                         )?.code === "EEXIST") return dir;
    try { rmdirSync(dir); } catch { /* A concurrent writer made the directory non-empty. */ }
    throw err;
  }
  return dir;
}
