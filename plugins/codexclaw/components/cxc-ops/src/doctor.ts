/**
 * doctor.ts — evidence-bound codexclaw plugin health report (L20.3 / 203).
 *
 * Self-checks plugin-specific health (skills, hooks, agent role configs, manifest
 * integrity). The codex install probe itself is delegated to `codex doctor`; this
 * is the codexclaw-plugin slice only. Pure filesystem + JSON reads, no network.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { diagnoseHookTrust, readInstalledPluginKeys } from "./hook-trust.ts";
import { TargetParseError, validateManifestTargets } from "./manifest-targets.ts";

export type Severity = "PASS" | "WARN" | "FAIL";

export interface CheckResult {
  name: string;
  severity: Severity;
  /** concrete evidence: a path, count, or parsed value — never a bare verdict. */
 evidence: string;
  /** Optional repair command when severity is FAIL or WARN. */
  repair?: string;
}

export interface DoctorReport {
  /** Schema version for --json consumers. Bump on structural changes. */
  schemaVersion: 1;
  overall: Severity;
  checks: CheckResult[];
  /** Plugin version from manifest, if available. */
  pluginVersion?: string;
  /** Codex CLI version, if detectable. */
  codexVersion?: string;
  /** Active surface: CLI or App, when detectable. */
  activeSurface?: string;
}

export interface DoctorOptions {
  codexHome?: string;
  pluginKey?: string;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Worst severity wins: FAIL > WARN > PASS. */
export function rollup(checks: CheckResult[]): Severity {
  // justified: Array.prototype method, not dynamic code execution
  if (checks.some((c) => c.severity === "FAIL")) return "FAIL";
  if (checks.some((c) => c.severity === "WARN")) return "WARN";
  return "PASS";
}

/**
 * Run the codexclaw plugin health checks against a plugin root. Returns a
 * structured report; the caller renders it. Every check carries evidence.
 */
/**
 * Turn shared-validator output into doctor checks.
  */

/** Detect Codex CLI version by running codex --version. */
function detectCodexVersion(runner: typeof spawnSync): string | undefined {
  try {
    const res = runner("codex", ["--version"], { encoding: "utf8", timeout: 5000 });
    if (res.status === 0 && res.stdout) {
      const match = res.stdout.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : res.stdout.trim();
    }
  } catch { /* codex not in PATH */ }
  return undefined;
}

/** Check PABCD session state health: schema version and corruption. */
function checkPabcdHealth(projectRoot: string): CheckResult {
  const stateDir = join(projectRoot, ".codexclaw", "sessions");
  if (!isDir(stateDir)) {
    return { name: "pabcd-state", severity: "PASS", evidence: "no .codexclaw/sessions/ directory (clean state)" };
  }
  const files = readdirSync(stateDir).filter(f => f.endsWith(".json"));
  const corrupt: string[] = [];
  for (const f of files) {
    try { JSON.parse(readFileSync(join(stateDir, f), "utf8")); }
    catch { corrupt.push(f); }
  }
  if (corrupt.length > 0) {
    return { name: "pabcd-state", severity: "WARN", evidence: corrupt.length + " corrupt session file(s): " + corrupt.join(", "), repair: "cxc reset --state" };
  }
  return { name: "pabcd-state", severity: "PASS", evidence: files.length + " session file(s), all parseable" };
}

/**
  * Turn shared-validator output back into doctor checks.
 *
 * A malformed manifest aborts validation at the first parse failure — the
 * premise has collapsed, so the remaining targets were never looked at. The
 * kind that never ran is reported WARN `not evaluated`, never PASS: marking an
 * unexecuted check as passing would let one broken hook JSON hide every MCP
 * defect.
 */
function manifestTargetChecks(pluginRoot: string): CheckResult[] {
  const KINDS = [
    { kind: "hook", name: "hooks" },
    { kind: "mcp", name: "mcp-targets" },
  ] as const;
  try {
    const issues = validateManifestTargets(pluginRoot);
    return KINDS.map(({ kind, name }) => {
      const mine = issues.filter((i) => i.kind === kind);
      return {
        name,
        severity: mine.length === 0 ? ("PASS" as Severity) : ("FAIL" as Severity),
        evidence: mine.length === 0 ? `all ${kind} target(s) present` : mine.map((i) => i.message).join(", "),
      };
    });
  } catch (err) {
    if (err instanceof TargetParseError) {
      return KINDS.map(({ kind, name }) =>
        kind === err.kind
          ? { name, severity: "FAIL" as Severity, evidence: `unparseable ${kind} json: ${err.path}` }
          : { name, severity: "WARN" as Severity, evidence: `not evaluated after ${err.kind} parse failure` },
      );
    }
    // Anything else (permissions, EISDIR, realpath) has no kind — do not guess.
    return [{ name: "manifest-targets", severity: "FAIL", evidence: `target validation failed: ${String(err)}` }];
  }
}

export function runDoctor(
  pluginRoot: string,
  agRunner: typeof spawnSync = spawnSync,
  options: DoctorOptions = {},
): DoctorReport {
  const checks: CheckResult[] = [];

  // 1. plugin manifest parses and references hooks.
  const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
  if (!existsSync(manifestPath)) {
    checks.push({ name: "manifest", severity: "FAIL", evidence: `missing ${manifestPath}` });
  } else {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { hooks?: unknown };
      const hookCount = Array.isArray(manifest.hooks) ? manifest.hooks.length : 0;
      checks.push({
        name: "manifest",
        severity: hookCount > 0 ? "PASS" : "WARN",
        evidence: `plugin.json parsed, ${hookCount} hook(s) referenced`,
      });
    } catch (err) {
      checks.push({ name: "manifest", severity: "FAIL", evidence: `unparseable plugin.json: ${String(err)}` });
    }
  }

