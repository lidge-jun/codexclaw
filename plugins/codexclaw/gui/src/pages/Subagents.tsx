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
import { EffortSelect } from "../components/EffortSelect.tsx";
import { PromptOverrideEditor } from "../components/PromptOverrideEditor.tsx";
import { Loading } from "../ui/kit.tsx";
import { toast } from "../ui/toast.tsx";

const ROLES = ["explorer", "reviewer", "executor"] as const;

const ROLE_DESC: Record<(typeof ROLES)[number], string> = {
  explorer: "Read-only search and codebase mapping.",
  reviewer: "Independent verification and audits.",
  executor: "Implementation and mutation work.",
};

export function SubagentsPage({ provider }: { provider: ProviderState }) {
  const [config, setConfig] = useState<SubagentsConfig | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    void api.getSubagents().then(setConfig);
    void api.getCatalog().then((c) => setCatalog(c.entries));
  }, []);

  async function save(role: (typeof ROLES)[number], patch: Partial<SubagentsConfig["roles"]["reviewer"]>) {
    if (!config) return;
    setSavingRole(role);
    const result = await setSubagentRole(role, patch, config);
    setSavingRole(null);
    if (!result.ok) {
      toast(result.error ?? `${role} save failed`, "err");
      return; // keep the current config — do not overwrite state with the fallback
    }
    setConfig(result.config);
    toast(`${role} updated`, "ok");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subagents</h1>
          <div className="sub">Per-role model and prompt overrides · saved to .codexclaw/subagents.json</div>
        </div>
        <span className="badge accent">{catalog.length} models · {provider.mode}</span>
      </div>
      <div className="page-body">
        {!config ? (
          <Loading label="Loading subagent config…" />
        ) : (
          <div className="row-list">
            {ROLES.map((role) => {
              const r = config.roles[role];
              // One fork only: "main model (default)" == default mode; a concrete
              // model == model mode. No separate enable-checkbox.
              const effectiveModel = r.mode === "model" ? r.model : null;
              return (
                <div key={role} className="list-row role-row">
                  <div className="row-id">
                    <span className="row-name">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                    <span className="row-sub">{ROLE_DESC[role]}</span>
                  </div>
                  <div className="role-controls">
                    <div className="role-selects">
                      <ModelSelect
                        value={effectiveModel}
                        disabled={false}
                        entries={catalog}
                        onChange={(model) => save(role, { mode: model ? "model" : "default", model })}
                      />
                      <EffortSelect
                        value={r.effort}
                        disabled={false}
                        onChange={(effort) => save(role, { effort })}
                      />
                    </div>
                    <PromptOverrideEditor
                      value={r.promptOverride}
                      onChange={(v) => save(role, { promptOverride: v })}
                    />
                  </div>
                  {savingRole === role ? <span className="badge">saving…</span> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
