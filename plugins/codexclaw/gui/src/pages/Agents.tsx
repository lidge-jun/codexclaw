import { useEffect, useState } from "react";
import { api, type BindingRow } from "../api.ts";
import { Loading, EmptyState, StatusDot } from "../ui/kit.tsx";
import { Icon } from "../ui/icons.tsx";

function statusDot(status: string): "ok" | "warn" | "off" {
  if (status === "running") return "warn";
  if (status === "idle") return "ok";
  return "off";
}

function shortThread(id: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

export function AgentsPage() {
  const [bindings, setBindings] = useState<BindingRow[] | null>(null);

  useEffect(() => {
    const load = () => void api.getBindings().then((b) => setBindings(b.bindings));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <div className="sub">Each chat binds 1:1 to a codex session. Sessions resume across messages.</div>
        </div>
        {bindings ? <span className="badge accent">{bindings.length} active</span> : null}
      </div>
      <div className="page-body">
        {!bindings ? (
          <Loading label="Loading agents…" />
        ) : bindings.length === 0 ? (
          <EmptyState icon="cpu" title="No agents yet">
            Connect a channel and message the bot — the first message spawns a codex session that
            appears here.
          </EmptyState>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Chat</th>
                    <th>Codex session</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="row" style={{ gap: "var(--s-2)" }}>
                          <Icon name={b.channel_kind === "telegram" ? "telegram" : "discord"} size={14} />
                          {b.channel_kind === "telegram" ? "Telegram" : "Discord"}
                        </span>
                      </td>
                      <td className="mono">{b.chat_id}</td>
                      <td className="mono">{shortThread(b.thread_id)}</td>
                      <td>
                        <span className="row" style={{ gap: "var(--s-2)" }}>
                          <StatusDot status={statusDot(b.status)} />
                          {b.status}
                        </span>
                      </td>
                      <td className="mono">{relTime(b.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
