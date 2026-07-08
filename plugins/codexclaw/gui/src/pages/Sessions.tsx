import { useEffect, useState } from "react";
import { api, type BindingRow, type JobRow } from "../api.ts";
import { Button, EmptyState, Field, Loading, Modal, StatusDot } from "../ui/kit.tsx";
import { Icon } from "../ui/icons.tsx";
import { toast } from "../ui/toast.tsx";
import { HelpDrawer, HelpTopicButton, useHelp } from "../ui/help.tsx";

function statusDot(status: string): "ok" | "warn" | "off" | "err" {
  if (status === "idle") return "ok";
  if (status === "running" || status === "queued") return "warn";
  if (status === "error") return "err";
  return "off";
}

function shortSession(id: string | null): string {
  if (!id) return "-";
  return id.length > 14 ? `${id.slice(0, 10)}...` : id;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

function modelLabel(binding: BindingRow): string {
  return binding.model === "default" ? "default" : binding.model;
}

export function SessionsPage() {
  const [bindings, setBindings] = useState<BindingRow[] | null>(null);
  const [resetting, setResetting] = useState<BindingRow | null>(null);
  const [editingCwd, setEditingCwd] = useState<BindingRow | null>(null);
  const [jobsFor, setJobsFor] = useState<BindingRow | null>(null);
  const { helpOpen, helpTopic, openHelp, closeHelp } = useHelp("sessions");

  const refresh = async () => {
    const res = await api.getBindings();
    setBindings(res.bindings);
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="page-header">
        <span className="page-header-title">Sessions</span>
        <HelpTopicButton topic="sessions" onOpen={openHelp} />
      </div>
      <div className="page-head">
        <div>
          <h1>Sessions</h1>
          <div className="sub">Binding sessions, workdirs, and recent jobs.</div>
        </div>
        {bindings ? <span className="badge accent">{bindings.length} binding{bindings.length === 1 ? "" : "s"}</span> : null}
      </div>
      <div className="page-body wide">
        {!bindings ? (
          <Loading label="Loading sessions..." />
        ) : bindings.length === 0 ? (
          <div className="row-list">
            <EmptyState icon="database" title="No sessions yet">
              Pair a chat and send a message to create the first binding.
            </EmptyState>
          </div>
        ) : (
          <div className="row-list">
            <div className="table-scroll">
              <table className="table compact session-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Chat</th>
                    <th>Codex session</th>
                    <th>Model</th>
                    <th>Workdir</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((binding) => (
                    <tr key={binding.id}>
                      <td>
                        <span className="row" style={{ gap: "var(--s-2)" }}>
                          <Icon name={binding.channel_kind === "telegram" ? "telegram" : "discord"} size={14} />
                          {binding.channel_kind}
                        </span>
                      </td>
                      <td className="mono">{binding.chat_id}</td>
                      <td className="mono" title={binding.thread_id ?? "No session"}>
                        {shortSession(binding.thread_id)}
                      </td>
                      <td className="mono">{modelLabel(binding)}</td>
                      <td className="mono cell-path" title={binding.workdir}>{binding.workdir}</td>
                      <td>
                        <span className="row" style={{ gap: "var(--s-2)" }}>
                          <StatusDot status={statusDot(binding.status)} />
                          {binding.status}
                        </span>
                      </td>
                      <td className="mono">{relTime(binding.updated_at)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Reset session"
                            aria-label={`Reset session for chat ${binding.chat_id}`}
                            onClick={() => setResetting(binding)}
                          >
                            <Icon name="x" size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Change workdir"
                            aria-label={`Change workdir for chat ${binding.chat_id}`}
                            onClick={() => setEditingCwd(binding)}
                          >
                            <Icon name="sliders" size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="View job history"
                            aria-label={`View job history for chat ${binding.chat_id}`}
                            onClick={() => setJobsFor(binding)}
                          >
                            <Icon name="database" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {resetting ? (
        <ResetSessionModal binding={resetting} onClose={() => setResetting(null)} onChanged={refresh} />
      ) : null}
      {editingCwd ? (
        <CwdModal binding={editingCwd} onClose={() => setEditingCwd(null)} onChanged={refresh} />
      ) : null}
      {jobsFor ? <JobsModal binding={jobsFor} onClose={() => setJobsFor(null)} /> : null}
      <HelpDrawer open={helpOpen} topic={helpTopic} onClose={closeHelp} />
    </>
  );
}

function ResetSessionModal({
  binding,
  onClose,
  onChanged,
}: {
  binding: BindingRow;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function reset() {
    setSaving(true);
    const res = await api.resetBinding(binding.id);
    setSaving(false);
    if (!res.ok || !res.data?.ok) {
      toast(res.data?.error ?? "reset failed", "err");
      return;
    }
    toast("Session reset", "ok");
    await onChanged();
    onClose();
  }

  return (
    <Modal title="Reset session" onClose={onClose}>
      <p className="hint">
        Clear the remembered Codex session for chat <span className="mono">{binding.chat_id}</span>.
      </p>
      <div className="modal-foot">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => void reset()} disabled={saving}>
          {saving ? <><span className="spinner" /> Resetting...</> : "Reset"}
        </Button>
      </div>
    </Modal>
  );
}

function CwdModal({
  binding,
  onClose,
  onChanged,
}: {
  binding: BindingRow;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [cwd, setCwd] = useState(binding.workdir);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = cwd.trim();
    if (!next) {
      setError("Workdir is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await api.setBindingCwd(binding.id, next);
    setSaving(false);
    if (!res.ok || !res.data?.ok) {
      setError(res.data?.error ?? "Workdir update failed.");
      return;
    }
    toast("Workdir updated", "ok");
    await onChanged();
    onClose();
  }

  return (
    <Modal title="Change workdir" onClose={onClose}>
      <Field label="Workdir">
        <input className="input mono" value={cwd} onChange={(e) => setCwd(e.target.value)} />
      </Field>
      {error ? (
        <p className="hint row" role="alert" style={{ color: "var(--danger)", gap: "var(--s-2)" }}>
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : null}
      <div className="modal-foot">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving || !cwd.trim()}>
          {saving ? <><span className="spinner" /> Saving...</> : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function JobsModal({ binding, onClose }: { binding: BindingRow; onClose: () => void }) {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    void api.getBindingJobs(binding.id).then((res) => {
      if (alive) setJobs(res.jobs);
    });
    return () => {
      alive = false;
    };
  }, [binding.id]);

  return (
    <Modal title="Job history" onClose={onClose}>
      {!jobs ? (
        <Loading label="Loading jobs..." />
      ) : jobs.length === 0 ? (
        <EmptyState icon="inbox" title="No jobs recorded" />
      ) : (
        <div className="table-scroll jobs-scroll">
          <table className="table compact">
            <thead>
              <tr>
                <th>ID</th>
                <th>State</th>
                <th>Prompt</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="mono">{job.id}</td>
                  <td>{job.state}</td>
                  <td className="cell-detail" title={job.prompt_preview}>{job.prompt_preview}</td>
                  <td className="mono">{job.ended_at ? relTime(job.ended_at) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
