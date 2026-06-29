// Pure feature-flag helpers. No process/homedir defaults — all deps are injected so tests
// can never reach the real ~/.codex. Activation delegates the actual config write to the
// official `codex features enable` CLI (format-preserving via toml_edit), so this module
// never parses or edits config.toml itself.

export const DECLARED_FEATURES = [
  "multi_agent",
  "goals",
  "hooks",
  "default_mode_request_user_input",
] as const;

export type DeclaredFeature = (typeof DECLARED_FEATURES)[number];

// Flags that are OFF by default in codex and that codexclaw must turn on. Soft flags may
// fail to enable (e.g. under-development / unavailable in this build) without failing activation.
export const SOFT_FEATURES: ReadonlySet<string> = new Set(["default_mode_request_user_input"]);

export interface CodexRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Injected runner: invokes the real `codex` binary in production, a fake in tests.
export type CodexRunner = (args: readonly string[]) => CodexRunResult;

// Parse `codex features list` output into a name -> enabled map. The CLI prints one feature
// per line; we look for the declared keys and a trailing enabled/disabled (or true/false) token.
export function parseFeaturesList(stdout: string): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    for (const key of DECLARED_FEATURES) {
      if (!line.includes(key)) continue;
      const lower = line.toLowerCase();
      // Prefer explicit state tokens; default to false when ambiguous.
      const enabled =
        /\b(enabled|on|true|yes)\b/.test(lower) && !/\b(disabled|off|false|no)\b/.test(lower);
      result.set(key, enabled);
    }
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
