/**
 * agent-service.ts — db + queue + runner glue (messenger-bridge Phase 2).
 *
 * The adapters (Phase 3/4) and connect API (Phase 5) call handleIncoming: it
 * resolves the chat's binding, logs a job, serializes the turn per binding, runs
 * Codex with the binding's remembered thread, persists the new thread id, and
 * records the outcome. Active children are tracked so a serve shutdown can
 * terminate them (A-audit Phase 2 finding 5).
 */


import { SerialQueues, QueueFullError } from "./queue.js";
import { runTurn,                                   } from "./runner.js";





























/** Build a summarized history block from recent jobs for the resume re-seed. */
export function buildReseedBlock(jobs          )         {
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
          queues              ;
          children = new Set              ();
          opts                     ;

  constructor(opts                     ) {
    this.opts = opts;
    this.queues = new SerialQueues(opts.queueCap ?? 20);
  }

          register = (child              )               => {
    this.children.add(child);
    return () => this.children.delete(child);
  };

  /** Terminate every in-flight Codex child (called on serve shutdown). */
  shutdown()       {
    for (const child of this.children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    }
    this.children.clear();
  }

  async handleIncoming(req                 )                          {
    const { db } = this.opts;
    const binding =
      req.agentId !== undefined
        ? db.getOrCreateAgentBinding(req.agentId, req.kind, req.chatId, req.workdir)
        : db.getOrCreateBinding(req.kind, req.chatId, req.workdir);
    const jobId = db.createJob(binding.id, req.text);

    let enqueued;
    try {
      enqueued = this.queues.enqueue(String(binding.id), () => this.runOne(binding.id, jobId, req));
    } catch (err) {
      if (err instanceof QueueFullError) {
        db.updateJob(jobId, { state: "error", error: err.message });
        return { ok: false, error: err.message };
      }
      throw err;
    }

    const queuedAhead = enqueued.position;
    const result = await enqueued.result;
    return { ...result, queued: queuedAhead > 0 ? queuedAhead : undefined };
  }

          async runOne(bindingId        , jobId        , req                 )                          {
    const { db } = this.opts;
    const binding = db.getBinding(bindingId);
    if (!binding) return { ok: false, error: "binding vanished" };

    db.setBindingStatus(bindingId, "running");
    db.updateJob(jobId, { state: "running", started_at: new Date().toISOString() });

    const reseedJobs = db.listJobs(bindingId, this.opts.reseedJobCount ?? 10);
    const reseedBlock = buildReseedBlock(reseedJobs.filter((j) => j.id !== jobId));

    // Card settings are read FRESH per turn (never cached at adapter start), so
    // a model/effort change on the agent card applies to the very next turn.
    const agent = binding.agent_id !== null ? db.getAgent(binding.agent_id) : null;
    const agentModel = agent && agent.model !== "default" ? agent.model : null;
    const agentEffort = agent && agent.effort !== "default" ? agent.effort : null;

    let result            ;
    try {
      result = await runTurn({
        workdir: req.workdir,
        prompt: req.text,
        threadId: binding.thread_id,
        model: req.model ?? agentModel ?? this.opts.model ?? null,
        effort: agentEffort,
        codexBin: this.opts.codexBin,
        fullAccess: true,
        timeoutMs: this.opts.timeoutMs,
        onEvent: req.onEvent,
        register: this.register,
        reseedBlock,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      db.updateJob(jobId, { state: "error", error: message, ended_at: new Date().toISOString() });
      db.setBindingStatus(bindingId, "idle");
      return { ok: false, error: message };
    }

    if (result.threadId) db.setBindingThread(bindingId, result.threadId);
    db.setBindingStatus(bindingId, "idle");

    if (result.ok) {
      db.updateJob(jobId, {
        state: "done",
        thread_id: result.threadId ?? undefined,
        result_preview: result.text,
        ended_at: new Date().toISOString(),
      });
      return { ok: true, text: result.text, threadId: result.threadId };
    }

    db.updateJob(jobId, {
      state: "error",
      thread_id: result.threadId ?? undefined,
      error: result.error ?? "unknown error",
      ended_at: new Date().toISOString(),
    });
    return { ok: false, error: result.error ?? "unknown error", threadId: result.threadId };
  }
}
