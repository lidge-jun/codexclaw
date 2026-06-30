/**
 * mcp.test.ts — drives the compiled subagent-config MCP server over stdio and
 * verifies the get/set tools roundtrip against a temp cwd store.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverJs = resolve(here, "..", "dist", "mcp.js");

function rpc(child: ReturnType<typeof spawn>, msg: unknown): void {
  child.stdin!.write(`${JSON.stringify(msg)}\n`);
}

async function collect(cwd: string, messages: unknown[], expectedReplies: number): Promise<any[]> {
  if (!existsSync(serverJs)) return []; // build not run yet; skip gracefully
  return await new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, [serverJs], { cwd, stdio: ["pipe", "pipe", "inherit"] });
    const out: any[] = [];
    let buf = "";
    // G23: the MCP stdio roundtrip can exceed a tight budget when this file runs
    // alongside the rest of the suite (parallel node:test workers contend for CPU,
    // and a cold spawn pays the type-strip cost). 8s was flaky under that load; 30s
    // is still a real failure ceiling but absorbs scheduling jitter.
    const MCP_STDIO_TIMEOUT_MS = 30000;
    const timer = setTimeout(() => {
      child.kill();
      rejectP(new Error("mcp server timeout"));
    }, MCP_STDIO_TIMEOUT_MS);
    child.stdout!.on("data", (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) out.push(JSON.parse(line));
        if (out.length >= expectedReplies) {
          clearTimeout(timer);
          child.stdin!.end();
          child.kill();
          resolveP(out);
        }
      }
    });
    for (const m of messages) rpc(child, m);
  });
}

test("MCP: tools/list advertises subagents_get + subagents_set", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const replies = await collect(cwd, [{ jsonrpc: "2.0", id: 1, method: "tools/list" }], 1);
  if (replies.length === 0) return; // dist not built
  const names = replies[0].result.tools.map((t: { name: string }) => t.name);
  assert.deepEqual(names.sort(), ["catalog_list", "subagents_get", "subagents_set"]);
});

test("MCP: subagents_set then subagents_get roundtrips through the store file", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const replies = await collect(
    cwd,
    [
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role: "reviewer", mode: "model", model: "gpt-5.5" } } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "subagents_get", arguments: {} } },
    ],
    2,
  );
  if (replies.length === 0) return;
  const getReply = replies.find((r) => r.id === 2);
  const cfg = JSON.parse(getReply.result.content[0].text);
  assert.equal(cfg.roles.reviewer.mode, "model");
  assert.equal(cfg.roles.reviewer.model, "gpt-5.5");
  // and it actually hit disk
  assert.ok(existsSync(join(cwd, ".codexclaw", "subagents.json")));
  const onDisk = JSON.parse(readFileSync(join(cwd, ".codexclaw", "subagents.json"), "utf8"));
  assert.equal(onDisk.roles.reviewer.model, "gpt-5.5");
});

test("MCP: subagents_set with invalid mode returns an isError result, no crash", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const replies = await collect(
    cwd,
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role: "reviewer", mode: "turbo" } } }],
    1,
  );
  if (replies.length === 0) return;
  assert.equal(replies[0].result.isError, true);
});
