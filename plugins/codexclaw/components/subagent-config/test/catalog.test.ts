import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCatalog, readNativeCacheDefault, NATIVE_OPENAI_MODELS } from "../src/catalog.ts";

test("AC1: ocx absent -> native-catalog state, native entries only", () => {
  const cat = buildCatalog({ readNativeCache: () => [...NATIVE_OPENAI_MODELS] });
  assert.equal(cat.state, "native-catalog");
  assert.deepEqual(cat.entries.map((e) => e.id), [...NATIVE_OPENAI_MODELS]);
  assert.ok(cat.entries.every((e) => e.source === "native"));
});

test("AC2: ocx active with n models -> native + n, native first", () => {
  const cat = buildCatalog({
    readNativeCache: () => ["gpt-5.5", "gpt-5.4"],
    providerStatus: { mode: "provider", ocxModels: ["grok-4", "claude-opus", "gemini-3"] },
  });
  assert.equal(cat.state, "ocx-active");
  assert.deepEqual(cat.entries.map((e) => e.id), ["gpt-5.5", "gpt-5.4", "grok-4", "claude-opus", "gemini-3"]);
  // native first
  assert.equal(cat.entries[0].source, "native");
  assert.equal(cat.entries[2].source, "ocx");
});

test("AC3: duplicate model ids collapsed, native kept", () => {
  const cat = buildCatalog({
    readNativeCache: () => ["gpt-5.5", "gpt-5.4"],
    providerStatus: { mode: "provider", ocxModels: ["gpt-5.5", "grok-4"] }, // gpt-5.5 dups native
  });
  assert.deepEqual(cat.entries.map((e) => e.id), ["gpt-5.5", "gpt-5.4", "grok-4"]);
  // the surviving gpt-5.5 is the NATIVE one
  assert.equal(cat.entries.find((e) => e.id === "gpt-5.5")?.source, "native");
});

test("ocx present but no catalog interface -> unsupported-ocx-catalog (native still returned)", () => {
  const cat = buildCatalog({
    readNativeCache: () => ["gpt-5.5"],
    providerStatus: { mode: "provider" }, // ocxModels undefined
  });
  assert.equal(cat.state, "unsupported-ocx-catalog");
  assert.deepEqual(cat.entries.map((e) => e.id), ["gpt-5.5"]);
});

test("ocx error mode -> native-catalog (not ocx-active)", () => {
  const cat = buildCatalog({ readNativeCache: () => ["gpt-5.5"], providerStatus: { mode: "error" } });
  assert.equal(cat.state, "native-catalog");
});

test("native cache absent -> documented fallback set", () => {
  const cat = buildCatalog({ readNativeCache: () => null });
  assert.deepEqual(cat.entries.map((e) => e.id), [...NATIVE_OPENAI_MODELS]);
});

test("readNativeCacheDefault: allowlists cache ids, ignores unknowns; missing path -> null", () => {
  // missing cache: point CODEX_HOME at an empty dir (a bare {} env now resolves
  // to the real ~/.codex/models_cache.json by design — never touch it in tests)
  assert.equal(readNativeCacheDefault({ CODEX_HOME: mkdtempSync(join(tmpdir(), "cxc-nohome-")) } as NodeJS.ProcessEnv), null);
  // cache file with a mix of allowed + unknown ids
  const dir = mkdtempSync(join(tmpdir(), "cxc-cat-"));
  const p = join(dir, "models.json");
  writeFileSync(p, JSON.stringify({ models: [{ id: "gpt-5.5" }, { id: "rogue-model" }, "gpt-5.4"] }));
  const ids = readNativeCacheDefault({ CODEX_MODELS_CACHE_PATH: p } as NodeJS.ProcessEnv);
  assert.deepEqual(ids, ["gpt-5.5", "gpt-5.4"]); // rogue-model filtered by allowlist
});

test("L9.2/L20: readNativeCacheDefault reads slugs; natives by allowlist, routed ocx slugs admitted", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-cat-slug-"));
  const p = join(dir, "models.json");
  // Live Codex catalog keys natives by slug, not id (opencodex codex-catalog.ts:152,183).
  // L20/WP4: opencodex syncs its routed `provider/model` slugs INTO this codex config
  // cache, and codexclaw reads them from here (it never calls ocx directly). So routed
  // slugs (containing "/") are admitted; a non-native BARE id is still filtered.
  writeFileSync(
    p,
    JSON.stringify({
      models: [
        { slug: "gpt-5.5", base_instructions: "x" },
        { slug: "gpt-5.4-mini" },
        { slug: "gpt-5.3-codex" }, // legacy/internal native bare id -> filtered by allowlist
        { slug: "openrouter/grok-4" }, // routed ocx-synced slug -> admitted (L20)
        { slug: "kiro/claude-opus-4.6" }, // routed ocx-synced slug -> admitted (L20)
      ],
    }),
  );
  const ids = readNativeCacheDefault({ CODEX_MODELS_CACHE_PATH: p } as NodeJS.ProcessEnv);
  assert.deepEqual(ids, ["gpt-5.5", "gpt-5.4-mini", "openrouter/grok-4", "kiro/claude-opus-4.6"]);
});

