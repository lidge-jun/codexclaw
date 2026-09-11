/**
 * cwd-scope.test.ts — P1-1 project scoping for memory search.
 *
 * Each test builds an ISOLATED temp home (the shared fixture home must keep its
 * mtimes untouched, ranking.test.ts header) with two projects' worth of
 * artifacts so boost-versus-filter is observable in the hit order.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { searchMemory, CWD_BOOST } from "../src/memory-search.ts";
import { normalizeCwd, cwdMatches } from "../src/rollout.ts";
import { main as cliMain } from "../src/cli.ts";

const HERE = "/proj/here";
const THERE = "/proj/here-adjacent";
const THREAD_HERE = "019f1111-0000-7000-8000-00000000aaaa";
const THREAD_THERE = "019f1111-0000-7000-8000-00000000bbbb";
const STAGE1_HERE = "019f1111-0000-7000-8000-00000000cccc";
const STAGE1_THERE = "019f1111-0000-7000-8000-00000000dddd";

// --- same-origin federation fixture (260910 wp4) ---
const MAIN_CHECKOUT = "/proj/codexclaw";
const WORKTREE = "/hash/worktrees/3412/codexclaw";
const OTHER_CHECKOUT = "/proj/cli-jaw";
const ORIGIN = "https://github.com/lidge-jun/codexclaw.git";
const OTHER_ORIGIN = "git@github.com:lidge-jun/cli-jaw.git";
const THREAD_MAIN_CO = "019f2222-0000-7000-8000-00000000aaaa";
const THREAD_OTHER_CO = "019f2222-0000-7000-8000-00000000bbbb";
const STAGE1_MAIN_CO = "019f2222-0000-7000-8000-00000000cccc";

/**
 * Two projects, one topic. Summaries carry cwd in frontmatter; the stage1 rows
 * carry none, so their scope can only come from the threads join.
 */
function buildScopedHome(): string {
  const home = mkdtempSync(join(tmpdir(), "recall-cwd-"));
  const summaries = join(home, "memories", "rollout_summaries");
  mkdirSync(summaries, { recursive: true });
  writeFileSync(
    join(summaries, "here.md"),
    `thread_id: ${THREAD_HERE}\nrollout_path: /Users/x/.codex/sessions/here.jsonl\ncwd: ${HERE}\n\n# Rollout\n\nThe wombat pipeline shipped.\n`,
  );
  writeFileSync(
    join(summaries, "there.md"),
    `thread_id: ${THREAD_THERE}\nrollout_path: /Users/x/.codex/sessions/there.jsonl\ncwd: ${THERE}\n\n# Rollout\n\nThe wombat pipeline shipped.\n`,
  );

  const state = new DatabaseSync(join(home, "state_1.sqlite"));
  state.exec(
    "CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT ''," +
      " cwd TEXT NOT NULL DEFAULT '', git_branch TEXT, updated_at_ms INTEGER)",
  );
  const ins = state.prepare("INSERT INTO threads (id, title, cwd, git_branch, updated_at_ms) VALUES (?, ?, ?, ?, ?)");
  ins.run(THREAD_HERE, "here lane", HERE, "main", Date.now());
  ins.run(THREAD_THERE, "there lane", THERE, "main", Date.now());
  ins.run(STAGE1_HERE, "stage1 here", HERE, null, Date.now());
  ins.run(STAGE1_THERE, "stage1 there", THERE, null, Date.now());
  state.close();

  const mem = new DatabaseSync(join(home, "memories_1.sqlite"));
  mem.exec(
    "CREATE TABLE stage1_outputs (thread_id TEXT PRIMARY KEY, source_updated_at INTEGER NOT NULL," +
      " raw_memory TEXT NOT NULL, rollout_summary TEXT NOT NULL)",
  );
  const mins = mem.prepare(
    "INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary) VALUES (?, ?, ?, ?)",
  );
  const now = Math.floor(Date.now() / 1000);
  mins.run(STAGE1_HERE, now, "aardvark notes recorded in the first project", "aardvark one");
  mins.run(STAGE1_THERE, now, "aardvark notes recorded in the second project", "aardvark two");
  mem.close();
  return home;
}

function scoreOf(hits: Array<{ relpath: string; score: number }>, relpath: string): number {
  const hit = hits.find((h) => h.relpath === relpath);
  assert.ok(hit, `expected a hit for ${relpath}`);
  return hit.score;
}

/**
 * Two repositories, each with a summary recorded under its own MAIN checkout.
 * Neither cwd is the worktree the query will name, so every federated hit has
 * to arrive through the git origin rather than a path prefix.
 *
 * This threads table has git_origin_url; buildScopedHome's deliberately does
 * not, which is what pins the older-state-db fallback in threads-db.ts.
 */
