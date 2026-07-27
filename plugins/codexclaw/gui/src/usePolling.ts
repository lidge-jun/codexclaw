import { useEffect, useRef } from "react";

/** Single-flight polling: schedule the next run only after the current run settles. */
export function usePolling(task: (signal: AbortSignal) => Promise<void>, intervalMs: number): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    const run = async (): Promise<void> => {
      controller = new AbortController();
      try {
        await taskRef.current(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) console.warn("codexclaw poll failed", err);
      } finally {
        controller = null;
        if (active) timer = setTimeout(() => void run(), intervalMs);
      }
    };
    void run();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [intervalMs]);
}
