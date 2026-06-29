import { useEffect, useState } from "react";
import { api, type ProviderState } from "./api.ts";
import { SubagentsPage } from "./pages/Subagents.tsx";
import { OcxLinkBar } from "./components/OcxLinkBar.tsx";

export function App() {
  const [tab, setTab] = useState<"subagents" | "prompts">("subagents");
  const [provider, setProvider] = useState<ProviderState>({ mode: "native", port: null });

  useEffect(() => {
    void api.getProvider().then(setProvider);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">codexclaw</span>
        <nav className="tabs">
          <button className={tab === "subagents" ? "tab active" : "tab"} onClick={() => setTab("subagents")}>
            Subagents
          </button>
          <button className={tab === "prompts" ? "tab active" : "tab"} onClick={() => setTab("prompts")}>
            Prompts
          </button>
        </nav>
        <OcxLinkBar provider={provider} />
      </header>

      <main className="content">
        {tab === "subagents" ? (
          <SubagentsPage provider={provider} />
        ) : (
          <section className="panel">
            <p className="hint">
              Per-role prompt overrides are edited inline on the Subagents tab; defaults inherit the role skill prompt.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
