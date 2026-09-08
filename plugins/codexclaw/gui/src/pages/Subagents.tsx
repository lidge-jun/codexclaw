import { useEffect, useRef, useState } from "react";
import { api, getSubagentSettings, setSubagentRole, type SubagentsConfig, type CatalogEntry, type ProviderState, type SubagentScope, type SubagentRole, type RoleConfig, type ModelCatalog } from "../api.ts";
import { ModelSelect } from "../components/ModelSelect.tsx";
import { EffortSelect } from "../components/EffortSelect.tsx";
import { effortExcluded } from "../effort-support.ts";
import { Loading } from "../ui/kit.tsx";
import { toast } from "../ui/toast.tsx";
import { HelpDrawer, HelpTopicButton, useHelp } from "../ui/help.tsx";

const ROLES = ["explorer", "reviewer", "executor"] as const;
const ROLE_DESC = {
  explorer: "Read-only search and codebase mapping.",
  reviewer: "Independent verification and audits.",
  executor: "Implementation and mutation work.",
};
const SOURCE_LABEL = { project: "Project override", global: "Global defaults", session: "Original session" };

export function SubagentsPage({ provider, scope = "project" }: { provider: ProviderState; scope?: SubagentScope }) {
  const title = scope === "global" ? "Global Settings" : "Subagents";
  const [config, setConfig] = useState<SubagentsConfig | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogState, setCatalogState] = useState<ModelCatalog | null>(null);
  const catalogLoading = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRole, setSavingRole] = useState<SubagentRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [prompts, setPrompts] = useState<Record<SubagentRole, string>>({ explorer: "", reviewer: "", executor: "" });
  const saving = useRef(false);
  const generation = useRef(0);
  const { helpOpen, helpTopic, openHelp, closeHelp } = useHelp("subagents");
  const dirty = (role: SubagentRole) => prompts[role] !== (config?.roles[role].promptOverride ?? "");


  async function refreshCatalog(force = false) {
    if (catalogLoading.current) return;
    catalogLoading.current = true; setRefreshing(true);
    const next = await api.getCatalog(force);
    setCatalogState(next); setCatalog(next.entries);
    catalogLoading.current = false; setRefreshing(false);
  }
  useEffect(() => {
    void refreshCatalog();
    const onFocus = () => { void refreshCatalog(); };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void refreshCatalog(), 30_000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(interval); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setConfig(null); setError(null);
    void getSubagentSettings(scope, controller.signal).then(next => {
      if (controller.signal.aborted || current !== generation.current) return;
      setConfig(next);
      setPrompts({ explorer: next.roles.explorer.promptOverride ?? "", reviewer: next.roles.reviewer.promptOverride ?? "", executor: next.roles.executor.promptOverride ?? "" });
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Settings could not be loaded.");
    });
    return () => { controller.abort(); generation.current++; };
  }, [scope, reload]);

  async function save(role: SubagentRole, patch: Partial<RoleConfig> & { inherit?: boolean }) {
    if (!config || saving.current) return;
    if (patch.mode === "model" && patch.model && config.roles[role].effort !== null) {
      // Only an advertised ladder can refuse a model. A missing catalog entry or an
      // unreported ladder both arrive as null/undefined here, and neither is evidence
      // that the model rejects the saved effort.
      const supported = catalog.find(entry => entry.id === patch.model)?.reasoningEfforts;
      if (effortExcluded(supported, config.roles[role].effort!)) {
        setError("This model does not support the saved effort. Select session effort first, then choose the model. If using global settings, choose Main model first to customize this role."); return;
      }
    }
    saving.current = true; setSavingRole(role); setError(null);
    const current = generation.current;
    const result = await setSubagentRole(role, patch, config, scope);
    saving.current = false;
    if (current !== generation.current) return;
    setSavingRole(null);
    if (!result.ok) { setError(result.error ?? `${role} save failed`); return; }
    setConfig(result.config);
    if (patch.inherit || patch.promptOverride !== undefined) {
      setPrompts(previous => ({ ...previous, [role]: result.config.roles[role].promptOverride ?? "" }));
    }
    toast(`${role} ${patch.inherit ? "now inherits defaults" : "updated"}`, "ok");
  }

  return (
    <>
      <div className="page-header"><span className="page-header-title">{title}</span><HelpTopicButton topic="subagents" onOpen={openHelp} /></div>
      <div className="page-head">
        <div><h1>{title}</h1><div className="sub">{scope === "global" ? "Default subagent settings shared by all projects." : "Choose the main model, global settings, or a model for this project."}</div></div>
        <span className="badge accent">{catalog.length} models · {catalogState?.source ?? provider.mode}</span>
      </div>
      <div className="page-body">
        <div className="role-selects" style={{ alignItems: "center", marginBottom: 12 }}>
          <span className="sub">{catalogState?.status === "fresh" ? `Model list from ${catalogState.source === "ocx" ? "OCX" : "Codex"}` : catalogState?.status === "stale" ? "Last known model list · refresh failed" : "Model list unavailable"}</span>
          <button className="btn" disabled={refreshing} onClick={() => void refreshCatalog(true)}>{refreshing ? "Refreshing…" : "Refresh models"}</button>
        </div>
        {catalogState?.message ? <p className="sub" role="status">{catalogState.message}</p> : null}
        {catalogState?.status === "fresh" && catalog.length === 0 ? <p className="sub">No models are enabled. Enable models in OCX, then refresh.</p> : null}
        <p className="sub">{scope === "global" ? "Projects using Global settings follow these values. Main model uses the original session’s model." : "Global settings follows this role’s defaults, including effort and prompt. Main model uses the original session’s model."}</p>
        {error ? <div role="alert"><p>{error}</p>{!config ? <button className="btn" onClick={() => setReload(n => n + 1)}>Retry</button> : null}</div> : null}
        {config?.trustWarning ? <div role="alert"><p>Project settings are present but ignored until trusted. The values below show the active defaults. Trust the project settings before editing.</p><p className="sub">{config.trustWarning}</p></div> : null}
        {!config ? (!error ? <Loading label="Loading subagent config…" /> : null) : (
          <div className="row-list">
            {ROLES.map(role => {
              const r = config.roles[role];
              const source = config.sources![role];
              const ignored = scope === "project" && !!config.trustWarning;
              const inherited = scope === "project" && !config.overrides![role];
              const supported = r.mode === "model" ? (catalog.find(entry => entry.id === r.model)?.reasoningEfforts ?? null) : undefined;
              const unsupported = r.effort !== null && effortExcluded(supported, r.effort);
              const effectiveModel = r.mode === "model" ? r.model : null;
              return (
                <section key={role} className="list-row role-row" aria-label={`${role} settings`}>
                  <div className="row-id">
                    <span className="row-name">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                    <span className="row-sub">{ROLE_DESC[role]}</span>
                    <span className="row-sub">{SOURCE_LABEL[source]}{inherited ? ` · ${r.model ?? "main model"} · ${r.effort ?? "session effort"}` : ""}</span>
                  </div>
                  <fieldset className="role-controls" disabled={savingRole !== null} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-label={`${role} controls`}>
                    <div className="role-selects">
                      <ModelSelect inherited={inherited} onInherit={scope === "project" ? () => void save(role, { inherit: true }) : undefined} value={effectiveModel} disabled={savingRole !== null || ignored} entries={catalog} onChange={model => void save(role, { mode: model ? "model" : "default", model })} />
                      <EffortSelect supported={supported} value={r.effort} disabled={savingRole !== null || ignored || inherited} onChange={effort => void save(role, { effort })} />
                    </div>
                    {unsupported ? <p className="sub" role="status">Saved effort {r.effort} is not advertised by this model. Select session effort or another supported level.</p> : null}
                    <textarea className="textarea" disabled={ignored || inherited} aria-label={`${role} prompt override`} placeholder="Role prompt override (blank = inherit role skill prompt)" rows={2} value={prompts[role]} onChange={e => setPrompts(previous => ({ ...previous, [role]: e.target.value }))} />
                    <div className="role-selects">
                      {dirty(role) ? <><button className="btn" disabled={ignored} onClick={() => void save(role, { promptOverride: prompts[role].trim() ? prompts[role] : null })}>Save prompt</button><button className="btn" onClick={() => setPrompts(previous => ({ ...previous, [role]: r.promptOverride ?? "" }))}>Discard prompt changes</button></> : null}

                    </div>
                  </fieldset>
                  {savingRole === role ? <span className="badge" role="status">saving…</span> : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
      <HelpDrawer open={helpOpen} topic={helpTopic} onClose={closeHelp} />
    </>
  );
}
