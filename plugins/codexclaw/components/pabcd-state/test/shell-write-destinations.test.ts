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

function includesDest(command: string, dest: string): void {
  const got = shellWriteDestinations(command);
  assert.ok(got.includes(dest), command + " => " + JSON.stringify(got));
}

test("PowerShell write cmdlets name their destination", () => {
  includesDest("Set-Content -LiteralPath '" + mem + "/n.md' -Value x", mem + "/n.md");
  includesDest("Out-File -FilePath " + mem + "/n.md", mem + "/n.md");
  includesDest("New-Item -Path " + mem + "/n.md -ItemType File", mem + "/n.md");
  includesDest("Copy-Item /w/a.md " + mem + "/b.md", mem + "/b.md");
  includesDest("Tee-Object -FilePath " + mem + "/out.md", mem + "/out.md");
  includesDest("set-content -path " + mem + "/n.md", mem + "/n.md");
});

test("Set-Content -Force does not swallow the destination", () => {
  assert.deepEqual(shellWriteDestinations("Set-Content -Force " + mem + "/n.md"), [mem + "/n.md"]);
});

test("Out-File -Append does not swallow the destination", () => {
  assert.deepEqual(shellWriteDestinations("Out-File -Append " + mem + "/n.md"), [mem + "/n.md"]);
});

test("New-Item -ItemType File -Force does not swallow the destination", () => {
  assert.deepEqual(shellWriteDestinations("New-Item -ItemType File -Force " + mem + "/n.md"), [mem + "/n.md"]);
});

test("Copy-Item is destination-only like POSIX cp", () => {
  assert.deepEqual(shellWriteDestinations("Copy-Item -Path " + mem + "/a.md -Destination /w/out.md"), ["/w/out.md"]);
  assert.deepEqual(shellWriteDestinations("Copy-Item " + mem + "/a.md /w/out.md"), ["/w/out.md"]);
  assert.deepEqual(shellWriteDestinations("Copy-Item /w/a.md " + mem + "/b.md"), [mem + "/b.md"]);
});

test("copy is Copy-Item destination-only", () => {
  assert.deepEqual(shellWriteDestinations("copy /w/a.md " + mem + "/b.md"), [mem + "/b.md"]);
  assert.deepEqual(shellWriteDestinations("copy -Path " + mem + "/a.md -Destination /w/out.md"), ["/w/out.md"]);
});

test("python and node one-line writes; reads stay empty", () => {
  includesDest("python -c \"open(r'" + mem + "/n.md','w').write('x')\"", mem + "/n.md");
  includesDest("python3 -c \"from pathlib import Path; Path('" + mem + "/n.md').write_text('x')\"", mem + "/n.md");
  includesDest("node -e \"require('fs').writeFileSync('" + mem + "/n.md','x')\"", mem + "/n.md");
  includesDest("python.exe -c \"open('" + mem + "/n.md','w').write('x')\"", mem + "/n.md");
  assert.deepEqual(
    shellWriteDestinations("python3 -c \"from pathlib import Path; print(Path('" + mem + "/MEMORY.md').read_text()); print('x -> y')\""),
    [],
  );
});

test("Get-Content is not a write", () => {
  assert.deepEqual(shellWriteDestinations("Get-Content -LiteralPath " + mem + "/n.md"), []);
});

test("abbreviation, alias, and interpreter writes still name the destination", () => {
  includesDest("Set-Content -LP " + mem + "/n.md -Value x", mem + "/n.md");
  includesDest("Set-Content -Fo " + mem + "/n.md", mem + "/n.md");
  includesDest("Out-File -Fi " + mem + "/n.md", mem + "/n.md");
  includesDest("Set-Content -AsByteStream " + mem + "/n.md", mem + "/n.md");
  includesDest("Set-Content /Force " + mem + "/n.md", mem + "/n.md");
  assert.deepEqual(shellWriteDestinations("Copy-Item /w/a.md -Dest " + mem + "/b.md"), [mem + "/b.md"]);
  includesDest("sc " + mem + "/n.md", mem + "/n.md");
  includesDest("ni " + mem + "/n.md", mem + "/n.md");
  includesDest("Add-Content " + mem + "/n.md -Value x", mem + "/n.md");
  includesDest("py -c \"open(r'" + mem + "/n.md','w').write('x')\"", mem + "/n.md");
  includesDest("node --eval \"require('fs').writeFileSync('" + mem + "/n.md','x')\"", mem + "/n.md");
  includesDest("node -erequire('fs').writeFileSync('" + mem + "/n.md','x')", mem + "/n.md");
  includesDest("[IO.File]::WriteAllText('" + mem + "/n.md','x')", mem + "/n.md");
  includesDest("[System.IO.File]::AppendAllText('" + mem + "/n.md','x')", mem + "/n.md");
  assert.deepEqual(shellWriteDestinations("sc query"), []);
  assert.deepEqual(shellWriteDestinations("cat " + mem + "/n.md"), []);
  assert.deepEqual(shellWriteDestinations("gc " + mem + "/n.md"), []);
});
