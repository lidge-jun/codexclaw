/**
 * api.ts — codexclaw GUI API client.
 *
 * The GUI reads/writes ONLY through codexclaw endpoints; it never shells out to
 * ocx and has no hard dependency on the opencodex dashboard at localhost:10100.
 * In MVP the dashboard runs without a backend wired, so these calls degrade to
 * safe defaults (ocx-absent, default roles) instead of throwing — the app shell
 * must load with no console errors when nothing is available.
 */
export type RoleMode = "default" | "model";

// Mirror of store.ts EFFORTS (separate GUI bundle). Scoped to the universally-supported
// set: codex-rs hard-fails a spawn whose effort is not in the resolved model's
// supported_reasoning_levels, and every selectable model supports exactly these four.
export const EFFORTS = ["low", "medium", "high", "xhigh"] as const;
export type EffortName = (typeof EFFORTS)[number];

export interface RoleConfig {
  mode: RoleMode;
  model: string | null;
  /** reasoning-effort override; null = inherit the parent session's effort. */
  effort: EffortName | null;
  promptOverride: string | null;
}

export interface SubagentsConfig {
  roles: { explorer: RoleConfig; reviewer: RoleConfig; executor: RoleConfig };
}

export interface CatalogEntry {
  id: string;
  source: "native" | "ocx";
  label: string;
}

export interface ProviderState {
  mode: "native" | "provider" | "error";
  port: number | null;
}

export type MultiAgentVersion = "v1" | "v2";

export interface MultiAgentSurface {
  version: MultiAgentVersion;
  v2Enabled: boolean;
  appliesTo: "flag-fallback models only";
  catalogPinned: {
    readonly v2: readonly string[];
    readonly v1: readonly string[];
  };
  effectiveFrom: "new sessions";
}

const defaultRole = (): RoleConfig => ({ mode: "default", model: null, effort: null, promptOverride: null });

export const defaultConfig = (): SubagentsConfig => ({
  roles: { explorer: defaultRole(), reviewer: defaultRole(), executor: defaultRole() },
});

export const defaultMultiAgentSurface = (): MultiAgentSurface => ({
  version: "v1",
  v2Enabled: false,
  appliesTo: "flag-fallback models only",
  catalogPinned: {
    v2: ["gpt-5.6-sol", "gpt-5.6-terra"],
    v1: ["gpt-5.6-luna"],
  },
  effectiveFrom: "new sessions",
});

/**
 * Backend base URL. The dev server (vite middleware) serves /api/* same-origin,
 * so the default empty base means "same origin". A failed fetch degrades to the
 * safe default (no throw), so a static build with no backend still loads cleanly.
 */
const API_BASE: string = (import.meta.env?.VITE_CXC_API as string | undefined) ?? "";

// Custom header that marks a request as same-origin GUI traffic. The bridge
// server's local guard requires it on mutating routes; a cross-origin page
// cannot set it without a CORS preflight the server never answers.
const LOCAL_HEADER = { "x-codexclaw-local": "1" };

const defaultMetrics = (): MetricsSnapshot => ({
  messagesReceived: 0,
  turnsCompleted: 0,
  errors: 0,
  rateLimits: { telegram: 0, discord: 0 },
  avgResponseTimeMs: null,
  perAgent: {},
});

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { accept: "application/json", ...LOCAL_HEADER },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    // No backend reachable (static build) -> safe default, no throw.
    return fallback;
  }
}

export interface SetRoleResult {
  ok: boolean;
  /** updated config on success; the caller-provided fallback on failure. */
  config: SubagentsConfig;
  error?: string;
}

export interface SetMultiAgentSurfaceResult {
  ok: boolean;
  /** updated surface on success; the caller-provided fallback on failure. */
  surface: MultiAgentSurface;
  error?: string;
}

/** POST a role patch. Failures are surfaced (never silently swallowed) so the
 *  UI can show the real error instead of a false success. */
