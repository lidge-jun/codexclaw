/**
 * agent-service.ts — db + queue + runner glue (messenger-bridge Phase 2).
 *
 * The adapters (Phase 3/4) and connect API (Phase 5) call handleIncoming: it
 * resolves the chat's binding, logs a job, serializes the turn per binding, runs
 * Codex with the binding's remembered thread, persists the new thread id, and
 * records the outcome. Active children are tracked so a serve shutdown can
 * terminate them (A-audit Phase 2 finding 5).
 */
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import type { BridgeDb, ChannelKind, JobRow } from "./db.ts";
import type { EventLog } from "./event-log.ts";
import type { BridgeMetrics } from "./metrics.ts";
import {
  createApprovalStore,
  type ApprovalDecision,
  type ApprovalRequest,
  type ApprovalStore,
} from "./approval-relay.ts";
import { QueueClosedError, SerialQueues, QueueFullError } from "./queue.ts";
import { runTurn, terminateChild, type RunnerEvent, type TurnResult } from "./runner.ts";

export interface AgentServiceOptions {
  db: BridgeDb;
  metrics?: BridgeMetrics;
  events?: EventLog;
  codexBin?: string;
  model?: string;
  timeoutMs?: number;
  queueCap?: number;
  reseedJobCount?: number;
  approvalStore?: ApprovalStore;
}

export interface IncomingRequest {
  kind: ChannelKind;
  chatId: string;
  text: string;
  workdir: string;
  topicId?: string | null;
  /** Named-agent scope (v4): binds per (agent, chat) instead of (kind, chat). */
  agentId?: number;
  approvalBypass?: boolean;
  onApprovalRequest?: (request: ApprovalRequest) => Promise<void>;
  model?: string | null;
  onEvent?: (event: RunnerEvent) => void;
}

export interface IncomingResult {
  ok: boolean;
  text?: string;
  error?: string;
  queued?: number;
  threadId?: string | null;
}

export interface EnqueuedIncoming {
  bindingId: number;
  jobId: number;
  queued?: number;
  result: Promise<IncomingResult>;
}

export type ApprovalResolveStatus = "resolved" | "not_found" | "unauthorized";

/** Build a summarized history block from recent jobs for the resume re-seed. */
export function buildReseedBlock(jobs: JobRow[]): string {
  if (jobs.length === 0) return "";
  const lines = jobs
    .slice()
    .reverse()
    .filter((j) => j.prompt_preview || j.result_preview)
    .map((j) => {
      const user = j.prompt_preview ? `User: ${j.prompt_preview}` : "";
      const asst = j.result_preview ? `Assistant: ${j.result_preview}` : "";
      return [user, asst].filter(Boolean).join("\n");
    });
  return `[context re-seed] The previous session was lost; here is a summary of recent turns:\n\n${lines.join("\n\n")}`;
}

export class AgentService {
  private queues: SerialQueues;
  private children = new Set<ChildProcess>();
  private childrenByBinding = new Map<number, Set<ChildProcess>>();
  private opts: AgentServiceOptions;
  private approvals: ApprovalStore;

  constructor(opts: AgentServiceOptions) {
    this.opts = opts;
    this.queues = new SerialQueues(opts.queueCap ?? 20);
    this.approvals = opts.approvalStore ?? createApprovalStore();
  }

  private registerChild(bindingId: number, child: ChildProcess): (() => void) {
    this.children.add(child);
    const children = this.childrenByBinding.get(bindingId) ?? new Set<ChildProcess>();
    children.add(child);
    this.childrenByBinding.set(bindingId, children);
    return () => {
      this.children.delete(child);
      children.delete(child);
      if (children.size === 0) this.childrenByBinding.delete(bindingId);
    };
  }

  cancelTurn(bindingId: number): boolean {
    const children = this.childrenByBinding.get(bindingId);
    if (!children || children.size === 0) return false;
    for (const child of children) terminateChild(child);
    return true;
  }

  /** Terminate every in-flight Codex child (called on serve shutdown). */
  shutdown(): void {
    this.queues.close();
    for (const child of this.children) {
      terminateChild(child);
    }
    this.children.clear();
    this.childrenByBinding.clear();
  }

