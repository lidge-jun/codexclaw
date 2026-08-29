// Thin CLI wrapper. This is the ONLY layer that resolves the real `codex` binary and the real
// codexHome — the lib layers (features/activate/deactivate) take everything injected so tests
// can never reach ~/.codex.

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDeclaredState, SOFT_FEATURE_IMPACT,                  } from "./features.js";
import { activate,                 } from "./activate.js";
import { deactivate } from "./deactivate.js";
import { applyManagedKey, readManagedState, resolveManagedKey } from "./config-set.js";
import { CONFIG_MANAGED_KEYS, managedKeyId } from "./managed-keys.js";
import {
  selfHealDeclaredFeatures,
  renderSelfHealContext,
  makeRealSelfHealDeps,
  clearSelfHealOptOut,
} from "./self-heal.js";

const CONFIG_USAGE = [
  "Usage:",
  "  cxc config list                          managed keys, their live values and side effects",
  "  cxc config get <table.key>",
  "  cxc config set <table.key> <true|false>",
  "  cxc config unset <table.key>             restore the value from before codexclaw set it",
  "  cxc config interview [off|new-unit|always]",
  "",
  "Only whitelisted keys can be set; 'config list' shows them. Installation never",
  "enables one on its own — that stays an explicit choice.",
].join("\n");

function runConfig(argv                   , codexHome        )         {
  const configPath = join(codexHome, "config.toml");
  const action = argv[0];

  if (action === undefined || action === "--help" || action === "-h" || action === "help") {
    process.stdout.write(`${CONFIG_USAGE}\n`);
    return action === undefined ? 2 : 0;
  }

  if (action === "list") {
    for (const { entry, value } of readManagedState(configPath)) {
      process.stdout.write(`${managedKeyId(entry)} = ${value ?? "(unset)"}\n  ${entry.caution}\n`);
    }
    if (CONFIG_MANAGED_KEYS.length === 0) process.stdout.write("(no managed keys)\n");
    return 0;
  }

  const id = argv[1];
  if (!id) {
    process.stderr.write(`config ${action}: a <table.key> argument is required\n${CONFIG_USAGE}\n`);
    return 2;
  }

  if (action === "get") {
    const resolved = resolveManagedKey(id);
    if ("error" in resolved) {
      process.stderr.write(`${resolved.error}\n`);
      return 2;
    }
    const found = readManagedState(configPath).find((s) => managedKeyId(s.entry) === id);
    process.stdout.write(`${id} = ${found?.value ?? "(unset)"}\n`);
    return 0;
  }

  if (action === "set" || action === "unset") {
    let value                 = null;
    if (action === "set") {
      const raw = argv[2];
      if (raw !== "true" && raw !== "false") {
        process.stderr.write(`config set: the value must be true or false, got '${raw ?? ""}'\n`);
        return 2;
      }
      value = raw === "true";
      const resolved = resolveManagedKey(id);
      if ("error" in resolved) {
        process.stderr.write(`${resolved.error}\n`);
        return 2;
      }
      // The side effect is shown BEFORE the write, so the decision is made with it in view.
      process.stdout.write(`주의: ${resolved.caution}\n`);
    }
    const res = applyManagedKey({ codexHome }, id, value);
    if (!res.ok) {
      process.stderr.write(`config ${action}: ${res.reason}\n`);
      return 1;
    }
    const from = res.priorValue ?? "(unset)";
    process.stdout.write(
      `${id}: ${from} -> ${res.appliedValue}${res.changed ? "" : " (already set; recorded)"}\n` +
        (res.backupPath ? `backup: ${res.backupPath}\n` : ""),
    );
    return 0;
  }

  process.stderr.write(`config: unknown action '${action}'\n${CONFIG_USAGE}\n`);
  return 2;
}

export function resolveCodexHome(env                    = process.env)         {
  const fromEnv = env.CODEX_HOME?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : join(homedir(), ".codex");
}

/**
 * The warning text for a soft flag that could not be enabled. PURE so the wording is
 * testable: main() only writes what this returns.
 *
 * The old surface was a parenthetical on the success line -- (soft-failed: x) -- which
 * read as a footnote to a success rather than as a feature the user just lost.
 */
