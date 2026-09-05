// IPC/socket barriers and explicitly owned teardown; invoked only by Darwin tests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { isolatedEnv } from "./filesystem.mjs";

// A separate driver receives cancellation, so a regression cannot signal the
// node:test runner. Socket readiness + IPC is the barrier, not a sleep/retry.
export async function ownedChildFixture() {
  const { spawn } = await import("node:child_process");
  const { createConnection } = await import("node:net");
  const { writeFileSync } = await import("node:fs");
  let background;
  if (f.scenario === "timeout") process.on("SIGTERM", () => {});
  if (f.scenario !== "timeout") {
    background = spawn(process.execPath, ["-e", 'process.stdout.write("READY\\n"); setInterval(() => {}, 1000);'], {
      detached: f.scenario === "detached", stdio: ["ignore", "pipe", "inherit"],
    });
    background.on("error", error => { console.error(error); process.exit(97); });
    if (f.scenario === "cancel") {
      process.on("SIGTERM", () => {});
      background.on("exit", () => process.exit(0)); // reap before leader exits
    }
  }
  const identities = { child: process.pid, background: background?.pid ?? null };
  writeFileSync(f.pidFile, JSON.stringify(identities));
  if (background) {
    await new Promise((resolveReady, rejectReady) => {
      let output = "";
      background.stdout.on("data", chunk => { output += chunk; if (output === "READY\n") resolveReady(); });
      background.once("error", rejectReady);
      background.once("exit", () => rejectReady(new Error("background exited before readiness")));
    });
  }
  const socket = createConnection({ host: "127.0.0.1", port: f.port });
  socket.on("error", error => { console.error(error); process.exit(98); });
  socket.on("connect", () => socket.write(JSON.stringify(identities) + "\n"));
  socket.on("close", () => {
    if (f.scenario === "detached" || f.scenario === "completion") process.exit(0);
  });
  setInterval(() => {}, 1000);
}

export async function lifecycleDriver() {
  const { createServer } = await import("node:net");
  const { openSync, closeSync } = await import("node:fs");
  const { runOwned } = await import(f.recorderUrl);
  const server = createServer(socket => {
    let data = "";
    socket.on("data", chunk => {
      data += chunk;
      if (!data.endsWith("\n")) return;
      process.send({ type: "ready", ...JSON.parse(data) });
      if (f.scenario === "completion" || f.scenario === "detached") {
        process.once("message", message => {
          if (message !== "release") throw new Error("unexpected lifecycle barrier message");
          socket.end();
        });
      } else socket.end();
    });
    socket.on("error", error => { throw error; });
  });
  await new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const childConfig = { scenario: f.scenario, port: server.address().port, pidFile: f.pidFile };
  const code = `const f = ${JSON.stringify(childConfig)}; await (${f.childSource})();`;
  const stdoutFd = openSync(f.stdout, "wx", 0o600), stderrFd = openSync(f.stderr, "wx", 0o600);
  try {
    const outcome = await runOwned({ bin: process.execPath, args: ["--input-type=module", "-e", code],
      cwd: f.root, env: process.env, prompt: "", timeoutMs: f.scenario === "timeout" ? 1000 : 8000,
      stdoutFd, stderrFd });
    await new Promise((resolveClosed, rejectClosed) => server.close(error => error ? rejectClosed(error) : resolveClosed()));
    process.send({ type: "result", outcome }, () => process.disconnect());
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
}

export function pidExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

export function killFixture(pid, signal = "SIGKILL") {
  assert.ok(Number.isInteger(pid) && Math.abs(pid) > 1, "only a recorded fixture PID/group may be signalled");
  try { process.kill(pid, signal); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
}

export async function assertGone(pid) {
  const deadline = Date.now() + 3000;
  while (pidExists(pid) && Date.now() < deadline) await new Promise(resolveTurn => setImmediate(resolveTurn));
  assert.equal(pidExists(pid), false, `fixture PID/group ${pid} must be gone`);
}

export function childExit(child) {
  return new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", (rc, signal) => resolveExit({ rc, signal }));
  });
}

export function lifecycleMessages(child, onReady) {
  return new Promise((resolveResult, rejectResult) => {
    const watchdog = setTimeout(() => rejectResult(new Error("fixture watchdog: no lifecycle result within 12s")), 12000);
    const finish = (error, result) => {
      clearTimeout(watchdog);
      if (error) rejectResult(error); else resolveResult(result);
    };
    let ready;
    child.once("error", error => finish(error));
    child.once("exit", rc => finish(new Error(`lifecycle driver exited before result: ${rc}`)));
    child.on("message", message => {
      try {
        if (message.type === "ready") { ready = message; onReady(message); }
        if (message.type === "result") {
          assert.ok(ready, "real child readiness must precede its result");
          finish(null, { ...ready, outcome: message.outcome });
        }
      } catch (error) { finish(error); }
    });
  });
}

export async function sentinelFixture(root) {
  const child = spawn(process.execPath, ["-e", 'process.send("ready"); setInterval(() => {}, 1000);'], {
    cwd: root, env: isolatedEnv(root), detached: true, stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  const exit = childExit(child);
  try {
    await new Promise((resolveReady, rejectReady) => {
      const watchdog = setTimeout(() => rejectReady(new Error("sentinel readiness timeout")), 5000);
      const finish = error => { clearTimeout(watchdog); if (error) rejectReady(error); else resolveReady(); };
      child.once("error", finish);
      child.once("message", message => {
        if (message !== "ready") finish(new Error("unexpected sentinel message")); else finish();
      });
    });
  } catch (error) {
    if (child.pid) killFixture(-child.pid);
    await exit;
    throw error;
  }
  return { child, exit };
}