  // 2. every manifest-declared target exists, is non-empty and stays inside the
  //    plugin root — same validator the build runs, so doctor and build cannot drift.
  //    Issues are split by kind: hook problems keep the historical `hooks` check
  //    name, MCP problems get their own `mcp-targets` check rather than being
  //    mislabelled as hook failures.
  if (existsSync(manifestPath)) {
    checks.push(...manifestTargetChecks(pluginRoot));
  }

  // 3. skills: each skill dir has SKILL.md + agents/openai.yaml.
  const skillsDir = join(pluginRoot, "skills");
  if (!isDir(skillsDir)) {
    checks.push({ name: "skills", severity: "WARN", evidence: "no skills/ directory" });
  } else {
    const skillDirs = readdirSync(skillsDir).filter((n) => isDir(join(skillsDir, n)));
    const broken: string[] = [];
    for (const n of skillDirs) {
      const hasSkill = existsSync(join(skillsDir, n, "SKILL.md"));
      const hasYaml = existsSync(join(skillsDir, n, "agents", "openai.yaml"));
      if (!hasSkill || !hasYaml) broken.push(n);
    }
    checks.push({
      name: "skills",
      severity: broken.length === 0 ? "PASS" : "FAIL",
      evidence:
        broken.length === 0
          ? `${skillDirs.length} skill(s) each have SKILL.md + agents/openai.yaml`
          : `incomplete skill(s): ${broken.join(", ")}`,
    });
  }

  // 4. agent role TOMLs present (spawn config).
  const agentsDir = join(pluginRoot, "agents");
  if (!isDir(agentsDir)) {
    checks.push({ name: "agents", severity: "WARN", evidence: "no agents/ directory" });
  } else {
    const tomls = readdirSync(agentsDir).filter((n) => n.endsWith(".toml"));
    checks.push({
      name: "agents",
      severity: tomls.length > 0 ? "PASS" : "WARN",
      evidence: tomls.length > 0 ? `${tomls.length} role TOML(s): ${tomls.join(", ")}` : "no role TOMLs",
    });
  }

  // 5. source-drift + known-issue section (L21.3).
  checks.push(...runDriftCheck(pluginRoot));

  // 6. installed hook trust state.
  checks.push(runHookTrustCheck(pluginRoot, options));

  // 7. ast-grep runtime status (L22).
  checks.push(runAstGrepCheck(pluginRoot, agRunner));

  // 7b. STALE-ROOT-01: does the payload this process is reading still exist where
  // the installed hooks point?
  checks.push(runInstalledRootCheck(pluginRoot, options));

  // 8. PABCD session state health.
  checks.push(checkPabcdHealth(process.cwd()));

  // Read plugin version for report metadata.
  let pluginVersion: string | undefined;
  try {
    const mf = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")) as { version?: unknown };
    pluginVersion = typeof mf.version === "string" ? mf.version : undefined;
  } catch { /* already caught by check #1 */ }

  const codexVersion = detectCodexVersion(agRunner);
  const activeSurface = process.env.CODEX_SURFACE ?? (process.env.CODEX_APP_PORT ? "app" : undefined);

  return {
    schemaVersion: 1,
    overall: rollup(checks),
    checks,
    pluginVersion,
    codexVersion,
    activeSurface,
  };
}

