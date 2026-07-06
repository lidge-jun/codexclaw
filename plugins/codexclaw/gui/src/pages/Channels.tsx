import { useEffect, useState } from "react";
import { api, type ChannelKind, type ChannelsState } from "../api.ts";
import { Button, Field, StatusDot, Badge, Loading, Modal } from "../ui/kit.tsx";
import { Icon, type IconName } from "../ui/icons.tsx";
import { toast } from "../ui/toast.tsx";
import { PairingPane, HANDSHAKE_SECONDS, type BotIdentity } from "../components/pairing.tsx";

interface ChannelMeta {
  name: string;
  icon: IconName;
  tokenLabel: string;
  tokenHint: string;
  tokenHelpUrl: string;
  tokenHelpLabel: string;
}

const CHANNEL_META: Record<ChannelKind, ChannelMeta> = {
  telegram: {
    name: "Telegram",
    icon: "telegram",
    tokenLabel: "Bot token",
    tokenHint: "123456:ABC-DEF…",
    tokenHelpUrl: "https://t.me/BotFather",
    tokenHelpLabel: "Get one from @BotFather",
  },
  discord: {
    name: "Discord",
    icon: "discord",
    tokenLabel: "Bot token",
    tokenHint: "Paste your bot token",
    tokenHelpUrl: "https://discord.com/developers/applications",
    tokenHelpLabel: "Developer Portal → Bot → Token",
  },
};

export function ChannelsPage() {
  const [state, setState] = useState<ChannelsState | null>(null);
  const [wizardKind, setWizardKind] = useState<ChannelKind | null>(null);
  // "pair" skips the token step (channel already active, just re-open the window)
  const [wizardMode, setWizardMode] = useState<"connect" | "pair">("connect");

  const refresh = async () => setState(await api.getChannels());
  useEffect(() => {
    void refresh();
  }, []);

  const openWizard = (kind: ChannelKind, mode: "connect" | "pair") => {
    setWizardMode(mode);
    setWizardKind(kind);
  };

  // "another channel is running" comes from the live per-channel flags, not the
  // legacy activeKind pointer (which lingers after everything is disabled).
  const runningKind = state?.channels.find((c) => c.active)?.kind ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <div className="sub">Connect one messenger. Only one channel is active at a time.</div>
        </div>
        {state ? (
          <span className="badge">
            <StatusDot status={runningKind ? "ok" : "off"} />
            {runningKind ? `${runningKind} · ${state.adapterStatus}` : "none active"}
          </span>
        ) : null}
      </div>
      <div className="page-body">
        {!state ? (
          <Loading label="Loading channels…" />
        ) : (
          <div className="row-list">
            {(["telegram", "discord"] as ChannelKind[]).map((kind) => {
              const info = state.channels.find((c) => c.kind === kind);
              return (
                <ChannelRow
                  key={kind}
                  kind={kind}
                  active={info?.active ?? false}
                  hasToken={info?.hasToken ?? false}
                  allowlistCount={info?.allowlistCount ?? 0}
                  otherActive={runningKind !== null && runningKind !== kind}
                  onConnect={() => openWizard(kind, "connect")}
                  onPair={() => openWizard(kind, "pair")}
                  onChanged={refresh}
                />
              );
            })}
          </div>
        )}
      </div>
      {wizardKind ? (
        <ConnectWizard
          kind={wizardKind}
          mode={wizardMode}
          onClose={() => setWizardKind(null)}
          onChanged={refresh}
        />
      ) : null}
    </>
  );
}

function ChannelRow({
  kind,
  active,
  hasToken,
  allowlistCount,
  otherActive,
  onConnect,
  onPair,
  onChanged,
}: {
  kind: ChannelKind;
  active: boolean;
  hasToken: boolean;
  allowlistCount: number;
  otherActive: boolean;
  onConnect: () => void;
  onPair: () => void;
  onChanged: () => Promise<void>;
}) {
  const meta = CHANNEL_META[kind];

  async function disconnect() {
    await api.deactivateChannel();
    await onChanged();
    toast(`${meta.name} deactivated`);
  }

  const status = active
    ? allowlistCount > 0
      ? "live"
      : "unpaired"
    : hasToken
      ? "configured"
      : "not-connected";

  return (
    <div className="list-row">
      <span className="channel-mark" data-kind={kind}><Icon name={meta.icon} size={16} /></span>
      <div className="row-id">
        <span className="row-name">{meta.name}</span>
        <span className="row-sub">
          {status === "live"
            ? `${allowlistCount} paired chat${allowlistCount === 1 ? "" : "s"} · routing to codex`
            : status === "unpaired"
              ? "Active, no chat paired — messages are ignored"
              : status === "configured"
                ? "Token saved, not running"
                : otherActive
                  ? "Disconnect the active channel first"
                  : "Not connected"}
        </span>
      </div>
      <div className="row-actions">
        {status === "live" ? <Badge tone="ok"><StatusDot status="ok" /> live</Badge> : null}
        {status === "unpaired" ? <Badge><StatusDot status="warn" /> unpaired</Badge> : null}
        {active ? (
          <>
            {allowlistCount === 0 ? (
              <Button variant="primary" onClick={onPair}>Pair a chat</Button>
            ) : null}
            <Button variant="danger" onClick={disconnect}>Disconnect</Button>
          </>
        ) : (
          <Button variant="primary" onClick={onConnect} disabled={otherActive}>Connect</Button>
        )}
      </div>
    </div>
  );
}

