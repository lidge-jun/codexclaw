 /**
  * event-log.ts — structured JSONL event logger (Phase E5).
  *
  * Appends bridge events to a JSONL file with basic rotation (rename to .1/.2/.3
  * when the file exceeds maxSizeBytes). recent(n) reads the last N events from
  * memory (kept in a bounded ring buffer).
  */
 import { appendFileSync, statSync, renameSync, existsSync, unlinkSync } from "node:fs";















 const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;
 const DEFAULT_MAX_FILES = 3;
 const RING_SIZE = 200;

 export class EventLog {
           filePath        ;
           maxSize        ;
           maxFiles        ;
           ring                = [];
           closed = false;

   constructor(opts                 ) {
     this.filePath = opts.path;
     this.maxSize = opts.maxSizeBytes ?? DEFAULT_MAX_SIZE;
     this.maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
   }

   log(event             )       {
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

   recent(n        )                {
     return this.ring.slice(-n);
   }

   close()       {
     this.closed = true;
   }

           maybeRotate()       {
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
