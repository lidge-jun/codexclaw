/**
 * doctor.ts — evidence-bound codexclaw plugin health report (L20.3 / 203).
 *
 * Self-checks plugin-specific health (skills, hooks, agent role configs, manifest
 * integrity). The codex install probe itself is delegated to `codex doctor`; this
 * is the codexclaw-plugin slice only. Pure filesystem + JSON reads, no network.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export type Severity = "PASS" | "WARN" | "FAIL";

export interface CheckResult {
  name: string;
  severity: Severity;
  /** concrete evidence: a path, count, or parsed value — never a bare verdict. */
  evidence: string;
}

export interface DoctorReport {
  overall: Severity;
  checks: CheckResult[];
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
  if (checks.some((c) => c.severity === "FAIL")) return "FAIL";
  if (checks.some((c) => c.severity === "WARN")) return "WARN";
  return "PASS";
}

/**
 * Run the codexclaw plugin health checks against a plugin root. Returns a
 * structured report; the caller renders it. Every check carries evidence.
 */
export function runDoctor(pluginRoot: string, agRunner: typeof spawnSync = spawnSync): DoctorReport {
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

  // 2. each manifest-referenced hook file exists.
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { hooks?: string[] };
      const hooks = Array.isArray(manifest.hooks) ? manifest.hooks : [];
      const missing = hooks.filter((h) => !existsSync(join(pluginRoot, h)));
      checks.push({
        name: "hooks",
        severity: missing.length === 0 ? "PASS" : "FAIL",
        evidence: missing.length === 0 ? `all ${hooks.length} hook file(s) present` : `missing: ${missing.join(", ")}`,
      });
    } catch {
      // manifest already reported above; skip a duplicate FAIL.
    }
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

  // 6. ast-grep runtime status (L22).
  checks.push(runAstGrepCheck(pluginRoot, agRunner));

  return { overall: rollup(checks), checks };
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
  const lines = report.checks.map((c) => `[${c.severity}] ${c.name}: ${c.evidence}`);
  lines.push(`overall: ${report.overall}`);
  return lines.join("\n");
}
