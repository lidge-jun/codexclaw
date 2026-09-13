"use strict";

/**
 * Extract a version's section from CHANGELOG.md for the release body.
 *
 * The release workflow passes the section to `gh release create
 * --generate-notes --notes-file <section>`; GitHub prepends the file to the
 * auto-generated PR list. Kept as a pure module so the heading grammar can be
 * unit-tested without Actions.
 *
 * Heading grammar (Keep a Changelog):
 *   ## [0.2.27] - 2026-09-13   (ASCII hyphen, current)
 *   ## [0.2.16] — 2026-08-30   (em dash, 0.2.1-0.2.16)
 * The section ends at the next `#`/`##` heading or a `[label]:` link
 * definition (the compare-link footer).
 */

/** Escape a version string for use inside a RegExp. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return the raw `## [version]` section (heading included, trailing
 * whitespace trimmed). Throws Error with `.code` "MISSING" when no heading
 * matches and "EMPTY" when the section has no body.
 */
function extractChangelogSection(changelogText, version) {
  if (!version) {
    const err = new Error("version is empty");
    err.code = "MISSING";
    throw err;
  }
  const startRe = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s|$)`);
  const lines = String(changelogText).split(/\r?\n/);
  const start = lines.findIndex((line) => startRe.test(line));
  if (start < 0) {
    const err = new Error(`CHANGELOG.md has no "## [${version}]" section`);
    err.code = "MISSING";
    throw err;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i]) || /^\[[^\]]+\]:\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section =
    lines
      .slice(start, end)
      .join("\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n+$/, "") + "\n";
  const body = section.replace(/^##[^\n]*\n/, "").trim();
  if (!body) {
    const err = new Error(`CHANGELOG.md section for ${version} is empty`);
    err.code = "EMPTY";
    throw err;
  }
  return section;
}

if (require.main === module) {
  const version = process.argv[2];
  const path = process.argv[3] || "CHANGELOG.md";
  try {
    const section = extractChangelogSection(require("node:fs").readFileSync(path, "utf8"), version);
    process.stdout.write(section);
    process.stdout.write("\n---\n");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { extractChangelogSection, escapeRegExp };
