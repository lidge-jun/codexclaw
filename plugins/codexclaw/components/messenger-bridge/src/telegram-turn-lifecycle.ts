import type { TelegramApi, TgMessage } from "./telegram-api.ts";

export type TelegramTurnLifecycleState =
  | "preflighting"
  | "owned"
  | "preExisting"
  | "skipped"
  | "finished";

export interface TelegramTurnLifecycleLease {
  finish(): Promise<void>;
}

export interface TelegramTurnLifecycleManager {
  begin(msg: TgMessage): TelegramTurnLifecycleLease;
  cleanupAll(): Promise<void>;
}

interface LeaseRecord {
  chatId: number;
  messageId: number;
  state: TelegramTurnLifecycleState;
  attempt: Promise<void> | null;
  finishPromise: Promise<void> | null;
}

export function createTelegramTurnLifecycleManager({
  api,
  log = () => {},
}: {
  api: TelegramApi;
  log?: (line: string) => void;
}): TelegramTurnLifecycleManager {
  const chats = new Map<string, LeaseRecord[]>();
  let closed = false;
  let cleanupPromise: Promise<void> | null = null;

  function logFailure(operation: string, lease: LeaseRecord, detail: unknown): void {
    log(`[tg] lifecycle ${operation} failed ${lease.chatId}/${lease.messageId}: ${String(detail)}`);
  }

  async function activate(lease: LeaseRecord): Promise<void> {
    if (closed || lease.state === "finished") return;
    lease.state = "preflighting";
    let chat;
    try {
      chat = await api.getChat(lease.chatId);
    } catch (err) {
      lease.state = "skipped";
      logFailure("preflight", lease, err instanceof Error ? err.message : err);
      return;
    }
    if (!chat.ok || !chat.result) {
      lease.state = "skipped";
      logFailure("preflight", lease, chat.description ?? chat.error_code ?? "ambiguous response");
      return;
    }
    const pinnedId = chat.result.pinned_message?.message_id;
    if (pinnedId === lease.messageId) {
      lease.state = "preExisting";
      return;
    }
    if (pinnedId !== undefined) {
      lease.state = "skipped";
      return;
    }
    let pinned;
    try {
      pinned = await api.pinChatMessage({
        chatId: lease.chatId,
        messageId: lease.messageId,
        disableNotification: true,
      });
    } catch (err) {
      lease.state = "skipped";
      logFailure("pin", lease, err instanceof Error ? err.message : err);
      return;
    }
    if (pinned.ok && pinned.result === true) {
      lease.state = "owned";
    } else {
      lease.state = "skipped";
      logFailure("pin", lease, pinned.description ?? pinned.error_code ?? "unsuccessful response");
    }
  }

  function promote(chatKey: string): void {
    const queue = chats.get(chatKey);
    if (!queue) return;
    while (queue[0]?.state === "finished") queue.shift();
    if (queue.length === 0) {
      chats.delete(chatKey);
      return;
    }
    if (!closed && queue[0]?.attempt === null) {
      const next = queue[0];
      next.attempt = activate(next);
    }
  }

  async function finishLease(lease: LeaseRecord): Promise<void> {
    if (lease.state === "finished") return;
    const chatKey = String(lease.chatId);
    const queue = chats.get(chatKey);
    if (queue?.[0] !== lease) {
      lease.state = "finished";
      if (queue) promote(chatKey);
      return;
    }
    await lease.attempt;
    if (lease.state === "owned") {
      try {
        const unpinned = await api.unpinChatMessage(lease.chatId, lease.messageId);
        if (!unpinned.ok || unpinned.result !== true) {
          logFailure("unpin", lease, unpinned.description ?? unpinned.error_code ?? "unsuccessful response");
        }
      } catch (err) {
        logFailure("unpin", lease, err instanceof Error ? err.message : err);
      }
    }
    lease.state = "finished";
    promote(chatKey);
  }

  function begin(msg: TgMessage): TelegramTurnLifecycleLease {
    const lease: LeaseRecord = {
      chatId: msg.chat.id,
      messageId: msg.message_id,
      state: closed ? "finished" : "skipped",
      attempt: null,
      finishPromise: null,
    };
    if (!closed) {
      const chatKey = String(lease.chatId);
      const queue = chats.get(chatKey) ?? [];
      queue.push(lease);
      chats.set(chatKey, queue);
      if (queue.length === 1) lease.attempt = activate(lease);
    }
    return {
      finish() {
        lease.finishPromise ??= finishLease(lease);
        return lease.finishPromise;
      },
    };
  }

  function cleanupAll(): Promise<void> {
    if (cleanupPromise) return cleanupPromise;
    closed = true;
    cleanupPromise = (async () => {
      const active: LeaseRecord[] = [];
      for (const queue of chats.values()) {
        const [head, ...pending] = queue;
        for (const lease of pending) lease.state = "finished";
        if (head && head.state !== "finished") active.push(head);
      }
      await Promise.all(active.map((lease) => {
        lease.finishPromise ??= finishLease(lease);
        return lease.finishPromise;
      }));
      chats.clear();
    })();
    return cleanupPromise;
  }

  return { begin, cleanupAll };
}