export async function setSubagentRole(
  role: "explorer" | "reviewer" | "executor",
  patch: Partial<RoleConfig> & { role?: never },
  fallback: SubagentsConfig,
): Promise<SetRoleResult> {
  try {
    const res = await fetch(`${API_BASE}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
      body: JSON.stringify({ role, ...patch }),
    });
    const body = (await res.json().catch(() => null)) as
      | (SubagentsConfig & { error?: string })
      | { error?: string }
      | null;
    if (!res.ok || !body || !("roles" in body)) {
      return { ok: false, config: fallback, error: body?.error ?? `save failed (${res.status})` };
    }
    return { ok: true, config: body as SubagentsConfig };
  } catch {
    return { ok: false, config: fallback, error: "backend unreachable" };
  }
}

export async function setMultiAgentSurface(
  version: MultiAgentVersion,
  fallback: MultiAgentSurface,
): Promise<SetMultiAgentSurfaceResult> {
  try {
    const res = await fetch(`${API_BASE}/api/multi-agent`, {
      method: "POST",
      headers: { "content-type": "application/json", ...LOCAL_HEADER },
      body: JSON.stringify({ version }),
    });
    const body = (await res.json().catch(() => null)) as
      | (MultiAgentSurface & { ok?: boolean; error?: string })
      | { error?: string }
      | null;
    if (!res.ok || !body || !("version" in body)) {
      return { ok: false, surface: fallback, error: body?.error ?? `save failed (${res.status})` };
    }
    return {
      ok: true,
      surface: {
        version: body.version,
        v2Enabled: body.v2Enabled,
        appliesTo: body.appliesTo,
        catalogPinned: body.catalogPinned,
        effectiveFrom: body.effectiveFrom,
      },
    };
  } catch {
    return { ok: false, surface: fallback, error: "backend unreachable" };
  }
}

/* ---- bridge (messenger) types ---- */
export type ChannelKind = "telegram" | "discord";

export interface ChannelInfo {
  kind: ChannelKind;
  hasToken: boolean;
  active: boolean;
  allowlistCount: number;
}

export interface ChannelsState {
  channels: ChannelInfo[];
  activeKind: ChannelKind | null;
  adapterStatus: string;
}

export interface BindingRow {
  id: number;
  channel_kind: ChannelKind;
  chat_id: string;
  agent_id: number | null;
  thread_id: string | null;
  workdir: string;
  model: string;
  status: string;
  updated_at: string;
}

export interface JobRow {
  id: number;
  binding_id: number;
  prompt_preview: string;
  result_preview: string | null;
  state: string;
  thread_id: string | null;
  error: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface HandshakeStatus {
  open: boolean;
  pairedChatId: string | null;
}

export interface AgentPairingLink {
  ok: boolean;
  url: string;
  code: string;
  expiresAt: number;
  error?: string;
}

export interface AgentTestSendResult {
  ok: boolean;
  chatId: string;
  error?: string;
}

/* ---- named agents (v4) ---- */
export const AGENT_EFFORTS = ["default", "minimal", "low", "medium", "high", "xhigh"] as const;
export type AgentEffort = (typeof AGENT_EFFORTS)[number];

export interface AgentInfo {
  id: number;
  name: string;
  kind: ChannelKind;
  hasToken: boolean;
  enabled: boolean;
  model: string;
  effort: string;
  autoSend: boolean;
  mentionOnly: boolean;
  heartbeatMinutes: number;
  heartbeatPrompt: string;
  allowlistCount: number;
  updatedAt: string;
  threadMode: "thread" | "plain";
  fullAccess: boolean;
  webhookUrl: string;
}

export interface AgentStatus {
  agentId: number;
  name: string;
  kind: ChannelKind;
  status: string;
}

export interface MetricsSnapshot {
  messagesReceived: number;
  turnsCompleted: number;
  errors: number;
  rateLimits: { telegram: number; discord: number };
  avgResponseTimeMs: number | null;
  perAgent: Record<string, { messages: number; turns: number; errors: number }>;
}

export type BridgeEvent =
  | { type: "message_received"; agentId: number | null; chatId: string; platform: string; ts: string }
  | { type: "turn_started"; agentId: number | null; chatId: string; platform: string; ts: string }
  | { type: "turn_complete"; agentId: number | null; durationMs: number; ts: string }
  | { type: "error"; agentId: number | null; message: string; ts: string }
  | { type: "rate_limit"; platform: string; retryAfterMs: number; ts: string }
  | { type: "reconnect"; platform: string; ts: string }
  | { type: "circuit_breaker"; platform: string; state: string; ts: string }
  | { type: "lifecycle"; payload: { action: "start" | "stop" | "reload"; detail?: string }; ts: string };

export interface AgentPatchBody {
  name?: string;
  token?: string;
  model?: string;
  effort?: AgentEffort;
  autoSend?: boolean;
  mentionOnly?: boolean;
  heartbeatMinutes?: number;
  heartbeatPrompt?: string;
  threadMode?: "thread" | "plain";
  fullAccess?: boolean;
  webhookUrl?: string;
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...LOCAL_HEADER },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export const api = {
  getSubagents: () => getJson<SubagentsConfig>("/api/subagents", defaultConfig()),
  getMultiAgentSurface: () => getJson<MultiAgentSurface>("/api/multi-agent", defaultMultiAgentSurface()),
  getCatalog: () =>
    getJson<{ state: string; entries: CatalogEntry[] }>("/api/catalog", {
      state: "native-catalog",
      entries: [
        { id: "gpt-5.5", source: "native", label: "gpt-5.5 (native)" },
        { id: "gpt-5.4", source: "native", label: "gpt-5.4 (native)" },
      ],
    }),
  getProvider: () => getJson<ProviderState>("/api/provider", { mode: "native", port: null }),

  // bridge
  getChannels: () =>
    getJson<ChannelsState>("/api/channels", { channels: [], activeKind: null, adapterStatus: "n/a" }),
  getBindings: () => getJson<{ bindings: BindingRow[] }>("/api/bindings", { bindings: [] }),
  getMetrics: () => getJson<MetricsSnapshot>("/api/metrics", defaultMetrics()),
  getEvents: (n = 50) =>
    getJson<{ events: BridgeEvent[] }>(`/api/events?n=${encodeURIComponent(String(n))}`, { events: [] }),
  getAgentStatuses: () => getJson<{ statuses: AgentStatus[] }>("/api/agents/statuses", { statuses: [] }),
  resetBinding: (id: number) =>
    postJson<{ ok: boolean; binding?: BindingRow; error?: string }>("/api/bindings/reset", { id }),
  setBindingCwd: (id: number, cwd: string) =>
    postJson<{ ok: boolean; binding?: BindingRow; error?: string }>("/api/bindings/cwd", { id, cwd }),
  getBindingJobs: (id: number) =>
    getJson<{ jobs: JobRow[] }>(`/api/bindings/jobs?id=${encodeURIComponent(String(id))}`, { jobs: [] }),
  validateToken: (kind: ChannelKind, token: string) =>
    postJson<{ ok: boolean; username: string | null; botId: string | null; error?: string }>(
      "/api/connect/validate",
      { kind, token },
    ),
  activateChannel: (kind: ChannelKind) => postJson<{ ok: boolean }>("/api/connect/activate", { kind }),
  deactivateChannel: () => postJson<{ ok: boolean }>("/api/connect/deactivate", {}),
  openHandshake: (kind: ChannelKind, seconds = 120) =>
    postJson<{ ok: boolean }>("/api/connect/handshake/open", { kind, seconds }),
  handshakeStatus: (kind: ChannelKind) =>
    getJson<HandshakeStatus>(`/api/connect/handshake/status?kind=${kind}`, { open: false, pairedChatId: null }),

  // named agents (v4)
  getAgents: () => getJson<{ agents: AgentInfo[] }>("/api/agents", { agents: [] }),
  createAgent: (name: string, kind: ChannelKind, token: string) =>
    postJson<{ ok: boolean; agent?: AgentInfo; username?: string | null; botId?: string | null; error?: string }>(
      "/api/agents",
      { name, kind, token },
    ),
  updateAgent: (id: number, patch: AgentPatchBody) =>
    postJson<{ ok: boolean; agent?: AgentInfo; error?: string }>("/api/agents/update", { id, ...patch }),
  enableAgent: (id: number, enabled: boolean) =>
    postJson<{ ok: boolean; error?: string }>("/api/agents/enable", { id, enabled }),
  deleteAgent: (id: number) => postJson<{ ok: boolean; error?: string }>("/api/agents/delete", { id }),
  openAgentHandshake: (id: number, seconds = 180) =>
    postJson<{ ok: boolean }>("/api/agents/handshake/open", { id, seconds }),
  mintPairingLink: (id: number, seconds?: number) =>
    postJson<AgentPairingLink>("/api/agents/pairing-link", seconds === undefined ? { id } : { id, seconds }),
  testSend: (id: number, chatId?: string) =>
    postJson<AgentTestSendResult>("/api/agents/test-send", chatId === undefined ? { id } : { id, chatId }),
  agentHandshakeStatus: (id: number) =>
    getJson<{ open: boolean; allowlistCount: number }>(`/api/agents/handshake/status?id=${id}`, {
      open: false,
      allowlistCount: 0,
    }),
};
