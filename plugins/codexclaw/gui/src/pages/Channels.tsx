import { useEffect, useRef, useState } from "react";
import { api, type ChannelKind, type ChannelsState } from "../api.ts";
import { Card, Button, Field, StatusDot, Badge, Loading } from "../ui/kit.tsx";
import { Icon, type IconName } from "../ui/icons.tsx";
import { toast } from "../ui/toast.tsx";

type WizardStep = "idle" | "validating" | "awaiting-start" | "paired" | "error";

const CHANNEL_META: Record<ChannelKind, { name: string; icon: IconName; startHint: string; tokenHint: string }> = {
  telegram: {
    name: "Telegram",
    icon: "telegram",
    startHint: "Open your bot's chat and press /start.",
    tokenHint: "Bot token from @BotFather (e.g. 123456:ABC-DEF…).",
  },
  discord: {
    name: "Discord",
    icon: "discord",
    startHint: "In a server channel the bot can see, send: !cxc start  (enable the MESSAGE CONTENT intent in the Developer Portal first).",
    tokenHint: "Bot token from the Discord Developer Portal → Bot.",
  },
};

export function ChannelsPage() {
  const [state, setState] = useState<ChannelsState | null>(null);

  const refresh = async () => setState(await api.getChannels());
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <div className="sub">Connect one messenger. Only one channel is active at a time.</div>
        </div>
        {state ? (
          <span className="badge">
            <StatusDot status={state.activeKind ? "ok" : "off"} />
            {state.activeKind ? `${state.activeKind} · ${state.adapterStatus}` : "none active"}
          </span>
        ) : null}
      </div>
      <div className="page-body">
        {!state ? (
          <Loading label="Loading channels…" />
        ) : (
          (["telegram", "discord"] as ChannelKind[]).map((kind) => {
            const info = state.channels.find((c) => c.kind === kind);
            return (
              <ChannelCard
                key={kind}
                kind={kind}
                active={info?.active ?? false}
                hasToken={info?.hasToken ?? false}
                allowlistCount={info?.allowlistCount ?? 0}
                otherActive={state.activeKind !== null && state.activeKind !== kind}
                onChanged={refresh}
              />
            );
          })
        )}
      </div>
    </>
  );
}

function ChannelCard({
  kind,
  active,
  hasToken,
  allowlistCount,
  otherActive,
  onChanged,
}: {
  kind: ChannelKind;
  active: boolean;
  hasToken: boolean;
  allowlistCount: number;
  otherActive: boolean;
  onChanged: () => Promise<void>;
}) {
  const meta = CHANNEL_META[kind];
  const [token, setToken] = useState("");
  const [step, setStep] = useState<WizardStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function connect() {
    setError(null);
    setStep("validating");
    const res = await api.validateToken(kind, token.trim());
    if (!res.ok || !res.data?.ok) {
      setStep("error");
      setError(res.data?.error ?? "token rejected");
      return;
    }
    toast(`${meta.name} token valid${res.data.username ? ` (@${res.data.username})` : ""}`, "ok");
    await api.activateChannel(kind);
    await api.openHandshake(kind, 180);
    await onChanged();
    setStep("awaiting-start");
    startPolling();
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await api.handshakeStatus(kind);
      if (s.pairedChatId) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep("paired");
        toast(`${meta.name} paired with chat ${s.pairedChatId}`, "ok");
        await onChanged();
      } else if (!s.open) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep("error");
        setError("handshake window expired — try again");
      }
    }, 1500);
  }

  async function disconnect() {
    await api.deactivateChannel();
    setStep("idle");
    setToken("");
    await onChanged();
    toast(`${meta.name} deactivated`);
  }

  return (
    <Card>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-3)" }}>
        <div className="row" style={{ gap: "var(--s-3)" }}>
          <span className="channel-mark" data-kind={kind}><Icon name={meta.icon} size={18} /></span>
          <div>
            <div className="card-title" style={{ margin: 0 }}>{meta.name}</div>
            <div className="hint">{allowlistCount} paired chat{allowlistCount === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="row">
          {active ? <Badge tone="ok"><StatusDot status="ok" /> active</Badge> : hasToken ? <Badge>configured</Badge> : null}
        </div>
      </div>

      {active ? (
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="hint">This channel is live. Messages route to codex.</span>
          <Button variant="danger" onClick={disconnect}>Disconnect</Button>
        </div>
      ) : step === "awaiting-start" ? (
        <div className="state" style={{ padding: "var(--s-5)" }}>
          <div className="spinner" />
          <div className="title">Waiting for the handshake…</div>
          <div className="hint">{meta.startHint}</div>
          <Button onClick={() => { setStep("idle"); if (pollRef.current) clearInterval(pollRef.current); }}>Cancel</Button>
        </div>
      ) : step === "paired" ? (
        <div className="state" style={{ padding: "var(--s-5)" }}>
          <div className="glyph" style={{ color: "var(--ok)" }}><Icon name="check-circle" size={30} /></div>
          <div className="title">Connected</div>
          <div className="hint">{meta.name} is live — send it a message.</div>
        </div>
      ) : (
        <>
          <Field label={`${meta.name} bot token`}>
            <input
              className="input"
              type="password"
              placeholder={meta.tokenHint}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={step === "validating" || otherActive}
            />
          </Field>
          {otherActive ? (
            <p className="hint">Another channel is active. Disconnect it first — only one channel runs at a time.</p>
          ) : null}
          {step === "error" && error ? (
            <p className="hint row" style={{ color: "var(--danger)", gap: "var(--s-2)" }}>
              <Icon name="alert" size={14} /> {error}
            </p>
          ) : null}
          <div className="row">
            <Button variant="primary" onClick={connect} disabled={!token.trim() || step === "validating" || otherActive}>
              {step === "validating" ? <><span className="spinner" /> Connecting…</> : "Connect"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