  enqueueIncoming(req: IncomingRequest): EnqueuedIncoming {
    const { db } = this.opts;
    const binding =
      req.agentId !== undefined
        ? db.getOrCreateAgentBinding(req.agentId, req.kind, req.chatId, req.workdir, req.topicId ?? null)
        : db.getOrCreateBinding(req.kind, req.chatId, req.workdir, req.topicId ?? null);
    const jobId = db.createJob(binding.id, req.text);
    const agentId = binding.agent_id;
    this.opts.metrics?.recordMessage(agentId);
    this.opts.events?.log({
      type: "message_received",
      agentId,
      chatId: binding.chat_id,
      platform: binding.channel_kind,
      ts: new Date().toISOString(),
    });

    let enqueued;
    try {
      enqueued = this.queues.enqueue(String(binding.id), () => this.runOne(binding.id, jobId, req));
    } catch (err) {
      if (err instanceof QueueFullError || err instanceof QueueClosedError) {
        db.updateJob(jobId, { state: "error", error: err.message });
        this.recordError(agentId, err.message);
        return {
          bindingId: binding.id,
          jobId,
          result: Promise.resolve({ ok: false, error: err.message }),
        };
      }
      throw err;
    }

    const queuedAhead = enqueued.position;
    return {
      bindingId: binding.id,
      jobId,
      queued: queuedAhead > 0 ? queuedAhead : undefined,
      result: enqueued.result.then(
        (result) => ({ ...result, queued: queuedAhead > 0 ? queuedAhead : undefined }),
        (err) => {
          if (!(err instanceof QueueClosedError)) throw err;
          db.updateJob(jobId, { state: "error", error: err.message, ended_at: new Date().toISOString() });
          this.recordError(agentId, err.message);
          return { ok: false, error: err.message, queued: queuedAhead > 0 ? queuedAhead : undefined };
        },
      ),
    };
  }

  async handleIncoming(req: IncomingRequest): Promise<IncomingResult> {
    return this.enqueueIncoming(req).result;
  }

  registerApprovalCleanup(
    id: string,
    cleanup: (request: ApprovalRequest) => void | Promise<void>,
  ): boolean {
    return this.approvals.registerCleanup(id, (request) => cleanup(request));
  }

  cleanupApprovals(now?: number): ApprovalRequest[] {
    return this.approvals.cleanup(now);
  }

  listPendingApprovals(filter: { bindingId?: number; agentId?: number | null } = {}): ApprovalRequest[] {
    this.approvals.cleanup();
    return [...this.approvals.pending.values()].filter((request) => {
      if (filter.bindingId !== undefined && request.bindingId !== filter.bindingId) return false;
      if (filter.agentId !== undefined) {
        const binding = this.opts.db.getBinding(request.bindingId);
        if (!binding || (binding.agent_id ?? null) !== (filter.agentId ?? null)) return false;
      }
      return true;
    });
  }

  resolveApproval(input: {
    id: string;
    decision: ApprovalDecision;
    bindingId?: number;
    chatId?: string;
    agentId?: number | null;
  }): ApprovalResolveStatus {
    const request = this.approvals.pending.get(input.id);
    if (!request) return "not_found";
    const binding = this.opts.db.getBinding(request.bindingId);
    if (!binding) return "not_found";
    if (input.bindingId !== undefined && input.bindingId !== binding.id) return "unauthorized";
    if (input.chatId !== undefined && input.chatId !== binding.chat_id) return "unauthorized";
    if (input.agentId !== undefined && (binding.agent_id ?? null) !== (input.agentId ?? null)) {
      return "unauthorized";
    }
    const allowed = binding.agent_id === null
      ? this.opts.db.isAllowed(binding.channel_kind, binding.chat_id)
      : this.opts.db.isAgentAllowed(binding.agent_id, binding.chat_id);
    if (!allowed) return "unauthorized";
    return this.approvals.resolve(input.id, input.decision) ? "resolved" : "not_found";
  }

