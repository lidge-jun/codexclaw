import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome } from "./fixtures.ts";
import { main as cliMain } from "../src/cli.ts";
import { searchMemory } from "../src/memory-search.ts";

function withCapturedStdio(fn: () => number): { code: number; stdout: string; stderr: string } {
  const out: string[] = [];
  const err: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    out.push(s);
    return true;
  };
  (process.stderr as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    err.push(s);
    return true;
  };
  try {
    return { code: fn(), stdout: out.join(""), stderr: err.join("") };
  } finally {
    (process.stdout as unknown as { write: typeof origOut }).write = origOut;
    (process.stderr as unknown as { write: typeof origErr }).write = origErr;
  }
}

test("cli: chat index --help prints usage, exits 0, and does not ingest", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-idx-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--help"]) as number,
    );
    assert.equal(r.code, 0);
    assert.match(r.stdout, /cxc chat search/);
    assert.doesNotMatch(r.stdout, /ingested/);
    assert.equal(existsSync(idx), false, "help must not openIndex/create the sidecar");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: --help anywhere beats --rebuild", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-rebuild-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    buildCodexHome(home);
    assert.equal(
      withCapturedStdio(() => cliMain(["chat", "index", "--home", home, "--index-path", idx]) as number).code,
      0,
    );
    const before = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status", "--json"]) as number,
    );
    const beforeJson = JSON.parse(before.stdout);
    const help = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--rebuild", "--help"]) as number,
    );
    assert.equal(help.code, 0);
    assert.match(help.stdout, /cxc chat search/);
    assert.doesNotMatch(help.stdout, /ingested/);
    const after = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status", "--json"]) as number,
    );
    const afterJson = JSON.parse(after.stdout);
    assert.equal(afterJson.files, beforeJson.files);
    assert.equal(afterJson.msgs, beforeJson.msgs);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: memory search --help exits 0 even with no query", () => {
  const r = withCapturedStdio(() => cliMain(["memory", "search", "--help"]) as number);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /cxc memory search/);
});

test("cli: -h is help", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-h-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "-h"]) as number,
    );
    assert.equal(r.code, 0);
    assert.match(r.stdout, /cxc chat index/);
    assert.doesNotMatch(r.stdout, /ingested/);
    assert.equal(existsSync(idx), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: chat index help prints usage, exits 0, and does not ingest", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-idx-word-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "help"]) as number,
    );
    assert.equal(r.code, 0);
    assert.match(r.stdout, /cxc chat search/);
    assert.doesNotMatch(r.stdout, /ingested/);
    assert.equal(existsSync(idx), false, "positional help must not ingest");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: chat index /? prints usage, exits 0, and does not ingest", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-idx-slash-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "/?"]) as number,
    );
    assert.equal(r.code, 0);
    assert.match(r.stdout, /cxc chat search/);
    assert.doesNotMatch(r.stdout, /ingested/);
    assert.equal(existsSync(idx), false, "/? must not ingest");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: memory search help searches for the word help", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-search-help-word-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["memory", "search", "help", "--home", home, "--no-chat", "--json"]) as number,
    );
    assert.equal(r.code, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(Array.isArray(parsed.hits));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: chat search help searches for the word help", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-chat-search-help-word-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "search", "help", "--home", home, "--scan", "--json"]) as number,
    );
    assert.equal(r.code, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(Array.isArray(parsed.hits));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: dash-leading --cwd-only value is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-dash-cwdonly-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["memory", "search", "memory", "--home", home, "--cwd-only", "--no-chat", "--json"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cwd-only/);
    assert.equal(r.stdout.trim(), "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: equals-form --cwd-only=--no-chat is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-eq-cwdonly-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["memory", "search", "memory", "--home", home, "--cwd-only=--no-chat", "--json"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cwd-only/);
    assert.match(r.stderr, /path must not start with '-'/);
    assert.equal(r.stdout.trim(), "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: dash-leading --cwd and --home values are rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-dash-cwd-"));
  try {
    const cwd = withCapturedStdio(() =>
      cliMain(["chat", "search", "q", "--home", home, "--cwd", "--json", "--scan"]) as number,
    );
    assert.notEqual(cwd.code, 0);
    assert.match(cwd.stderr, /cwd/);
    const homeFlag = withCapturedStdio(() =>
      cliMain(["memory", "search", "q", "--home", "--json"]) as number,
    );
    assert.notEqual(homeFlag.code, 0);
    assert.match(homeFlag.stderr, /home/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: equals-form --cwd=--json and --home=--json are rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-eq-cwd-home-"));
  try {
    const cwd = withCapturedStdio(() =>
      cliMain(["chat", "search", "q", "--home", home, "--cwd=--json", "--scan"]) as number,
    );
    assert.notEqual(cwd.code, 0);
    assert.match(cwd.stderr, /--cwd path must not start with '-'/);
    const homeFlag = withCapturedStdio(() =>
      cliMain(["memory", "search", "q", "--home=--json"]) as number,
    );
    assert.notEqual(homeFlag.code, 0);
    assert.match(homeFlag.stderr, /--home path must not start with '-'/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: missing --cwd-only value is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-missing-cwdonly-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["memory", "search", "q", "--home", home, "--cwd-only"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cwd-only/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: unknown flag is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-unknown-flag-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--not-a-flag"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /not-a-flag/i);
    assert.equal(existsSync(idx), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: missing --home directory exits non-zero", () => {
  const missing = join(tmpdir(), "recall-home-does-not-exist");
  assert.equal(existsSync(missing), false);
  const r = withCapturedStdio(() =>
    cliMain(["memory", "search", "foo", "--home", missing, "--no-chat", "--json"]) as number,
  );
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /--home not found/);
  assert.equal(r.stdout.trim(), "");
});

test("searchMemory: missing memories root and missing db each warn once, including on relaxed retry", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-missing-roots-"));
  try {
    const prose = searchMemory("anything", { home });
    assert.equal(prose.hits.length, 0);
    assert.equal(prose.warnings.filter((w) => w === "memories root not found (file search off)").length, 1);
    assert.equal(prose.warnings.filter((w) => w === "memories db not found (stage1 search off)").length, 1);

    const symbol = searchMemory("foo", { home });
    assert.equal(symbol.hits.length, 0);
    assert.equal(symbol.warnings.filter((w) => w === "memories root not found (file search off)").length, 1);
    assert.equal(symbol.warnings.filter((w) => w === "memories db not found (stage1 search off)").length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
