// Pure feature-flag helpers. No process/homedir defaults — all deps are injected so tests
// can never reach the real ~/.codex. Activation delegates the actual config write to the
// official `codex features enable` CLI (format-preserving via toml_edit), so this module
// never parses or edits config.toml itself.

export const DECLARED_FEATURES = [
  "multi_agent",
  "multi_agent_v2",
  "goals",
  "hooks",
  "default_mode_request_user_input",
]         ;



// Flags that are OFF by default in codex and that codexclaw must turn on. Soft flags may
// fail to enable (e.g. under-development / unavailable in this build) without failing activation.
// multi_agent_v2 is SOFT: it is stage under-development, so a future codex build may refuse
// or remove it; when the enable fails, the version-resolution ladder falls back to stable
// multi_agent (V1) automatically (260709 dev2 switch).
export const SOFT_FEATURES                      = new Set([
  "default_mode_request_user_input",
  "multi_agent_v2",
]);







// Injected runner: invokes the real `codex` binary in production, a fake in tests.


// Parse `codex features list` output into a name -> enabled map. The official CLI prints one
// feature per line as three whitespace-padded columns — `{name}  {stage}  {true|false}` — sorted
// by name (codex-rs cli/src/main.rs:1427-1429). We match the FIRST field exactly (not a substring)
// so sibling keys like `plugin_hooks` (or `multi_agent_mode`) never clobber `hooks`/`multi_agent`, and read
// the boolean from the LAST field.
export function parseFeaturesList(stdout        )                       {
  const declared = new Set        (DECLARED_FEATURES);
  const result = new Map                 ();
  for (const rawLine of stdout.split(/\r?\n/)) {
    const fields = rawLine.trim().split(/\s+/);
    if (fields.length < 2) continue;
    const name = fields[0];
    if (!declared.has(name)) continue;
    const last = fields[fields.length - 1].toLowerCase();
    if (last === "true") result.set(name, true);
    else if (last === "false") result.set(name, false);
    // Any other trailing token (unexpected format) is ignored; readDeclaredState then
    // treats the flag as not-seen -> not-enabled, which is the safe default.
  }
  return result;
}

// Read the effective enabled-state of the declared flags via the injected runner.
export function readDeclaredState(run             )                       {
  const res = run(["features", "list"]);
  if (res.exitCode !== 0) {
    throw new Error(`codex features list failed (exit ${res.exitCode}): ${res.stderr.trim()}`);
  }
  const parsed = parseFeaturesList(res.stdout);
  // Any declared flag not seen in the listing is treated as not-enabled.
  const state = new Map                 ();
  for (const key of DECLARED_FEATURES) {
    state.set(key, parsed.get(key) ?? false);
  }
  return state;
}

// Compute which declared flags still need enabling (those not already true).
export function featuresToEnable(currentState                              )                    {
  return DECLARED_FEATURES.filter((key) => currentState.get(key) !== true);
}
