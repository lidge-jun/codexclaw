"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractChangelogSection } = require("./changelog-section.cjs");

const SAMPLE = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "## [0.2.27] - 2026-09-13",
  "",
  "### Added",
  "",
  "- Logic analysis ships",
  "",
  "## [0.2.16] — 2026-08-30",
  "",
  "### Fixed",
  "",
  "- Em-dash heading entry",
  "",
  "## [0.2.20] - 2026-08-01",
  "",
  "- Twenty",
  "",
  "## [0.2.2] - 2026-07-01",
  "",
  "- Two",
  "",
  "[Unreleased]: https://example/compare/v0.2.27...HEAD",
  "# Changelog",
  "",
  "## 0.2.7 (2026-08-22)",
  "",
  "- leftover document",
  "",
].join("\n");

describe("extractChangelogSection", () => {
  it("extracts a hyphen-dated section with its body", () => {
    const out = extractChangelogSection(SAMPLE, "0.2.27");
    assert.ok(out.startsWith("## [0.2.27] - 2026-09-13"));
    assert.ok(out.includes("- Logic analysis ships"));
    assert.ok(!out.includes("0.2.16"), "stops before the next section");
    assert.ok(out.endsWith("\n"));
  });

  it("accepts em-dash headings", () => {
    const out = extractChangelogSection(SAMPLE, "0.2.16");
    assert.ok(out.includes("- Em-dash heading entry"));
  });

  it("matches the exact version, never a prefix", () => {
    const out = extractChangelogSection(SAMPLE, "0.2.2");
    assert.ok(out.includes("- Two"));
    assert.ok(!out.includes("Twenty"), "0.2.2 must not steal the 0.2.20 section");
  });

  it("stops at compare-link footers and repeated top headings", () => {
    const out = extractChangelogSection(SAMPLE, "0.2.2");
    assert.ok(!out.includes("[Unreleased]:"), "link footer excluded");
    assert.ok(!out.includes("leftover document"), "second document excluded");
  });

  it("fails closed when the section is missing", () => {
    assert.throws(() => extractChangelogSection(SAMPLE, "0.2.25"), /no "## \[0\.2\.25\]" section/);
  });

  it("fails closed when the section has no body", () => {
    assert.throws(() => extractChangelogSection(SAMPLE, "Unreleased"), /is empty/);
  });

  it("fails closed on an empty version", () => {
    assert.throws(() => extractChangelogSection(SAMPLE, ""), /version is empty/);
  });

  it("extracts the real 0.2.27 section from this repo's CHANGELOG.md", () => {
    const real = fs.readFileSync(path.join(__dirname, "..", "..", "CHANGELOG.md"), "utf8");
    const out = extractChangelogSection(real, "0.2.27");
    assert.ok(out.includes("logic-analysis"), "curated notes reach the release body");
    assert.ok(!out.includes("## [0.2.26]"), "does not bleed into the previous release");
  });
});
