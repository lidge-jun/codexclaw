/**
 * discord-adapter.ts — Discord bridge over the gateway + REST (Phase 4).
 *
 * Same contract as the Telegram adapter: gate each message (own-bot skip →
 * allowlist → non-empty), run it through the Phase 2 AgentService, and reply.
 * Discord has no cheap message-edit status UX like Telegram, so progress is a
 * single typing trigger + the final chunked answer. A `!start` message pairs a
 * channel when a handshake window is open (Discord bots can't see a native
 * /start, so we use a text trigger).
 *
 * v4 agent scoping: with `agent` set, handshake/allowlist/bindings are scoped to
 * that agent, and guild messages honor the agent's mention_only toggle (mention
 * = `<@botId>` or nickname form `<@!botId>`, from the gateway READY user id).
 */

import { formatApprovalForDiscord,                      } from "./approval-relay.js";


import { performance } from "node:perf_hooks";
import {
  DiscordApi,


} from "./discord-api.js";
import {
  DiscordGateway,


} from "./discord-gateway.js";
import { registerGlobalCommands as registerDiscordCommands } from "./discord-commands.js";
import { buildStatusEmbed } from "./discord-components.js";
import { handleInteraction,                  } from "./discord-interactions.js";
import { buildHelpEntries, dispatchGatewayCommand } from "./gateway-commands.js";
import { cleanupTmpMedia, downloadDiscordAttachment } from "./media-handler.js";
import { sendFormattedDiscordOutput } from "./output-formatter.js";





















const START_TRIGGER = "!cxc start";
const GATEWAY_TEXT_COMMANDS = new Set([
  "status", "context", "new", "reset", "cwd", "model", "effort", "mode",
  "stop", "retry", "approve", "sessions", "jobs", "agent",
]);
const DISCORD_PROGRESS_EDIT_MS = 1_200;

