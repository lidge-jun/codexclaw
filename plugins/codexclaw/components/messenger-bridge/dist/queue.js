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

export class QueueClosedError extends Error {
  constructor() {
    super("queue is closed");
    this.name = "QueueClosedError";
  }
}


















export class SerialQueues {
          keys = new Map                  ();
          cap        ;
          closed = false;

  constructor(cap = 20) {
    this.cap = cap;
  }

  /** Pending count for a key (includes the currently-running task). */
  pending(key        )         {
    const state = this.keys.get(key);
    return state ? state.entries.length + (state.running ? 1 : 0) : 0;
  }

  enqueue   (key        , task                  )                   {
    if (this.closed) throw new QueueClosedError();
    const state = this.keys.get(key) ?? { running: false, entries: [] };
    const position = state.entries.length + (state.running ? 1 : 0);
    if (position >= this.cap) {
      throw new QueueFullError(key, this.cap);
    }
    let resolve                     ;
    let reject                            ;
    const result = new Promise   ((res, rej) => { resolve = res; reject = rej; });
    state.entries.push({ task, resolve, reject }              );
    this.keys.set(key, state);
    this.runNext(key, state);

    return { position, result };
  }

          runNext(key        , state          )       {
    if (state.running) return;
    const entry = state.entries.shift();
    if (!entry) {
      this.keys.delete(key);
      return;
    }
    state.running = true;
    void Promise.resolve()
      .then(entry.task)
      .then((value) => {
        state.running = false;
        this.runNext(key, state);
        entry.resolve(value);
      }, (err) => {
        state.running = false;
        this.runNext(key, state);
        entry.reject(err);
      });
  }

  close()       {
    if (this.closed) return;
    this.closed = true;
    for (const [key, state] of this.keys) {
      const pending = state.entries.splice(0);
      for (const entry of pending) entry.reject(new QueueClosedError());
      if (!state.running) this.keys.delete(key);
    }
  }

  /** Number of keys with in-flight or queued work (for observability/tests). */
  activeKeys()         {
    return this.keys.size;
  }
}
