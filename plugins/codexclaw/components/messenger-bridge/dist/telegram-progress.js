/** Shared attended-turn progress lifecycle for Telegram polling and webhooks. */


import { createDraftProgressState, sendDraftProgress } from "./telegram-rich-send.js";

export const TELEGRAM_PROGRESS_EDIT_MS = 2_000;
const TELEGRAM_TYPING_REFRESH_MS = 4_000;
const TELEGRAM_PROGRESS_MAX_CHARS = 4_095;
const TELEGRAM_ACTIVITY_LINES = 5;
const TELEGRAM_THINKING_MAX_CHARS = 300;






























const defaultDeps                       = {
  now: Date.now,
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle                                 ),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle                                  ),
};

export function createTelegramTurnProgress(options                             )                       {
  const deps = options.deps ?? defaultDeps;
  const log = options.log ?? (() => {});
  const draftLane = options.chatType === "private" && options.richSupported;
  const draftState = createDraftProgressState();
  const activity           = [];
  let latestAssistantText = "";
  let started = false;
  let finished = false;
  let typingTimer         ;
  let flushTimer         ;
  let statusMessageId                = null;
  let statusCreation                       = null;
  let inFlightFlush                       = null;
  let pendingSnapshot                = null;
  let lastEditAt                = null;
  let suspendedUntil = 0;

  const report = (step        , err         ) => {
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

  async function start()                {
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

  function onEvent(event             )       {
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

  function queueRenderedProgress()       {
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

  function scheduleFlush()       {
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

  function beginFlush()       {
    if (finished || statusMessageId === null || inFlightFlush || pendingSnapshot === null) return;
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    lastEditAt = deps.now();
    inFlightFlush = flushSnapshot(statusMessageId, snapshot).finally(() => {
      inFlightFlush = null;
      if (!finished && pendingSnapshot !== null) scheduleFlush();
    });
  }

  async function flushSnapshot(messageId        , snapshot        )                {
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

  async function finish()                {
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



function isActivityEvent(event             )                         {
  return event.kind === "status" || event.kind === "thinking" || event.kind === "tool_call" || event.kind === "file_change";
}

function activityLine(event               , mode                                               )         {
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

function renderProgress(latest        , activity          , statusLane         )         {
  const sections           = [];
  if (latest) sections.push(`Latest\n${latest}`);
  if (activity.length > 0) sections.push(`Activity\n${activity.join("\n")}`);
  const body = [statusLane ? "🔄 Working…" : "", sections.join("\n\n")].filter(Boolean).join("\n\n");
  return body.slice(0, TELEGRAM_PROGRESS_MAX_CHARS);
}

function isNotModified(description                    )          {
  return /message is not modified|not modified/i.test(description ?? "");
}
