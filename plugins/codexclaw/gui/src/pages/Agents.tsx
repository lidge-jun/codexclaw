import { useEffect, useState } from "react";
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
import { Badge, Button, EmptyState, Field, Loading, Modal, StatusDot, Switch } from "../ui/kit.tsx";
import { Icon } from "../ui/icons.tsx";
import { toast } from "../ui/toast.tsx";
import { PairingPane, type BotIdentity, type HandshakeAdapter } from "../components/pairing.tsx";

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
  const [creating, setCreating] = useState(false);
  const [settingsFor, setSettingsFor] = useState<AgentInfo | null>(null);
  const [pairingFor, setPairingFor] = useState<AgentInfo | null>(null);

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
        <div className="row">
          {agents && agents.length > 0 ? (
            <span className="badge accent">{agents.filter((a) => a.enabled).length} of {agents.length} enabled</span>
          ) : null}
          <Button variant="primary" onClick={() => setCreating(true)}>New agent</Button>
        </div>
      </div>
      <div className="page-body">
        {!agents ? (
          <Loading label="Loading agents…" />
        ) : agents.length === 0 ? (
          <div className="row-list">
            <EmptyState icon="cpu" title="No agents yet">
              Create one — name it, pick a messenger, paste its bot token.
            </EmptyState>
          </div>
        ) : (
          <div className="row-list">
            {agents.map((a) => (
              <AgentRow
                key={a.id}
                agent={a}
                onChanged={refresh}
                onSettings={() => setSettingsFor(a)}
                onPair={() => setPairingFor(a)}
              />
            ))}
          </div>
        )}
        <SessionsTable bindings={bindings} />
      </div>
      {creating ? (
        <CreateAgentWizard
          onClose={() => setCreating(false)}
          onChanged={refresh}
        />
      ) : null}
      {settingsFor ? (
        <AgentSettingsModal
          agent={settingsFor}
          catalog={catalog}
          onClose={() => setSettingsFor(null)}
          onChanged={refresh}
        />
      ) : null}
      {pairingFor ? (
        <AgentPairingModal
          agent={pairingFor}
          onClose={() => setPairingFor(null)}
          onChanged={refresh}
        />
      ) : null}
    </>
  );
}

