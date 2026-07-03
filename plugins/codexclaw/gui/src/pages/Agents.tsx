import { useEffect, useRef, useState } from "react";
import {
  api,
  AGENT_EFFORTS,
  type AgentEffort,
  type AgentInfo,
  type BindingRow,
  type CatalogEntry,
  type ChannelKind,
} from "../api.ts";
import { ModelSelect } from "../components/ModelSelect.tsx";
import { Badge, Button, Card, EmptyState, Field, Loading, StatusDot } from "../ui/kit.tsx";
import { Icon } from "../ui/icons.tsx";
import { toast } from "../ui/toast.tsx";

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
  const [agents, setAgents] = useState<AgentInfo[] | null>(null);
  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);

  const refresh = async () => {
    const [a, b] = await Promise.all([api.getAgents(), api.getBindings()]);
    setAgents(a.agents);
    setBindings(b.bindings);
  };

  useEffect(() => {
    void refresh();
    void api.getCatalog().then((c) => setCatalog(c.entries));
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <div className="sub">
            Named agents, one bot token each — all enabled agents run concurrently.
          </div>
        </div>
        {agents ? <span className="badge accent">{agents.filter((a) => a.enabled).length} enabled · {agents.length} total</span> : null}
      </div>
      <div className="page-body">
        <CreateAgentCard onCreated={refresh} />
        {!agents ? (
          <Loading label="Loading agents…" />
        ) : agents.length === 0 ? (
          <EmptyState icon="cpu" title="No agents yet">
            Create one above — name it, pick a messenger, paste its bot token.
          </EmptyState>
        ) : (
          agents.map((a) => (
            <AgentCard key={a.id} agent={a} catalog={catalog} onChanged={refresh} />
          ))
        )}
        <SessionsTable bindings={bindings} />
      </div>
    </>
  );
}

function CreateAgentCard({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ChannelKind>("telegram");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await api.createAgent(name.trim(), kind, token.trim());
    setBusy(false);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? "agent create failed", "err");
      return;
    }
    toast(`agent "${name.trim()}" created`, "ok");
    setName("");
    setToken("");
    await onCreated();
  }

  return (
    <Card title="New agent" desc="Each agent needs its own bot token (BotFather / Discord portal).">
      <div className="row wrap" style={{ alignItems: "flex-end" }}>
        <Field label="name">
          <input className="input" placeholder="telegram-2" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="messenger">
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as ChannelKind)}>
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
          </select>
        </Field>
        <Field label="bot token">
          <input className="input" type="password" placeholder="bot token" value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
        <Button variant="primary" disabled={!name.trim() || !token.trim() || busy} onClick={create}>
          {busy ? <><span className="spinner" /> Validating…</> : "Create"}
        </Button>
      </div>
    </Card>
  );
}