/* ── connect wizard (modal) ─────────────────────────────────────────────────
 * token → validate/activate/open handshake → waiting (deep link + countdown)
 * → paired. `pair` mode starts at the waiting step for an already-active
 * channel (bot identity unknown then — generic instructions). */

type WizardStep = "token" | "validating" | "waiting" | "paired";

function ConnectWizard({
  kind,
  mode,
  onClose,
  onChanged,
}: {
  kind: ChannelKind;
  mode: "connect" | "pair";
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const meta = CHANNEL_META[kind];
  const [step, setStep] = useState<WizardStep>(mode === "pair" ? "waiting" : "token");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bot, setBot] = useState<BotIdentity>({ username: null, botId: null });
  const [pairedChat, setPairedChat] = useState<string | null>(null);
  // Channel handshake adapter: paired == pairedChatId present.
  const adapter = {
    open: (seconds: number) => api.openHandshake(kind, seconds),
    poll: async () => {
      const s = await api.handshakeStatus(kind);
      return { paired: s.pairedChatId !== null, open: s.open, detail: s.pairedChatId ?? undefined };
    },
  };

  async function connect() {
    setError(null);
    setStep("validating");
    const res = await api.validateToken(kind, token.trim());
    if (!res.ok || !res.data?.ok) {
      setStep("token");
      setError(res.data?.error ?? "Token rejected — check it and try again.");
      return;
    }
    setBot({ username: res.data.username ?? null, botId: res.data.botId ?? null });
    await api.activateChannel(kind);
    await api.openHandshake(kind, HANDSHAKE_SECONDS);
    await onChanged();
    setStep("waiting");
  }

  return (
    <Modal title={mode === "pair" ? `Pair a ${meta.name} chat` : `Connect ${meta.name}`} onClose={onClose}>
      {step === "token" || step === "validating" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim() && step !== "validating") void connect();
          }}
        >
          <Field label={meta.tokenLabel}>
            <input
              className="input"
              type="password"
              placeholder={meta.tokenHint}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={step === "validating"}
              autoComplete="off"
            />
          </Field>
          <a className="help-link" href={meta.tokenHelpUrl} target="_blank" rel="noreferrer">
            <Icon name="external" size={13} /> {meta.tokenHelpLabel}
          </a>
          {kind === "discord" ? (
            <p className="hint" style={{ marginTop: "var(--s-2)" }}>
              Enable the <strong>Message Content</strong> intent under Bot → Privileged Gateway Intents.
            </p>
          ) : null}
          {error ? (
            <p className="hint row" role="alert" style={{ color: "var(--danger)", gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
              <Icon name="alert" size={14} /> {error}
            </p>
          ) : null}
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!token.trim() || step === "validating"}>
              {step === "validating" ? <><span className="spinner" /> Validating…</> : "Connect"}
            </Button>
          </div>
        </form>
      ) : step === "waiting" ? (
        <PairingPane
          kind={kind}
          bot={bot}
          adapter={adapter}
          alreadyOpen={mode === "connect"}
          onPaired={async (detail) => {
            setPairedChat(detail ?? null);
            setStep("paired");
            await onChanged();
          }}
          onCancel={onClose}
        />
      ) : step === "paired" ? (
        <div className="wizard-state">
          <span className="wizard-glyph ok"><Icon name="check-circle" size={28} /></span>
          <div className="title">Connected</div>
          <p className="hint">
            {meta.name} is live{pairedChat ? ` — paired with chat ${pairedChat}` : ""}. Send the bot a message to talk to codex.
          </p>
          <div className="modal-foot">
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
