import { useEffect, useState } from "react";
import {
  api,
  defaultMultiAgentSurface,
  setMultiAgentSurface as saveMultiAgentSurface,
  setSubagentRole,
  type AgentStatus,
  type BridgeEvent,
  type CatalogEntry,
  type MetricsSnapshot,
  type MultiAgentSurface,
  type MultiAgentVersion,
  type SubagentsConfig,
} from "../api.ts";
import { ModelSelect } from "../components/ModelSelect.tsx";
import { Card, EmptyState, Loading, StatusDot, Switch } from "../ui/kit.tsx";
import { Icon } from "../ui/icons.tsx";
import { HelpDrawer, HelpTopicButton, useHelp } from "../ui/help.tsx";
import { toast } from "../ui/toast.tsx";

interface DashboardState {
  metrics: MetricsSnapshot;
  events: BridgeEvent[];
  statuses: AgentStatus[];
}

const SUBAGENT_ROLES = ["explorer", "reviewer", "executor"] as const;
type SubagentRole = (typeof SUBAGENT_ROLES)[number];

const ROLE_META: Record<SubagentRole, { label: string; desc: string }> = {
  explorer: { label: "Explorer", desc: "Discovery and context gathering" },
  reviewer: { label: "Reviewer", desc: "Audit, review, and verification" },
  executor: { label: "Executor", desc: "Focused implementation work" },
};