function buildOriginHome(): string {
  const home = mkdtempSync(join(tmpdir(), "recall-origin-"));
  const summaries = join(home, "memories", "rollout_summaries");
  mkdirSync(summaries, { recursive: true });
  writeFileSync(
    join(summaries, "main.md"),
    `thread_id: ${THREAD_MAIN_CO}\ncwd: ${MAIN_CHECKOUT}\n\n# Rollout\n\nThe quokka release train landed.\n`,
  );
  writeFileSync(
    join(summaries, "other.md"),
    `thread_id: ${THREAD_OTHER_CO}\ncwd: ${OTHER_CHECKOUT}\n\n# Rollout\n\nThe quokka release train landed.\n`,
  );

  const state = new DatabaseSync(join(home, "state_1.sqlite"));
  state.exec(
    "CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT ''," +
      " cwd TEXT NOT NULL DEFAULT '', git_branch TEXT, git_origin_url TEXT, updated_at_ms INTEGER)",
  );
  const ins = state.prepare(
    "INSERT INTO threads (id, title, cwd, git_branch, git_origin_url, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
  );
  ins.run(THREAD_MAIN_CO, "main checkout", MAIN_CHECKOUT, "dev", ORIGIN, Date.now());
  ins.run(THREAD_OTHER_CO, "other repo", OTHER_CHECKOUT, "dev", OTHER_ORIGIN, Date.now());
  ins.run(STAGE1_MAIN_CO, "stage1 main", MAIN_CHECKOUT, null, ORIGIN, Date.now());
  state.close();

  const mem = new DatabaseSync(join(home, "memories_1.sqlite"));
  mem.exec(
    "CREATE TABLE stage1_outputs (thread_id TEXT PRIMARY KEY, source_updated_at INTEGER NOT NULL," +
      " raw_memory TEXT NOT NULL, rollout_summary TEXT NOT NULL)",
  );
  mem
    .prepare(
      "INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary) VALUES (?, ?, ?, ?)",
    )
    .run(STAGE1_MAIN_CO, Math.floor(Date.now() / 1000), "numbat notes from the main checkout", "numbat one");
  mem.close();
  return home;
}

