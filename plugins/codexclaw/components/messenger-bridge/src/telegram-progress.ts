/** Shared attended-turn progress lifecycle for Telegram polling and webhooks. */
import type { RunnerEvent } from "./runner.ts";
import type { TelegramApi } from "./telegram-api.ts";
import { createDraftProgressState, sendDraftProgress } from "./telegram-rich-send.ts";

export const TELEGRAM_PROGRESS_EDIT_MS = 2_000;
const TELEGRAM_TYPING_REFRESH_MS = 4_000;
const TELEGRAM_PROGRESS_MAX_CHARS = 4_095;
const TELEGRAM_ACTIVITY_LINES = 5;
const TELEGRAM_THINKING_MAX_CHARS = 300;

export type TelegramProgressFilterResult = "full" | "summary" | "drop";
export type TelegramProgressFilter = (event: RunnerEvent) => TelegramProgressFilterResult;

export interface TelegramProgressDeps {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export interface TelegramTurnProgressOptions {
  api: TelegramApi;
  chatId: string | number;
  chatType: string;
  richSupported: boolean;
  messageThreadId?: number;
  draftId: number;
  progressFilter?: TelegramProgressFilter;
  deps?: TelegramProgressDeps;
  log?: (line: string) => void;
}

export interface TelegramTurnProgress {
  start: () => Promise<void>;
  onEvent: (event: RunnerEvent) => void;
  finish: () => Promise<void>;
}

const defaultDeps: TelegramProgressDeps = {
  now: Date.now,
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export function createTelegramTurnProgress(options: TelegramTurnProgressOptions): TelegramTurnProgress {
  const deps = options.deps ?? defaultDeps;
  const log = options.log ?? (() => {});
  const draftLane = options.chatType === "private" && options.richSupported;
  const draftState = createDraftProgressState();
  const activity: string[] = [];
  let latestAssistantText = "";
  let started = false;
  let finished = false;
  let typingTimer: unknown;
  let flushTimer: unknown;
  let statusMessageId: number | null = null;
  let statusCreation: Promise<void> | null = null;
  let inFlightFlush: Promise<void> | null = null;
  let pendingSnapshot: string | null = null;
  let lastEditAt: number | null = null;
  let suspendedUntil = 0;

  const report = (step: string, err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err);
    try {
      log(`[tg-progress] ${step} failed: ${detail}`);
    } catch {
      // Progress and cleanup remain best-effort even if an injected logger fails.
    }
  };

  const fireTyping = () => {
    void options.api.sendChatAction(options.chatId, options.messageThreadId).catch((err) => report("typing", err));
  };

  async function start(): Promise<void> {
    if (started || finished) return;
    started = true;
    fireTyping();
    typingTimer = deps.setInterval(fireTyping, TELEGRAM_TYPING_REFRESH_MS);
    if (draftLane) return;

    statusCreation = (async () => {
      try {
        const sent = await options.api.sendMessage({
          chatId: options.chatId,
          text: "🔄 Working…",
          messageThreadId: options.messageThreadId,
          disableNotification: true,
        });
        if (sent.ok && sent.result) {
          statusMessageId = sent.result.message_id;
          lastEditAt = deps.now();
        } else {
          report("status create", sent.description ?? `Telegram error ${sent.error_code ?? "unknown"}`);
        }
      } catch (err) {
        report("status create", err);
      }
    })();
    await statusCreation;
    if (pendingSnapshot !== null) scheduleFlush();
  }

  function onEvent(event: RunnerEvent): void {
    if (finished) return;
    if (event.kind === "message") {
      latestAssistantText = event.text.trim();
      queueRenderedProgress();
      return;
    }
    if (!isActivityEvent(event)) return;

    const mode = options.progressFilter?.(event) ?? "full";
    if (mode === "drop") return;
    const line = activityLine(event, mode);
    if (!line) return;
    const duplicate = activity.indexOf(line);
    if (duplicate !== -1) activity.splice(duplicate, 1);
    activity.push(line);
    if (activity.length > TELEGRAM_ACTIVITY_LINES) activity.splice(0, activity.length - TELEGRAM_ACTIVITY_LINES);
    queueRenderedProgress();
  }

  function queueRenderedProgress(): void {
    const snapshot = renderProgress(latestAssistantText, activity, !draftLane);
    if (draftLane) {
      void sendDraftProgress(
        {
          api: options.api,
          chatId: String(options.chatId),
          richSupported: options.richSupported,
          chatType: options.chatType,
          messageThreadId: options.messageThreadId,
        },
        options.draftId,
        snapshot,
        { state: draftState, now: deps.now },
      ).catch((err) => report("draft", err));
      return;
    }
    pendingSnapshot = snapshot;
    scheduleFlush();
  }

  function scheduleFlush(): void {
    if (finished || statusMessageId === null || inFlightFlush || pendingSnapshot === null) return;
    const now = deps.now();
    const throttleUntil = lastEditAt === null ? now : lastEditAt + TELEGRAM_PROGRESS_EDIT_MS;
    const delay = Math.max(0, throttleUntil - now, suspendedUntil - now);
    if (delay > 0) {
      if (flushTimer === undefined) {
        flushTimer = deps.setTimeout(() => {
          flushTimer = undefined;
          beginFlush();
        }, delay);
      }
      return;
    }
    beginFlush();
  }

  function beginFlush(): void {
    if (finished || statusMessageId === null || inFlightFlush || pendingSnapshot === null) return;
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    lastEditAt = deps.now();
    inFlightFlush = flushSnapshot(statusMessageId, snapshot).finally(() => {
      inFlightFlush = null;
      if (!finished && pendingSnapshot !== null) scheduleFlush();
    });
  }

  async function flushSnapshot(messageId: number, snapshot: string): Promise<void> {
    try {
      const edited = await options.api.editMessageText(options.chatId, messageId, snapshot);
      const retryAfterMs = Number(edited.parameters?.retry_after ?? 0) * 1_000;
      if (edited.error_code === 429 && retryAfterMs > 0) {
        suspendedUntil = deps.now() + retryAfterMs;
        if (pendingSnapshot === null) pendingSnapshot = snapshot;
        return;
      }
      if (!edited.ok && !isNotModified(edited.description)) {
        report("edit", edited.description ?? `Telegram error ${edited.error_code ?? "unknown"}`);
      }
    } catch (err) {
      report("edit", err);
    }
  }

  async function finish(): Promise<void> {
    finished = true;
    pendingSnapshot = null;

    try {
      if (flushTimer !== undefined) deps.clearTimeout(flushTimer);
      flushTimer = undefined;
    } catch (err) {
      report("flush timer cleanup", err);
    }

    try {
      if (typingTimer !== undefined) deps.clearInterval(typingTimer);
      typingTimer = undefined;
    } catch (err) {
      report("typing timer cleanup", err);
    }

    try {
      await statusCreation;
    } catch (err) {
      report("status creation drain", err);
    }

    try {
      await inFlightFlush;
    } catch (err) {
      report("pending edit drain", err);
    }

    if (statusMessageId !== null) {
      try {
        const deleted = await options.api.deleteMessage(options.chatId, statusMessageId);
        if (!deleted.ok) report("delete", deleted.description ?? `Telegram error ${deleted.error_code ?? "unknown"}`);
      } catch (err) {
        report("delete", err);
      }
    }
  }

  return { start, onEvent, finish };
}

type ActivityEvent = Extract<RunnerEvent, { kind: "status" | "thinking" | "tool_call" | "file_change" }>;

function isActivityEvent(event: RunnerEvent): event is ActivityEvent {
  return event.kind === "status" || event.kind === "thinking" || event.kind === "tool_call" || event.kind === "file_change";
}

function activityLine(event: ActivityEvent, mode: Exclude<TelegramProgressFilterResult, "drop">): string {
  if (mode === "summary") {
    switch (event.kind) {
      case "status": return "status";
      case "thinking": return "thinking";
      case "tool_call": return event.name.trim();
      case "file_change": return event.path.trim();
    }
  }
  switch (event.kind) {
    case "status": return event.label.trim();
    case "thinking": return event.text.trim().slice(0, TELEGRAM_THINKING_MAX_CHARS);
    case "tool_call": return [event.name, event.input].filter(Boolean).join(" ").trim();
    case "file_change": return `${event.action} ${event.path}`.trim();
  }
}

function renderProgress(latest: string, activity: string[], statusLane: boolean): string {
  const sections: string[] = [];
  if (latest) sections.push(`Latest\n${latest}`);
  if (activity.length > 0) sections.push(`Activity\n${activity.join("\n")}`);
  const body = [statusLane ? "🔄 Working…" : "", sections.join("\n\n")].filter(Boolean).join("\n\n");
  return body.slice(0, TELEGRAM_PROGRESS_MAX_CHARS);
}

function isNotModified(description: string | undefined): boolean {
  return /message is not modified|not modified/i.test(description ?? "");
}