export function createDiscordAdapter(opts                       )                 {
  const api = new DiscordApi(opts.token, opts.fetchImpl);
  const log = opts.log ?? (() => {});
  const nowMs = opts.now ?? (() => performance.now());
  const agentId = opts.agent?.id ?? null;
  let gateway                        = null;
  let applicationId                = null;
  let registeredApplicationId                = null;
  let registrationPromise                       = null;
  let warnedNoBotId = false;
  let paused = false;
  // Bounded dedupe of recently-seen message ids — the gateway can redeliver a
  // MESSAGE_CREATE on RESUME, and a full-permission exec must not run twice
  // (security review finding 4).
  const seenIds = new Set        ();
  const seenOrder           = [];

  const isAllowedChat = (channelId        ) =>
    agentId === null ? opts.db.isAllowed("discord", channelId) : opts.db.isAgentAllowed(agentId, channelId);
  const isHandshakeOpen = () =>
    agentId === null ? opts.db.isHandshakeOpen("discord") : opts.db.isAgentHandshakeOpen(agentId);
  const admitChannel = (channelId        ) => {
    if (agentId === null) {
      opts.db.addAllowlist("discord", channelId, "");
      opts.db.closeHandshake("discord");
    } else {
      opts.db.addAgentAllowlist(agentId, channelId, "");
      opts.db.closeAgentHandshake(agentId);
    }
  };
  const admitThreadChannel = (channelId        ) => {
    if (agentId === null) opts.db.addAllowlist("discord", channelId, "task-thread");
    else opts.db.addAgentAllowlist(agentId, channelId, "task-thread");
  };
  /** Legacy has no mention gate on Discord; agents follow the live card toggle. */
  const mentionRequired = () =>
    agentId === null ? false : (opts.db.getAgent(agentId)?.mention_only ?? 1) === 1;

  /** Thread mode: legacy always uses threads; agents follow the live card toggle. */
  const isThreadMode = () =>
    agentId === null ? true : (opts.db.getAgent(agentId)?.thread_mode ?? "thread") === "thread";
  async function resolveApplicationId()                         {
    const readyAppId = gateway?.applicationId() ?? null;
    if (readyAppId) {
      applicationId = readyAppId;
      return readyAppId;
    }
    if (applicationId) return applicationId;
    const me = await api.getMe();
    if (me.ok && me.data?.id) {
      // Fallback only: READY application.id wins as soon as the gateway provides it.
      applicationId = me.data.id;
      return applicationId;
    }
    log(`[discord] application id unavailable: ${me.error ?? me.status}`);
    return null;
  }

  function ensureCommandsRegistered(source                            )       {
    if (registrationPromise) return;
    registrationPromise = (async () => {
      const appId = await resolveApplicationId();
      if (!appId || registeredApplicationId === appId) return;
      await registerDiscordCommands(api, appId);
      registeredApplicationId = appId;
      log(`[discord] global commands registered via ${source}`);
    })().catch((err) => {
      log(`[discord] command registration failed: ${(err         ).message}`);
    }).finally(() => {
      registrationPromise = null;
      const readyAppId = gateway?.applicationId() ?? null;
      if (readyAppId && readyAppId !== registeredApplicationId) {
        applicationId = readyAppId;
        ensureCommandsRegistered("READY");
      }
    });
  }

  async function rejectInteraction(interaction             , content        )                {
    await api.createInteractionResponse(interaction.id, interaction.token, {
      type: 4,
      data: { content, flags: 64 },
    });
  }

  async function deferNativeInteraction(interaction             )                   {
    if (interaction.type !== 2 && interaction.type !== 3) return false;
    await api.createInteractionResponse(interaction.id, interaction.token, { type: 5 });
    return true;
  }

  async function handleNativeInteraction(interaction             )                {
    if (interaction.type === 1) {
      await handleInteraction(interaction, {
        db: opts.db,
        agentService: opts.agentService,
        api,
        applicationId: applicationId ?? "0",
        workdir: opts.workdir,
        agentId,
        log,
      });
      return;
    }
    if (!interaction.channel_id || !isAllowedChat(interaction.channel_id)) {
      await rejectInteraction(interaction, "codexclaw: connect this channel first with !cxc start.");
      return;
    }
    const deferred = await deferNativeInteraction(interaction);
    const appId = await resolveApplicationId();
    if (!appId) {
      if (!deferred) {
        await rejectInteraction(interaction, "codexclaw: Discord application id is not available yet.");
      } else {
        log("[discord] deferred interaction but Discord application id is unavailable");
      }
      return;
    }
    await handleInteraction(interaction, {
      db: opts.db,
      agentService: opts.agentService,
      api,
      applicationId: appId,
      workdir: opts.workdir,
      agentId,
      deferred,
      log,
    });
  }

  function alreadySeen(id        )          {
    if (!id) return false;
    if (seenIds.has(id)) return true;
    seenIds.add(id);
    seenOrder.push(id);
    if (seenOrder.length > 512) {
      const evicted = seenOrder.shift();
      if (evicted) seenIds.delete(evicted);
    }
    return false;
  }

  /** Guild-channel mention gate + strip. Returns null when gated out. */
  function gateAndStripMention(msg                     , text        )                {
    const agent = agentId !== null ? opts.db.getAgent(agentId) : null;
    const prefix = agent?.trigger_prefix;
    if (prefix && text.startsWith(prefix)) {
      return text.slice(prefix.length).trim();
    }

    if (!msg.guildId) return text; // DMs always respond
    const botId = gateway?.botUserId() ?? null;
    if (!botId) {
      // READY payload lacked the user id — cannot detect mentions; respond-all
      // (documented fallback, audit rev-2 fix #2) and say so once.
      if (mentionRequired() && !warnedNoBotId) {
        warnedNoBotId = true;
        log("[discord] mention_only is on but the bot user id is unknown — responding to all messages");
      }
      return text;
    }
    // Nickname mentions arrive as <@!id> (audit rev-2 fix #3).
    const hasMention = new RegExp(`<@!?${botId}>`).test(text);
    if (mentionRequired() && !hasMention) return null;
    return text.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
  }

  function parseDiscordCommand(text        )                                           {
    const match = /^!cxc\s+(\S+)(?:\s+([\s\S]*))?$/.exec(text);
    if (!match) return null;
    const command = match[1].toLowerCase();
    if (command === "start") return null;
    return { command, args: (match[2] ?? "").trim() };
  }

  function getBinding(channelId        ) {
    return agentId !== null
      ? opts.db.getOrCreateAgentBinding(agentId, "discord", channelId, opts.workdir)
      : opts.db.getOrCreateBinding("discord", channelId, opts.workdir);
  }

  async function handleCommand(channelId        , command        , args        )                {
    if (GATEWAY_TEXT_COMMANDS.has(command)) {
      await handleGatewayTextCommand(channelId, command, args);
      return;
    }

    if (command === "kick") {
      if (agentId !== null) opts.db.removeAgentAllowlist(agentId, channelId);
      else opts.db.removeAllowlist("discord", channelId);
      await api.sendMessage(channelId, "Chat removed from allowlist.");
      return;
    }

    if (command === "pause") {
      paused = true;
      await api.sendMessage(channelId, "Paused — messages will be ignored until !cxc resume.");
      return;
    }

    if (command === "resume") {
      paused = false;
      await api.sendMessage(channelId, "Resumed — messages will be processed.");
      return;
    }

    if (command === "help") {
      // Unified help: Discord text (!cxc) commands merged from gateway + DC-only
      const dcTextOnly = [
        { name: "start", description: "Connect this channel" },
        { name: "pause", description: "Pause message processing" },
        { name: "resume", description: "Resume message processing" },
        { name: "kick", description: "Remove this channel from allowlist" },
      ];
      const entries = buildHelpEntries("discord", dcTextOnly);
      const lines = entries.map((e) => `!cxc ${e.name}${e.args ? " " + e.args : ""} — ${e.description}`);
      await api.sendMessage(channelId, lines.join("\n"));
    }
  }

  async function handleGatewayTextCommand(channelId        , command        , args        )                {
    const binding = getBinding(channelId);
    if (command !== "retry") {
      const result = await dispatchGatewayCommand(command, {
        bindingId: binding.id,
        db: opts.db,
        agentService: opts.agentService,
        agentId,
        args,
        defaultWorkdir: opts.workdir,
        onApprovalRequest: (request) => sendApprovalRequest(channelId, request),
      });
      await api.sendMessage(channelId, result?.text ?? "Unknown bridge command.");
      return;
    }

    const progress = createProgressWindow(channelId);
    await progress.start();
    let outcome                                  = { ok: false, error: "Retry did not complete." };
    try {
      const result = await dispatchGatewayCommand(command, {
        bindingId: binding.id,
        db: opts.db,
        agentService: opts.agentService,
        agentId,
        args,
        defaultWorkdir: opts.workdir,
        onApprovalRequest: (request) => sendApprovalRequest(channelId, request),
        onEvent: progress.onEvent,
      });
      outcome = {
        ok: result?.data?.ok === undefined ? true : result.data.ok === true,
        error: typeof result?.data?.error === "string" ? result.data.error : undefined,
      };
      const sent = await api.sendMessage(channelId, result?.text ?? "Unknown bridge command.");
      if (!sent.ok) outcome = { ok: false, error: sent.error ?? "Failed to send retry result." };
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
      throw err;
    } finally {
      await progress.finish(outcome);
    }
  }

  async function replyChannelForMessage(msg                     , text        )                                                       {
    if (!msg.guildId) return { channelId: msg.channelId, autoCreated: false };
    // plain mode: reply in the origin channel, skip thread creation + admitThreadChannel.
    if (!isThreadMode()) return { channelId: msg.channelId, autoCreated: false };
    const thread = await api.startThread(msg.channelId, threadName(text), msg.id);
    if (thread.ok && thread.data?.id) {
      admitThreadChannel(thread.data.id);
      return { channelId: thread.data.id, autoCreated: true };
    }
    log(`[discord] thread start failed ${msg.channelId}: ${thread.error ?? thread.status}`);
    return { channelId: msg.channelId, autoCreated: false };
  }

  async function sendTurnResult(channelId        , result                                                )                {
    if (result.ok && result.text) {
      await sendFormattedDiscordOutput(api, channelId, result.text, log);
      return;
    }
    await api.sendMessage(channelId, `Error: ${result.error ?? "no response"}`);
  }

  async function downloadAttachmentPrefixes(msg                     )                                                      {
    const prefixes           = [];
    const tempDirs           = [];
    for (const attachment of msg.attachments) {
      try {
        const downloaded = await downloadDiscordAttachment(attachment, { fetchImpl: opts.fetchImpl });
        tempDirs.push(downloaded.tempDir);
        prefixes.push(`[File: ${downloaded.path}]`);
      } catch (err) {
        log(`[discord] attachment download failed ${attachment.id || attachment.filename}: ${(err         ).message}`);
      }
    }
    return { prefixes, tempDirs };
  }

  function createProgressWindow(channelId        ) {
    let messageId                = null;
    let lastEditAt = 0;
    let creating                       = null;

    const start = async () => {
      if (!creating) {
        creating = api
          .sendEmbed(channelId, "", [progressEmbed("Working", "Starting turn.")])
          .then((res) => {
            if (res.ok && res.data?.id) messageId = res.data.id;
          })
          .finally(() => {
            creating = null;
          });
      }
      await creating;
    };

    const edit = async (stage        , detail        , force = false, state                                  = "running") => {
      await start();
      if (!messageId) return;
      const now = nowMs();
      if (!force && lastEditAt > 0 && now - lastEditAt < DISCORD_PROGRESS_EDIT_MS) return;
      lastEditAt = now;
      const res = await api.editMessage(channelId, messageId, "", [progressEmbed(stage, detail, state)]);
      if (!res.ok) log(`[discord] progress edit failed ${channelId}: ${res.error ?? res.status}`);
    };

    return {
      start,
      onEvent(event             ) {
        const progress = progressFromEvent(event);
        if (progress) void edit(progress.stage, progress.detail);
      },
      finish(result                                 ) {
        return edit(
          result.ok ? "Done" : "Error",
          result.ok ? "Final answer sent as a fresh message." : result.error ?? "No response.",
          true,
          result.ok ? "success" : "error",
        );
      },
    };
  }

  async function handleMessage(msg                     )                {
    if (msg.isBot) return; // never react to bots (incl. our own echoes)
    if (alreadySeen(msg.id)) return; // duplicate gateway delivery
    const channelId = msg.channelId;
    const rawText = msg.content.trim();

    if (rawText === START_TRIGGER) {
      await handleStart(channelId);
      return;
    }
    if (!isAllowedChat(channelId)) return; // silent ignore

    const rawCmd = parseDiscordCommand(rawText);
    if (rawCmd) {
      await handleCommand(channelId, rawCmd.command, rawCmd.args);
      return;
    }
    if (paused) return;

    let text = gateAndStripMention(msg, rawText);
    if (text === null) return;

    const cmd = text ? parseDiscordCommand(text) : null;
    if (cmd) {
      await handleCommand(channelId, cmd.command, cmd.args);
      return;
    }
    if (paused) return;

    if (msg.messageReference) {
      text = `[replying to a previous message] ${text}`;
    }

    let mediaTempDirs           = [];
    try {
      const media = await downloadAttachmentPrefixes(msg);
      mediaTempDirs = media.tempDirs;
      text = [media.prefixes.join("\n"), text.trim()].filter(Boolean).join("\n");
      if (!text.trim()) return;

      const reply = await replyChannelForMessage(msg, rawText || "attachment");
      const replyChannelId = reply.channelId;
      void api.triggerTyping(replyChannelId);
      const progress = createProgressWindow(replyChannelId);
      await progress.start();
      const result = await opts.agentService.handleIncoming({
        kind: "discord",
        chatId: replyChannelId,
        text,
        workdir: opts.workdir,
        agentId: agentId ?? undefined,
        onApprovalRequest: (request) => sendApprovalRequest(replyChannelId, request),
        onEvent: (event) => progress.onEvent(event),
      });

      await progress.finish(result);
      await sendTurnResult(replyChannelId, result);
      if (reply.autoCreated && isThreadMode()) {
        const archived = await api.archiveThread(replyChannelId);
        if (!archived.ok) log(`[discord] archive thread failed ${replyChannelId}: ${archived.error ?? archived.status}`);
      }
      if (result.ok && result.text) log(`[discord] out ${channelId}: ${result.text.slice(0, 60)}`);
    } finally {
      try {
        await cleanupTmpMedia(mediaTempDirs);
      } catch (err) {
        log(`[discord] media cleanup failed: ${(err         ).message}`);
      }
    }
  }

  async function sendApprovalRequest(channelId        , request                 )                {
    const formatted = formatApprovalForDiscord(request);
    const sent = await api.sendEmbed(channelId, "", formatted.embeds, formatted.components);
    if (sent.ok && sent.data?.id) {
      const messageId = sent.data.id;
      opts.agentService.registerApprovalCleanup(request.id, async () => {
        const disabled = formatApprovalForDiscord(request, true);
        await api.editMessage(channelId, messageId, "", disabled.embeds, disabled.components);
      });
    }
  }

  async function handleStart(channelId        )                {
    if (isAllowedChat(channelId)) {
      await api.sendMessage(channelId, "codexclaw: already connected ✅");
      return;
    }
    if (isHandshakeOpen()) {
      // Atomic close on first pair (security review finding 2).
      admitChannel(channelId);
      await api.sendMessage(channelId, "codexclaw: connected ✅ send me a message.");
      log(`[discord] handshake paired channel ${channelId}`);
    }
    // else silent (no oracle)
  }

  return {
    async start() {
      gateway = new DiscordGateway({
        token: opts.token,
        wsFactory: opts.wsFactory,
        log,
        onReady: (ready) => {
          // READY application.id is primary; getMe() only seeds a fallback before READY.
          if (ready.applicationId) applicationId = ready.applicationId;
          ensureCommandsRegistered("READY");
        },
        onInteraction: (interaction) =>
          void handleNativeInteraction(interaction).catch((err) =>
            log(`[discord] interaction error: ${(err         ).message}`),
          ),
        onMessage: (msg) =>
          void handleMessage(msg).catch((err) =>
            log(`[discord] handle error: ${(err         ).message}`),
          ),
      });
      gateway.connect();
      log("[discord] gateway connecting");
    },
    stop() {
      gateway?.stop();
      // Shared AgentService shutdown is owned by BridgeController.stop()
      // (audit rev-2 fix #1) — one agent stopping must not kill the others.
    },
    status: () => gateway?.status() ?? "idle",
  };
}

function threadName(text        )         {
  const compact = text.replace(/\s+/g, " ").trim();
  return (compact ? `cxc: ${compact}` : "cxc turn").slice(0, 100);
}

function progressEmbed(stage        , detail        , state                                  = "running")               {
  return buildStatusEmbed(state, `${stage}: ${sanitizeProgressDetail(detail)}`);
}

function progressFromEvent(event             )                                           {
  switch (event.kind) {
    case "thinking":
      return { stage: "Thinking", detail: event.text };
    case "tool_call":
      return { stage: "Coding", detail: [event.name, event.input].filter(Boolean).join(" ") };
    case "file_change":
      return { stage: "Coding", detail: `${event.action} ${event.path}` };
    case "status":
      return { stage: "Coding", detail: event.label };
    case "message":
      return { stage: "Writing", detail: event.text.slice(0, 500) };
    case "thread":
    case "done":
    case "fail":
      return null;
  }
}

function sanitizeProgressDetail(value        )         {
  return String(value || "-")
    .replace(/<@!?\d+>/g, "@user")
    .replace(/@everyone/g, "[everyone]")
    .replace(/@here/g, "[here]")
    .slice(0, 1000);
}
