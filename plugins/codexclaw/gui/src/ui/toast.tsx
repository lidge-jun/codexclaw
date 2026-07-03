/**
 * toast.tsx — minimal toast host (Phase 6).
 *
 * A module-level emitter so any code can `toast(...)` without threading a
 * context provider through every page. The host renders the queue and expires
 * each toast after a timeout.
 */
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons.tsx";

export interface ToastItem {
  id: number;
  tone: "ok" | "err" | "info";
  message: string;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(items);
}

export function toast(message: string, tone: ToastItem["tone"] = "info", ttlMs = 4000): void {
  const id = nextId++;
  items = [...items, { id, tone, message }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, ttlMs);
}

export function ToastHost() {
  const [queue, setQueue] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setQueue);
    return () => {
      listeners.delete(setQueue);
    };
  }, []);
  if (queue.length === 0) return null;
  const icon: Record<ToastItem["tone"], IconName> = { ok: "check-circle", err: "alert", info: "arrow-right" };
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {queue.map((t) => (
        <div key={t.id} className={`toast ${t.tone === "info" ? "" : t.tone}`}>
          <Icon name={icon[t.tone]} size={16} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
