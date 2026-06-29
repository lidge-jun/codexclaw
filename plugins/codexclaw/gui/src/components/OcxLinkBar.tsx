import type { ProviderState } from "../api.ts";

/** Link to the opencodex dashboard — visible ONLY when provider status reports
 *  ocx detected (mode "provider"). Hidden/native-labeled otherwise. */
export function OcxLinkBar({ provider }: { provider: ProviderState }) {
  if (provider.mode === "provider" && provider.port) {
    return (
      <a className="linkbar" href={`http://localhost:${provider.port}`} target="_blank" rel="noreferrer">
        opencodex :{provider.port}
      </a>
    );
  }
  return <span className="linkbar muted">native catalog</span>;
}
