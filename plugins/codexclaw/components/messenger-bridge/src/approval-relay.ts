import type { InlineKeyboard } from "./telegram-commands.ts";
import { encodeCallback } from "./telegram-interactive.ts";
import type { ActionRow } from "./discord-components.ts";
import { buildApprovalCard } from "./discord-components.ts";
import type { DiscordEmbed } from "./discord-api.ts";

export type ApprovalDecision = "allow-once" | "allow-always" | "deny";
export type ApprovalOutcome =
  | { decision: ApprovalDecision; timedOut: false }
  | { decision: "deny"; timedOut: true };

export interface ApprovalRequest {
  id: string;
  bindingId: number;
  promptHash: string;
  workdir: string;
  expiresAt: number;
}

export interface ApprovalRequestInput {
  bindingId: number;
  promptHash: string;
  workdir: string;
}

export interface ApprovalStoreOptions {
  now?: () => number;
  idFactory?: () => string;
  autoExpire?: boolean;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface ApprovalStore {
  pending: Map<string, ApprovalRequest>;
  request(req: ApprovalRequestInput): ApprovalRequest;
  resolve(id: string, decision: ApprovalDecision): ApprovalRequest | null;
  cleanup(now?: number): ApprovalRequest[];
  wait(id: string): Promise<ApprovalOutcome>;
  registerCleanup(
    id: string,
    cleanup: (request: ApprovalRequest, outcome: ApprovalOutcome) => void | Promise<void>,
  ): boolean;
}

const DEFAULT_TIMEOUT_MS = 600_000;

export function createApprovalStore(timeoutMs = DEFAULT_TIMEOUT_MS, opts: ApprovalStoreOptions = {}): ApprovalStore {
  const pending = new Map<string, ApprovalRequest>();
  const waiters = new Map<string, (outcome: ApprovalOutcome) => void>();
  const cleanups = new Map<string, Array<(request: ApprovalRequest, outcome: ApprovalOutcome) => void | Promise<void>>>();
  const timers = new Map<string, unknown>();
  const now = opts.now ?? Date.now;
  let seq = 0;
  const idFactory = opts.idFactory ?? (() => `ap_${(++seq).toString(36)}`);
  const setTimer = opts.setTimer ?? ((callback: () => void, ms: number) => {
    const timer = setTimeout(callback, ms);
    timer.unref?.();
    return timer;
  });
  const clearTimer = opts.clearTimer ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));

  const settle = (request: ApprovalRequest, outcome: ApprovalOutcome): void => {
    pending.delete(request.id);
    const timer = timers.get(request.id);
    if (timer) clearTimer(timer);
    timers.delete(request.id);
    waiters.get(request.id)?.(outcome);
    waiters.delete(request.id);
    const callbacks = cleanups.get(request.id) ?? [];
    cleanups.delete(request.id);
    for (const cleanup of callbacks) {
      void Promise.resolve(cleanup(request, outcome)).catch(() => {});
    }
  };

  return {
    pending,
    request(input: ApprovalRequestInput): ApprovalRequest {
      const id = idFactory();
      const request: ApprovalRequest = {
        id,
        bindingId: input.bindingId,
        promptHash: input.promptHash,
        workdir: input.workdir,
        expiresAt: now() + timeoutMs,
      };
      pending.set(id, request);
      if (opts.autoExpire !== false) {
        timers.set(id, setTimer(() => {
          const current = pending.get(id);
          if (current) settle(current, { decision: "deny", timedOut: true });
        }, Math.max(0, request.expiresAt - now())));
      }
      return request;
    },
    resolve(id: string, decision: ApprovalDecision): ApprovalRequest | null {
      const request = pending.get(id);
      if (!request) return null;
      settle(request, { decision, timedOut: false });
      return request;
    },
    cleanup(at = now()): ApprovalRequest[] {
      const expired: ApprovalRequest[] = [];
      for (const request of pending.values()) {
        if (request.expiresAt > at) continue;
        expired.push(request);
      }
      for (const request of expired) {
        settle(request, { decision: "deny", timedOut: true });
      }
      return expired;
    },
    wait(id: string): Promise<ApprovalOutcome> {
      if (!pending.has(id)) return Promise.resolve({ decision: "deny", timedOut: true });
      return new Promise((resolve) => {
        waiters.set(id, resolve);
      });
    },
    registerCleanup(
      id: string,
      cleanup: (request: ApprovalRequest, outcome: ApprovalOutcome) => void | Promise<void>,
    ): boolean {
      if (!pending.has(id)) return false;
      const callbacks = cleanups.get(id) ?? [];
      callbacks.push(cleanup);
      cleanups.set(id, callbacks);
      return true;
    },
  };
}

export function formatApprovalForTelegram(req: ApprovalRequest): { text: string; keyboard: InlineKeyboard } {
  return {
    text: [
      "Approval required before Codex can run.",
      `id: ${req.id}`,
      `prompt: ${req.promptHash}`,
      `cwd: ${req.workdir}`,
      `fallback: /approve ${req.id} allow-once`,
    ].join("\n"),
    keyboard: [
      [
        {
          text: "Allow once",
          callback_data: encodeCallback({ type: "approve", payload: `${req.id}:allow-once` }),
        },
        {
          text: "Allow always",
          callback_data: encodeCallback({ type: "approve", payload: `${req.id}:allow-always` }),
        },
      ],
      [
        {
          text: "Deny",
          callback_data: encodeCallback({ type: "deny", payload: `${req.id}:deny` }),
        },
      ],
    ],
  };
}

export function formatApprovalForDiscord(
  req: ApprovalRequest,
  disabled = false,
): { embeds: DiscordEmbed[]; components: ActionRow[] } {
  return buildApprovalCard({
    id: req.id,
    promptHash: req.promptHash,
    workdir: req.workdir,
    disabled,
  });
}
