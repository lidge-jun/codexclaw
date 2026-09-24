#!/usr/bin/env node
import { existsSync, fstatSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const mode = process.env.CXC_VISUALIZER_FIXTURE_MODE || "happy";
const printArg = args.find((arg) => arg.startsWith("--print-to-pdf="));

function writeCompletePdf(path, paperSize, count) {
  writeFileSync(path, `%PDF-1.4\nfixture-paper=${paperSize}\nfixture-pass=${count}\n%%EOF\n`);
}

function inheritedDescriptors() {
  return [1, 2].map((fd) => {
    const { dev, ino } = fstatSync(fd, { bigint: true });
    return { fd, dev: String(dev), ino: String(ino) };
  });
}

if (args[0] === "--hold-inherited-output") {
  // This handle keeps the child alive after IPC disconnect and parent exit.
  // It is a lifetime fixture, not a readiness delay; the test explicitly kills it.
  setInterval(() => {}, 1000);
  process.send({
    type: "ready", pid: process.pid, descriptors: inheritedDescriptors(),
    stdoutWritten: writeSync(1, "inherited stdout ready\n") > 0,
    stderrWritten: writeSync(2, "inherited stderr ready\n") > 0,
  });
  await new Promise(() => {});
}

async function hang() {
  process.on("SIGTERM", () => {});
  writeFileSync(join(process.env.HOME, "hanging-tool.json"), JSON.stringify({
    pid: process.pid,
    profile: args.find((arg) => arg.startsWith("--user-data-dir="))?.split("=").slice(1).join("="),
  }));
  await new Promise(() => setInterval(() => {}, 1000));
}

if (args.includes("--dump-dom")) {
  if (process.env.CXC_VISUALIZER_DOM_CAPTURE) {
    writeFileSync(process.env.CXC_VISUALIZER_DOM_CAPTURE, readFileSync(fileURLToPath(args.at(-1))));
  }
  if (mode === "dump-dom-fail") { console.error("fixture dump-dom failed"); process.exit(11); }
  if (mode === "dump-dom-malformed") {
    console.log('<!doctype html><script type="application/json" id="cxc-svg-geometry-result-v1">{invalid-json</script>');
    process.exit(0);
  }
  if (mode === "dump-dom-no-marker") {
    console.log("<!doctype html><p>fixture dump-dom result marker absent</p>");
    process.exit(0);
  }
  if (mode === "dump-dom-null-finding" || mode === "dump-dom-bad-geometry-type") {
    const invalidFinding = mode === "dump-dom-null-finding" ? null
      : { svg: "fixture-svg", text: "fixture-label", geometry: "fixture-line", geometryType: "circle" };
    const validFinding = { svg: "fixture-svg", text: "valid-label", geometry: "valid-line", geometryType: "line" };
    const result = { schemaVersion: 1, kind: "svg-text-crossings",
      findings: [validFinding, invalidFinding], capped: false };
    console.log("<!doctype html><script type=\"application/json\" id=\"cxc-svg-geometry-result-v1\">"
      + JSON.stringify(result) + "</script>");
    process.exit(0);
  }
  const result = mode === "dump-dom-crossing"
    ? { schemaVersion: 1, kind: "svg-text-crossings",
        findings: [{ svg: "fixture-svg", text: "fixture-label",
          geometry: "fixture-line", geometryType: "line" }], capped: false }
    : mode === "dump-dom-cap"
      ? { schemaVersion: 1, kind: "svg-text-crossings", findings: [], capped: true }
      : { schemaVersion: 1, kind: "svg-text-crossings", findings: [], capped: false };
  console.log("<!doctype html><script type=\"application/json\" id=\"cxc-svg-geometry-result-v1\">"
    + JSON.stringify(result) + "</script>");
  process.exit(0);
}

if (printArg) {
  const countPath = join(process.env.HOME, "print-count");
  const count = existsSync(countPath) ? Number(readFileSync(countPath, "utf8")) + 1 : 1;
  writeFileSync(countPath, String(count));
  const destination = join(process.env.HOME, "..", "report.pdf");
  writeFileSync(join(process.env.HOME, `destination-at-pass-${count}`), existsSync(destination) ? readFileSync(destination) : "absent");
  if (!args.some((arg) => arg.startsWith("--user-data-dir="))) {
    console.error("fixture chrome requires an isolated profile");
    process.exit(7);
  }
  if (mode === "chrome-nonzero" || (mode === "second-pass-nonzero" && count === 2)) {
    console.error("fixture chrome failed");
    process.exit(8);
  }
  if (mode === "chrome-no-output") process.exit(0);
  const htmlPath = fileURLToPath(args.at(-1));
  const html = readFileSync(htmlPath, "utf8");
  const paperSize = /@page\s*\{[^}]*\bsize:\s*Letter\b/is.test(html) ? "Letter" : "A4";
  const stage = printArg.slice("--print-to-pdf=".length);
  writeCompletePdf(stage, paperSize, count);
  if (mode === "complete-then-hang") await hang();
  if (mode === "complete-then-nonzero") {
    console.error("fixture complete PDF followed by nonzero exit");
    process.exit(8);
  }
  if (mode === "complete-then-nonzero-after-stable-request") {
    const release = process.env.CXC_VISUALIZER_RACE_RELEASE;
    if (!release) process.exit(12);
    const poll = setInterval(() => {
      if (existsSync(release)) process.exit(3);
    }, 20);
    setTimeout(() => { clearInterval(poll); process.exit(13); }, 8_000);
    await new Promise(() => {});
  }
  if (mode === "changing-content-same-size") {
    let value = 0;
    setInterval(() => {
      const bytes = readFileSync(stage);
      bytes[20] = value++ % 2 ? 0x58 : 0x59;
      writeFileSync(stage, bytes);
    }, 100);
    await hang();
  }
  if (mode === "chrome-partial-zero" || (mode === "second-pass-partial-zero" && count === 2)) {
    writeFileSync(printArg.slice("--print-to-pdf=".length), "%PDF-1.4 truncated");
    process.exit(0);
  }
  if (mode === "chrome-partial" || (mode === "second-pass-partial" && count === 2)) {
    writeFileSync(printArg.slice("--print-to-pdf=".length), "partial output");
    process.exit(8);
  }
  if (mode === "chrome-hang" || (mode === "second-pass-hang" && count === 2)) await hang();
  if (mode === "chrome-tree-hang") {
    const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); process.send('ready'); setInterval(() => {}, 1000)"], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    await new Promise((resolve, reject) => { child.once("message", resolve); child.once("error", reject); });
    writeFileSync(join(process.env.HOME, "descendant.json"), JSON.stringify({ pid: child.pid }));
    await hang();
  }
  if (mode === "inherited-output") {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--hold-inherited-output"], {
      // unref only detaches the parent's event loop. Windows also needs an
      // independent process lifetime; explicit stdio still inherits both handles.
      detached: process.platform === "win32",
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    const metadata = join(process.env.HOME, "inherited-output.json");
    // Record ownership immediately so the test can clean up even a failed handshake.
    writeFileSync(metadata, JSON.stringify({ pid: child.pid }));
    const ready = await new Promise((resolve, reject) => {
      const failed = (error) => reject(error);
      const exited = (code, signal) => reject(new Error(`inherited-output child exited before readiness: ${code}/${signal}`));
      child.once("error", failed);
      child.once("exit", exited);
      child.once("message", (message) => {
        child.off("error", failed);
        child.off("exit", exited);
        if (message?.type !== "ready" || message.pid !== child.pid) reject(new Error("invalid inherited-output readiness acknowledgement"));
        else resolve(message);
      });
    });
    writeFileSync(metadata, JSON.stringify({ pid: child.pid, ready, parentDescriptors: inheritedDescriptors() }));
    child.disconnect();
    child.unref();
  }
  process.exit(0);
}

const textCommand = args.includes("-layout") || args.includes("-bbox");
const pdfPath = textCommand ? args.at(-2) : args.at(-1);
const pdf = readFileSync(pdfPath, "utf8");
const paperSize = /fixture-paper=Letter/.test(pdf) ? "Letter" : "A4";

if (!textCommand) {
  if (pdf.includes("truncated")) { console.error("truncated PDF"); process.exit(1); }
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
  if (args.includes("-f")) {
    console.log(`Pages: 2\nPage 1 size: ${geometry} pts (${paperSize})`);
    if (mode !== "missing-page-geometry") {
      console.log(mode === "mixed-paper" ? "Page 2 size: 612 x 792 pts (Letter)" : `Page 2 size: ${geometry} pts (${paperSize})`);
    }
    process.exit(0);
  }
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
  console.log(mode.startsWith("second-pass") || mode === "complete-then-hang" ? "Contents" : "Fixture cover");
  process.exit(0);
}
const lines = ["Section heading", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"];
if (mode !== "review") lines.push("2 / 2");
console.log(lines.join("\n"));
