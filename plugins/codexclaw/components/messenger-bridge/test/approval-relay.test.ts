/** approval-relay.test.ts — pending approval store and platform formatters. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalStore,
  formatApprovalForDiscord,
  formatApprovalForTelegram,
} from "../src/approval-relay.ts";
import { decodeCallback } from "../src/telegram-interactive.ts";

test("approval store resolves decisions and invokes cleanup callbacks", async () => {
  const store = createApprovalStore(1_000, { autoExpire: false, idFactory: () => "ap_1" });
  const req = store.request({ bindingId: 7, promptHash: "h123", workdir: "/tmp/w" });
  let cleaned = "";
  assert.equal(store.registerCleanup(req.id, (_request, outcome) => {
    cleaned = outcome.decision;
  }), true);
  const wait = store.wait(req.id);

  assert.equal(store.resolve(req.id, "allow-once")?.id, req.id);
  assert.deepEqual(await wait, { decision: "allow-once", timedOut: false });
  assert.equal(cleaned, "allow-once");
  assert.equal(store.pending.size, 0);
});

test("approval store cleanup expires requests fail-closed without sleeps", async () => {
  let now = 10_000;
  const store = createApprovalStore(500, {
    autoExpire: false,
    now: () => now,
    idFactory: () => "ap_expire",
  });
  const req = store.request({ bindingId: 9, promptHash: "h456", workdir: "/tmp/w" });
  const wait = store.wait(req.id);

  now = 10_499;
  assert.equal(store.cleanup(now).length, 0);
  now = 10_500;
  assert.deepEqual(store.cleanup(now).map((entry) => entry.id), [req.id]);
  assert.deepEqual(await wait, { decision: "deny", timedOut: true });
  assert.equal(store.pending.size, 0);
});

test("approval formatters expose allow-once, allow-always, and deny actions", () => {
  const req = { id: "ap_fmt", bindingId: 1, promptHash: "abc123", workdir: "/tmp/w", expiresAt: 123 };
  const tg = formatApprovalForTelegram(req);
  const actions = tg.keyboard.flat().map((button) => decodeCallback(button.callback_data ?? ""));
  assert.deepEqual(actions, [
    { type: "approve", payload: "ap_fmt:allow-once" },
    { type: "approve", payload: "ap_fmt:allow-always" },
    { type: "deny", payload: "ap_fmt:deny" },
  ]);

  const dc = formatApprovalForDiscord(req);
  assert.deepEqual(dc.components[0].components.map((button) => button.custom_id), [
    "approval:ap_fmt:allow-once",
    "approval:ap_fmt:allow-always",
    "approval:ap_fmt:deny",
  ]);
  const disabled = formatApprovalForDiscord(req, true);
  assert.ok(disabled.components[0].components.every((button) => button.disabled === true));
});