function AgentRow({
  agent,
  onChanged,
  onSettings,
  onPair,
}: {
  agent: AgentInfo;
  onChanged: () => Promise<void>;
  onSettings: () => void;
  onPair: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    setConfirmingDelete(false);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? "delete failed", "err");
      return;
    }
    toast(`${agent.name} deleted`, "ok");
    await onChanged();
  }

  const modelLabel = agent.model === "default" ? "main model" : agent.model;
  const sub = [
    `${agent.allowlistCount} paired chat${agent.allowlistCount === 1 ? "" : "s"}`,
    modelLabel,
    agent.effort !== "default" ? agent.effort : null,
    agent.hasToken ? null : "no token",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="list-row">
      <span className="channel-mark" data-kind={agent.kind}>
        <Icon name={agent.kind === "telegram" ? "telegram" : "discord"} size={16} />
      </span>
      <div className="row-id">
        <span className="row-name">{agent.name}</span>
        <span className="row-sub">{sub}</span>
      </div>
      <div className="row-actions">
        {confirmingDelete ? (
          <>
            <span className="hint">Delete {agent.name}?</span>
            <Button variant="danger" onClick={remove}>Delete</Button>
            <Button onClick={() => setConfirmingDelete(false)}>Keep</Button>
          </>
        ) : (
          <>
            {agent.enabled && agent.allowlistCount === 0 ? (
              <Badge><StatusDot status="warn" /> unpaired</Badge>
            ) : null}
            <Button onClick={onPair}>Pair chat</Button>
            <Button onClick={onSettings} aria-label={`Settings for ${agent.name}`}>
              <Icon name="sliders" size={14} /> Settings
            </Button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Delete ${agent.name}`}
              disabled={agent.enabled}
              title={agent.enabled ? "Disable the agent before deleting" : "Delete agent"}
              onClick={() => setConfirmingDelete(true)}
            >
              <Icon name="x" size={15} />
            </button>
            <Switch
              checked={agent.enabled}
              onChange={(next) => void setEnabled(next)}
              label={`${agent.name} enabled`}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ── create wizard: form -> validate -> pairing (reuses PairingPane) ─────── */

function CreateAgentWizard({ onClose, onChanged }: { onClose: () => void; onChanged: () => Promise<void> }) {
  const [step, setStep] = useState<"form" | "creating" | "pairing" | "done">("form");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ChannelKind>("telegram");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AgentInfo | null>(null);
  const [bot, setBot] = useState<BotIdentity>({ username: null, botId: null });

  async function create() {
    setError(null);
    setStep("creating");
    const res = await api.createAgent(name.trim(), kind, token.trim());
    if (!res.ok || !res.data?.ok || !res.data.agent) {
      setStep("form");
      setError(res.data?.error ?? "Agent create failed — check the token.");
      return;
    }
    setCreated(res.data.agent);
    setBot({ username: res.data.username ?? null, botId: res.data.botId ?? null });
    await onChanged();
    setStep("pairing");
  }

  const adapter: HandshakeAdapter | null = created
    ? {
        open: (seconds) => api.openAgentHandshake(created.id, seconds),
        poll: async () => {
          const s = await api.agentHandshakeStatus(created.id);
          return { paired: s.allowlistCount > (created.allowlistCount ?? 0), open: s.open };
        },
      }
    : null;

  return (
    <Modal title={step === "pairing" ? `Pair ${created?.name ?? "agent"}` : "New agent"} onClose={onClose}>
      {step === "form" || step === "creating" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && token.trim() && step !== "creating") void create();
          }}
        >
          <Field label="Name">
            <input className="input" placeholder="telegram-2" value={name} onChange={(e) => setName(e.target.value)} disabled={step === "creating"} />
          </Field>
          <Field label="Messenger">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as ChannelKind)} disabled={step === "creating"}>
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
            </select>
          </Field>
          <Field label="Bot token">
            <input
              className="input"
              type="password"
              placeholder={kind === "telegram" ? "123456:ABC-DEF…" : "Paste your bot token"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={step === "creating"}
              autoComplete="off"
            />
          </Field>
          <a
            className="help-link"
            href={kind === "telegram" ? "https://t.me/BotFather" : "https://discord.com/developers/applications"}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external" size={13} />
            {kind === "telegram" ? "Get one from @BotFather" : "Developer Portal → Bot → Token"}
          </a>
          {error ? (
            <p className="hint row" role="alert" style={{ color: "var(--danger)", gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
              <Icon name="alert" size={14} /> {error}
            </p>
          ) : null}
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || !token.trim() || step === "creating"}>
              {step === "creating" ? <><span className="spinner" /> Validating…</> : "Create"}
            </Button>
          </div>
        </form>
      ) : step === "pairing" && adapter && created ? (
        <PairingPane
          kind={created.kind}
          bot={bot}
          adapter={adapter}
          onPaired={async () => {
            setStep("done");
            await onChanged();
          }}
          onCancel={onClose}
        />
      ) : (
        <div className="wizard-state">
          <span className="wizard-glyph ok"><Icon name="check-circle" size={28} /></span>
          <div className="title">Agent ready</div>
          <p className="hint">
            {created?.name} paired a chat. Enable it from the list to start routing messages.
          </p>
          <div className="modal-foot">
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── standalone pairing modal for an existing agent ──────────────────────── */

function AgentPairingModal({ agent, onClose, onChanged }: { agent: AgentInfo; onClose: () => void; onChanged: () => Promise<void> }) {
  // Baseline snapshotted at open: pairing success == allowlist grew past it.
  const [baseline] = useState(agent.allowlistCount);
  const adapter: HandshakeAdapter = {
    open: (seconds) => api.openAgentHandshake(agent.id, seconds),
    poll: async () => {
      const s = await api.agentHandshakeStatus(agent.id);
      return { paired: s.allowlistCount > baseline, open: s.open };
    },
  };
  const [done, setDone] = useState(false);

  return (
    <Modal title={`Pair a chat with ${agent.name}`} onClose={onClose}>
      {done ? (
        <div className="wizard-state">
          <span className="wizard-glyph ok"><Icon name="check-circle" size={28} /></span>
          <div className="title">Chat paired</div>
          <p className="hint">{agent.name} can now talk to the new chat.</p>
          <div className="modal-foot">
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <PairingPane
          kind={agent.kind}
          // Bot identity is not stored for existing agents — generic instructions.
          bot={{ username: null, botId: null }}
          adapter={adapter}
          onPaired={async () => {
            setDone(true);
            await onChanged();
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

/* ── settings modal: snapshot on open, explicit save ─────────────────────── */

function AgentSettingsModal({
  agent,
  catalog,
  onClose,
  onChanged,
}: {
  agent: AgentInfo;
  catalog: CatalogEntry[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  // Snapshot once on open: the page's 5s poll must not clobber edits.
  const [model, setModel] = useState(agent.model);
  const [effort, setEffort] = useState(agent.effort as AgentEffort);
  const [autoSend, setAutoSend] = useState(agent.autoSend);
  const [mentionOnly, setMentionOnly] = useState(agent.mentionOnly);
  const [heartbeatMinutes, setHeartbeatMinutes] = useState(String(agent.heartbeatMinutes));
  const [heartbeatPrompt, setHeartbeatPrompt] = useState(agent.heartbeatPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const minutes = Number.parseInt(heartbeatMinutes, 10);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
      setError("Heartbeat must be 0-1440 minutes (0 = off).");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await api.updateAgent(agent.id, {
      model,
      effort,
      autoSend,
      mentionOnly,
      heartbeatMinutes: minutes,
      heartbeatPrompt,
    });
    setSaving(false);
    if (!res.ok || !res.data?.ok) {
      setError(res.data?.error ?? "Save failed.");
      return;
    }
    toast(`${agent.name} updated`, "ok");
    await onChanged();
    onClose();
  }

  return (
    <Modal title={`${agent.name} settings`} onClose={onClose}>
      <Field label="Model">
        <ModelSelect
          value={model === "default" ? null : model}
          disabled={false}
          entries={catalog}
          onChange={(m) => setModel(m ?? "default")}
        />
      </Field>
      <Field label="Reasoning effort">
        <select className="select" value={effort} onChange={(e) => setEffort(e.target.value as AgentEffort)}>
          {AGENT_EFFORTS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      <div className="setting-line">
        <span>Auto-send results</span>
        <Switch checked={autoSend} onChange={setAutoSend} label="Auto-send results" />
      </div>
      <div className="setting-line">
        <span>Respond only when @mentioned (groups)</span>
        <Switch checked={mentionOnly} onChange={setMentionOnly} label="Respond only when mentioned" />
      </div>
      <Field label="Heartbeat interval (minutes, 0 = off)">
        <input
          className="input"
          type="number"
          min={0}
          max={1440}
          value={heartbeatMinutes}
          onChange={(e) => setHeartbeatMinutes(e.target.value)}
        />
      </Field>
      <Field label="Heartbeat prompt">
        <input
          className="input"
          placeholder="What should this agent check periodically?"
          value={heartbeatPrompt}
          onChange={(e) => setHeartbeatPrompt(e.target.value)}
        />
      </Field>
      {error ? (
        <p className="hint row" role="alert" style={{ color: "var(--danger)", gap: "var(--s-2)" }}>
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : null}
      <div className="modal-foot">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function SessionsTable({ bindings }: { bindings: BindingRow[] }) {
  if (bindings.length === 0) return null;
  return (
    <div className="row-list" style={{ marginTop: "var(--s-4)" }}>
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
