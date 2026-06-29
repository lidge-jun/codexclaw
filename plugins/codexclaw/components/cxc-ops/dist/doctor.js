/**
 * doctor.ts — evidence-bound codexclaw plugin health report (L20.3 / 203).
 *
 * Self-checks plugin-specific health (skills, hooks, agent role configs, manifest
 * integrity). The codex install probe itself is delegated to `codex doctor`; this
 * is the codexclaw-plugin slice only. Pure filesystem + JSON reads, no network.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

                                                

                              
               
                     
                                                                                  
                   
 

                               
                    
                        
 

function isDir(p        )          {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Worst severity wins: FAIL > WARN > PASS. */
export function rollup(checks               )           {
  if (checks.some((c) => c.severity === "FAIL")) return "FAIL";
  if (checks.some((c) => c.severity === "WARN")) return "WARN";
  return "PASS";
}

/**
 * Run the codexclaw plugin health checks against a plugin root. Returns a
 * structured report; the caller renders it. Every check carries evidence.
 */
export function runDoctor(pluginRoot        )               {
  const checks                = [];

  // 1. plugin manifest parses and references hooks.
  const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
  if (!existsSync(manifestPath)) {
    checks.push({ name: "manifest", severity: "FAIL", evidence: `missing ${manifestPath}` });
  } else {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))                       ;
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
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))                        ;
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
    const broken           = [];
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

  return { overall: rollup(checks), checks };
}

/** Render a report as aligned PASS/WARN/FAIL lines for CLI stdout. */
export function renderDoctor(report              )         {
  const lines = report.checks.map((c) => `[${c.severity}] ${c.name}: ${c.evidence}`);
  lines.push(`overall: ${report.overall}`);
  return lines.join("\n");
}
