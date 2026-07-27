import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexclawApiMiddleware } from "../src/server/middleware.ts";

test("Vite API rejects browser-simple CSRF and bounds JSON bodies", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-vite-api-"));
  const previous = process.env.CODEXCLAW_ROOT;
  process.env.CODEXCLAW_ROOT = cwd;
  const middleware = codexclawApiMiddleware();
  const server = createServer((req, res) => middleware(req, res, () => {
    res.writeHead(404).end();
  }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const attack = await fetch(`${base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "https://attacker.example" },
      body: JSON.stringify({ role: "reviewer", promptOverride: "attacker" }),
    });
    assert.equal(attack.status, 403);

    const legitimate = await fetch(`${base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
      body: JSON.stringify({ role: "reviewer", promptOverride: "local" }),
    });
    assert.equal(legitimate.status, 200);
    assert.match(readFileSync(join(cwd, ".codexclaw", "subagents.json"), "utf8"), /local/);

    const oversized = await fetch(`${base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
      body: JSON.stringify({ role: "reviewer", promptOverride: "x".repeat(1_000_001) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous === undefined) delete process.env.CODEXCLAW_ROOT;
    else process.env.CODEXCLAW_ROOT = previous;
    rmSync(cwd, { recursive: true, force: true });
  }
});