test("a worktree query reaches the main checkout of the same git origin", () => {
  const home = buildOriginHome();
  try {
    const nowMs = Date.now();
    const plain = searchMemory("quokka", { home, nowMs, readOriginUrl: () => null });
    assert.equal(plain.hits.length, 2, "both repositories match the query");

    // The worktree path is a prefix of nothing here: only the origin connects it.
    const scoped = searchMemory("quokka", {
      home,
      nowMs,
      cwd: WORKTREE,
      cwdOnly: true,
      readOriginUrl: () => ORIGIN,
    });
    assert.equal(scoped.hits.length, 1, "the other remote is filtered out");
    assert.equal(scoped.hits[0].relpath, "rollout_summaries/main.md");
    assert.equal(scoped.hits[0].cwd, MAIN_CHECKOUT, "the hit keeps its own recorded cwd");
    const gain = scoped.hits[0].score - scoreOf(plain.hits, "rollout_summaries/main.md");
    assert.ok(Math.abs(gain - CWD_BOOST) < 1e-9, `same origin earns the full CWD_BOOST, got ${gain}`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("stage1 rows federate by origin through the same threads join", () => {
  const home = buildOriginHome();
  try {
    const only = searchMemory("numbat", {
      home,
      cwd: WORKTREE,
      cwdOnly: true,
      readOriginUrl: () => ORIGIN,
    });
    assert.equal(only.hits.length, 1);
    assert.equal(only.hits[0].origin, "stage1");
    assert.equal(only.hits[0].cwd, MAIN_CHECKOUT);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a directory with no origin keeps the plain cwd-prefix scope", () => {
  const home = buildOriginHome();
  try {
    // git answers nothing (no repository, no origin, no git): the worktree path
    // matches no recorded cwd, so the hard filter empties and says so.
    const nothing = searchMemory("quokka", {
      home,
      cwd: WORKTREE,
      cwdOnly: true,
      readOriginUrl: () => null,
    });
    assert.equal(nothing.hits.length, 0);
    assert.ok(nothing.warnings.some((w) => w.includes("--cwd-only")));

    // Naming the main checkout directly still works without any origin.
    const byPath = searchMemory("quokka", {
      home,
      cwd: MAIN_CHECKOUT,
      cwdOnly: true,
      readOriginUrl: () => null,
    });
    assert.equal(byPath.hits.length, 1);
    assert.equal(byPath.hits[0].cwd, MAIN_CHECKOUT);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cwdMatches folds path case only when the caller asks", () => {
  // macOS ships a case-insensitive volume, so /Users/jun/developer/x and
  // /Users/jun/Developer/x are one directory there. The option is passed by
  // call sites (FOLD_CWD_CASE), never decided inside the comparison.
  assert.equal(cwdMatches("/Users/jun/developer/x", "/Users/jun/Developer/x"), false);
  assert.equal(
    cwdMatches("/Users/jun/developer/x", "/Users/jun/Developer/x", { caseInsensitive: true }),
    true,
  );
  // Folding case must not fold the separator boundary.
  assert.equal(cwdMatches("/proj/ALPHABET", "/proj/alpha", { caseInsensitive: true }), false);
  assert.equal(cwdMatches("/proj/ALPHA/sub", "/proj/alpha", { caseInsensitive: true }), true);
});

test("--cwd boosts the current project without hiding the rest", () => {
  const home = buildScopedHome();
  try {
    // One pinned clock for both searches: recency decays between two Date.now()
    // captures, and the assertion below measures an exact score delta.
    const nowMs = Date.now();
    const plain = searchMemory("wombat", { home, nowMs });
    assert.equal(plain.hits.length, 2, "both projects match the query");

    const scoped = searchMemory("wombat", { home, cwd: HERE, nowMs });
    assert.equal(scoped.hits.length, 2, "boost must not drop the other project");
    assert.equal(scoped.hits[0].relpath, "rollout_summaries/here.md", "in-project hit ranks first");
    assert.equal(scoped.hits[0].cwd, HERE);
    const gain = scoped.hits[0].score - scoreOf(plain.hits, "rollout_summaries/here.md");
    assert.ok(Math.abs(gain - CWD_BOOST) < 1e-9, `boost is exactly CWD_BOOST, got ${gain}`);
    assert.equal(
      scoreOf(scoped.hits, "rollout_summaries/there.md"),
      scoreOf(plain.hits, "rollout_summaries/there.md"),
      "out-of-project hits keep their original score",
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("--cwd-only filters instead of ranking, and says so when it empties the result", () => {
  const home = buildScopedHome();
  try {
    const only = searchMemory("wombat", { home, cwd: HERE, cwdOnly: true });
    assert.equal(only.hits.length, 1);
    assert.equal(only.hits[0].relpath, "rollout_summaries/here.md");

    const nothing = searchMemory("wombat", { home, cwd: "/proj/unrelated", cwdOnly: true });
    assert.equal(nothing.hits.length, 0);
    assert.ok(nothing.warnings.some((w) => w.includes("--cwd-only")), "empty hard filter explains itself");

    // The same query without the hard filter still answers.
    const boosted = searchMemory("wombat", { home, cwd: "/proj/unrelated" });
    assert.equal(boosted.hits.length, 2);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cwd prefix matching is separator-aware: /proj/here never matches /proj/here-adjacent", () => {
  const home = buildScopedHome();
  try {
    const only = searchMemory("wombat", { home, cwd: HERE, cwdOnly: true });
    assert.ok(
      only.hits.every((h) => h.cwd === HERE),
      "an adjacent path sharing the prefix characters must not be included",
    );
    const adjacent = searchMemory("wombat", { home, cwd: THERE, cwdOnly: true });
    assert.equal(adjacent.hits.length, 1);
    assert.equal(adjacent.hits[0].cwd, THERE);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("stage1 rows get their scope from the threads join, not a stage1 column", () => {
  const home = buildScopedHome();
  try {
    const scoped = searchMemory("aardvark", { home, cwd: HERE });
    assert.equal(scoped.hits.length, 2);
    assert.equal(scoped.hits[0].origin, "stage1");
    assert.equal(scoped.hits[0].cwd, HERE, "cwd came from threads.cwd");

    const only = searchMemory("aardvark", { home, cwd: HERE, cwdOnly: true });
    assert.equal(only.hits.length, 1);
    assert.equal(only.hits[0].cwd, HERE);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a chunk naming the project path scores between in-project and unrelated", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-cwd-prose-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    // MEMORY.md carries no cwd frontmatter; the handbook convention is to name
    // the path in prose. Without the prose signal --cwd-only would discard the
    // handbook entirely, which is where project rules live.
    writeFileSync(join(mem, "MEMORY.md"), `# Notes\n\napplies_to: cwd=${HERE}; the wombat pipeline is owned here.\n`);
    const only = searchMemory("wombat", { home, cwd: HERE, cwdOnly: true });
    assert.equal(only.hits.length, 1, "prose mention survives the hard filter");
    const plain = searchMemory("wombat", { home });
    const gain = only.hits[0].score - plain.hits[0].score;
    assert.ok(gain > 0 && gain < CWD_BOOST, `weaker than a structured cwd match, got ${gain}`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: --cwd and --cwd-only reach memory search", () => {
  const home = buildScopedHome();
  const captured: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.push(s);
    return true;
  };
  try {
    assert.equal(cliMain(["memory", "search", "wombat", "--home", home, "--cwd", HERE, "--json"]), 0);
    const boosted = JSON.parse(captured.join(""));
    assert.equal(boosted.hits.length, 2);
    assert.equal(boosted.hits[0].cwd, HERE);

    captured.length = 0;
    assert.equal(cliMain(["memory", "search", "wombat", "--home", home, "--cwd-only", HERE, "--json"]), 0);
    const filtered = JSON.parse(captured.join(""));
    assert.equal(filtered.hits.length, 1);
    assert.equal(filtered.hits[0].cwd, HERE);
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
    rmSync(home, { recursive: true, force: true });
  }
});

test("aggregate files do not inherit their first block's cwd", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-cwd-agg-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    // raw_memories.md concatenates one block per thread, each with its own
    // cwd: line (448 of them in the live store). Reading the first one would
    // label every chunk in the file with a single project.
    writeFileSync(
      join(mem, "raw_memories.md"),
      `# Raw Memories\n\n## Thread one\ncwd: ${HERE}\n\nplatypus work in the first project.\n\n## Thread two\ncwd: ${THERE}\n\nplatypus work in the second project.\n`,
    );
    const hits = searchMemory("platypus", { home }).hits;
    assert.ok(hits.length >= 2);
    assert.ok(hits.every((h) => h.cwd === null), "a leading heading means no file-level cwd");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("frontmatter cwd is read from the leading block, not any later line", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-cwd-front-"));
  try {
    const summaries = join(home, "memories", "rollout_summaries");
    mkdirSync(summaries, { recursive: true });
    // rollout_path also holds a path, and the body may quote another project.
    writeFileSync(
      join(summaries, "s.md"),
      `thread_id: t1\nrollout_path: /Users/x/.codex/sessions/s.jsonl\ncwd: ${HERE}\n\n# Notes\n\ncwd: ${THERE} was mentioned in passing about the numbat.\n`,
    );
    const hits = searchMemory("numbat", { home }).hits;
    assert.equal(hits.length, 1);
    assert.equal(hits[0].cwd, HERE);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("windows-shaped input reaches a posix-recorded project (CI regression)", () => {
  const home = buildScopedHome();
  try {
    // The fixture records cwd the way a POSIX session does. On Windows the CLI
    // hands the same directory over with backslashes, and resolve() used to
    // rewrite the query side only, so the two never compared equal and every
    // scoped assertion failed on windows-latest while ubuntu/macos passed.
    const backslashed = HERE.replace(/\//g, "\\");
    const scoped = searchMemory("wombat", { home, cwd: backslashed });
    assert.equal(scoped.hits[0].cwd, HERE, "a backslash query still finds a slash-recorded cwd");

    const only = searchMemory("wombat", { home, cwd: backslashed, cwdOnly: true });
    assert.equal(only.hits.length, 1, "the hard filter matches across separator styles");
    assert.equal(only.hits[0].cwd, HERE);

    // The prose signal reads both spellings too.
    assert.equal(
      searchMemory("wombat", { home, cwd: backslashed, cwdOnly: true }).hits[0].origin,
      "file",
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("drive-lettered paths compare by drive, separator and boundary", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-cwd-drive-"));
  try {
    const summaries = join(home, "memories", "rollout_summaries");
    mkdirSync(summaries, { recursive: true });
    // A session recorded on Windows stores a drive-lettered, backslashed cwd.
    writeFileSync(
      join(summaries, "win.md"),
      "thread_id: t-win\ncwd: C:\\proj\\here\\sub\n\n# Notes\n\nThe numbat pipeline shipped.\n",
    );
    // Same directory, every spelling a caller might type.
    for (const q of ["C:\\proj\\here", "C:/proj/here", "c:/proj/here", "C:\\proj\\here\\"]) {
      const r = searchMemory("numbat", { home, cwd: q, cwdOnly: true });
      assert.equal(r.hits.length, 1, `${q} must reach the recorded cwd`);
    }
    // ...and a sibling that merely shares the prefix characters must not.
    const sibling = searchMemory("numbat", { home, cwd: "C:\\proj\\here2", cwdOnly: true });
    assert.equal(sibling.hits.length, 0, "C:\\proj\\here2 is a different directory");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("normalizeCwd folds separators and drive case without folding path case", () => {
  assert.equal(normalizeCwd("/proj/here/"), "/proj/here");
  assert.equal(normalizeCwd("\\proj\\here"), "/proj/here");
  assert.equal(normalizeCwd("c:\\proj\\here"), "C:/proj/here");
  assert.equal(normalizeCwd("C:/proj/here/"), "C:/proj/here");
  // Path case is meaningful on the case-sensitive hosts this also runs on.
  assert.notEqual(normalizeCwd("/Proj/Here"), normalizeCwd("/proj/here"));
});