/**
 * STALE-ROOT-01 (260818) — the installed payload directory a running Codex still
 * points at.
 *
 * `codex plugin add` keeps exactly ONE version directory per plugin: installing
 * `0.2.5+codex.B` deletes `0.2.5+codex.A`. Every hook command is
 * `node "${PLUGIN_ROOT}/..."`, and PLUGIN_ROOT is resolved when a session starts,
 * so a session that was alive across the reinstall keeps executing the OLD path.
 * That path is gone, node exits with "Cannot find module", and the hook silently
 * does nothing for the rest of that session's life.
 *
 * Measured 260818: four reinstalls in one day, and after each one the spawn hook
 * stopped firing in every session that predated it — no error surfaced anywhere,
 * because a hook that cannot start also cannot report.
 *
 * We do not control the installer, so this reports rather than repairs: it names
 * the live install root and how many sibling roots exist. Nothing can be inferred
 * about OTHER processes from inside this one, so the evidence stays factual and
 * the repair line says the only thing that actually works — restart Codex.
 */
export function runInstalledRootCheck(pluginRoot: string, options: DoctorOptions = {}): CheckResult {
  const codexHome = options.codexHome ?? process.env.CODEX_HOME ?? join(homedir(), ".codex");
  try {
    const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")) as {
      name?: unknown;
      version?: unknown;
    };
    const name = typeof manifest.name === "string" ? manifest.name : null;
    const version = typeof manifest.version === "string" ? manifest.version : null;
    if (!name || !version) {
      return { name: "install-root", severity: "WARN", evidence: "manifest has no name/version; cannot locate the install root" };
    }
    // cache/<marketplace>/<plugin>/<version>. The marketplace segment is not in
    // the manifest, so scan for the plugin folder rather than guessing it.
    const cacheRoot = join(codexHome, "plugins", "cache");
    if (!existsSync(cacheRoot)) {
      return { name: "install-root", severity: "WARN", evidence: `no plugin cache at ${cacheRoot} (running uninstalled?)` };
    }
    const found: string[] = [];
    for (const market of readdirSync(cacheRoot)) {
      const dir = join(cacheRoot, market, name);
      if (!existsSync(dir)) continue;
      for (const v of readdirSync(dir)) found.push(join(dir, v));
    }
    if (found.length === 0) {
      return { name: "install-root", severity: "WARN", evidence: `${name} is not installed under ${cacheRoot}` };
    }
    const live = found.filter((p) => p.endsWith(`${sep}${version}`));
    if (live.length === 0) {
      return {
        name: "install-root",
        severity: "FAIL",
        evidence: `this payload declares ${version}, but the installed root(s) are: ${found.join(", ")}. Any session started before the last reinstall is running hooks from a path that no longer exists (STALE-ROOT-01).`,
        repair: "codex plugin add <plugin>@<marketplace>, then RESTART Codex — a running session keeps the old PLUGIN_ROOT",
      };
    }
    return {
      name: "install-root",
      severity: "PASS",
      evidence: `installed root matches this payload (${version}); ${found.length} root(s) present`,
    };
  } catch (error) {
    return { name: "install-root", severity: "WARN", evidence: error instanceof Error ? error.message : String(error) };
  }
}

