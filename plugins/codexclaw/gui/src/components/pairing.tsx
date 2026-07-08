/**
 * pairing.tsx — shared pairing-wizard pieces (GUI overhaul phase 2).
 *
 * Channels and Agents both drive a "waiting for /start" handshake, but over
 * different APIs: channels poll pairedChatId, agents poll an allowlistCount
 * delta. The UI (instructions, deep link, copy chip, countdown, expiry) is
 * identical, so it lives here and the caller injects a HandshakeAdapter.
 */
import { useEffect, useRef, useState } from "react";
import { api, type ChannelKind } from "../api.ts";
import { Button } from "../ui/kit.tsx";
import { Icon } from "../ui/icons.tsx";
import { toast } from "../ui/toast.tsx";

export const HANDSHAKE_SECONDS = 180;

interface HandshakeOpenResult {
  deepLinkUrl?: string;
  expiresAt?: number;
}

export interface HandshakeAdapter {
  /** (Re)open the pairing window on the backend. */
  open: (seconds: number) => Promise<HandshakeOpenResult | unknown>;
  /** Poll once: `paired` ends the wizard with success; `open:false` expires it. */
  poll: () => Promise<{ paired: boolean; open: boolean; detail?: string }>;
}

export interface BotIdentity {
  username: string | null;
  botId: string | null;
}

export function botDeepLink(kind: ChannelKind, bot: BotIdentity): string | null {
  if (kind === "telegram") return bot.username ? `https://t.me/${bot.username}` : null;
  return bot.botId
    ? `https://discord.com/oauth2/authorize?client_id=${bot.botId}&scope=bot&permissions=3072`
    : null;
}

export function startCommand(kind: ChannelKind): string {
  return kind === "telegram" ? "/start" : "!cxc start";
}

/**
 * Full pairing pane: opens the window (unless the caller already did), polls,
 * shows instructions + countdown, and renders the expired state with retry.
 */
export function PairingPane({
  kind,
  bot,
  adapter,
  alreadyOpen = false,
  deepLinkMode = false,
  onPaired,
  onCancel,
}: {
  kind: ChannelKind;
  bot: BotIdentity;
  adapter: HandshakeAdapter;
  /** true when the caller already opened the window (skip the initial open). */
  alreadyOpen?: boolean;
  /** true when the adapter mints an authorization deep link instead of opening a legacy window. */
  deepLinkMode?: boolean;
  onPaired: (detail?: string) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"waiting" | "expired">("waiting");
  const [windowStart, setWindowStart] = useState(() => Date.now());
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest callback without re-arming the poll loop.
  const onPairedRef = useRef(onPaired);
  onPairedRef.current = onPaired;

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const s = await adapter.poll();
      if (pollRef.current === null) return; // cancelled while in flight
      if (s.paired) {
        stopPolling();
        onPairedRef.current(s.detail);
      } else if (!s.open) {
        stopPolling();
        setPhase("expired");
      }
    }, 1500);
  }

  async function openPairing() {
    const result = await adapter.open(HANDSHAKE_SECONDS);
    if (isHandshakeOpenResult(result)) {
      setDeepLinkUrl(result.deepLinkUrl ?? null);
      setExpiresAt(result.expiresAt ?? null);
    } else {
      setDeepLinkUrl(null);
      setExpiresAt(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const boot = alreadyOpen ? Promise.resolve() : openPairing();
    void boot
      .then(() => {
        if (!cancelled) startPolling();
      })
      .catch(() => {
        if (!cancelled) {
          toast("Pairing setup failed", "err");
          setPhase("expired");
        }
      });
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retry() {
    try {
      await openPairing();
      setWindowStart(Date.now());
      setPhase("waiting");
      startPolling();
    } catch {
      toast("Pairing setup failed", "err");
    }
  }

  if (phase === "expired") {
    return (
      <div className="wizard-state">
        <span className="wizard-glyph warn"><Icon name="alert" size={28} /></span>
        <div className="title">Pairing window expired</div>
        <p className="hint">No chat paired before the link or window expired.</p>
        <div className="modal-foot">
          <Button onClick={onCancel}>Close</Button>
          <Button variant="primary" onClick={() => void retry()}>Try again</Button>
        </div>
      </div>
    );
  }

  const link = deepLinkUrl ?? botDeepLink(kind, bot);
  const cmd = startCommand(kind);
  const isTelegramDeepLink = kind === "telegram" && (deepLinkMode || Boolean(deepLinkUrl));
  return (
    <div>
      <div className="row" style={{ gap: "var(--s-2)", marginBottom: "var(--s-4)" }}>
        <span className="spinner" />
        <span style={{ fontWeight: 600 }}>Waiting for pairing…</span>
        <Countdown startedAt={windowStart} expiresAt={expiresAt} />
      </div>
      <ol className="wizard-steps">
        {isTelegramDeepLink ? (
          <>
            <li>
              Open the one-tap bot link
              <span className="pairing-link-slot">
                {link ? (
                  <a className="help-link" href={link} target="_blank" rel="noreferrer">
                    <Icon name="external" size={13} /> Telegram link
                  </a>
                ) : null}
                {link ? <CopyChip text={link} /> : null}
              </span>
            </li>
            <li>Tap Start in Telegram; the pairing code is already filled in.</li>
            <li>Plain <CopyChip text={cmd} /> only works during a legacy pairing window.</li>
          </>
        ) : kind === "telegram" ? (
          <>
            <li>
              Open your bot's chat
              {link ? (
                <a className="help-link" href={link} target="_blank" rel="noreferrer">
                  <Icon name="external" size={13} /> @{bot.username}
                </a>
              ) : null}
            </li>
            <li>Send <CopyChip text={cmd} /></li>
          </>
        ) : (
          <>
            <li>
              Invite the bot to your server
              {link ? (
                <a className="help-link" href={link} target="_blank" rel="noreferrer">
                  <Icon name="external" size={13} /> invite link
                </a>
              ) : null}
            </li>
            <li>In a channel the bot can see, send <CopyChip text={cmd} /></li>
          </>
        )}
      </ol>
      <p className="hint">This screen updates automatically once the chat pairs.</p>
      <div className="modal-foot">
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function isHandshakeOpenResult(value: unknown): value is HandshakeOpenResult {
  if (!value || typeof value !== "object") return false;
  return "deepLinkUrl" in value || "expiresAt" in value;
}

function Countdown({ startedAt, expiresAt }: { startedAt: number; expiresAt: number | null }) {
  const initial = () =>
    expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : HANDSHAKE_SECONDS;
  const [remaining, setRemaining] = useState(initial);
  useEffect(() => {
    const tick = () =>
      setRemaining(
        expiresAt
          ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
          : Math.max(0, HANDSHAKE_SECONDS - Math.round((Date.now() - startedAt) / 1000)),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt, expiresAt]);
  return (
    <span className="countdown mono" aria-label="time remaining">
      {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
    </span>
  );
}

export function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-chip"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast("Copy failed — select the text manually", "err");
        }
      }}
      aria-label={`Copy ${text}`}
    >
      <span className="mono">{text}</span>
      <Icon name={copied ? "check" : "copy"} size={13} />
    </button>
  );
}

export function TestSendAction({ agentId }: { agentId: number }) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const res = await api.testSend(agentId);
    setSending(false);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? "Test message failed", "err");
      return;
    }
    toast(`Test message sent to ${res.data.chatId}`, "ok");
  }

  return (
    <Button onClick={() => void send()} disabled={sending}>
      {sending ? <span className="spinner" /> : <Icon name="arrow-right" size={14} />}
      Send test message
    </Button>
  );
}
