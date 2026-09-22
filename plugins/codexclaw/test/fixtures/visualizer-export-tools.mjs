#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const mode = process.env.CXC_VISUALIZER_FIXTURE_MODE || "happy";
const printArg = args.find((arg) => arg.startsWith("--print-to-pdf="));

async function hang() {
  process.on("SIGTERM", () => {});
  writeFileSync(join(process.env.HOME, "hanging-tool.json"), JSON.stringify({
    pid: process.pid,
    profile: args.find((arg) => arg.startsWith("--user-data-dir="))?.split("=").slice(1).join("="),
  }));
  await new Promise(() => setInterval(() => {}, 1000));
}

if (printArg) {
  if (!args.some((arg) => arg.startsWith("--user-data-dir="))) {
    console.error("fixture chrome requires an isolated profile");
    process.exit(7);
  }
  if (mode === "chrome-nonzero") {
    console.error("fixture chrome failed");
    process.exit(8);
  }
  if (mode === "chrome-no-output") process.exit(0);
  const htmlPath = fileURLToPath(args.at(-1));
  const html = readFileSync(htmlPath, "utf8");
  const paperSize = /@page\s*\{[^}]*\bsize:\s*Letter\b/is.test(html) ? "Letter" : "A4";
  writeFileSync(printArg.slice("--print-to-pdf=".length), `%PDF-1.4\nfixture-paper=${paperSize}\n`);
  if (mode === "chrome-hang") await hang();
  if (mode === "inherited-output") {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"] });
    writeFileSync(join(process.env.HOME, "inherited-output.json"), JSON.stringify({ pid: child.pid }));
    child.unref();
  }
  process.exit(0);
}

const pdfPath = args.includes("-f") ? args.at(-2) : args.at(-1);
const pdf = readFileSync(pdfPath, "utf8");
const paperSize = /fixture-paper=Letter/.test(pdf) ? "Letter" : "A4";

if (!args.includes("-f")) {
  if (mode === "pdfinfo-hang") await hang();
  if (mode === "pdfinfo-nonzero") {
    console.error("fixture pdfinfo failed");
    process.exit(9);
  }
  if (mode === "invalid-page-count") {
    console.log("Pages: unknown\nPage size: 595.28 x 841.89 pts (A4)");
    process.exit(0);
  }
  if (mode === "invalid-geometry") {
    console.log("Pages: 2\nPage size: unknown");
    process.exit(0);
  }
  const geometry = paperSize === "Letter" ? "612 x 792" : "595.28 x 841.89";
  console.log(`Pages: 2\nPage size: ${geometry} pts (${paperSize})`);
  process.exit(0);
}

if (mode === "pdftotext-hang") await hang();
if (mode === "pdftotext-nonzero") {
  console.error("fixture pdftotext failed");
  process.exit(10);
}
if (args.includes("-bbox")) {
  const height = paperSize === "Letter" ? 792 : 841.89;
  console.log(`<doc><page width="${paperSize === "Letter" ? 612 : 595.28}" height="${height}"><word xMin="50" yMin="100" xMax="100" yMax="110">start</word><word xMin="50" yMin="680" xMax="100" yMax="690">end</word></page></doc>`);
  process.exit(0);
}
if (mode === "empty-text") {
  console.log("   ");
  process.exit(0);
}
const page = Number(args[args.indexOf("-f") + 1]);
if (page === 1) {
  console.log("Fixture cover");
  process.exit(0);
}
const lines = ["Section heading", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"];
if (mode !== "review") lines.push("2 / 2");
console.log(lines.join("\n"));