export function renderSoftFailureWarning(key        , rec                        )         {
  const impact = SOFT_FEATURE_IMPACT[key] ?? "이 플래그에 의존하는 기능이 비활성화된다.";
  const lines = [
    `codexclaw: 경고 — '${key}' 를 켤 수 없었다${rec?.failure ? ` (exit ${rec.failure.exitCode})` : ""}`,
    `  영향: ${impact}`,
  ];
  if (rec?.failure?.message) lines.push(`  codex: ${rec.failure.message}`);
  lines.push(`  확인: codex features list | grep ${key}`);
  lines.push(`  수동: codex features enable ${key}`);
  return `${lines.join("\n")}\n`;
}

export function makeRealRunner()              {
  return (args) => {
    const res = spawnSync("codex", [...args], { encoding: "utf8" });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
}

function main(argv                   )         {
  const cmd = argv[0];
  const run = makeRealRunner();
  const codexHome = resolveCodexHome();

  switch (cmd) {
    case "hook": {
      // SessionStart self-heal. FAIL-OPEN without exception: a config-guard problem must
      // never stop a session from starting, so every failure path is a silent exit 0.
      if (argv[1] !== "session-start") return 0;
      try {
        const outcomes = selfHealDeclaredFeatures(makeRealSelfHealDeps(codexHome, run));
        const context = renderSelfHealContext(outcomes);
        if (context) {
          process.stdout.write(
            `${JSON.stringify({
              hookSpecificOutput: {
                hookEventName: "SessionStart",
                additionalContext: context,
              },
            })}\n`,
          );
        }
      } catch {
        /* fail-open */
      }
      return 0;
    }
    case "enable": {
      const m = activate({ run, codexHome });
      // An explicit enable resumes self-heal: the user just asked for codexclaw back.
      try {
        clearSelfHealOptOut(codexHome);
      } catch {
        /* the opt-out is an optimisation, not a gate */
      }
      const turnedOn = Object.entries(m.flags)
        .filter(([, r]) => r.enabledByCodexclaw)
        .map(([k]) => k);
      const failed = Object.entries(m.flags)
        .filter(([, r]) => r.enableFailed)
        .map(([k]) => k);
      process.stdout.write(
        `codexclaw: enabled [${turnedOn.join(", ") || "none"}]` +
          (m.backupPath ? `\nbackup: ${m.backupPath}` : "") +
          "\n",
      );
      // stderr, not stdout: this is a warning about a capability the user asked for,
      // and it must not read as part of the success line. Exit stays 0 — activation
      // itself succeeded.
      for (const key of failed) process.stderr.write(renderSoftFailureWarning(key, m.flags[key]));
      return 0;
    }
    case "disable": {
      const r = deactivate({ run, codexHome });
      if (r.noManifest) {
        process.stdout.write("codexclaw: no install manifest; nothing to revert\n");
      } else {
        const lines = [
          `codexclaw: disabled [${r.disabled.join(", ") || "none"}]; kept pre-existing [${r.skippedPreExisting.join(", ") || "none"}]`,
        ];
        if (r.restoredKeys.length > 0) lines.push(`restored keys: ${r.restoredKeys.join(", ")}`);
        if (r.skippedExternal.length > 0) {
          const detail = r.skippedExternal.map((s) => `${s.target} (${s.reason})`).join(", ");
          lines.push(`left to their current owner: ${detail}`);
        }
        // Reported, never a gate: the file changing since install is normal, because
        // codexclaw is not its only writer.
        if (r.fileDrifted) lines.push("note: config.toml changed since activation; reverted per key");
        if (r.featuresStateUnavailable) {
          lines.push("note: could not read 'codex features list'; reverted flags from the manifest alone");
        }
        process.stdout.write(`${lines.join("\n")}\n`);
      }
      return 0;
    }
    case "status": {
      const state = readDeclaredState(run);
      for (const [k, v] of state) process.stdout.write(`${k}: ${v ? "enabled" : "disabled"}\n`);
      return 0;
    }
    case "config":
      return runConfig(argv.slice(1), codexHome);
    default:
      process.stderr.write("usage: config-guard <enable|disable|status|config>\n");
      return 2;
  }
}

// Realpath both sides: symlinked installs (plugin cache, npm global) otherwise miss.
const isDirect = (() => {
  try {
    if (process.argv[1] === undefined) return false;
    const self = realpathSync(fileURLToPath(import.meta.url));
    let invoked = process.argv[1];
    try {
      invoked = realpathSync(invoked);
    } catch {
      /* keep unresolved */
    }
    return self === invoked;
  } catch {
    return false;
  }
})();
if (isDirect) {
  process.exit(main(process.argv.slice(2)));
}
