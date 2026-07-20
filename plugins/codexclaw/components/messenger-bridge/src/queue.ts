/**
 * queue.ts — per-key serial FIFO (messenger-bridge Phase 2).
 *
 * One chat/binding runs one turn at a time; different keys run in parallel.
 * Each key holds a tail promise; enqueue chains onto it. Idle keys are deleted
 * once their tail settles and no work is pending (A-audit Phase 2 finding 5:
 * no unbounded Map growth). A per-key cap rejects overload before awaiting.
 */
export class QueueFullError extends Error {
  constructor(key: string, cap: number) {
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

interface QueueEntry<T = unknown> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

interface KeyState {
  running: boolean;
  entries: QueueEntry[];
}

export interface EnqueueResult<T> {
  /** Number of tasks already ahead of this one when it was enqueued (0 = runs now). */
  position: number;
  result: Promise<T>;
}

export class SerialQueues {
  private keys = new Map<string, KeyState>();
  private cap: number;
  private closed = false;

  constructor(cap = 20) {
    this.cap = cap;
  }

  /** Pending count for a key (includes the currently-running task). */
  pending(key: string): number {
    const state = this.keys.get(key);
    return state ? state.entries.length + (state.running ? 1 : 0) : 0;
  }

  enqueue<T>(key: string, task: () => Promise<T>): EnqueueResult<T> {
    if (this.closed) throw new QueueClosedError();
    const state = this.keys.get(key) ?? { running: false, entries: [] };
    const position = state.entries.length + (state.running ? 1 : 0);
    if (position >= this.cap) {
      throw new QueueFullError(key, this.cap);
    }
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    state.entries.push({ task, resolve, reject } as QueueEntry);
    this.keys.set(key, state);
    this.runNext(key, state);

    return { position, result };
  }

  private runNext(key: string, state: KeyState): void {
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

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [key, state] of this.keys) {
      const pending = state.entries.splice(0);
      for (const entry of pending) entry.reject(new QueueClosedError());
      if (!state.running) this.keys.delete(key);
    }
  }

  /** Number of keys with in-flight or queued work (for observability/tests). */
  activeKeys(): number {
    return this.keys.size;
  }
}
