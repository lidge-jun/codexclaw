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
import { Card, Loading } from "../ui/kit.tsx";
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
          ROLES.map((role) => {
            const r = config.roles[role];
            const isModelMode = r.mode === "model";
            return (
              <Card key={role} title={role.charAt(0).toUpperCase() + role.slice(1)} desc={ROLE_DESC[role]}>
                <div className="row" style={{ marginBottom: "var(--s-4)" }}>
                  <label className="row" style={{ gap: "var(--s-2)", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                    <input
                      type="checkbox"
                      checked={isModelMode}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          void save(role, { mode: "default" });
                          return;
                        }
                        // "model" mode needs a concrete model id: keep the saved one,
                        // else default to the first catalog entry.
                        const model = r.model ?? catalog[0]?.id ?? null;
                        if (!model) {
                          toast("no models available to select", "err");
                          return;
                        }
                        void save(role, { mode: "model", model });
                      }}
                    />
                    use a specific model
                  </label>
                  {savingRole === role ? <span className="badge">saving…</span> : null}
                </div>
                <div className="row wrap" style={{ alignItems: "stretch" }}>
                  <ModelSelect
                    value={r.model}
                    disabled={!isModelMode}
                    entries={catalog}
                    onChange={(model) => save(role, { mode: model ? "model" : "default", model })}
                  />
                  <div className="grow">
                    <PromptOverrideEditor value={r.promptOverride} onChange={(v) => save(role, { promptOverride: v })} />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
