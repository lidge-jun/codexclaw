 /**
  * event-log.ts — structured JSONL event logger (Phase E5).
  *
  * Appends bridge events to a JSONL file with basic rotation (rename to .1/.2/.3
  * when the file exceeds maxSizeBytes). recent(n) reads the last N events from
  * memory (kept in a bounded ring buffer).
  */
 import { appendFileSync, statSync, renameSync, existsSync, unlinkSync } from "node:fs";
 
 export type BridgeEvent =
   | { type: "message_received"; agentId: number | null; chatId: string; platform: string; ts: string }
   | { type: "turn_complete"; agentId: number | null; durationMs: number; ts: string }
   | { type: "error"; agentId: number | null; message: string; ts: string }
   | { type: "rate_limit"; platform: string; retryAfterMs: number; ts: string }
   | { type: "reconnect"; platform: string; ts: string }
   | { type: "circuit_breaker"; platform: string; state: string; ts: string };
 
 export interface EventLogOptions {
   path: string;
   maxSizeBytes?: number; // default 50MB
   maxFiles?: number;     // default 3
 }
 
 const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;
 const DEFAULT_MAX_FILES = 3;
 const RING_SIZE = 200;
 
 export class EventLog {
   private filePath: string;
   private maxSize: number;
   private maxFiles: number;
   private ring: BridgeEvent[] = [];
   private closed = false;
 
   constructor(opts: EventLogOptions) {
     this.filePath = opts.path;
     this.maxSize = opts.maxSizeBytes ?? DEFAULT_MAX_SIZE;
     this.maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
   }
 
   log(event: BridgeEvent): void {
     if (this.closed) return;
     this.ring.push(event);
     if (this.ring.length > RING_SIZE) this.ring.shift();
     try {
       appendFileSync(this.filePath, JSON.stringify(event) + "\n");
       this.maybeRotate();
     } catch {
       // Filesystem errors are non-fatal for the bridge.
     }
   }
 
   recent(n: number): BridgeEvent[] {
     return this.ring.slice(-n);
   }
 
   close(): void {
     this.closed = true;
   }
 
   private maybeRotate(): void {
     try {
       const stat = statSync(this.filePath);
       if (stat.size < this.maxSize) return;
     } catch {
       return;
     }
     // Rotate: .3 → delete, .2 → .3, .1 → .2, current → .1
     for (let i = this.maxFiles; i >= 1; i -= 1) {
       const src = i === 1 ? this.filePath : `${this.filePath}.${i - 1}`;
       const dst = `${this.filePath}.${i}`;
       if (i === this.maxFiles && existsSync(dst)) {
         try { unlinkSync(dst); } catch { /* ignore */ }
       }
       if (existsSync(src)) {
         try { renameSync(src, dst); } catch { /* ignore */ }
       }
     }
   }
 }
