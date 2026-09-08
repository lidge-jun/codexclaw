// check-links.mjs — resolve relative Markdown links in the given files; exit 1 on a missing target.
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const files = process.argv.slice(2);
let bad = 0, total = 0;
for (const f of files) {
  const body = readFileSync(f, "utf8");
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = m[1];
    if (/^(https?:|mailto:|skill:|#)/.test(t)) continue;
    const target = t.split("#")[0];
    if (!target) continue;
    total++;
    const abs = resolve(dirname(f), target);
    if (!existsSync(abs)) { bad++; console.log("MISSING " + f + " -> " + t); }
  }
}
console.log(`checked ${total} relative links in ${files.length} files; missing ${bad}`);
process.exit(bad ? 1 : 0);

