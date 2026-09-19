// report-genre-contract.test.mjs — issue #200, matrix row A10.
//
// The visualizer rules were written for a decision memo and applied to every genre, so a
// research synthesis was pushed into a decisive headline and a closing ask it had not
// earned. Prose cannot be checked for meaning, but it CAN be checked for the specific
// thing that went wrong: a universal mandate with no genre qualifier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = join(here, "..", "skills", "dev-visualizer");
const read = (...p) => readFileSync(join(SKILL, ...p), "utf8");

test("#200: the genre table exists and names the four genres", () => {
  const writing = read("reference", "report-writing.md");
  assert.match(writing, /REPORT-STORY-00/, "a genre selector rule must exist");
  for (const genre of ["Decision memo", "Research synthesis", "Explanation", "reference"]) {
    assert.match(writing, new RegExp(genre, "i"), "genre table missing " + genre);
  }
});

test("#200: the one-argument rule is scoped to decision genres, not STRICT for everything", () => {
  const writing = read("reference", "report-writing.md");
  assert.doesNotMatch(
    writing,
    /## REPORT-STORY-01 The document is one argument \(STRICT\)/,
    "the universal one-argument mandate must be gone",
  );
  assert.match(writing, /REPORT-STORY-01 applies to decision memos and explanations; it is not universal/);
});

test("#200: ending at an ask is qualified by genre wherever it appears", () => {
  for (const [file, text] of [
    ["report-writing.md", read("reference", "report-writing.md")],
    ["SKILL.md", read("SKILL.md")],
    ["report-pipeline.md", read("reference", "report-pipeline.md")],
    ["reader-documents.md", read("reference", "reader-documents.md")],
  ]) {
    for (const line of text.split("\n")) {
      if (!/end at the ask|ends at the ask/.test(line)) continue;
      // The surrounding sentence must name the genre it applies to.
      const idx = text.indexOf(line);
      const window = text.slice(Math.max(0, idx - 400), idx + 200);
      assert.match(
        window,
        /decision (document|memo|genres)/i,
        file + " has an unqualified ask mandate: " + line.trim(),
      );
    }
  }
});

test("#200: a research synthesis is told to end at what is unresolved", () => {
  const writing = read("reference", "report-writing.md");
  const pipeline = read("reference", "report-pipeline.md");
  assert.match(writing, /unresolved/i);
  assert.match(pipeline, /does\s*\n?\s*not close on an action it has not earned|not close on an action/i);
});

test("#200: review criteria are about content, not length", () => {
  const writing = read("reference", "report-writing.md");
  assert.match(writing, /Review the content, not the length/i);
  // The explicit carve-out for qualitative documents: no numbers is not a failure.
  assert.match(writing, /no numbers in it\s*\n?\s*can pass|document with no numbers/i);
  assert.match(writing, /section count and page count answer none of them/i);
});

test("#200: the editorial-review receipt no longer demands an action unconditionally", () => {
  const pipeline = read("reference", "report-pipeline.md");
  const row = pipeline.split("\n").find((l) => l.includes("editorial-review"));
  assert.ok(row, "the editorial-review receipt row must still exist");
  assert.match(row, /where the genre calls for one/i, "the action requirement must be genre-conditional");
});

test("#200: a reference document may use topic labels without that being a defect", () => {
  const writing = read("reference", "report-writing.md");
  // The sentence wraps across lines in the source, so normalise whitespace first.
  const flat = writing.replace(/\s+/g, " ");
  assert.match(flat, /topic label is correct, not a defect/i);
});
