/** Ordered, non-blocking JSONL event log with bounded rotation and memory ring. */
import { chmodSync, mkdirSync, statSync } from "node:fs";
import { appendFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";






















const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;
const DEFAULT_MAX_FILES = 3;
const RING_SIZE = 200;
const DEFAULT_MAX_PENDING_BYTES = 1024 * 1024;
const DEFAULT_MAX_PENDING_EVENTS = 1024;

export class EventLog {
          filePath        ;
          maxSize        ;
          maxFiles        ;
          ring                = [];
          closed = false;
          pending                                         = [];
          pendingBytes = 0;
          dropped = 0;
          draining                       = null;
          maxPendingBytes        ;
          maxPendingEvents        ;
          append                                                                          ;
          bytes = 0;

  constructor(opts                 ) {
    this.filePath = opts.path;
    this.maxSize = opts.maxSizeBytes ?? DEFAULT_MAX_SIZE;
    this.maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
    this.maxPendingBytes = Math.max(1, opts.maxPendingBytes ?? DEFAULT_MAX_PENDING_BYTES);
    this.maxPendingEvents = Math.max(1, opts.maxPendingEvents ?? DEFAULT_MAX_PENDING_EVENTS);
    this.append = opts.append ?? appendFile;
    mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
    try {
      this.bytes = statSync(this.filePath).size;
      chmodSync(this.filePath, 0o600);
    } catch {
      this.bytes = 0;
    }
  }

  log(event             )       {
    if (this.closed) return;
    this.ring.push(event);
    if (this.ring.length > RING_SIZE) this.ring.shift();
    const line = `${JSON.stringify(event)}\n`;
    const bytes = Buffer.byteLength(line);
    if (bytes > this.maxPendingBytes || this.pending.length >= this.maxPendingEvents || this.pendingBytes + bytes > this.maxPendingBytes) {
      this.dropped += 1;
    } else {
      this.pending.push({ line, bytes });
      this.pendingBytes += bytes;
    }
    this.startDrain();
  }

  recent(n        )                {
    return this.ring.slice(-n);
  }

  async flush()                {
    while (this.draining !== null) await this.draining;
  }

  async close()                {
    this.closed = true;
    await this.flush();
  }

          async rotate()                {
    for (let i = this.maxFiles; i >= 1; i -= 1) {
      const src = i === 1 ? this.filePath : `${this.filePath}.${i - 1}`;
      const dst = `${this.filePath}.${i}`;
      if (i === this.maxFiles) await rm(dst, { force: true }).catch(() => {});
      await rename(src, dst).catch(() => {});
    }
    this.bytes = 0;
  }

          startDrain()       {
    if (this.draining !== null) return;
    this.draining = this.drain().finally(() => {
      this.draining = null;
      // A log call can arrive after drain's final empty check but before the
      // finally callback. Restart once so that race cannot strand a record.
      if (this.pending.length > 0 || this.dropped > 0) this.startDrain();
    });
  }

          async drain()                {
    for (;;) {
      const next = this.pending.shift();
      if (next) {
        this.pendingBytes -= next.bytes;
        await this.writeLine(next.line, next.bytes);
        continue;
      }
      if (this.dropped > 0) {
        const count = this.dropped;
        this.dropped = 0;
        const line = `${JSON.stringify({ type: "log_dropped", count, ts: new Date().toISOString() })}\n`;
        await this.writeLine(line, Buffer.byteLength(line));
        continue;
      }
      return;
    }
  }

          async writeLine(line        , bytes        )                {
    try {
      if (this.bytes > 0 && this.bytes + bytes >= this.maxSize) await this.rotate();
      await this.append(this.filePath, line, { mode: 0o600 });
      this.bytes += bytes;
    } catch {
      // Filesystem errors are non-fatal for the bridge. The bounded queue keeps
      // draining instead of retaining failed records indefinitely.
    }
  }
}
