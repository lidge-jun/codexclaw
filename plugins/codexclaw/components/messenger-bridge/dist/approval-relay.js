
import { encodeCallback } from "./telegram-interactive.js";

import { buildApprovalCard } from "./discord-components.js";









































const DEFAULT_TIMEOUT_MS = 600_000;

export function createApprovalStore(timeoutMs = DEFAULT_TIMEOUT_MS, opts                       = {})                {
  const pending = new Map                         ();
  const waiters = new Map                                            ();
  const cleanups = new Map                                                                                             ();
  const timers = new Map                 ();
  const now = opts.now ?? Date.now;
  let seq = 0;
  const idFactory = opts.idFactory ?? (() => `ap_${(++seq).toString(36)}`);
  const setTimer = opts.setTimer ?? ((callback            , ms        ) => {
    const timer = setTimeout(callback, ms);
    timer.unref?.();
    return timer;
  });
  const clearTimer = opts.clearTimer ?? ((timer         ) => clearTimeout(timer                                 ));

  const settle = (request                 , outcome                 )       => {
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
    request(input                      )                  {
      const id = idFactory();
      const request                  = {
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
    resolve(id        , decision                  )                         {
      const request = pending.get(id);
      if (!request) return null;
      settle(request, { decision, timedOut: false });
      return request;
    },
    cleanup(at = now())                    {
      const expired                    = [];
      for (const request of pending.values()) {
        if (request.expiresAt > at) continue;
        expired.push(request);
      }
      for (const request of expired) {
        settle(request, { decision: "deny", timedOut: true });
      }
      return expired;
    },
    wait(id        )                           {
      if (!pending.has(id)) return Promise.resolve({ decision: "deny", timedOut: true });
      return new Promise((resolve) => {
        waiters.set(id, resolve);
      });
    },
    registerCleanup(
      id        ,
      cleanup                                                                              ,
    )          {
      if (!pending.has(id)) return false;
      const callbacks = cleanups.get(id) ?? [];
      callbacks.push(cleanup);
      cleanups.set(id, callbacks);
      return true;
    },
  };
}

export function formatApprovalForTelegram(req                 )                                             {
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
  req                 ,
  disabled = false,
)                                                      {
  return buildApprovalCard({
    id: req.id,
    promptHash: req.promptHash,
    workdir: req.workdir,
    disabled,
  });
}