export function runHookTrustCheck(pluginRoot: string, options: DoctorOptions = {}): CheckResult {
  const codexHome = options.codexHome ?? process.env.CODEX_HOME ?? join(homedir(), ".codex");
  try {
    const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")) as { name?: unknown };
    if (typeof manifest.name !== "string" || !manifest.name) {
      return { name: "hook-trust", severity: "WARN", evidence: "manifest has no plugin name; cannot resolve install key" };
    }
    const candidates = readInstalledPluginKeys(codexHome, manifest.name);
    const pluginKey = options.pluginKey ?? (candidates.length === 1 ? candidates[0] : null);
    if (!pluginKey) {
      return {
        name: "hook-trust",
        severity: "WARN",
        evidence: `enabled install key is ambiguous (${candidates.length}): ${candidates.length ? candidates.join(", ") : "(none)"}`,
      };
    }
    const results = diagnoseHookTrust(codexHome, pluginRoot, pluginKey);
    const failed = results.filter((result) => result.status !== "trusted");
    return {
      name: "hook-trust",
      // An EMPTY result set is not a pass. `diagnoseHookTrust` skips a handler it
      // cannot hash (invalid matcher, empty command, async), so "0 failed" can also
      // mean "0 examined" — a green check over hooks nobody verified.
      severity: results.length === 0 ? "WARN" : failed.length === 0 ? "PASS" : "FAIL",
      evidence:
        results.length === 0
          ? `no hook handler could be hashed for ${pluginKey}; nothing was verified`
          : failed.length === 0
          ? `${results.length} hook hash(es) trusted for ${pluginKey}`
          : failed
              .map((result) => `${result.status} ${result.key} expected=${result.hash} actual=${result.actual ?? "(none)"}`)
              .join("; "),
    };
  } catch (error) {
    return { name: "hook-trust", severity: "FAIL", evidence: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Source-drift + known-issue probe (L21.3, lcx-doctor pattern). Reports the
 * declared plugin version and any MCP-config drift, and surfaces a known-issue
 * hint line instead of a bare "reinstall". Evidence-first; never blocks.
 */
export function runDriftCheck(pluginRoot: string): CheckResult[] {
  const checks: CheckResult[] = [];
  const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");

  // declared version presence (drift baseline).
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: unknown; mcpServers?: unknown };
    const version = typeof manifest.version === "string" ? manifest.version : null;
    checks.push({
      name: "drift:version",
      severity: version ? "PASS" : "WARN",
      evidence: version ? `declared plugin version ${version}` : "manifest has no version field (cannot baseline drift)",
    });

    // MCP config drift: manifest points at a file that must exist and parse.
    const mcpRef = typeof manifest.mcpServers === "string" ? manifest.mcpServers : null;
    if (!mcpRef) {
      checks.push({ name: "drift:mcp", severity: "WARN", evidence: "manifest declares no mcpServers reference" });
    } else {
      const mcpPath = join(pluginRoot, mcpRef);
      if (!existsSync(mcpPath)) {
        checks.push({ name: "drift:mcp", severity: "FAIL", evidence: `mcpServers -> ${mcpRef} but file is missing` });
      } else {
        try {
          const mcp = JSON.parse(readFileSync(mcpPath, "utf8")) as { mcpServers?: Record<string, unknown> };
          const count = mcp.mcpServers ? Object.keys(mcp.mcpServers).length : 0;
          checks.push({ name: "drift:mcp", severity: "PASS", evidence: `${mcpRef} parses, ${count} server(s) declared` });
        } catch (err) {
          checks.push({ name: "drift:mcp", severity: "FAIL", evidence: `${mcpRef} is unparseable: ${String(err)}` });
        }
      }
    }
  } catch (err) {
    checks.push({ name: "drift:version", severity: "FAIL", evidence: `cannot read manifest for drift baseline: ${String(err)}` });
  }

  // known-issue lookup: a debugging handoff hint, not a bare "reinstall".
  const failing = checks.filter((c) => c.severity === "FAIL").map((c) => c.name);
  checks.push({
    name: "known-issues",
    severity: failing.length ? "WARN" : "PASS",
    evidence: failing.length
      ? `drift FAIL in [${failing.join(", ")}] — re-run \`npm run build\`, then inspect the named file before reinstalling`
      : "no known-issue signature matched",
  });

  return checks;
}

/**
 * ast-grep runtime status (L22). Reports whether `sg` is resolvable via the
 * skill helper without crashing when it (or python) is absent. Missing binary
 * is WARN (install hint), not FAIL — ast-grep is optional, on-demand tooling.
 */
export function runAstGrepCheck(pluginRoot: string, runner: typeof spawnSync = spawnSync): CheckResult {
  const helper = join(pluginRoot, "skills", "ast-grep", "scripts", "ast_grep_helper.py");
  if (!existsSync(helper)) {
    return { name: "ast-grep", severity: "WARN", evidence: "ast-grep skill helper not installed" };
  }
  try {
    const res = runner("python3", [helper, "doctor"], { encoding: "utf8", timeout: 8000 });
    const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
    const versionMatch = out.match(/ast-grep\s+(\d+\.\d+\.\d+)/);
    const pathMatch = out.match(/ast-grep binary:\s*(\S+)/);
    if (res.status === 0 && versionMatch) {
      return {
        name: "ast-grep",
        severity: "PASS",
        evidence: `sg resolved at ${pathMatch ? pathMatch[1] : "(path n/a)"} (version ${versionMatch[1]})`,
      };
    }
    return { name: "ast-grep", severity: "WARN", evidence: "sg not resolved — run `ast_grep_helper.py install` to provision" };
  } catch (err) {
    return { name: "ast-grep", severity: "WARN", evidence: `ast-grep probe skipped: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Render a report as aligned PASS/WARN/FAIL lines for CLI stdout. */
export function renderDoctor(report: DoctorReport): string {
  const lines = report.checks.map((c) => {
    let line = `[${c.severity}] ${c.name}: ${c.evidence}`;
    if (c.repair && c.severity !== "PASS") line += ` (repair: ${c.repair})`;
    return line;
  });
  if (report.pluginVersion) lines.unshift(`codexclaw v${report.pluginVersion}`);
  if (report.codexVersion) lines.unshift(`codex v${report.codexVersion}`);
  lines.push(`overall: ${report.overall}`);
  return lines.join("\n");
}
