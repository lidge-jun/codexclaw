import { useEffect, useState } from "react";
import { api, defaultConfig, type SubagentsConfig, type CatalogEntry, type ProviderState } from "./api.ts";

const ROLES = ["explorer", "reviewer", "executor"] as const;

export function App() {
  const [tab, setTab] = useState<"subagents" | "prompts">("subagents");
  const [config, setConfig] = useState<SubagentsConfig>(defaultConfig());
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [provider, setProvider] = useState<ProviderState>({ mode: "native", port: null });

  useEffect(() => {
    // Load through codexclaw APIs; all calls degrade to safe defaults so the
    // shell renders cleanly in ocx-absent / no-backend MVP state.
    void api.getSubagents().then(setConfig);
    void api.getCatalog().then((c) => setCatalog(c.entries));
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
        {provider.mode === "provider" && provider.port ? (
          <a className="linkbar" href={`http://localhost:${provider.port}`} target="_blank" rel="noreferrer">
            opencodex :{provider.port}
          </a>
        ) : (
          <span className="linkbar muted">native catalog</span>
        )}
      </header>

      <main className="content">
        {tab === "subagents" ? (
          <section className="panel">
            <table className="roles">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Mode</th>
                  <th>Model</th>
                  <th>Prompt override</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => {
                  const r = config.roles[role];
                  return (
                    <tr key={role}>
                      <td>{role}</td>
                      <td>{r.mode}</td>
                      <td>{r.mode === "model" ? (r.model ?? "—") : "main model"}</td>
                      <td>{r.promptOverride ? "custom" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">{catalog.length} model(s) available · {provider.mode} mode</p>
          </section>
        ) : (
          <section className="panel">
            <p className="hint">Per-role prompt overrides are edited here. Defaults inherit the role skill prompt.</p>
          </section>
        )}
      </main>
    </div>
  );
}
