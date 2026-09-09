/**
 * shell-write-destinations.test.ts — parser unit cases for MEMORY-WRITE-GATE-01
 * (260910 wp1). The gate integration cases live in memory-write-gate.test.ts;
 * this file pins the parser alone, including the audit-round-1 forms
 * (no-space `>`/`>>` and `>|`) that the first draft returned [] for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shellWriteDestinations } from "../src/shell-write-destinations.ts";

const mem = "/h/memories";

test("redirections: stdout forms are writes, stderr and arrows are not", () => {
  assert.deepEqual(shellWriteDestinations(`echo hi > ${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`echo hi >> ${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`echo hi>${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`echo hi>>${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`echo hi >| ${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`echo hi 1> ${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`cmd &> ${mem}/n.md`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`rg foo ${mem}/M.md 2>/dev/null`), []);
  assert.deepEqual(shellWriteDestinations(`cmd 2>&1`), []);
  assert.deepEqual(shellWriteDestinations("x -> y"), []);
  assert.deepEqual(shellWriteDestinations("grep -- '->' /w/f"), []);
  assert.deepEqual(shellWriteDestinations("echo 'a>b'"), []);
  assert.deepEqual(shellWriteDestinations("echo 'a > b'"), []);
  assert.deepEqual(shellWriteDestinations("rg '<prose>' /w/f"), []);
});

test("heredoc bodies and herestrings are not destinations; the redirect target is", () => {
  assert.deepEqual(shellWriteDestinations(`cat > /w/x.md <<'EOF'\n${mem}\nEOF`), ["/w/x.md"]);
  assert.deepEqual(shellWriteDestinations(`cat <<EOF > /w/x.md\n${mem}/n.md\nEOF`), ["/w/x.md"]);
  assert.deepEqual(shellWriteDestinations(`cat <<< "${mem}/n.md"`), []);
  assert.deepEqual(
    shellWriteDestinations(`mkdir -p /w/notes && cat > /w/notes/00.md <<'EOF'\n~/.codex/memories\nEOF`),
    ["/w/notes/00.md"],
  );
});

test("verbs: tee, sed -i, cp/mv destination, perl -i, ruby -i", () => {
  assert.deepEqual(shellWriteDestinations(`rg foo /w | tee ${mem}/out.md`), [`${mem}/out.md`]);
  assert.deepEqual(shellWriteDestinations(`tee -a ${mem}/out.md`), [`${mem}/out.md`]);
  assert.deepEqual(shellWriteDestinations(`sed -n '1p' ${mem}/M.md`), []);
  assert.deepEqual(shellWriteDestinations(`sed -i 's/a/b/' ${mem}/M.md`), [`${mem}/M.md`]);
  assert.deepEqual(shellWriteDestinations(`sed -i '' 's/a/b/' ${mem}/M.md`), [`${mem}/M.md`]);
  assert.deepEqual(shellWriteDestinations(`sed -i.bak -e 's/a/b/' ${mem}/M.md`), [`${mem}/M.md`]);
  assert.deepEqual(shellWriteDestinations(`cp /w/a.md ${mem}/b.md`), [`${mem}/b.md`]);
  assert.deepEqual(shellWriteDestinations(`cp ${mem}/a.md /w/b.md`), ["/w/b.md"]);
  assert.deepEqual(shellWriteDestinations(`mv /w/a.md ${mem}/b.md`), [`${mem}/b.md`]);
  assert.deepEqual(shellWriteDestinations(`cp -t ${mem} /w/a.md`), [mem]);
  assert.deepEqual(shellWriteDestinations(`perl -i -pe 's/a/b/' ${mem}/M.md`), [`${mem}/M.md`]);
  assert.deepEqual(shellWriteDestinations(`ruby -i -pe 's/a/b/' ${mem}/M.md`), [`${mem}/M.md`]);
  assert.deepEqual(shellWriteDestinations(`sudo tee ${mem}/out.md`), [`${mem}/out.md`]);
  assert.deepEqual(shellWriteDestinations(`cat ${mem}/M.md`), []);
});

test("segments: every command in a chain is inspected", () => {
  assert.deepEqual(shellWriteDestinations(`cat /w/a && echo x > ${mem}/n.md; ls`), [`${mem}/n.md`]);
  assert.deepEqual(shellWriteDestinations(`cat /w/a || echo x>${mem}/n.md`), [`${mem}/n.md`]);
});

