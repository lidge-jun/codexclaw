// Pure feature-flag helpers. No process/homedir defaults — all deps are injected so tests
// can never reach the real ~/.codex. Activation delegates the actual config write to the
// official `codex features enable` CLI (format-preserving via toml_edit), so this module
// never parses or edits config.toml itself.
//
// Boundary note (260829 config-autopilot): the CLI only reaches booleans inside
// [features]. Keys in other tables — `memories.dedicated_tools` first — have no
// persisted CLI setter, so editing them lives in toml-edit.ts with its whitelist in
// managed-keys.ts. That module owns the component's TOML grammar; this one stays
// delegation-only. The two vocabularies are deliberately separate: DECLARED_FEATURES
// here, CONFIG_MANAGED_KEYS there, and nothing on that list is auto-enabled.

export const DECLARED_FEATURES = [
  "multi_agent",
  "goals",
  "hooks",
  "default_mode_request_user_input",
] as const;

export type DeclaredFeature = (typeof DECLARED_FEATURES)[number];

// Flags that are OFF by default in codex and that codexclaw must turn on. A soft flag's
// enable failure does not fail activation — but it is NOT silent (see SOFT_FEATURE_IMPACT).
//
// 260829 정정: 이전 주석은 "under-development 라 실패할 수 있다"고 적었으나 사실이 아니다.
// codex-rs cli/src/main.rs:915 validate_feature 는 is_known_feature_key 만 보고 stage 를
// 보지 않으며, under-development 는 성공적 쓰기 뒤 stderr 경고만 낸다(실측 exit 0).
// 따라서 실제 실패 원인은 하나로 좁혀진다 — 이 codex 빌드가 그 키를 모른다(rename/retire).
// 그건 조용히 넘길 사안이 아니라 정확히 사용자에게 알려야 하는 사안이다.
// multi_agent_v2 is NOT declared: codexclaw does not force-enable or manage it.
// Users who want V2 enable it manually in config.toml; the version-resolution
// ladder falls back to stable multi_agent (V1) automatically.
export const SOFT_FEATURES: ReadonlySet<string> = new Set(["default_mode_request_user_input"]);

// What the user loses when a soft flag stays off. Read by the CLI to build the warning,
// so the impact statement lives next to the membership decision instead of in the printer.
// Every SOFT_FEATURES member must have an entry; a test enforces that, which is what stops
// a future addition from silently reintroducing the swallow this table exists to end.
export const SOFT_FEATURE_IMPACT: Readonly<Record<string, string>> = {
  default_mode_request_user_input:
    "Default 모드에서 질문선택지 UI(request_user_input)가 모델에게 노출되지 않는다. " +
    "Plan 모드에서는 계속 동작한다.",
};

export interface CodexRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Injected runner: invokes the real `codex` binary in production, a fake in tests.
export type CodexRunner = (args: readonly string[]) => CodexRunResult;

// Parse `codex features list` output into a name -> enabled map. The official CLI prints one
// feature per line as three whitespace-padded columns — `{name}  {stage}  {true|false}` — sorted
// by name (codex-rs cli/src/main.rs:1427-1429). We match the FIRST field exactly (not a substring)
// so sibling keys like `plugin_hooks` (or `multi_agent_mode`) never clobber `hooks`/`multi_agent`, and read
// the boolean from the LAST field.
export function parseFeaturesList(stdout: string): Map<string, boolean> {
  const declared = new Set<string>(DECLARED_FEATURES);
  const result = new Map<string, boolean>();
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
export function readDeclaredState(run: CodexRunner): Map<string, boolean> {
  const res = run(["features", "list"]);
  if (res.exitCode !== 0) {
    throw new Error(`codex features list failed (exit ${res.exitCode}): ${res.stderr.trim()}`);
  }
  const parsed = parseFeaturesList(res.stdout);
  // Any declared flag not seen in the listing is treated as not-enabled.
  const state = new Map<string, boolean>();
  for (const key of DECLARED_FEATURES) {
    state.set(key, parsed.get(key) ?? false);
  }
  return state;
}

// Compute which declared flags still need enabling (those not already true).
export function featuresToEnable(currentState: ReadonlyMap<string, boolean>): DeclaredFeature[] {
  return DECLARED_FEATURES.filter((key) => currentState.get(key) !== true);
}
