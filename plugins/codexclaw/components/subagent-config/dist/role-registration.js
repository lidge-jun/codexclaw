/** Explicit native executor registration. Never invoked by hooks or dispatch. */
import { closeSync, constants, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

function existingRole(path        )                {
  let fd        ;
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.isSymbolicLink()) throw new Error(`Refusing non-regular role file: ${path}`);
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (err) {
    if ((err                         ).code === "ENOENT") return null;
    throw err;
  }
  try {
    if (!fstatSync(fd).isFile()) throw new Error(`Refusing non-regular role file: ${path}`);
    return readFileSync(fd, "utf8");
  } finally { closeSync(fd); }
}

export function registerExecutor(codexHome = process.env.CODEX_HOME || join(homedir(), ".codex"))                                     {
  const template = resolve(dirname(fileURLToPath(import.meta.url)), "../../../agents/executor.toml");
  const content = readFileSync(template, "utf8").replace(/^model\s*=\s*"default"[^\r\n]*\r?\n/m, "");
  const directory = join(codexHome, "agents");
  mkdirSync(codexHome, { recursive: true });
  try { mkdirSync(directory); }
  catch (err) { if ((err                         ).code !== "EEXIST") throw err; }
  const st = lstatSync(directory);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(`Refusing non-regular agents directory: ${directory}`);
  const path = join(directory, "executor.toml");
  const existing = existingRole(path);
  if (existing === content) return { path, created: false };
  if (existing !== null) throw new Error(`Existing executor role differs; preserved ${path}. Compare it with ${template} before updating.`);
  const temporary = join(directory, `.executor-${randomUUID()}.tmp`);
  writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
  try {
    // Publish complete content without replacing an existing name, including races.
    try { linkSync(temporary, path); }
    catch (err) {
      if ((err                         ).code === "EEXIST" && existingRole(path) === content) return { path, created: false };
      throw err;
    }
  } finally { unlinkSync(temporary); }
  return { path, created: true };
}
