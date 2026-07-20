import type { DiscordApi, DiscordApiResult, DiscordEmbed } from "./discord-api.ts";
import { buildStatusEmbed } from "./discord-components.ts";
import type { RunnerEvent } from "./runner.ts";
import type { ToolProgressFilter, ToolProgressLine } from "./tool-progress.ts";

export const DISCORD_INTERACTION_HANDOFF_MS = 14 * 60 * 1_000;
export const DISCORD_INTERACTION_PROGRESS_EDIT_MS = 1_200;

export type DiscordProgressFilterResult = "full" | "summary" | "drop" | ToolProgressLine | null;
export type DiscordProgressFilter = (event: RunnerEvent) => DiscordProgressFilterResult;

export interface DiscordInteractionProgressDeps {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface DiscordInteractionProgressOptions {
  api: DiscordApi;
  applicationId: string;
  interactionToken: string;
  channelId: string;
  guildId?: string;
  log?: (line: string) => void;
  progressFilter?: DiscordProgressFilter;
  deps?: DiscordInteractionProgressDeps;
}

export interface DiscordInteractionProgress {
  start: () => Promise<void>;
  onEvent: (event: RunnerEvent) => void;
  finish: (result: { ok: boolean; error?: string }) => Promise<void>;
}

const defaultDeps: DiscordInteractionProgressDeps = {
  now: Date.now,
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createDiscordInteractionProgress(
  options: DiscordInteractionProgressOptions,
): DiscordInteractionProgress {
  const deps = options.deps ?? defaultDeps;
  const createdAt = deps.now();
  const log = options.log ?? (() => {});
  let lane: Promise<void> = Promise.resolve();
  let handoffPromise: Promise<void> | null = null;
  let handoffTimer: unknown;
  let flushTimer: unknown;
  let channelMessageId: string | null = null;
  let pendingEmbed: DiscordEmbed | null = null;
  let lastEditAt = 0;
  let started = false;
  let closed = false;

  const report = (step: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    try {
      log(`[discord-progress] ${step} failed: ${detail}`);
    } catch {
      // Progress remains best-effort if an injected logger fails.
    }
  };

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const run = async () => {
      try {
        await operation();
      } catch (error) {
        report("mutation", error);
      }
    };
    lane = lane.then(run, run);
    return lane;
  };

  const checked = (step: string, result: DiscordApiResult<unknown>) => {
    if (!result.ok) report(step, result.error ?? `Discord error ${result.status}`);
  };

  const editTarget = async (embed: DiscordEmbed, step: string): Promise<void> => {
    if (channelMessageId) {
      const result = await options.api.editMessage(options.channelId, channelMessageId, "", [embed]);
      checked(step, result);
      return;
    }
    const result = await options.api.editOriginalInteractionResponse(
      options.applicationId,
      options.interactionToken,
      { embeds: [embed] },
    );
    checked(step, result);
  };

  const beginFlush = () => {
    if (closed || pendingEmbed === null) return;
    const embed = pendingEmbed;
    pendingEmbed = null;
    lastEditAt = deps.now();
    void enqueue(() => editTarget(embed, "progress edit")).then(() => {
      if (!closed && pendingEmbed !== null) scheduleFlush();
    });
  };

  const scheduleFlush = () => {
    if (closed || pendingEmbed === null || flushTimer !== undefined) return;
    const delay = Math.max(0, lastEditAt + DISCORD_INTERACTION_PROGRESS_EDIT_MS - deps.now());
    if (delay === 0) {
      beginFlush();
      return;
    }
    flushTimer = deps.setTimeout(() => {
      flushTimer = undefined;
      beginFlush();
    }, delay);
  };

  const beginHandoff = () => {
    handoffTimer = undefined;
    if (closed || handoffPromise) return;
    handoffPromise = enqueue(async () => {
      const created = await options.api.sendMessage(options.channelId, "Working…", { suppressNotifications: true });
      if (!created.ok || !created.data?.id) {
        report("handoff create", created.error ?? `Discord error ${created.status}`);
        return;
      }
      const messageId = created.data.id;
      const guild = options.guildId || "@me";
      const link = `https://discord.com/channels/${guild}/${options.channelId}/${messageId}`;
      const pointed = await options.api.editOriginalInteractionResponse(
        options.applicationId,
        options.interactionToken,
        { embeds: [progressEmbed("Working", `Progress moved to ${link}`)] },
      );
      checked("handoff pointer edit", pointed);
      channelMessageId = messageId;
    });
  };

  async function start(): Promise<void> {
    if (started || closed) return;
    started = true;
    handoffTimer = deps.setTimeout(beginHandoff, Math.max(0, DISCORD_INTERACTION_HANDOFF_MS - (deps.now() - createdAt)));
    lastEditAt = deps.now();
    await enqueue(() => editTarget(
      progressEmbed("Working", "Starting turn."),
      "initial edit",
    ));
  }

  function onEvent(event: RunnerEvent): void {
    if (closed) return;
    const toolFilter = typeof (options.progressFilter as ToolProgressFilter | undefined)?.reset === "function";
    const filtered = toolFilter
      ? options.progressFilter?.(event)
      : event.kind === "message" ? "full" : options.progressFilter?.(event);
    if (filtered === null || typeof filtered === "object") {
      if (!filtered) return;
      pendingEmbed = progressEmbed("Coding", filtered.text);
      scheduleFlush();
      return;
    }
    const mode = filtered ?? "full";
    if (mode === "drop") return;
    const progress = mode === "summary" ? summaryFromEvent(event) : progressFromEvent(event);
    if (!progress) return;
    pendingEmbed = progressEmbed(progress.stage, progress.detail);
    scheduleFlush();
  }

  async function finish(result: { ok: boolean; error?: string }): Promise<void> {
    if (closed) return;
    closed = true;
    (options.progressFilter as ToolProgressFilter | undefined)?.reset?.();
    try {
      if (handoffTimer !== undefined) deps.clearTimeout(handoffTimer);
    } catch (error) {
      report("handoff timer cleanup", error);
    }
    handoffTimer = undefined;
    try {
      if (flushTimer !== undefined) deps.clearTimeout(flushTimer);
    } catch (error) {
      report("flush timer cleanup", error);
    }
    flushTimer = undefined;
    pendingEmbed = null;
    if (handoffPromise) await handoffPromise;
    const terminal = result.ok
      ? progressEmbed("Done", "Final answer sent as a fresh message.", "success")
      : progressEmbed("Error", result.error ?? "No response.", "error");
    await enqueue(() => editTarget(terminal, "terminal edit"));
  }

  return { start, onEvent, finish };
}

function summaryFromEvent(event: RunnerEvent): { stage: string; detail: string } | null {
  switch (event.kind) {
    case "status":
      return { stage: "Coding", detail: "status" };
    case "thinking":
      return { stage: "Thinking", detail: "thinking" };
    case "tool_call":
      return { stage: "Coding", detail: event.name };
    case "file_change":
      return { stage: "Coding", detail: event.path };
    case "message":
      return progressFromEvent(event);
    case "thread":
    case "done":
    case "fail":
      return null;
  }
}

export function progressEmbed(
  stage: string,
  detail: string,
  state: "running" | "success" | "error" = "running",
): DiscordEmbed {
  return buildStatusEmbed(state, `${stage}: ${sanitizeProgressDetail(detail)}`);
}

export function progressFromEvent(event: RunnerEvent): { stage: string; detail: string } | null {
  switch (event.kind) {
    case "thinking": return { stage: "Thinking", detail: event.text };
    case "tool_call": return { stage: "Coding", detail: [event.name, event.input].filter(Boolean).join(" ") };
    case "file_change": return { stage: "Coding", detail: `${event.action} ${event.path}` };
    case "status": return { stage: "Coding", detail: event.label };
    case "message": return { stage: "Writing", detail: event.text.slice(0, 500) };
    case "thread":
    case "done":
    case "fail": return null;
  }
}

function sanitizeProgressDetail(value: string): string {
  return String(value || "-")
    .replace(/<@!?\d+>/g, "@user")
    .replace(/@everyone/g, "[everyone]")
    .replace(/@here/g, "[here]")
    .slice(0, 1000);
}
