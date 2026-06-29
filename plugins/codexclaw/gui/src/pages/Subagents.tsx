import { useEffect, useState } from "react";
import {
  api,
  defaultConfig,
  setSubagentRole,
  type SubagentsConfig,
  type CatalogEntry,
  type ProviderState,
} from "../api.ts";
import { ModelSelect } from "../components/ModelSelect.tsx";
import { PromptOverrideEditor } from "../components/PromptOverrideEditor.tsx";

const ROLES = ["explorer", "reviewer", "executor"] as const;

export function SubagentsPage({ provider }: { provider: ProviderState }) {
  const [config, setConfig] = useState<SubagentsConfig>(defaultConfig());
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    void api.getSubagents().then(setConfig);
    void api.getCatalog().then((c) => setCatalog(c.entries));
  }, []);

  async function save(role: (typeof ROLES)[number], patch: Partial<SubagentsConfig["roles"]["reviewer"]>) {
    setSavingRole(role);
    const next = await setSubagentRole(role, patch, config);
    setConfig(next);
    setSavingRole(null);
  }

  return (
    <section className="panel">
      {ROLES.map((role) => {
        const r = config.roles[role];
        const isModelMode = r.mode === "model";
        return (
          <div className="role-card" key={role}>
            <div className="role-head">
              <span className="role-name">{role}</span>
              <label className="mode-toggle">
                <input
                  type="checkbox"
                  checked={isModelMode}
                  onChange={(e) => save(role, { mode: e.target.checked ? "model" : "default" })}
                />
                use specific model
              </label>
              {savingRole === role ? <span className="saving">saving…</span> : null}
            </div>
            <div className="role-body">
              <ModelSelect
                value={r.model}
                disabled={!isModelMode}
                entries={catalog}
                onChange={(model) => save(role, { mode: model ? "model" : "default", model })}
              />
              <PromptOverrideEditor value={r.promptOverride} onChange={(v) => save(role, { promptOverride: v })} />
            </div>
          </div>
        );
      })}
      <p className="hint">
        {catalog.length} model(s) · {provider.mode} mode · saves to .codexclaw/subagents.json
      </p>
    </section>
  );
}