  private async runOne(bindingId: number, jobId: number, req: IncomingRequest): Promise<IncomingResult> {
    const { db } = this.opts;
    const binding = db.getBinding(bindingId);
    if (!binding) {
      this.recordError(req.agentId ?? null, "binding vanished");
      return { ok: false, error: "binding vanished" };
    }
    const agentId = binding.agent_id;

    // Settings are read FRESH per turn (never cached at adapter start), so a
    // binding override or agent-card change applies to the very next turn.
    const agent = binding.agent_id !== null ? db.getAgent(binding.agent_id) : null;
    const bindingModel = binding.model !== "default" ? binding.model : null;
    const bindingEffort = binding.effort !== "default" ? binding.effort : null;
    const agentModel = agent && agent.model !== "default" ? agent.model : null;
    const agentEffort = agent && agent.effort !== "default" ? agent.effort : null;
    const approval = await this.ensureApproved(bindingId, jobId, req, agent?.full_access ?? 1);
    if (!approval.ok) return approval.result;

    db.setBindingStatus(bindingId, "running");
    db.updateJob(jobId, { state: "running", started_at: new Date().toISOString() });
    this.opts.events?.log({
      type: "turn_started",
      agentId,
      chatId: binding.chat_id,
      platform: binding.channel_kind,
      ts: new Date().toISOString(),
    });

    const reseedJobs = db.listJobs(bindingId, this.opts.reseedJobCount ?? 10);
    const reseedBlock = buildReseedBlock(reseedJobs.filter((j) => j.id !== jobId));

    let result: TurnResult;
    const startedAt = Date.now();
    try {
      result = await runTurn({
        // Binding row wins: /cwd steers exec per chat. req.workdir is defense
        // only — workdir is NOT NULL and no writer produces an empty string.
        workdir: binding.workdir || req.workdir,
        prompt: req.text,
        threadId: binding.thread_id,
        model: bindingModel ?? agentModel ?? this.opts.model ?? null,
        effort: bindingEffort ?? agentEffort,
        codexBin: this.opts.codexBin,
        fullAccess: true,
        timeoutMs: this.opts.timeoutMs,
        onEvent: req.onEvent,
        register: (child) => this.registerChild(bindingId, child),
        reseedBlock,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      db.updateJob(jobId, { state: "error", error: message, ended_at: new Date().toISOString() });
      db.setBindingStatus(bindingId, "idle");
      this.recordError(agentId, message);
      return { ok: false, error: message };
    }

    // Skip the thread persist when the binding's workdir changed mid-turn
    // (/cwd during a running turn clears the thread; re-persisting the old
    // thread would resume an old-cwd conversation inside the new cwd).
    const fresh = db.getBinding(bindingId);
    if (result.threadId && fresh && fresh.workdir === binding.workdir) {
      db.setBindingThread(bindingId, result.threadId);
    }
    db.setBindingStatus(bindingId, "idle");

    if (result.ok) {
      const durationMs = Date.now() - startedAt;
      db.updateJob(jobId, {
        state: "done",
        thread_id: result.threadId ?? undefined,
        result_preview: result.text,
        ended_at: new Date().toISOString(),
      });
      this.opts.metrics?.recordTurnComplete(agentId, durationMs);
      this.opts.events?.log({
        type: "turn_complete",
        agentId,
        durationMs,
        ts: new Date().toISOString(),
      });
      return { ok: true, text: result.text, threadId: result.threadId };
    }

    db.updateJob(jobId, {
      state: "error",
      thread_id: result.threadId ?? undefined,
      error: result.error ?? "unknown error",
      ended_at: new Date().toISOString(),
    });
    this.recordError(agentId, result.error ?? "unknown error");
    return { ok: false, error: result.error ?? "unknown error", threadId: result.threadId };
  }

  private async ensureApproved(
    bindingId: number,
    jobId: number,
    req: IncomingRequest,
    fullAccess: number,
  ): Promise<{ ok: true } | { ok: false; result: IncomingResult }> {
    if (fullAccess === 1 || req.approvalBypass === true) return { ok: true };

    const binding = this.opts.db.getBinding(bindingId);
    if (!binding) return { ok: false, result: { ok: false, error: "binding vanished" } };

    const promptHash = createHash("sha256")
      .update(`${bindingId}\0${binding.workdir}\0${req.text}`)
      .digest("hex")
      .slice(0, 16);
    const approval = this.approvals.request({ bindingId, promptHash, workdir: binding.workdir });
    const approvalWait = this.approvals.wait(approval.id);
    this.opts.db.updateJob(jobId, { state: "approval", started_at: new Date().toISOString() });

    try {
      await req.onApprovalRequest?.(approval);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.approvals.resolve(approval.id, "deny");
      this.opts.db.updateJob(jobId, { state: "error", error: message, ended_at: new Date().toISOString() });
      this.opts.db.setBindingStatus(bindingId, "idle");
      this.recordError(binding.agent_id, message);
      return { ok: false, result: { ok: false, error: message } };
    }

    const outcome = await approvalWait;
    if (outcome.decision === "deny") {
      const message = outcome.timedOut ? `Approval ${approval.id} timed out.` : `Approval ${approval.id} denied.`;
      this.opts.db.updateJob(jobId, { state: "error", error: message, ended_at: new Date().toISOString() });
      this.opts.db.setBindingStatus(bindingId, "idle");
      return { ok: false, result: { ok: false, error: message } };
    }

    if (outcome.decision === "allow-always" && binding.agent_id !== null) {
      this.opts.db.updateAgent(binding.agent_id, { full_access: 1 });
      this.opts.events?.log({
        type: "lifecycle",
        payload: { action: "reload", detail: `approval ${approval.id} enabled full_access` },
        ts: new Date().toISOString(),
      });
    }
    return { ok: true };
  }

  private recordError(agentId: number | null, message: string): void {
    this.opts.metrics?.recordError(agentId);
    this.opts.events?.log({ type: "error", agentId, message, ts: new Date().toISOString() });
  }
}