function statusDot(status: string): "ok" | "warn" | "off" | "err" {
  if (status === "running" || status === "ready") return "ok";
  if (status === "conflict" || status === "connecting" || status === "resuming") return "warn";
  if (status === "error") return "err";
  return "off";
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

function fmtMs(value: number | null): string {
  if (value === null) return "n/a";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function eventDetail(event: BridgeEvent): string {
  switch (event.type) {
    case "message_received":
      return `${event.platform} chat ${event.chatId}`;
    case "turn_started":
      return `${event.platform} chat ${event.chatId}`;
    case "turn_complete":
      return fmtMs(event.durationMs);
    case "error":
      return event.message;
    case "rate_limit":
      return `${event.platform} retry ${fmtMs(event.retryAfterMs)}`;
    case "reconnect":
      return event.platform;
    case "circuit_breaker":
      return `${event.platform} ${event.state}`;
    case "lifecycle":
      return [event.payload.action, event.payload.detail].filter(Boolean).join(" ");
  }
}

function eventAgent(event: BridgeEvent): string {
  return "agentId" in event && event.agentId !== null ? String(event.agentId) : "-";
}

export function DashboardPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [surface, setSurface] = useState<MultiAgentSurface | null>(null);
  const [config, setConfig] = useState<SubagentsConfig | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [savingSurface, setSavingSurface] = useState(false);
  const [savingRole, setSavingRole] = useState<SubagentRole | null>(null);
  const { helpOpen, helpTopic, openHelp, closeHelp } = useHelp("dashboard");

  const refresh = async () => {
    const [metrics, events, statuses] = await Promise.all([
      api.getMetrics(),
      api.getEvents(50),
      api.getAgentStatuses(),
    ]);
    setState({ metrics, events: events.events, statuses: statuses.statuses });
  };

  const refreshControls = async () => {
    const [nextSurface, nextConfig, nextCatalog] = await Promise.all([
      api.getMultiAgentSurface(),
      api.getSubagents(),
      api.getCatalog(),
    ]);
    setSurface(nextSurface);
    setConfig(nextConfig);
    setCatalog(nextCatalog.entries);
  };

  useEffect(() => {
    void refresh();
    void refreshControls();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  const setVersion = async (version: MultiAgentVersion) => {
    const current = surface ?? defaultMultiAgentSurface();
    if (current.version === version || savingSurface) return;
    setSavingSurface(true);
    const result = await saveMultiAgentSurface(version, current);
    setSavingSurface(false);
    if (!result.ok) {
      toast(result.error ?? "Multi-agent mode update failed", "err");
      return;
    }
    setSurface(result.surface);
    toast(`Fallback models use ${version.toUpperCase()} for new sessions`, "ok");
  };

  const setRoleModel = async (role: SubagentRole, model: string | null) => {
    if (!config || savingRole) return;
    setSavingRole(role);
    const result = await setSubagentRole(role, { mode: model ? "model" : "default", model }, config);
    setSavingRole(null);
    if (!result.ok) {
      toast(result.error ?? `${role} model update failed`, "err");
      return;
    }
    setConfig(result.config);
    toast(`${ROLE_META[role].label} model updated`, "ok");
  };

  return (
    <>
      <div className="page-header">
        <span className="page-header-title">Dashboard</span>
        <HelpTopicButton topic="dashboard" onOpen={openHelp} />
      </div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Bridge traffic, turn health, and adapter state.</div>
        </div>
        {state ? (
          <span className="badge">
            <StatusDot status={state.statuses.some((s) => statusDot(s.status) === "ok") ? "ok" : "off"} />
            {state.statuses.length} adapter{state.statuses.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <div className="page-body wide">
        {!state ? (
          <Loading label="Loading dashboard..." />
        ) : (
          <>
            <DashboardControls
              surface={surface}
              config={config}
              catalog={catalog}
              savingSurface={savingSurface}
              savingRole={savingRole}
              onVersionChange={setVersion}
              onRoleModelChange={setRoleModel}
            />

            <div className="metric-grid">
              <MetricCard label="Messages" value={state.metrics.messagesReceived} />
              <MetricCard label="Turns" value={state.metrics.turnsCompleted} />
              <MetricCard label="Errors" value={state.metrics.errors} tone={state.metrics.errors > 0 ? "err" : "ok"} />
              <MetricCard label="Avg response" value={fmtMs(state.metrics.avgResponseTimeMs)} />
            </div>

            <div className="dashboard-grid">
              <Card title="Recent events">
                {state.events.length === 0 ? (
                  <EmptyState icon="activity" title="No events yet">
                    Messages and lifecycle changes will appear here.
                  </EmptyState>
                ) : (
                  <div className="event-feed">
                    <table className="table compact">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event</th>
                          <th>Agent</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.events.map((event, idx) => (
                          <tr key={`${event.ts}-${idx}`}>
                            <td className="mono">{relTime(event.ts)}</td>
                            <td>{event.type}</td>
                            <td className="mono">{eventAgent(event)}</td>
                            <td className="cell-detail">{eventDetail(event)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Agent status">
                {state.statuses.length === 0 ? (
                  <EmptyState icon="cpu" title="No running adapters">
                    Enable an agent to start routing messages.
                  </EmptyState>
                ) : (
                  <div className="agent-status-list">
                    {state.statuses.map((agent) => (
                      <div className="agent-status-row" key={agent.agentId}>
                        <span className="channel-mark" data-kind={agent.kind}>
                          <Icon name={agent.kind === "telegram" ? "telegram" : "discord"} size={15} />
                        </span>
                        <div className="row-id">
                          <span className="row-name">{agent.name}</span>
                          <span className="row-sub">agent {agent.agentId}</span>
                        </div>
                        <span className="badge">
                          <StatusDot status={statusDot(agent.status)} />
                          {agent.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
      <HelpDrawer open={helpOpen} topic={helpTopic} onClose={closeHelp} />
    </>
  );
}

function DashboardControls({
  surface,
  config,
  catalog,
  savingSurface,
  savingRole,
  onVersionChange,
  onRoleModelChange,
}: {
  surface: MultiAgentSurface | null;
  config: SubagentsConfig | null;
  catalog: CatalogEntry[];
  savingSurface: boolean;
  savingRole: SubagentRole | null;
  onVersionChange: (version: MultiAgentVersion) => void;
  onRoleModelChange: (role: SubagentRole, model: string | null) => void;
}) {
  const version = surface?.version ?? "v1";
  const controlsReady = config !== null;

  return (
    <div className="dashboard-config-stack">
      <Card title="Multi-agent fallback" desc="This flag applies to flag-fallback models only.">
        {surface === null ? (
          <Loading label="Loading multi-agent mode..." />
        ) : (
          <div className="surface-control">
            <div className="surface-copy">
              <span className="surface-name">Fallback {version.toUpperCase()}</span>
              <span className="surface-desc">
                {surface.catalogPinned.v2.join(" and ")} stay on V2; {surface.catalogPinned.v1.join(" and ")} stays on V1 through the model catalog. Takes effect for {surface.effectiveFrom}.
              </span>
            </div>
            <div className="surface-toggle" aria-label="Fallback multi-agent version">
              <span className={`surface-toggle-label ${version === "v1" ? "active" : ""}`}>V1</span>
              <Switch
                checked={version === "v2"}
                disabled={savingSurface}
                label="Toggle V2 for flag-fallback models"
                onChange={(next) => onVersionChange(next ? "v2" : "v1")}
              />
              <span className={`surface-toggle-label ${version === "v2" ? "active" : ""}`}>V2</span>
            </div>
          </div>
        )}
      </Card>

      {surface !== null ? (
        <Card
          title="Subagent models"
          desc="Applies to spawns on both V1 and V2 surfaces when the caller does not pick a model; not applied on full-history forks."
        >
          {!controlsReady ? (
            <Loading label="Loading subagent models..." />
          ) : (
            <div className="subagent-model-list">
              {SUBAGENT_ROLES.map((role) => (
                <div className="subagent-model-row" key={role}>
                  <div className="row-id">
                    <span className="row-name">{ROLE_META[role].label}</span>
                    <span className="row-sub">{ROLE_META[role].desc}</span>
                  </div>
                  <div className="subagent-model-control">
                    <ModelSelect
                      value={config.roles[role].mode === "model" ? config.roles[role].model : null}
                      disabled={savingRole !== null}
                      entries={catalog}
                      onChange={(model) => onRoleModelChange(role, model)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "err" }) {
  return (
    <Card>
      <div className="metric-card">
        <div className="metric-label">{label}</div>
        <div className={`metric-value ${tone ?? ""}`}>{value}</div>
      </div>
    </Card>
  );
}