test("L20/WP4: a non-native BARE id is still filtered even with routed slugs present", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-cat-mix-"));
  const p = join(dir, "models.json");
  writeFileSync(p, JSON.stringify({ models: [{ id: "gpt-5.5" }, { id: "rogue-model" }, { slug: "kiro/claude" }] }));
  const ids = readNativeCacheDefault({ CODEX_MODELS_CACHE_PATH: p } as NodeJS.ProcessEnv);
  assert.deepEqual(ids, ["gpt-5.5", "kiro/claude"]); // rogue-model (bare, non-native) dropped; routed slug kept
});

test("L20/WP4: buildCatalog labels cache-sourced routed slugs as ocx, native bare ids as native", () => {
  const cat = buildCatalog({ readNativeCache: () => ["gpt-5.5", "kiro/claude-opus-4.6"] });
  // No providerStatus -> native-catalog state, but routed slugs from the cache are
  // labelled ocx (they were synced in by opencodex), bare ids native.
  assert.equal(cat.state, "native-catalog");
  assert.deepEqual(cat.entries.map((e) => [e.id, e.source]), [["gpt-5.5", "native"], ["kiro/claude-opus-4.6", "ocx"]]);
});

test("L9.2: id and slug for the same model collapse to one allowlisted entry", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-cat-dup-"));
  const p = join(dir, "models.json");
  // An entry with `id` and a separate entry with the same value as `slug`.
  writeFileSync(p, JSON.stringify({ models: [{ id: "gpt-5.5" }, { slug: "gpt-5.5" }, { slug: "gpt-5.4" }] }));
  const ids = readNativeCacheDefault({ CODEX_MODELS_CACHE_PATH: p } as NodeJS.ProcessEnv);
  assert.deepEqual(ids, ["gpt-5.5", "gpt-5.4"]); // gpt-5.5 deduped
});

test("L9.2: routed provider/model ocx slugs are selectable + deduped, native first", () => {
  const cat = buildCatalog({
    readNativeCache: () => ["gpt-5.5"],
    providerStatus: { mode: "provider", ocxModels: ["openrouter/grok-4", "anthropic/claude-opus", "gpt-5.5"] },
  });
  assert.equal(cat.state, "ocx-active");
  // native first; routed slugs preserved as ocx; the gpt-5.5 dup against native is dropped.
  assert.deepEqual(cat.entries.map((e) => e.id), ["gpt-5.5", "openrouter/grok-4", "anthropic/claude-opus"]);
  assert.equal(cat.entries[0].source, "native");
  assert.equal(cat.entries[1].source, "ocx");
});

test("WP30: CODEX_HOME resolution — cache at $CODEX_HOME/models_cache.json loads without CODEX_MODELS_CACHE_PATH", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-home-"));
  writeFileSync(
    join(home, "models_cache.json"),
    JSON.stringify({ models: [{ slug: "gpt-5.5" }, { slug: "anthropic/claude-sonnet-5" }, { slug: "rogue" }] }),
  );
  const ids = readNativeCacheDefault({ CODEX_HOME: home } as NodeJS.ProcessEnv);
  assert.deepEqual(ids, ["gpt-5.5", "anthropic/claude-sonnet-5"]); // rogue filtered, routed slug admitted
});

test("WP30: explicit CODEX_MODELS_CACHE_PATH still wins over CODEX_HOME", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-home2-"));
  writeFileSync(join(home, "models_cache.json"), JSON.stringify({ models: [{ slug: "gpt-5.4" }] }));
  const dir = mkdtempSync(join(tmpdir(), "cxc-explicit-"));
  const p = join(dir, "explicit.json");
  writeFileSync(p, JSON.stringify({ models: [{ slug: "gpt-5.5" }] }));
  const ids = readNativeCacheDefault({ CODEX_HOME: home, CODEX_MODELS_CACHE_PATH: p } as NodeJS.ProcessEnv);
  assert.deepEqual(ids, ["gpt-5.5"]);
});

test("WP30: provider mode + cache-borne routed slugs (ocxModels undefined) -> ocx-active, not unsupported", () => {
  const cat = buildCatalog({
    readNativeCache: () => ["gpt-5.5", "anthropic/claude-sonnet-5"],
    providerStatus: { mode: "provider" }, // no catalog interface — but ocx entries arrived via cache sync
  });
  assert.equal(cat.state, "ocx-active");
  assert.equal(cat.entries.find((e) => e.id === "anthropic/claude-sonnet-5")?.source, "ocx");
});
