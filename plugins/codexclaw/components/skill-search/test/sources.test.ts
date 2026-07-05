import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLAWHUB_TREE_URL,
  HERMES_CATALOG_URL,
  JAW_REGISTRY_URL,
  fetchClawhubRows,
  fetchHermesRows,
  fetchJawRows,
} from "../src/sources.ts";
import type { FetchText } from "../src/types.ts";

const fixtureFetch = (fixtures: Record<string, string>): FetchText => {
  return async (url) => {
    const hit = fixtures[url];
    if (hit === undefined) throw new Error(`unexpected fetch: ${url}`);
    return hit;
  };
};

test("jaw adapter normalizes registry entries incl. entry path, superseded_by, requires", async () => {
  const registry = {
    skills: {
      "static-analysis": {
        name: "Static Analysis",
        description: "CodeQL workflows",
        desc_ko: "정적 분석",
        category: "devtools",
        entry: "static-analysis/skills/codeql/SKILL.md",
        requires: { bins: ["codeql"] },
      },
      tdd: {
        name: "TDD",
        description: "red-green loop",
        superseded_by: "dev-testing",
      },
    },
  };
  const rows = await fetchJawRows(fixtureFetch({ [JAW_REGISTRY_URL]: JSON.stringify(registry) }));
  assert.equal(rows.length, 2);
  const sa = rows.find((r) => r.id === "static-analysis")!;
  assert.ok(sa.rawUrl.endsWith("/static-analysis/skills/codeql/SKILL.md"));
  assert.deepEqual(sa.requires, { bins: ["codeql"], env: undefined, system: undefined });
  const tdd = rows.find((r) => r.id === "tdd")!;
  assert.equal(tdd.supersededBy, "dev-testing");
  assert.ok(tdd.rawUrl.endsWith("/tdd/SKILL.md"), "default entry path");
});

test("hermes adapter parses catalog table rows into raw SKILL.md urls", async () => {
  const md = [
    "## apple",
    "",
    "| Skill | Description | Path |",
    "|-------|-------------|------|",
    "| [`apple-notes`](/docs/user-guide/x) | Manage Apple Notes via memo CLI. | `apple/apple-notes` |",
    "| not a row |",
  ].join("\n");
  const rows = await fetchHermesRows(fixtureFetch({ [HERMES_CATALOG_URL]: md }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "apple-notes");
  assert.equal(rows[0].category, "apple");
  assert.equal(
    rows[0].rawUrl,
    "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills/apple/apple-notes/SKILL.md",
  );
});

test("clawhub adapter maps tree SKILL.md paths to raw urls", async () => {
  const tree = {
    tree: [
      { path: ".agents/skills/convex/SKILL.md" },
      { path: "README.md" },
      { path: ".agents/skills/autoreview/SKILL.md" },
    ],
  };
  const rows = await fetchClawhubRows(fixtureFetch({ [CLAWHUB_TREE_URL]: JSON.stringify(tree) }));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.id).sort(), ["autoreview", "convex"]);
  assert.ok(rows[0].rawUrl.startsWith("https://raw.githubusercontent.com/openclaw/clawhub/main/"));
});
