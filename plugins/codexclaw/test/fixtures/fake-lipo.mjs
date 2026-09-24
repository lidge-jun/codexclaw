#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (process.env.CXC_FAKE_LIPO_CAPTURE) {
  appendFileSync(process.env.CXC_FAKE_LIPO_CAPTURE, JSON.stringify(args) + "\n");
}

const mode = process.env.CXC_FAKE_LIPO_MODE;
if (args[0] === "-archs") {
  if (mode === "archs-fail") process.exit(3);
  process.stdout.write(readFileSync(args[1], "utf8").trim() + "\n");
} else if (args[0] === "-thin" || args[0] === "-remove") {
  if (mode === "thin-fail") process.exit(3);
  const outputIndex = args.indexOf("-output");
  if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(3);
  writeFileSync(args[outputIndex + 1], args[1]);
} else if (args[0] === "-verify_arch") {
  if (args.length !== 3) process.exit(1);
  const actual = readFileSync(args[2], "utf8").trim().split(/\s+/);
  process.exit(actual.includes(args[1]) ? 0 : 1);
} else if (args[0] === "-always-pass") {
  process.exit(0);
} else if (args[0] === "-always-fail") {
  process.exit(1);
} else {
  process.exit(1);
}
