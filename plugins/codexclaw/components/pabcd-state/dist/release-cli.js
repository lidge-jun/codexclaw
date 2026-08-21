/**
 * release-cli.ts — `cxc release`: assemble a candidate manifest from real receipts
 * and refuse publication when the evidence does not describe the candidate commit.
 *
 * release-gate.ts shipped the schema (issue #21) but nothing produced a manifest, so
 * the gate could not refuse anything. This is the producer.
 *
 * Verbs:
 *   release init      --version <v> [--candidate <output-path>] [--sha <sha>]
 *   release receipt   (--version <v> | --candidate <path>) --name <n> --evidence <e> [...]
 *   release platform  (--version <v> | --candidate <path>) --platform <p> --sha <sha> --ci-run <id> [--passed|--failed]
 *   release tests     (--version <v> | --candidate <path>) --pass <n> --fail <n> --sha <sha>
 *   release inventory (--version <v> | --candidate <path>) --hash <sha256:...> --skills <n> --hooks <n> --published-tests <n>
 *   release verify    (--version <v> | --candidate <path>) [--json] [--allow-deferred] [--actual-inventory-hash <h>]
 *
 * `init` always takes --version (it is the manifest body) and may take --candidate as
 * the OUTPUT path. The other verbs address an existing candidate with --version XOR
 * --candidate; zero matches and multiple matches are both explicit errors.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { renameWithRetry } from "./atomic-write.js";

import {
  CANDIDATE_SCHEMA_VERSION,
  MLB_1_0_RECEIPTS,
  isPrerelease,
  isReleaseReady,
  parseVersion,
  validateCandidateManifest,




} from "./release-gate.js";






/** Receipts this release train earns for itself, as opposed to the MLB 1.0 tracks. */
export const TRAIN_RECEIPTS                    = [
  { name: "inventory-sync", source: "#25", status: "missing" },
  { name: "test-suite", source: "ci.yml", status: "missing" },
  { name: "gate", source: "gate.mjs", status: "missing" },
  { name: "build", source: "build.mjs", status: "missing" },
  { name: "packed-install-lifecycle", source: "packed-install.yml", status: "missing" },
  { name: "platform-ci", source: "ci.yml", status: "missing" },
];

/** Why each MLB 1.0 receipt may be deferred on a 0.2.x train. */
const MLB_DEFERRAL_REASON = "target: MLB 1.0, not required for 0.2.x";

export const RELEASE_DIR = join(".codexclaw", "release");

function usage()                   {
  return {
    code: 1,
    output: [
      "release: expected one of:",
      "  release init      --version <v> [--candidate <output-path>] [--sha <sha>]",
      "  release receipt   (--version <v> | --candidate <path>) --name <n> --evidence <e> [--sha <sha>] [--status present|missing|failed|deferred] [--reason <text>]",
      "  release platform  (--version <v> | --candidate <path>) --platform ubuntu|windows|macos --sha <sha> --ci-run <id> [--passed|--failed]",
      "  release tests     (--version <v> | --candidate <path>) --pass <n> --fail <n> [--total <n>] --sha <sha>",
      "  release inventory (--version <v> | --candidate <path>) --hash <sha256:...> --skills <n> --hooks <n> --published-tests <n>",
      "  release classify  --version <v>                     prints: stable | prerelease",
      "  release verify    (--version <v> | --candidate <path>) [--json] [--allow-deferred] [--actual-inventory-hash <h>]",
    ].join("\n"),
  };
}

function readFlag(argv          , name        )                {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function hasFlag(argv          , name        )          {
  return argv.includes(name);
}

function candidateFileName(version        )         {
  return "candidate-" + version + ".json";
}

/**
 * Resolve which candidate file a verb operates on. --version and --candidate are
 * mutually exclusive; neither present means we look for exactly one candidate, and
 * both zero and multiple are errors rather than a silent guess.
 */
export function resolveCandidatePath(
  argv          ,
  cwd        ,
)                                       {
  const version = readFlag(argv, "--version");
  const explicit = readFlag(argv, "--candidate");
  if (version && explicit) {
    return { error: "--version and --candidate are mutually exclusive" };
  }
  if (explicit) return { path: resolve(cwd, explicit) };
  if (version) return { path: join(cwd, RELEASE_DIR, candidateFileName(version)) };

  const dir = join(cwd, RELEASE_DIR);
  if (!existsSync(dir)) {
    return { error: "no candidate found: " + RELEASE_DIR + " does not exist (run: release init --version <v>)" };
  }
  const found = readdirSync(dir).filter((f) => f.startsWith("candidate-") && f.endsWith(".json"));
  if (found.length === 0) {
    return { error: "no candidate found in " + RELEASE_DIR + " (run: release init --version <v>)" };
  }
  if (found.length > 1) {
    return {
      error:
        "multiple candidates in " + RELEASE_DIR + " (" + found.join(", ") +
        "); pass --version <v> or --candidate <path>",
    };
  }
  return { path: join(dir, found[0]) };
}

function readCandidate(path        )                                                      {
  if (!existsSync(path)) return { error: "candidate not found: " + path };
  let parsed         ;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { error: "candidate is not valid JSON: " + (err         ).message };
  }
  return { manifest: parsed                      };
}

