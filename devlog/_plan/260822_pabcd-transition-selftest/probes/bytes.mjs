// Reports the true bytes of a file: leading hex, detected BOM, and whether an
// anchor matches under utf8 vs utf16le decoding.
//   node probes/bytes.mjs run.log "^not ok"
import { readFileSync } from "node:fs";

const [file, anchor = "^not ok"] = process.argv.slice(2);
const raw = readFileSync(file);
const head = raw.slice(0, 8).toString("hex");

const bom =
  head.startsWith("fffe") ? "UTF-16LE BOM"
  : head.startsWith("feff") ? "UTF-16BE BOM"
  : head.startsWith("efbbbf") ? "UTF-8 BOM"
  : "none";

const re = new RegExp(anchor, "m");
const count = (text) => text.split(/\r?\n/).filter((l) => re.test(l)).length;

console.log("file=" + file);
console.log("bytes=" + raw.length + " head=" + head + " bom=" + bom);
console.log("utf8 matches=" + count(raw.toString("utf8")));
console.log("utf16le matches=" + count(raw.toString("utf16le")));
