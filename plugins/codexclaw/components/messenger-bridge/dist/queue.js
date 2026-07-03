/**
 * queue.ts — per-key serial FIFO (messenger-bridge Phase 2).
 *
 * One chat/binding runs one turn at a time; different keys run in parallel.
 * Each key holds a tail promise; enqueue chains onto it. Idle keys are deleted
 * once their tail settles and no work is pending (A-audit Phase 2 finding 5:
 * no unbounded Map growth). A per-key cap rejects overload before awaiting.
 */
export class QueueFullError extends Error {
  constructor(key        , cap        ) {
    super(`queue for "${key}" is full (cap ${cap})`);
    this.name = "QueueFullError";
  }
}












export class SerialQueues {
          keys = new Map                  ();
          cap        ;

  constructor(cap = 20) {
    this.cap = cap;
  }

  /** Pending count for a key (includes the currently-running task). */
  pending(key        )         {
    return this.keys.get(key)?.pending ?? 0;
  }

  enqueue   (key        , task                  )                   {
    const state = this.keys.get(key) ?? { tail: Promise.resolve(), pending: 0 };
    if (state.pending >= this.cap) {
      throw new QueueFullError(key, this.cap);
    }
    const position = state.pending;
    state.pending += 1;
    this.keys.set(key, state);

    const result = state.tail.then(task, task);

    // Advance the tail; when it settles, decrement and clean up idle keys.
    state.tail = result.then(
      () => this.settle(key),
      () => this.settle(key),
    );

    return { position, result };
  }

          settle(key        )       {
    const state = this.keys.get(key);
    if (!state) return;
    state.pending -= 1;
    if (state.pending <= 0) {
      this.keys.delete(key);
    }
  }

  /** Number of keys with in-flight or queued work (for observability/tests). */
  activeKeys()         {
    return this.keys.size;
  }
}
