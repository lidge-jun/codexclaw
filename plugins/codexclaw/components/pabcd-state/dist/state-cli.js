/**
 * state-cli.ts — cxc state path|sync|migrate and cxc devlog path (261020 external state root, wp2).
 *
 * path     print the resolved layout (mode, why, durable/devlog/volatile dirs, project id)
 * sync     pull/commit/push the external base when it is a private git repository, without ever
 *          replacing a file a hook writer may be using (devlog/_plan/261020_external_state_root
 *          006/007): merge happens in a throwaway linked worktree, the live tree only receives
 *          appended jsonl lines, create-only new files, and goalplan files swapped under the
 *          goalplan's own write lock; any other difference stops the sync before the branch moves.
 * migrate  move a checkout's legacy durable state and devlog/ into the external layout; dry-run
 *          unless --apply; never overwrites (identical = done, *.jsonl = union append, other
 *          differences = conflict, both kept); skips symlinks and git-tracked files; never runs a
 *          git command that changes history or the index.
 */
import { spawnSync } from "node:child_process";
import {
  appendFileSync, copyFileSync, constants as fsConstants, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { ensureDurableDir } from "./codexclaw-dir.js";
import { LEGACY_DURABLE_ITEMS, resolveStateRoot,                } from "./state-root.js";



const GIT_ROUTING_VARS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"];
const SYNC_LOCK = ".cxc-sync.lock";
const MIGRATE_LOCK = ".migrate.lock";
const GOALPLAN_LOCK_DIR = ".goalplan.lock";
const BASE_GITIGNORE = [SYNC_LOCK, MIGRATE_LOCK, "*.tmp", GOALPLAN_LOCK_DIR + "/", ".probe-*"];
// Bytes are stored exactly as written ("* -text": evidence such as screenshots or PDFs must never
// be rewritten). Only the files codexclaw itself writes as LF text are normalized, so a checkout
// with core.autocrlf never commits a line-ending-only change to a ledger (which union merge would
// turn into duplicate events) or a goalplan.
const BASE_GITATTRIBUTES = ["* -text", "*.jsonl text eol=lf merge=union", "goalplan.json text eol=lf"];

/** Lock and scratch paths that must never be committed, merged in, or applied. */
export function isScratchPath(rel        )          {
  const parts = rel.split("/");
  const leaf = parts[parts.length - 1] ?? "";
  return parts.includes(GOALPLAN_LOCK_DIR) || leaf === SYNC_LOCK || leaf === MIGRATE_LOCK
    || parts.some((p) => p.endsWith(".tmp") || p.startsWith(".probe-"));
}

/** True when p, or any existing directory between base and p, is a symlink. */
function pathHasSymlink(base        , p        )          {
  const rel = relative(base, p);
  if (rel === "" || rel === ".." || rel.startsWith(".." + sep)) return true;
  let cur = base;
  for (const part of rel.split(sep)) {
    cur = join(cur, part);
    try {
      if (lstatSync(cur).isSymbolicLink()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function flag(argv          , name        )                     {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function gitEnv(base                   )                    {
  const env = { ...base };
  for (const name of GIT_ROUTING_VARS) delete env[name];
  return env;
}



/** Strip userinfo and query strings from URLs so git errors never echo credentials. */
export function redactUrls(text        )         {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s/@]*@)?([^\s?#'"]*)(\?[^\s'"]*)?/gi, (_m, scheme        , _user, rest        ) => scheme + rest);
}

function gitIn(dir        , env                   , args          )         {
  const r = spawnSync("git", ["-C", dir, ...args], { env: gitEnv(env), maxBuffer: 256 * 1024 * 1024 });
  const buf = (r.stdout                 ) ?? Buffer.alloc(0);
  return {
    status: typeof r.status === "number" ? r.status : 1,
    stdout: buf.toString("utf8").trim(),
    stderr: redactUrls(((r.stderr                 ) ?? Buffer.alloc(0)).toString("utf8").trim()),
    buf,
  };
}

function realLoose(p        )         {
  try {
    // .native expands Windows 8.3 short names (RUNNER~1) that the JS realpath keeps.
    return typeof realpathSync.native === "function" ? realpathSync.native(p) : realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * A path in one comparable spelling: native realpath; on Windows also forward slashes and
 * lower case. git prints C:/Users/runneradmin/... while Node may hold C:\Users\RUNNER~1\...;
 * both must compare equal (#299). On POSIX a backslash is a legal filename character and is kept.
 */
export function comparablePath(p        , platform                  = process.platform)         {
  const real = realLoose(resolve(p));
  return platform === "win32" ? real.replace(/\\/g, "/").toLowerCase() : real;
}

/**
 * Conservative key for "could these two names be the same tracked file": Unicode NFC, and
 * case-folded on the platforms whose default filesystems are case-insensitive (macOS,
 * Windows). A false match only ever keeps a file in place.
 */
function looseRelKey(rel        )         {
  const n = rel.normalize("NFC");
  return process.platform === "win32" || process.platform === "darwin" ? n.toLowerCase() : n;
}

function fileIdentity(p        )                {
  try {
    const st = statSync(p, { bigint: true });
    return st.ino === 0n ? null : st.dev + ":" + st.ino;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- path

export function describeStateRoot(root           )           {
  const lines = [
    "mode: " + root.mode + " (" + root.reason + ")",
    "durable: " + (root.mode === "none" ? "(disabled)" : root.durableDir),
    "devlog: " + (root.devlogDir ?? "(disabled)"),
    "volatile: " + root.volatileDir,
  ];
  if (root.projectId) lines.push("project: " + root.projectId + (root.originKey ? " (origin " + root.originKey + ")" : ""));
  if (root.stateBase) lines.push("base: " + root.stateBase + " (cxc state sync operates here)");
  if (root.mode === "local" && !root.originKey) {
    lines.push("note: local-only — state stays in this checkout, hidden from git, and is not synced; set CODEXCLAW_STATE_MODE=external or state.mode to keep it outside");
  }
  if (root.mode === "none") {
    lines.push("note: gates that need durable evidence (goalplan C>D receipts, subagent evidence receipts) cannot be satisfied in mode none");
  }
  if (root.disabledReason && root.mode !== "none") lines.push("disabled: " + root.disabledReason);
  for (const w of root.warnings) lines.push("warning: " + w);
  return lines;
}

function rootJson(root           )         {
  return JSON.stringify(root, null, 2);
}

export function runDevlogCli(argv          , cwd        , env                    = process.env)                 {
  const verb = argv[0];
  if (verb === undefined || verb === "--help" || verb === "-h" || verb === "help") {
    return { code: 0, output: "Usage: cxc devlog path [--cwd <path>] [--json|--explain]\n  Prints the resolved devlog directory (plan units live in <path>/_plan, finished ones in <path>/_fin)." };
  }
  if (verb !== "path") return { code: 1, output: "devlog: unknown verb '" + verb + "' (expected path)" };
  const root = resolveStateRoot(flag(argv, "cwd") ?? cwd, env);
  if (argv.includes("--json")) return { code: root.devlogDir ? 0 : 1, output: JSON.stringify({ devlog: root.devlogDir, mode: root.mode, reason: root.reason, disabledReason: root.disabledReason }, null, 2) };
  if (!root.devlogDir) return { code: 1, output: "devlog path: " + (root.disabledReason ?? "devlog is disabled") };
  if (argv.includes("--explain")) return { code: 0, output: [root.devlogDir, ...describeStateRoot(root)].join("\n") };
  return { code: 0, output: root.devlogDir };
}

// ---------------------------------------------------------------- sync

function ensureLines(path        , lines          , header        )          {
  // Never append through a link: the base's own ignore/attribute files must be real files.
  if (existsSync(path) || isDanglingLink(path)) {
    const st = lstatSync(path);
    if (st.isSymbolicLink() || !st.isFile()) throw new Error(path + " is not a regular file; refusing to edit it");
  }
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const have = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const missing = lines.filter((l) => !have.has(l));
  if (missing.length === 0) return false;
  const lead = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(path, lead + header + "\n" + missing.join("\n") + "\n");
  return true;
}

function isDanglingLink(path        )          {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function splitJsonlLines(buf        )           {
  // CRLF and LF lines are the same ledger event (a checkout with core.autocrlf rewrites them).
  return buf.toString("utf8").split(/\r?\n/).filter((l) => l.length > 0);
}

/** Append the lines of 'merged' that 'live' lacks (multiset-aware), keeping merged order. */
function appendMissingLines(livePath        , merged        )         {
  const liveLines = existsSync(livePath) ? splitJsonlLines(readFileSync(livePath)) : [];
  const count = new Map                ();
  for (const l of liveLines) count.set(l, (count.get(l) ?? 0) + 1);
  const add           = [];
  for (const l of splitJsonlLines(merged)) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1);
    else add.push(l);
  }
  if (add.length === 0) return 0;
  mkdirSync(dirname(livePath), { recursive: true });
  const existing = existsSync(livePath) ? readFileSync(livePath) : Buffer.alloc(0);
  const lead = existing.length > 0 && existing[existing.length - 1] !== 0x0a ? "\n" : "";
  appendFileSync(livePath, lead + add.join("\n") + "\n");
  return add.length;
}

function createExclusive(path        , data        )                       {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + "." + process.pid + "." + Date.now() + ".tmp";
  writeFileSync(tmp, data, { flag: "wx" });
  try {
    linkSync(tmp, path);
    return "created";
  } catch (err) {
    if ((err                         )?.code === "EEXIST") return "exists";
    throw err;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** goalplans/<slug>/ directory of a base-relative path, if it is one. */
function goalplanSlugDir(base        , rel        )                {
  const parts = rel.split("/");
  const i = parts.indexOf("goalplans");
  if (i < 0 || i + 2 >= parts.length) return null;
  if (parts[i + 2] === GOALPLAN_LOCK_DIR) return null;
  return join(base, ...parts.slice(0, i + 2));
}

/** The files codexclaw writes as LF text (the ones .gitattributes normalizes). */
function isLfText(rel        )          {
  return rel.endsWith(".jsonl") || rel.endsWith("/goalplan.json") || rel === "goalplan.json";
}

/** Drop CR bytes that precede LF, at the byte level (never decodes, so binaries stay exact). */
function stripCrlf(buf        )         {
  const out = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) continue;
    out[n++] = buf[i];
  }
  return out.subarray(0, n);
}

function sameBytes(path        , data               , lfText = false)          {
  if (!existsSync(path)) return data === null;
  if (data === null) return false;
  const live = readFileSync(path);
  if (live.equals(data)) return true;
  // Ledgers and goalplans that differ only by CRLF (an autocrlf checkout) are the same
  // content; every other file is compared byte for byte.
  return lfText && stripCrlf(live).equals(stripCrlf(data));
}

function blobAt(base        , env                   , rev        , rel        )                {
  const r = gitIn(base, env, ["cat-file", "blob", rev + ":" + rel]);
  return r.status === 0 ? r.buf : null;
}



function applyMerge(base        , env                   , snapshot        , merge        )               {
  const out               = { appended: 0, created: 0, replaced: 0, removed: 0, conflicts: [] };
  // --raw keeps the entry modes: only regular files (100644/100755) are ever applied.
  const diff = gitIn(base, env, ["diff", "--no-renames", "--raw", "-z", snapshot, merge]);
  if (diff.status !== 0) {
    out.conflicts.push("git diff failed: " + diff.stderr);
    return out;
  }
  const fields = diff.buf.toString("utf8").split("\0").filter((f) => f.length > 0);
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const meta = fields[i].replace(/^:/, "").split(" ");
    const newMode = meta[1] ?? "";
    const status = (meta[4] ?? "M")[0];
    const rel = fields[i + 1];
    const live = join(base, ...rel.split("/"));
    if (isScratchPath(rel)) {
      out.conflicts.push(rel + " (lock or scratch file in the merge; never applied)");
      continue;
    }
    if (status !== "D" && newMode !== "100644" && newMode !== "100755") {
      out.conflicts.push(rel + " (entry mode " + newMode + " is not a regular file; symlinks and submodules are never applied)");
      continue;
    }
    if (pathHasSymlink(base, live)) {
      out.conflicts.push(rel + " (the local path is or passes through a symlink; never written)");
      continue;
    }
    if (rel.endsWith(".jsonl") && status === "D") {
      out.conflicts.push(rel + " (append-only ledger deleted on the other side; kept here)");
      continue;
    }
    const mergedBlob = status === "D" ? null : blobAt(base, env, merge, rel);
    const snapBlob = status === "A" ? null : blobAt(base, env, snapshot, rel);
    if (sameBytes(live, mergedBlob, isLfText(rel))) continue;
    if (rel.endsWith(".jsonl") && mergedBlob) {
      out.appended += appendMissingLines(live, mergedBlob);
      continue;
    }
    const slugDir = goalplanSlugDir(base, rel);
    if (slugDir) {
      const lock = join(slugDir, GOALPLAN_LOCK_DIR);
      try {
        mkdirSync(slugDir, { recursive: true });
        mkdirSync(lock);
      } catch {
        out.conflicts.push(rel + " (goalplan is locked by a writer; retry later)");
        continue;
      }
      try {
        if (!sameBytes(live, snapBlob, isLfText(rel))) {
          out.conflicts.push(rel + " (changed here since the sync snapshot)");
        } else if (mergedBlob === null) {
          unlinkSync(live);
          out.removed += 1;
        } else if (snapBlob === null) {
          // A plan created on the other machine: create-only, so a local `loop init` that
          // published the same slug a moment ago is never replaced.
          if (createExclusive(live, mergedBlob) === "created") out.created += 1;
          else out.conflicts.push(rel + " (created here during the sync)");
        } else {
          // wx (O_EXCL) never follows or reuses an existing entry at the tmp name.
          const tmp = live + "." + process.pid + "." + Date.now() + ".sync.tmp";
          try {
            writeFileSync(tmp, mergedBlob, { mode: 0o600, flag: "wx" });
            renameSync(tmp, live);
          } finally {
            rmSync(tmp, { force: true });
          }
          out.replaced += 1;
        }
      } finally {
        rmSync(lock, { recursive: true, force: true });
      }
      continue;
    }
    if (status === "A" && mergedBlob && !existsSync(live)) {
      if (createExclusive(live, mergedBlob) === "created") out.created += 1;
      else if (!sameBytes(live, mergedBlob)) out.conflicts.push(rel + " (appeared here during the sync)");
      continue;
    }
    out.conflicts.push(rel + " (" + (status === "D" ? "deleted" : "modified") + " on the other side; only jsonl ledgers, new files and goalplans are applied automatically)");
  }
  return out;
}

export function runStateSync(cwd        , env                   , dryRun         )                 {
  const root = resolveStateRoot(cwd, env);
  if (root.mode !== "external" || !root.stateBase) {
    return { code: 0, output: "state sync: mode " + root.mode + " keeps durable state at " + root.durableDir + "; nothing to sync" };
  }
  if (root.disabledReason) return { code: 1, output: "state sync: " + root.disabledReason };
  const base = root.stateBase;
  if (!existsSync(base)) return { code: 0, output: "state sync: " + base + " does not exist yet; nothing to sync" };
  const top = gitIn(base, env, ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) {
    return { code: 0, output: "state sync: " + base + " is not a git repository; nothing to sync.\nTo sync across machines: git -C " + base + " init, add a PRIVATE remote, push once, then run cxc state sync." };
  }
  if (comparablePath(top.stdout) !== comparablePath(base)) {
    return { code: 1, output: "state sync: " + base + " is inside another git repository (" + top.stdout + "); refusing. Make the state base its own repository." };
  }
  if (dryRun) {
    const st = gitIn(base, env, ["status", "--porcelain"]);
    const up = gitIn(base, env, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    return {
      code: 0,
      output: [
        "state sync (dry run) in " + base,
        "local changes: " + (st.stdout ? st.stdout.split("\n").length : 0) + " path(s)",
        "upstream: " + (up.status === 0 ? up.stdout : "(none — sync would commit locally only)"),
        "steps: snapshot commit -> fetch -> merge in a temp worktree -> apply additively -> push (never --force)",
      ].join("\n"),
    };
  }
  const lockPath = join(base, SYNC_LOCK);
  try {
    writeFileSync(lockPath, String(process.pid), { flag: "wx" });
  } catch {
    return { code: 1, output: "state sync: another sync holds " + lockPath + "; if no sync is running, remove that file and retry" };
  }
  let tmpWorktree                = null;
  const lines           = ["state sync in " + base];
  try {
    try {
      if (ensureLines(join(base, ".gitignore"), BASE_GITIGNORE, "# codexclaw state sync: never commit locks or scratch files")) lines.push("wrote .gitignore entries");
      if (ensureLines(join(base, ".gitattributes"), BASE_GITATTRIBUTES, "# codexclaw state sync: append-only ledgers merge by union")) lines.push("wrote .gitattributes (*.jsonl merge=union)");
    } catch (err) {
      return { code: 1, output: "state sync: " + (err instanceof Error ? err.message : String(err)) };
    }
    const trackedAll = gitIn(base, env, ["ls-files", "-z"]);
    const trackedScratch = trackedAll.buf.toString("utf8").split("\0").filter((p) => p && isScratchPath(p));
    if (trackedScratch.length > 0) {
      return { code: 1, output: "state sync: lock or scratch files are tracked in " + base + " (" + trackedScratch.slice(0, 5).join(", ") + "); untrack them first" };
    }
    if (gitIn(base, env, ["diff", "--cached", "--quiet"]).status !== 0) {
      return { code: 1, output: "state sync: " + base + " already has staged changes that sync did not make; commit or unstage them first" };
    }
    const commitIfStaged = (message        )                => {
      if (gitIn(base, env, ["diff", "--cached", "--quiet"]).status === 0) return null;
      return gitIn(base, env, ["commit", "-q", "-m", message]);
    };
    const stamp = (what        ) => "cxc state sync: " + what + " " + hostname() + " " + new Date().toISOString();
    const stage = ()                => {
      const add = gitIn(base, env, ["add", "-A"]);
      if (add.status !== 0) return add.stderr || "git add failed";
      // Belt and braces: whatever the ignore files say, a lock or scratch path never
      // gets committed. Unstaging touches only the index, never history or files.
      const names = gitIn(base, env, ["diff", "--cached", "--name-only", "-z"]);
      const scratch = names.buf.toString("utf8").split("\0").filter((p) => p && isScratchPath(p));
      if (scratch.length > 0) {
        const reset = gitIn(base, env, ["reset", "-q", "--", ...scratch]);
        if (reset.status !== 0) return "could not unstage lock/scratch files: " + reset.stderr;
      }
      return null;
    };
    const staged = stage();
    if (staged) return { code: 1, output: [...lines, "staging failed: " + staged].join("\n") };
    const snap = commitIfStaged(stamp("snapshot"));
    if (snap && snap.status !== 0) return { code: 1, output: "state sync: commit failed: " + snap.stderr };
    if (snap) lines.push("committed local changes");
    const head = gitIn(base, env, ["rev-parse", "--verify", "-q", "HEAD"]);
    if (head.status !== 0) return { code: 0, output: [...lines, "no commits yet; nothing to push"].join("\n") };
    const up = gitIn(base, env, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    if (up.status !== 0) return { code: 0, output: [...lines, "no upstream configured; committed locally only"].join("\n") };
    const fetch = gitIn(base, env, ["fetch", "--quiet"]);
    if (fetch.status !== 0) return { code: 1, output: [...lines, "fetch failed: " + fetch.stderr].join("\n") };
    const snapshot = head.stdout;
    const upstream = gitIn(base, env, ["rev-parse", "@{u}"]).stdout;
    const remoteAhead = gitIn(base, env, ["merge-base", "--is-ancestor", upstream, snapshot]).status !== 0;
    if (remoteAhead) {
      tmpWorktree = mkdtempSync(join(tmpdir(), "cxc-state-sync-"));
      rmdirSync(tmpWorktree);
      const add = gitIn(base, env, ["worktree", "add", "-q", "--detach", tmpWorktree, snapshot]);
      if (add.status !== 0) {
        // Git can register the worktree and still fail (e.g. a post-checkout hook); the
        // finally block removes whatever exists at tmpWorktree.
        return { code: 1, output: [...lines, "could not create a merge worktree: " + add.stderr].join("\n") };
      }
      const merge = gitIn(tmpWorktree, env, ["merge", "--no-edit", "-q", upstream]);
      if (merge.status !== 0) {
        const unmerged = gitIn(tmpWorktree, env, ["diff", "--name-only", "--diff-filter=U"]).stdout;
        gitIn(tmpWorktree, env, ["merge", "--abort"]);
        return { code: 1, output: [...lines, "merge conflict with " + up.stdout + " — live files untouched, branch unchanged:", unmerged || merge.stderr, "Resolve by hand in " + base + " (git pull), then rerun."].join("\n") };
      }
      const merged = gitIn(tmpWorktree, env, ["rev-parse", "HEAD"]).stdout;
      const applied = applyMerge(base, env, snapshot, merged);
      lines.push("applied remote changes: " + applied.appended + " ledger line(s) appended, " + applied.created + " file(s) created, " + applied.replaced + " goalplan file(s) replaced, " + applied.removed + " removed");
      if (applied.conflicts.length > 0) {
        return { code: 1, output: [...lines, "stopped before moving the branch; conflicts:", ...applied.conflicts.map((c) => "  - " + c), "Nothing was overwritten. Resolve these paths by hand, then rerun."].join("\n") };
      }
      const reset = gitIn(base, env, ["reset", "--soft", merged]);
      if (reset.status !== 0) return { code: 1, output: [...lines, "could not advance the branch: " + reset.stderr].join("\n") };
      const restaged = stage();
      if (restaged) return { code: 1, output: [...lines, "staging failed after the merge: " + restaged].join("\n") };
      const after = commitIfStaged(stamp("after-merge"));
      if (after && after.status !== 0) return { code: 1, output: [...lines, "commit failed: " + after.stderr].join("\n") };
    }
    const ahead = gitIn(base, env, ["rev-list", "--count", "@{u}..HEAD"]).stdout;
    if (ahead !== "0") {
      const push = gitIn(base, env, ["push", "-q"]);
      if (push.status !== 0) return { code: 1, output: [...lines, "push failed (nothing forced): " + push.stderr, "Rerun cxc state sync to merge the newer remote first."].join("\n") };
      lines.push("pushed " + ahead + " commit(s) to " + up.stdout);
    } else {
      lines.push("up to date with " + up.stdout);
    }
    return { code: 0, output: lines.join("\n") };
  } finally {
    if (tmpWorktree) {
      gitIn(base, env, ["worktree", "remove", "--force", tmpWorktree]);
      gitIn(base, env, ["worktree", "prune"]);
      rmSync(tmpWorktree, { recursive: true, force: true });
    }
    rmSync(lockPath, { force: true });
  }
}

// ---------------------------------------------------------------- migrate




function walk(src        , dst        , ops             , dstBase        )       {
  let st;
  try {
    st = lstatSync(src);
  } catch {
    return;
  }
  if (st.isSymbolicLink()) {
    ops.push({ kind: "skip-symlink", src, dst });
    return;
  }
  if (st.isDirectory()) {
    for (const name of readdirSync(src).sort()) walk(join(src, name), join(dst, name), ops, dstBase);
    return;
  }
  if (!st.isFile()) return;
  if (pathHasSymlink(dstBase, dst)) ops.push({ kind: "skip-symlink", src, dst, note: "destination is or passes through a symlink" });
  else if (!existsSync(dst)) ops.push({ kind: "move", src, dst });
  else if (readFileSync(src).equals(readFileSync(dst))) ops.push({ kind: "same", src, dst });
  else if (src.endsWith(".jsonl")) ops.push({ kind: "merge", src, dst });
  else ops.push({ kind: "conflict", src, dst });
}



/**
 * Tracked paths as repo-relative keys (git's own --full-name form, see looseRelKey) and as
 * file identities (dev:ino of the working-tree file), plus the comparable top-level.
 * Absolute-string matching broke on Windows short names and slashes and let migrate move
 * tracked files (#299); identity also covers case and NFC/NFD spellings.
 */
function trackedSet(cwd        , env                   )                      {
  const r = gitIn(cwd, env, ["ls-files", "-z", "--full-name", "--", ".codexclaw", "devlog"]);
  const top = gitIn(cwd, env, ["rev-parse", "--show-toplevel"]);
  const rels = new Set        ();
  const ids = new Set        ();
  if (top.status !== 0) return { top: "", rels, ids }; // not a git checkout: nothing can be tracked
  if (r.status !== 0) return null; // a git checkout whose index cannot be read: refuse
  for (const rel of r.buf.toString("utf8").split("\0")) {
    if (!rel) continue;
    rels.add(looseRelKey(rel));
    const id = fileIdentity(join(top.stdout, ...rel.split("/")));
    if (id) ids.add(id);
  }
  return { top: comparablePath(top.stdout), rels, ids };
}

/** true/false for tracked/untracked; null when the path cannot be placed under the top-level. */
function isTracked(index              , src        )                 {
  if (index.top === "") return false;
  const id = fileIdentity(src);
  if (id && index.ids.has(id)) return true;
  const here = comparablePath(src);
  const rel = process.platform === "win32" ? posix.relative(index.top, here) : relative(index.top, here).split(sep).join("/");
  if (rel === "" || rel === ".." || rel.startsWith("../") || posix.isAbsolute(rel) || /^[a-z]:/i.test(rel)) return null;
  return index.rels.has(looseRelKey(rel));
}

function activeSessions(volatileDir        )           {
  const dir = join(volatileDir, "sessions");
  const out           = [];
  let names           = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    try {
      const s = JSON.parse(readFileSync(join(dir, n), "utf8"))                                                 ;
      if ((s.phase !== undefined && s.phase !== "IDLE") || (s.dcloseRecovery !== undefined && s.dcloseRecovery !== null)) {
        out.push(n.replace(/\.json$/, "") + " (phase " + String(s.phase) + (s.dcloseRecovery ? ", D-close recovery pending" : "") + ")");
      }
    } catch {
      out.push(n + " (unreadable)");
    }
  }
  return out;
}

function pruneEmptyDirs(dir        )       {
  let st;
  try {
    st = lstatSync(dir);
  } catch {
    return;
  }
  if (!st.isDirectory()) return;
  for (const name of readdirSync(dir)) pruneEmptyDirs(join(dir, name));
  try {
    if (readdirSync(dir).length === 0) rmdirSync(dir);
  } catch {
    // keep it
  }
}

function staleReferences(sources          )           {
  const out           = [];
  const visit = (p        )       => {
    let st;
    try {
      st = lstatSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const n of readdirSync(p)) visit(join(p, n));
    } else if (st.isFile() && p.endsWith(".json")) {
      const text = readFileSync(p, "utf8");
      if (text.includes(".codexclaw/evidence") || text.includes("devlog/_plan")) out.push(p);
    }
  };
  for (const s of sources) visit(s);
  return out;
}

export function runStateMigrate(cwd        , env                   , apply         )                 {
  const root = resolveStateRoot(cwd, env);
  if (root.mode !== "external" || !root.projectDir || !root.devlogDir) {
    return { code: 1, output: "state migrate: this checkout resolves to mode " + root.mode + " (" + root.reason + "); migrate only moves state into the external layout. Set CODEXCLAW_STATE_MODE=external or config state.projects[\"" + (root.originKey ?? "<host/owner/repo>") + "\"]=\"external\" first." };
  }
  if (root.disabledReason) return { code: 1, output: "state migrate: " + root.disabledReason };
  const ops              = [];
  const goalplanSources           = [];
  for (const item of LEGACY_DURABLE_ITEMS) {
    const src = join(root.volatileDir, item);
    if (pathHasSymlink(root.cwd, src)) {
      ops.push({ kind: "skip-symlink", src, dst: join(root.durableDir, item), note: "source is or passes through a symlink" });
      continue;
    }
    if (item === "goalplans" && existsSync(src)) goalplanSources.push(src);
    walk(src, join(root.durableDir, item), ops, root.projectDir);
  }
  const devlogSrc = join(root.cwd, "devlog");
  if (pathHasSymlink(root.cwd, devlogSrc)) ops.push({ kind: "skip-symlink", src: devlogSrc, dst: root.devlogDir, note: "source is a symlink" });
  else walk(devlogSrc, root.devlogDir, ops, root.projectDir);
  const tracked = trackedSet(root.cwd, env);
  if (tracked === null) {
    return { code: 1, output: "state migrate: git ls-files failed in " + root.cwd + "; refusing to move files whose tracked status is unknown" };
  }
  for (const op of ops) {
    if (op.kind === "skip-symlink") continue;
    const status = isTracked(tracked, op.src);
    if (status === true) {
      op.kind = "skip-tracked";
      op.note = "tracked in git; left in place";
    } else if (status === null) {
      // Fail closed: a file whose tracked status cannot be determined is never moved.
      op.kind = "skip-tracked";
      op.note = "tracked status unknown (outside the git top-level); left in place";
    }
  }
  const count = (k             ) => ops.filter((o) => o.kind === k).length;
  const show = (o           ) => "  " + o.kind.padEnd(13) + relative(root.cwd, o.src).split(sep).join("/") + " -> " + o.dst;
  const head = [
    "state migrate " + (apply ? "(apply)" : "(dry run; pass --apply to move)") + ": " + root.cwd + " -> " + root.projectDir,
    "move " + count("move") + ", already there " + count("same") + ", jsonl union " + count("merge") + ", conflicts " + count("conflict") + ", skipped symlinks " + count("skip-symlink") + ", skipped tracked " + count("skip-tracked"),
  ];
  const stale = staleReferences(goalplanSources);
  const notes           = [];
  if (stale.length > 0) {
    notes.push("stale after migration: these plans store checkout-relative evidence or devlog paths; re-record receipts / re-attest planUnit in the next cycle:");
    for (const s of stale) notes.push("  - " + s);
  }
  const active = activeSessions(root.volatileDir);
  if (active.length > 0) {
    notes.push("blocked: sessions in this checkout are mid-cycle; close them to IDLE before --apply:");
    for (const a of active) notes.push("  - " + a);
  }
  if (!apply) return { code: 0, output: [...head, ...ops.map(show), ...notes].join("\n") };
  if (active.length > 0) return { code: 1, output: [...head, ...notes].join("\n") };
  if (ops.length === 0) return { code: 0, output: [...head, "nothing to migrate"].join("\n") };

  ensureDurableDir(root.cwd, env);
  const lockPath = join(root.projectDir, MIGRATE_LOCK);
  try {
    writeFileSync(lockPath, String(process.pid), { flag: "wx" });
  } catch {
    return { code: 1, output: "state migrate: another migration holds " + lockPath + "; if none is running, remove it and retry" };
  }
  const failures           = [];
  try {
    for (const op of ops) {
      try {
        if (op.kind === "move") {
          mkdirSync(dirname(op.dst), { recursive: true });
          copyFileSync(op.src, op.dst, fsConstants.COPYFILE_EXCL);
          if (!readFileSync(op.src).equals(readFileSync(op.dst))) throw new Error("copy verification failed");
          unlinkSync(op.src);
        } else if (op.kind === "same") {
          unlinkSync(op.src);
        } else if (op.kind === "merge") {
          appendMissingLines(op.dst, readFileSync(op.src));
          unlinkSync(op.src);
        }
      } catch (err) {
        failures.push(op.src + ": " + (err instanceof Error ? err.message : String(err)));
      }
    }
  } finally {
    rmSync(lockPath, { force: true });
  }
  for (const item of LEGACY_DURABLE_ITEMS) pruneEmptyDirs(join(root.volatileDir, item));
  pruneEmptyDirs(join(root.cwd, "devlog"));
  const leftovers = ops.filter((o) => o.kind === "conflict" || o.kind.startsWith("skip"));
  return {
    code: failures.length > 0 ? 1 : 0,
    output: [
      ...head,
      ...leftovers.map(show),
      ...failures.map((f) => "failed: " + f),
      ...notes,
      leftovers.length > 0 ? "left in place: " + leftovers.length + " path(s) above (conflicts keep both copies)" : "done",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------- dispatch

const STATE_USAGE = [
  "cxc state — where codexclaw keeps durable state for this checkout",
  "",
  "Usage:",
  "  cxc state path    [--cwd <path>] [--json]   mode, reason and resolved directories",
  "  cxc state sync    [--cwd <path>] [--dry-run] pull/commit/push the external base (a private git repo)",
  "  cxc state migrate [--cwd <path>] [--apply]   move legacy in-checkout state + devlog/ to the external layout",
  "",
  "Modes: repo | local | external | none. Override with CODEXCLAW_STATE_MODE / CODEXCLAW_STATE_ROOT",
  "or ~/.codexclaw/config.json {\"state\": {\"mode\", \"root\", \"ownerAllowlist\", \"projects\"}}.",
].join("\n");

export function runStateCli(argv          , cwd        , env                    = process.env)                 {
  const verb = argv[0];
  const target = flag(argv, "cwd") ?? cwd;
  if (verb === undefined || verb === "help" || verb === "--help" || verb === "-h") return { code: 0, output: STATE_USAGE };
  if (verb === "path") {
    const root = resolveStateRoot(target, env);
    return { code: 0, output: argv.includes("--json") ? rootJson(root) : describeStateRoot(root).join("\n") };
  }
  if (verb === "sync") return runStateSync(target, env, argv.includes("--dry-run"));
  if (verb === "migrate") return runStateMigrate(target, env, argv.includes("--apply"));
  return { code: 1, output: "state: unknown verb '" + verb + "'\n" + STATE_USAGE };
}