/** Atomic write so a crashed step never leaves a half-written candidate. */
function writeCandidate(path        , manifest                   )       {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(manifest, null, 2) + "\n");
  renameWithRetry(tmp, path);
}

function nowIso()         {
  return new Date().toISOString();
}

function defaultSha()                {
  return process.env.GITHUB_SHA ?? null;
}

function runInit(argv          , cwd        )                   {
  const version = readFlag(argv, "--version");
  if (!version) return { code: 1, output: "release init: --version <v> is required" };
  const sha = readFlag(argv, "--sha") ?? defaultSha();
  if (!sha) {
    return { code: 1, output: "release init: --sha <sha> is required (or set GITHUB_SHA)" };
  }
  const explicit = readFlag(argv, "--candidate");
  const path = explicit
    ? resolve(cwd, explicit)
    : join(cwd, RELEASE_DIR, candidateFileName(version));

  const manifest                    = {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    candidateSha: sha,
    version,
    createdAt: nowIso(),
    // Seed BOTH sets so the manifest is complete from creation: the train receipts
    // this release must earn, and the MLB 1.0 receipts it explicitly defers.
    receipts: [
      ...TRAIN_RECEIPTS.map((r) => ({ ...r })),
      ...MLB_1_0_RECEIPTS.map((r) => ({
        ...r,
        status: "deferred"                 ,
        deferredReason: MLB_DEFERRAL_REASON,
      })),
    ],
    platforms: [],
    scorecard: {},
    nonGoals: [],
  };
  writeCandidate(path, manifest);
  return {
    code: 0,
    output:
      "release init: wrote " + path + " (" + manifest.receipts.length + " receipts, candidate " + sha + ")",
  };
}

function mutate(
  argv          ,
  cwd        ,
  fn                                                            ,
)                   {
  const resolved = resolveCandidatePath(argv, cwd);
  if ("error" in resolved) return { code: 1, output: "release: " + resolved.error };
  const read = readCandidate(resolved.path);
  if ("error" in read) return { code: 1, output: "release: " + read.error };
  const outcome = fn(read.manifest);
  if (typeof outcome !== "string") return outcome;
  writeCandidate(resolved.path, read.manifest);
  return { code: 0, output: outcome };
}

function runReceipt(argv          , cwd        )                   {
  const name = readFlag(argv, "--name");
  const evidence = readFlag(argv, "--evidence");
  if (!name) return { code: 1, output: "release receipt: --name <n> is required" };
  const statusRaw = readFlag(argv, "--status") ?? "present";
  const allowed                  = ["present", "missing", "failed", "deferred"];
  if (!allowed.includes(statusRaw                 )) {
    return { code: 1, output: "release receipt: --status must be one of " + allowed.join("|") };
  }
  const status = statusRaw                 ;
  if (status === "present" && !evidence) {
    return { code: 1, output: "release receipt: --evidence <e> is required for a present receipt" };
  }
  const sha = readFlag(argv, "--sha") ?? defaultSha();
  if (status === "present" && !sha) {
    return { code: 1, output: "release receipt: --sha <sha> is required (or set GITHUB_SHA)" };
  }
  const reason = readFlag(argv, "--reason");

  return mutate(argv, cwd, (manifest) => {
    const existing = manifest.receipts.find((r) => r.name === name);
    if (!existing) {
      return {
        code: 1,
        output:
          "release receipt: unknown receipt \"" + name + "\"; candidate declares " +
          manifest.receipts.map((r) => r.name).join(", "),
      };
    }
    existing.status = status;
    if (evidence) existing.evidence = evidence;
    if (status === "deferred") existing.deferredReason = reason ?? MLB_DEFERRAL_REASON;
    if (status === "present") {
      existing.capturedSha = sha          ;
      existing.capturedAt = nowIso();
    }
    return "release receipt: " + name + " -> " + status;
  });
}

function runPlatform(argv          , cwd        )                   {
  const platform = readFlag(argv, "--platform");
  const sha = readFlag(argv, "--sha") ?? defaultSha();
  const ciRun = readFlag(argv, "--ci-run");
  const allowed = ["ubuntu", "windows", "macos"];
  if (!platform || !allowed.includes(platform)) {
    return { code: 1, output: "release platform: --platform must be one of " + allowed.join("|") };
  }
  if (!sha) return { code: 1, output: "release platform: --sha <sha> is required (or set GITHUB_SHA)" };
  const passed = hasFlag(argv, "--failed") ? false : true;

  return mutate(argv, cwd, (manifest) => {
    const row                   = {
      platform: platform                                ,
      ciPassed: passed,
      testedSha: sha,
      ...(ciRun ? { ciRun } : {}),
    };
    const idx = manifest.platforms.findIndex((p) => p.platform === row.platform);
    if (idx >= 0) manifest.platforms[idx] = row;
    else manifest.platforms.push(row);
    return "release platform: " + platform + " passed=" + passed + " sha=" + sha + (ciRun ? " run=" + ciRun : "");
  });
}

