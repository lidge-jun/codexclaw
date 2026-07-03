/** queue.test.ts — per-key serial FIFO, parallel across keys, cap, idle cleanup. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SerialQueues, QueueFullError } from "../src/queue.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));

test("same key runs strictly FIFO", async () => {
  const q = new SerialQueues();
  const order: number[] = [];
  const make = (n: number, ms: number) => () =>
    new Promise<number>((resolve) => setTimeout(() => {
      order.push(n);
      resolve(n);
    }, ms));

  const a = q.enqueue("k", make(1, 30));
  const b = q.enqueue("k", make(2, 5));
  const c = q.enqueue("k", make(3, 1));
  assert.equal(a.position, 0);
  assert.equal(b.position, 1);
  assert.equal(c.position, 2);
  await Promise.all([a.result, b.result, c.result]);
  assert.deepEqual(order, [1, 2, 3]);
});

test("different keys run in parallel", async () => {
  const q = new SerialQueues();
  let running = 0;
  let maxConcurrent = 0;
  const task = () => async () => {
    running += 1;
    maxConcurrent = Math.max(maxConcurrent, running);
    await tick();
    running -= 1;
  };
  await Promise.all([
    q.enqueue("a", task()).result,
    q.enqueue("b", task()).result,
    q.enqueue("c", task()).result,
  ]);
  assert.equal(maxConcurrent, 3);
});

test("cap rejects overload synchronously with QueueFullError", () => {
  const q = new SerialQueues(2);
  q.enqueue("k", () => new Promise(() => {})); // never resolves
  q.enqueue("k", () => new Promise(() => {}));
  assert.throws(() => q.enqueue("k", () => Promise.resolve()), QueueFullError);
});

test("idle keys are deleted after their tail settles", async () => {
  const q = new SerialQueues();
  const r = q.enqueue("k", () => Promise.resolve("x"));
  assert.equal(q.activeKeys(), 1);
  await r.result;
  await tick();
  assert.equal(q.activeKeys(), 0);
  assert.equal(q.pending("k"), 0);
});

test("a rejecting task does not wedge the key", async () => {
  const q = new SerialQueues();
  const bad = q.enqueue("k", () => Promise.reject(new Error("boom")));
  await assert.rejects(bad.result, /boom/);
  const good = q.enqueue("k", () => Promise.resolve("ok"));
  assert.equal(await good.result, "ok");
});