function AgentCard({
  agent,
  catalog,
  onChanged,
}: {
  agent: AgentInfo;
  catalog: CatalogEntry[];
  onChanged: () => Promise<void>;
}) {
  const [pairing, setPairing] = useState(false);
  const [heartbeatPrompt, setHeartbeatPrompt] = useState(agent.heartbeatPrompt);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function patch(body: Parameters<typeof api.updateAgent>[1], label: string) {
    const res = await api.updateAgent(agent.id, body);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? `${label} failed`, "err");
      return;
    }
    toast(`${agent.name}: ${label}`, "ok");
    await onChanged();
  }

  async function setEnabled(enabled: boolean) {
    const res = await api.enableAgent(agent.id, enabled);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? "enable failed", "err");
      return;
    }
    toast(`${agent.name} ${enabled ? "enabled" : "disabled"}`, "ok");
    await onChanged();
  }

  async function remove() {
    const res = await api.deleteAgent(agent.id);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? "delete failed", "err");
      return;
    }
    toast(`${agent.name} deleted`, "ok");
    await onChanged();
  }

  async function openPairing() {
    const baseline = agent.allowlistCount;
    await api.openAgentHandshake(agent.id, 180);
    setPairing(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await api.agentHandshakeStatus(agent.id);
      if (pollRef.current === null) return;
      if (s.allowlistCount > baseline) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPairing(false);
        toast(`${agent.name} paired a new chat`, "ok");
        await onChanged();
      } else if (!s.open) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPairing(false);
        toast("pairing window expired — try again", "err");
      }
    }, 1500);
  }

  return (
    <Card>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-3)" }}>
        <div className="row" style={{ gap: "var(--s-3)" }}>
          <span className="channel-mark" data-kind={agent.kind}>
            <Icon name={agent.kind === "telegram" ? "telegram" : "discord"} size={18} />
          </span>
          <div>
            <div className="card-title" style={{ margin: 0 }}>{agent.name}</div>
            <div className="hint">
              {agent.allowlistCount} paired chat{agent.allowlistCount === 1 ? "" : "s"}
              {agent.hasToken ? "" : " · no token"}
            </div>
          </div>
        </div>
        <div className="row">
          {agent.enabled ? <Badge tone="ok"><StatusDot status="ok" /> enabled</Badge> : <Badge>off</Badge>}
          <Button onClick={() => setEnabled(!agent.enabled)}>{agent.enabled ? "Disable" : "Enable"}</Button>
          <Button variant="danger" disabled={agent.enabled} onClick={remove}>Delete</Button>
        </div>
      </div>

      <div className="row wrap" style={{ alignItems: "flex-end" }}>
        <Field label="model">
          <ModelSelect
            value={agent.model === "default" ? null : agent.model}
            disabled={false}
            entries={catalog}
            onChange={(model) => void patch({ model: model ?? "default" }, "model updated")}
          />
        </Field>
        <Field label="reasoning effort">
          <select
            className="select"
            value={agent.effort}
            onChange={(e) => void patch({ effort: e.target.value as AgentEffort }, "effort updated")}
          >
            {AGENT_EFFORTS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </Field>
        <label className="row" style={{ gap: "var(--s-2)", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={agent.autoSend}
            onChange={(e) => void patch({ autoSend: e.target.checked }, "auto-send updated")}
          />
          auto-send results
        </label>
        <label className="row" style={{ gap: "var(--s-2)", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={agent.mentionOnly}
            onChange={(e) => void patch({ mentionOnly: e.target.checked }, "mention gate updated")}
          />
          respond only when @mentioned (groups)
        </label>
      </div>

      <div className="row wrap" style={{ alignItems: "flex-end", marginTop: "var(--s-3)" }}>
        <Field label="heartbeat (minutes, 0 = off)">
          <input
            className="input"
            type="number"
            min={0}
            max={1440}
            style={{ width: "110px" }}
            defaultValue={agent.heartbeatMinutes}
            onBlur={(e) => {
              const minutes = Number.parseInt(e.target.value, 10);
              if (Number.isInteger(minutes) && minutes !== agent.heartbeatMinutes) {
                void patch({ heartbeatMinutes: minutes }, "heartbeat updated");
              }
            }}
          />
        </Field>
        <div className="grow">
          <Field label="heartbeat prompt">
            <input
              className="input"
              placeholder="What should this agent check periodically?"
              value={heartbeatPrompt}
              onChange={(e) => setHeartbeatPrompt(e.target.value)}
              onBlur={() => {
                if (heartbeatPrompt !== agent.heartbeatPrompt) {
                  void patch({ heartbeatPrompt }, "heartbeat prompt updated");
                }
              }}
            />
          </Field>
        </div>
        {pairing ? (
          <span className="row hint" style={{ gap: "var(--s-2)" }}>
            <span className="spinner" /> waiting for {agent.kind === "telegram" ? "/start" : "!cxc start"}…
          </span>
        ) : (
          <Button onClick={openPairing}>Open pairing window</Button>
        )}
      </div>
    </Card>
  );
}

function SessionsTable({ bindings }: { bindings: BindingRow[] }) {
  if (bindings.length === 0) return null;
  return (
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
  );
}