function parseIntFlag(argv          , name        )                {
  const raw = readFlag(argv, name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function runTests(argv          , cwd        )                   {
  const pass = parseIntFlag(argv, "--pass");
  const fail = parseIntFlag(argv, "--fail");
  const total = parseIntFlag(argv, "--total");
  const sha = readFlag(argv, "--sha") ?? defaultSha();
  if (pass === null || fail === null) {
    return { code: 1, output: "release tests: --pass <n> and --fail <n> must be non-negative integers" };
  }
  if (!sha) return { code: 1, output: "release tests: --sha <sha> is required (or set GITHUB_SHA)" };
  return mutate(argv, cwd, (manifest) => {
    manifest.testSuite = { pass, fail, measuredSha: sha, ...(total === null ? {} : { total }) };
    return "release tests: pass=" + pass + " fail=" + fail + (total === null ? "" : " total=" + total) + " sha=" + sha;
  });
}

function runInventory(argv          , cwd        )                   {
  const hash = readFlag(argv, "--hash");
  const skills = parseIntFlag(argv, "--skills");
  const hooks = parseIntFlag(argv, "--hooks");
  const publishedTests = parseIntFlag(argv, "--published-tests");
  if (!hash || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
    return { code: 1, output: "release inventory: --hash must look like sha256:<64 hex>" };
  }
  if (skills === null || hooks === null || publishedTests === null) {
    return {
      code: 1,
      output: "release inventory: --skills, --hooks and --published-tests must be non-negative integers",
    };
  }
  return mutate(argv, cwd, (manifest) => {
    manifest.inventoryHash = hash;
    manifest.publishedCounts = { tests: publishedTests, skills, hooks };
    return "release inventory: hash recorded; published tests=" + publishedTests + " skills=" + skills + " hooks=" + hooks;
  });
}

function runVerify(argv          , cwd        )                   {
  const resolved = resolveCandidatePath(argv, cwd);
  if ("error" in resolved) return { code: 1, output: "release: " + resolved.error };
  const read = readCandidate(resolved.path);
  if ("error" in read) return { code: 1, output: "release: " + read.error };
  const manifest = read.manifest;
  const allowDeferred = hasFlag(argv, "--allow-deferred");
  const actualInventoryHash = readFlag(argv, "--actual-inventory-hash") ?? undefined;
  const asJson = hasFlag(argv, "--json");

  const schemaErrors = validateCandidateManifest(manifest);
  const gate = schemaErrors.length
    ? { ready: false, blockers: []             }
    : isReleaseReady(manifest, { allowDeferred, actualInventoryHash });
  const blockers = [...schemaErrors, ...gate.blockers];
  const ready = blockers.length === 0;

  // Record the allowance on the manifest so the published artifact states what it
  // skipped, rather than leaving it in a CI log nobody reads.
  if (allowDeferred && manifest.allowedDeferred !== true) {
    manifest.allowedDeferred = true;
    writeCandidate(resolved.path, manifest);
  }

  if (asJson) {
    return {
      code: ready ? 0 : 1,
      output: JSON.stringify(
        { candidate: resolved.path, version: manifest.version, candidateSha: manifest.candidateSha, ready, blockers, allowedDeferred: allowDeferred },
        null,
        2,
      ),
    };
  }
  if (ready) {
    return {
      code: 0,
      output:
        "release verify: READY — " + manifest.version + " @ " + manifest.candidateSha +
        (allowDeferred ? " (deferred receipts allowed and recorded)" : ""),
    };
  }
  return {
    code: 1,
    output: [
      "release verify: NOT READY — " + blockers.length + " blocker(s):",
      ...blockers.map((b) => "  - " + b),
    ].join("\n"),
  };
}

/**
 * `release classify` — one SemVer parser shared with release.yml.
 *
 * The workflow previously used `case "$VERSION" in *-*)`, a substring test that
 * classified the stable `1.0.0+build-with-hyphen` as a prerelease. The same value
 * drives both the GitHub prerelease label and (formerly) gate leniency, so a
 * misclassification could mislabel a release. One parser, one answer.
 */
function runClassify(argv          )                   {
  const version = readFlag(argv, "--version");
  if (!version) return { code: 1, output: "release classify: --version <v> is required" };
  const parsed = parseVersion(version);
  if (!parsed) return { code: 1, output: "release classify: not valid semver: " + version };
  return { code: 0, output: isPrerelease(version) ? "prerelease" : "stable" };
}

export function runReleaseCli(argv          , cwd        )                   {
  const verb = argv[0];
  switch (verb) {
    case "init":
      return runInit(argv, cwd);
    case "receipt":
      return runReceipt(argv, cwd);
    case "platform":
      return runPlatform(argv, cwd);
    case "tests":
      return runTests(argv, cwd);
    case "inventory":
      return runInventory(argv, cwd);
    case "classify":
      return runClassify(argv);
    case "verify":
      return runVerify(argv, cwd);
    default:
      return usage();
  }
}
