# 020 — wp1 remote evaluation: installed payload and execution evidence

Status: PROPOSED, written during wp0 P. Main must verify these documents and audit
them before B. No command in this document was executed while authoring it.
The `020` filename is the user-assigned slot; this document designs **wp1**, not wp2.
Code listings in [021](021_evaluation_contract.md) are proposed files, not installed tools.

## 1. Loop spec and authority

- Archetype: satisfy-spec measurement foundation, then paired baseline/candidate comparison.
- Trigger: main authorizes wp1 B after wp0 document verification and A audit.
- Outcome: a replayable, identity-bound evidence packet that distinguishes an
  installed payload, a hook replay, a real Codex run, and actual routing proof.
- Non-goals: change loop defaults, delete hooks, implement skill routing, add a
  daemon/MCP/provider, release, publish, update Codex CLI, or repair shared services.
- Verifier: focused Node tests, installed-root benchmark, recorder artifacts,
  offline analyzer, and main's provenance/behavior review. Commands below are
  **NOT RUN**; source paths were inspected, not executable behavior verified.
- Stop: wp1 may complete the measurement tooling with negative fixture proof;
  candidate adoption is withheld until real-run evidence is eligible and all
  behavior rows pass. UNKNOWN is not performance improvement or adoption PASS.
- Memory artifact: this file and 021; private run artifacts stay on macmini.
- Outcomes: eligible-for-review, failed, unknown, or explicit permission/input blocker.
- Escalation: missing trust approval, missing exact model/effort/priority wire
  proof, unexpected shared-state changes, or two failed attempts at the same
  recording mechanism return to main. No silent retries or provider/model changes.
- Bounds: one owned Codex subprocess group per run; default 180 s (aligned with
  main's 010 initial fixture timeout), allowed
  1–600 s, TERM then KILL after 3 s. Run serially until identities and proof
  channels are established. No fan-out, SSH client, or nested runner scheduling.

The project direction is agent-led dynamic skill/reference routing and fewer
instructional hooks, not a new opt-in lightweight profile. Bare `cxc-loop` means
HOTL completion of in-scope plans; explicit interview/plan-only and external
permission boundaries remain intact (`006:29–39,52–54`, `007:30–49`). A docs-only
request does not become HOTL implementation because it contains that term.
`pabcd_initiative` remains read-only and agent-neutral. Its README:3–9,48–50 and
skills/dev/SKILL.md:44–52,67–72 supply methodology, not Codex wire syntax.

## 2. Current owners and bounded reuse

Anchors below were read at source HEAD `065fa1e887f1d64dcd9c822f34c5fb8626d80a55`.
Paths in this document are repository-relative unless absolute. Authoring root:
`/Users/jun/.codex/worktrees/974c/codexclaw`. Recheck anchors before B.

| Owner | Current evidence | Decision |
| --- | --- | --- |
| `.github/workflows/packed-install.yml:43–79,115–160` | committed-dist check, tar/SHA256, installer JSON path, isolated CODEX_HOME, installed dispatcher | Reuse operations, not a second packer. Current selected doctor checks permit WARN; recorder requires PASS for its four named checks. |
| `plugins/codexclaw/scripts/check-versions.mjs:26–30,42–62` | strips build metadata; checks manifest/component/inventory surfaces | Not a cache freshness verifier. Keep unchanged; compare full manifest version and payload digest in the run packet. |
| `scripts/dev-symlink.sh:19,48–59` | hardcoded 0.1.0 and rm/symlink replacement | Never use for these experiments. Use independent real-copy installations. |
| `plugins/codexclaw/components/cxc-ops/src/doctor.ts:394–487` | installed-root and per-handler trust diagnostics; empty trust set WARN | Invoke installed dispatcher. A version match does not prove active-session adoption or content equality. |
| `plugins/codexclaw/components/cxc-ops/src/hook-trust.ts:101–131,368–369,441–464` | handler identity hashes; follows config symlink; bootstrap/safety pin; backup/rollback | Do not call retrust from recorder. Reject escaping/symlinked config; retain host approval. Trust hash is not dist-content hash. |
| `plugins/codexclaw/scripts/hook-bench.mjs:23–47,60–107,149–162,192–252` | real compiled entrypoint replay, isolated home, cold/warm/spawn-floor metrics | Add only installed-root selection, harness identity and output-byte accounting. Synthetic replay is not host invocation/trust evidence. |
| `plugins/codexclaw/scripts/hook-bench-compare.mjs:28–58` | per-hook comparison, missing hooks fail; incomplete timings/errors not rejected | Leave implementation unchanged; analyzer validates reports before using it. Zero/negative floor-adjusted baseline is UNKNOWN, not percent gain. |
| `plugins/codexclaw/components/cxc-ops/src/activation-trace.ts:18–42,78–120,130–150` | four-layer schema; bytes/4; opt-in writer | Leave unchanged. Search found no production TraceBuilder/emitTrace callers. An env switch alone does not collect observations. |
| `plugins/codexclaw/components/messenger-bridge/src/runner.ts:79–105,109–199,379–392` | exec argv, JSONL events, inherited process environment | Reuse known argv shapes. Do not import the messenger lifecycle: no env/tier/raw-artifact contract and resume fallback would contaminate trials. |
| `plugins/codexclaw/components/recall/src/rollout.ts:214–256` | response_item-only parser | Do not use as evidence filter: loses turn_context, unknown events and custom-tool calls. Analyzer reads original JSONL with line anchors. |
| `plugins/codexclaw/test/hook-e2e.test.mjs:827–859` | cache-relative skills fixture and compiled hook output | Reuse activation case, not its skip-on-missing-dist behavior as installation success. |

Necessity decisions: do not add a packer, SSH wrapper, model client, telemetry hook,
cachebuster implementation, or another activation schema. A recorder is needed
because existing runner does not retain raw artifacts/isolated ownership. One
offline analyzer is needed because existing parsers discard proof fields and
benchmark comparison can accept invalid measurements. Both are opt-in scripts;
neither is wired into normal sessions, a CLI dispatcher, hooks, or CI in wp1.

## 3. Exact wp1 file map and dependencies

| Order | Action | Exact path | Delta |
| --- | --- | --- | --- |
| 1 | MODIFY | `plugins/codexclaw/scripts/hook-bench.mjs` | Section 4 hunks: root override, stable harness digest, byte sums, environment override removal. |
| 1 | MODIFY | `plugins/codexclaw/test/hook-bench-cwd.test.mjs` | Section 4 final hunk: ambient skill override regression. |
| 2 | NEW | `plugins/codexclaw/scripts/probe-recorder.mjs` | Complete file in 021 §2; host-local run and artifact identity only. |
| 3 | NEW | `plugins/codexclaw/scripts/probe-evidence.mjs` | Complete file in 021 §3; offline run/benchmark checks. Imports existing compareReports and recorder's file digest only. |
| 4 | NEW | `plugins/codexclaw/test/probe-evidence.test.mjs` | Complete starter/regression file in 021 §4; additional mandatory cases specified there with constructible fixtures. |
| 5 | MODIFY | `docs/native-thin-harness.md` | Section 4 final SoT hunk: measurement does not establish runtime delivery or actual model identity. |

No DELETE, new dependencies, package scripts, workflow, manifest, component source,
component dist, activation-trace, or production hook changes in this wp1 slice.

Audit correction: the recorder must not inherit the host's executable search path. After validating the entire installed payload, provision two experiment-owned cxc/codex launchers in the fresh isolated home, prepend only that launcher directory and the selected Node/system paths, and set CODEXCLAW_CXC to the absolute candidate dispatcher. Record and hash those launchers. Test a conflicting global cxc that writes a marker: the actual launched cxc must be the candidate and the global marker must stay absent. A separate record(spec) fixture places a symlinked dispatcher inside the otherwise valid payload; it must be rejected before doctor or any linked target executes. Final native probes also verify the actual executable resolution rather than trusting PATH construction alone.
Candidate payload construction/version changes belong to the main roadmap's
candidate owner, not this measurement plan. New `.mjs` files need no component
build; existing component gates are regression checks only.

The future source delta is deliberately outside wp0 authorization. During wp0,
only `020_remote_evaluation.md` and `021_evaluation_contract.md` may be created.

## 4. Existing before/after hunks

These are focused unified hunks, not a command to apply them during wp0. Preserve
all unrelated code. `--plugin-root` is a **new proposed benchmark option**, not
an existing Codex option. Run the same controller-side benchmark file for both
payloads so benchmark instrumentation does not require modifying the baseline.

```diff
--- a/plugins/codexclaw/scripts/hook-bench.mjs
+++ b/plugins/codexclaw/scripts/hook-bench.mjs
@@
 import { spawnSync } from "node:child_process";
+import { createHash } from "node:crypto";
@@
-const MANIFEST_PATH = join(PLUG_ROOT, ".codex-plugin", "plugin.json");
+const HARNESS_SHA256 = createHash("sha256")
+  .update(readFileSync(fileURLToPath(import.meta.url))).digest("hex");
@@
-function loadHooks() {
-  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
+function loadHooks(pluginRoot = PLUG_ROOT) {
+  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
@@
-    const absPath = join(PLUG_ROOT, relPath.replace(/^\.\//, ""));
-    if (!existsSync(absPath)) continue;
+    const absPath = join(pluginRoot, relPath.replace(/^\.\//, ""));
+    if (!existsSync(absPath)) throw new Error(`missing manifest hook file: ${relPath}`);
@@
-              command: hook.command.replace(/\$\{PLUGIN_ROOT\}/g, PLUG_ROOT),
+              command: hook.command.replace(/\$\{PLUGIN_ROOT\}/g, pluginRoot),
@@
 export function benchEnv(tmpHome) {
-  return {
+  const env = {
@@
     CODEX_SQLITE_HOME: join(tmpHome, ".codex"),
   };
+  for (const key of Object.keys(env)) {
+    if (/^(?:CXC_|CODEXCLAW_)/.test(key)) delete env[key];
+  }
+  delete env.NODE_OPTIONS;
+  return env;
 }
@@
-  return { elapsed, exitCode: result.status, isNoOp };
+  return {
+    elapsed, exitCode: result.status, isNoOp,
+    stdoutBytes: Buffer.byteLength(result.stdout || ""),
+    stderrBytes: Buffer.byteLength(result.stderr || ""),
+  };
@@
-  const hooks = loadHooks();
+  const rootIdx = args.indexOf("--plugin-root");
+  if (rootIdx >= 0 && (!args[rootIdx + 1] || args[rootIdx + 1].startsWith("--"))) {
+    throw new Error("--plugin-root requires a directory");
+  }
+  const pluginRoot = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : PLUG_ROOT;
+  const hooks = loadHooks(pluginRoot);
@@
     let noOps = 0;
     let errors = 0;
+    let stdoutBytes = 0;
+    let stderrBytes = 0;
@@
         if (r.exitCode !== 0) errors++;
+        stdoutBytes += r.stdoutBytes;
+        stderrBytes += r.stderrBytes;
@@
       errorCount: errors,
+      stdoutBytes,
+      stderrBytes,
@@
       schemaVersion: 1,
+      harnessSha256: HARNESS_SHA256,
+      pluginRoot,
```

Byte counts measure raw hook protocol output, **not** exact injected content or
tokens. Missing result/status still increments errorCount; analyzer rejects the
report even if the legacy benchmark process exits zero. This additive schema
extension keeps existing consumers intact; the new analyzer requires these fields.
No matcher simulation is added. Scope says what this benchmark cannot prove.

```diff
--- a/plugins/codexclaw/test/hook-bench-cwd.test.mjs
+++ b/plugins/codexclaw/test/hook-bench-cwd.test.mjs
@@
 test("the bench env sets USERPROFILE alongside HOME", () => {
@@
   assert.equal(env.CODEX_SQLITE_HOME, join(tmpHome, ".codex"));
 });
+
+test("bench env removes ambient routing and preload overrides", () => {
+  const keys = ["CXC_SKILLS_DIR", "CODEXCLAW_WORKTREE_ROOTS", "NODE_OPTIONS"];
+  const before = keys.map(key => process.env[key]);
+  try {
+    for (const key of keys) process.env[key] = "probe-sentinel";
+    const env = benchEnv(join(tmpdir(), "cxc-bench-home-probe"));
+    for (const key of keys) assert.equal(env[key], undefined);
+  } finally {
+    keys.forEach((key, i) => {
+      if (before[i] === undefined) delete process.env[key];
+      else process.env[key] = before[i];
+    });
+  }
+});
```

```diff
--- a/docs/native-thin-harness.md
+++ b/docs/native-thin-harness.md
@@
 Hook count alone is not a performance metric. Measure session-once and hot-path hooks separately, including invocation frequency, no-op rate, process creation, filesystem IO, and platform-specific p50/p95. Security and PABCD invariants may intentionally cost more, but they still require an explicit budget and regression fixture.
+
+Evaluation scripts are opt-in and run outside ordinary sessions. Compiled hook
+replay measures synthetic invocation cost, not host matcher/trust activation.
+Installed version, selected configuration, and actual routed model/service tier
+are separate claims. Missing execution proof is unknown, never an inferred pass;
+raw artifacts and parent/child provenance must be reviewed before adoption.
```

## 5. Installation, isolation and trust contract

1. Main provisions a unique real directory per candidate/run under macmini's
   `/Users/junny/cxc-probes/260905/`. `home`, `work`, prompt, approval record and
   installer JSON are inside that run root. `work` is a dedicated fixture checkout,
   not the canonical initiative or an active user checkout. Never reuse `output`.
2. Set HOME/USERPROFILE to that run's home; CODEX_HOME/CODEX_SQLITE_HOME to its
   `.codex`. Recorder allowlists environment instead of inheriting CXC overrides,
   NODE_OPTIONS, provider credentials, or an active task's session IDs.
3. Credentials are provisioned separately by the authorized operator using the
   supported host mechanism. No inline auth flags, shell-expanded tokens,
   credential copying commands, env dumps, config dumps, or auth handling in
   these scripts. A provider requiring additional env access is a main-reviewed
   plan amendment, not an automatic environment fallback.
4. Resolve the installed root from actual `codex plugin add ... --json` output;
   require its real path under isolated CODEX_HOME and no payload/config symlinks.
   Hash full payload, config, Codex binary, prompt, approval note and controller.
   Record full manifest version and clean source SHA. Dirty source is refused;
   main must first commit the intended candidate, never discard dirty work.
5. Reuse the existing tar/SHA256 flow if transporting a payload. Local marketplace
   syntax/ref acceptance must be checked from the physical host CLI first; do not
   invent a `codex plugin add /archive.tar.gz` API. An extracted archive is not an
   installed plugin. Main records source→archive→installer→payload association in
   the approval note, including exact source SHA and expected manifest version.
6. Recorder calls installed `bin/cxc.mjs doctor --json` before inference and after
   completion. Require unique PASS checks for manifest/hooks/hook-trust/install-root.
   Raw doctor process exit and stderr are retained; other existing WARN/FAIL
   categories are reviewed separately. The four selected checks are not claimed
   to prove the whole doctor is green.
7. Hook approval occurs through Codex and remains visible. Trust refusal is an
   experiment outcome. No `--dangerously-bypass-hook-trust`, retrust, bootstrap,
   disabled safety pin, or automatic repair in recorder. CI's bootstrap option
   is not permission to use it in this experiment.
8. Start a fresh `codex exec` per run, never resume. Updating a cache does not
   retrofit an already-running session. Post-run config/payload drift invalidates
   the comparison. Preserve shared home/service pre/post status evidence separately
   in main's preflight; the recorder never reads or mutates the shared credential home.

Approval/sandbox bypass is an explicitly approved execution condition, **not
isolation**. The private directory and env prevent accidental state mixing but
cannot constrain a fully privileged model. Only harmless fixture prompts are used.
Native host worktree/session guards remain enabled. Recorder kills only its own
POSIX process group on timeout/cancellation/completion; it never kills an app,
launchd service, another run, or a process found by name.
This covers only descendants remaining in that group, not separately detached
processes. Fixtures that launch background work must supply explicit, fixture-owned
teardown proof for those resources; recorder kill scope must not expand.
Canonical `/Users/junny/...` run paths are intentional: rejecting macOS `/tmp`
symlink aliases is acceptable. Preserve the exact installer-returned root.

Raw stdout/stderr/rollouts may contain sensitive text even when no credentials are
passed inline. Keep output mode 0700/files 0600, disable provider header/body debug
logging before starting, inspect locally, and publish only reviewed non-secret
excerpts. If a secret unexpectedly appears, quarantine the packet and stop export;
do not call a hash or a regex a complete redaction strategy.

## 6. Confirmed preflight and bounded proof contract

Main supplied these actual preflight results during wp0 document authoring:
remote focused tests **145 passed / 0 failed**; Codex CLI 0.146 returned
`ASTRA_PREFLIGHT_OK`. Rollout: model `gpt-6-astra`, effort `high`, approval `never`,
sandbox `danger-full-access`. This author did not rerun them. Main retains the
actual output/artifact paths; these results are not tests of the proposed scripts.

The usage row reported requested/resolved Astra, requestedEffort high,
caller/requestedServiceTier priority, and tierOutcome canonical priority,
wireKind service-tier, wireValue priority, fastOutcome applied, confirmation
assumed, responseServiceTier default. User clarified the default response echo
is a known OCX bug tracked upstream and **excluded from investigation/fix here**.
It neither denies priority nor blocks candidate comparison. No new external or
source research is required to finish these plans.

Main supplied the primary-source correlation contract from OCX
`src/server/request-log-conversation.ts`: normalizeLogConversationId is
`sha256(raw.trim()).hex.slice(0,32)`. Use this exact deterministic join from CLI
thread ID to usage conversationId, then inspect every matching unique request ID.
Never compare raw IDs directly or take the last nearby row. Main verifies the
adapter source/version binding. OCX `src/providers/fastwire.ts:383` explains that
the ChatGPT-internal Codex path can echo default on priority requests; the echo
is non-authoritative. No hidden-scheduler attestation is required.

The offline manifest in 021 is our artifact contract, not an upstream API.
Required per participating parent/child session: actual turn_context model and
effort; exact conversation digest and unique request binding; requested and
resolved model; requested effort; configured canonical/wire service-tier priority.
CLI stdout JSONL does not carry effort/tier: obtain them from turn_context and
exactly joined usage, not from the CLI's final text or argv alone. Unknown/missing
required proof is UNKNOWN/ineligible; contradicting proof is FAILED.

An `applied` + `assumed` priority sample with the known `default` echo **is eligible
for paired configured-priority comparison** once the required evidence above
matches. Record scheduler confirmation as unknown and the raw echo as a known
limitation. Do not claim confirmed upstream scheduling, infer a downgrade, or
require an unattainable backend-confirmed tier criterion. No model suffix switch.

Observed rollout event types on CLI 0.146 were session_meta,
event_msg/task_started,user_message,agent_message,token_count,task_complete,
response_item/message (7), world_state (1), turn_context (1). There were **no hook
lifecycle events**. Their absence means hook invocation count UNKNOWN, not zero.
Actual behavior plus captured instruction-message bytes and/or separately labeled
source replay can support paired choice. Full syscall counts, host hook timings,
or hidden scheduling are optional telemetry, never eligibility requirements.

Main independently reviews provenance, complete child/request inventory, and
behavior. V1/V2 use the surface actually exposed by the host; unavailable surfaces
are recorded unavailable. Full-history forks preserve their existing override
rules (spawn-attach-hook.ts:856–879). The analyzer does not create a new host gate.

## 7. Activation/negative matrix and promotion criteria

| Case | Constructible trigger | Required observable evidence |
| --- | --- | --- |
| Plain session | ordinary bounded read-only request, no loop/goal | no automatic HOTL; no external write; applicable skill only |
| Bare loop | explicit `cxc-loop` on a disposable bounded fixture | completes in-scope plan; required skill/ref reads and completion evidence; does not expand permission |
| Plan-only / interview | explicit restriction on same fixture | stops before B or awaits user; no host goal/implementation from mere mention |
| V1 + V2 skill transport | use each surface actually exposed by installed host | tool input, hook result, actual SKILL/ref read and child behavior; unavailable surface UNKNOWN, never fabricated |
| Override/inherit/fork | distinct caller/config/default values; full-history separate run | exact effective parent/child tuple; caller preserved and illegal fork override absent |
| Re-fire / compact | duplicate same turn, then real compact recovery fixture | no duplicate instruction cost; required state/guard survives |
| Missing receipt | compiled stop and completion-gate fixtures | child release remains bounded; parent's unsupported completion denied |
| Protected checkout | managed temp worktree + attempted self-delete payload | denial before destructive command; never invoke a real destructive shell command as test setup |
| Missing/drifted trust | isolated install without approval / changed handler | recorder stops before inference; no auto-retrust |
| Missing/stale dist | omit a required installed dist file or mismatch payload | selected doctor/payload preflight fails; no skip-as-pass |
| Wrong install identity | outside-home path, symlink payload, wrong full version | preflight exit 2; zero Codex exec calls |
| Incomplete run | malformed JSONL, no thread/start/done, nonzero exit, signal | failed packet, including retained raw outputs and terminal rc/signal |
| Missing model/tier | omit turn_context model/effort or joined usage/wire claim | analyzer UNKNOWN (2), never argv→actual inference |
| Wrong model/effort/wire | supply an anchored differing effective model, effort or wire priority | analyzer FAILED (1); no silent model switch or Fast removal |
| Known tier echo | applied + assumed + priority wire + response default | eligible for configured-priority comparison; raw echo retained, scheduler unknown |
| No hook events | the observed CLI 0.146 rollout shape | invocation count UNKNOWN, not zero; does not block paired behavior/byte comparison |
| Benchmark false-green | errorCount>0, zero hooks, duplicates, missing timing, incompatible host/harness | FAILED or UNKNOWN before legacy comparison |
| Hook removed | baseline hook absent after | existing comparison remains FAILED; removal is a separate reviewed behavior decision, never silently zero latency |

Source regression owners: hook-e2e.test.mjs:436,638,827;
components/pabcd-state/test/hook-continuation.test.ts:529–569;
components/pabcd-state/test/worktree-guard.test.ts:414–451;
components/cxc-ops/test/hook-trust.test.ts:222,327,336,368.
Do not replace these assertions with SKILL.md phrase tests. Real-run activation
uses read/tool/output evidence and an independent behavior oracle; a prompt that
names a skill, an injected body, or a zero-error tool call alone proves too little.

Mandatory reachable hook fixtures are owned by the future
`plugins/codexclaw/test/probe-evidence.test.mjs` additions in **021 §5** (compiled
manifest-driven spawn V1/V2, nonmatch, repeated input, protection and completion
cases). Reuse existing hook-e2e.test.mjs:827's cache-shaped setup and existing
invariant suites. The generic matcherless benchmark is explicitly not their
activation proof. Real model behavior is a separate physical recorder fixture.

Report separately when observable: metadata bytes; selected SKILL-body bytes; selected reference
bytes; hook-added context bytes; raw hook stdout/stderr bytes; host hook invocation
counts; recovery failures; wall time; actual usage if exposed. Record unknown
for unobserved buckets. Missing optional metrics cannot make the whole sample
ineligible. Synthetic timing remains labeled synthetic, even when model behavior
and actual message-byte evidence support a paired decision. Do not double-count a body in both hook context and native
read without explaining two actual deliveries. Bytes/4 remains an estimate.

## 8. Exact commands for future physical macmini execution

All commands here are **future commands, NOT RUN in wp0**. Main selects the
actual authorized checkout; no remote CodexClaw path was established in 006.
Run these inside an already-open macmini shell. The runner contains no SSH.
The first remote wrapper hit zsh's readonly `status`; use `rc` throughout.

### 8.1 Source/preflight, no inference

```bash
# Set REPO to the verified wp1 checkout on macmini; never guess or repoint it.
: "${REPO:?set the verified macmini checkout path}"
cd "$REPO"
git rev-parse HEAD
git status --short
node --version
command -v codex
codex --version
codex exec --help
codex plugin marketplace add --help
codex plugin add --help
```

Main records the resolved binary, CLI version, supplied priority config evidence,
installer/source identity, scope, and trust approval into each run's `approval.md`.
The reported successful preflight already establishes this run's priority setting;
reuse its exact invocation/evidence and do not reopen scheduler/echo research.
These help commands are for reproducing a changed host only, not a requirement to
rerun discovery now. No CLI upgrade is authorized by this plan.

### 8.2 Focused proposed script verification

```bash
node --check plugins/codexclaw/scripts/probe-recorder.mjs
node --check plugins/codexclaw/scripts/probe-evidence.mjs
node --test --test-concurrency=1 \
  plugins/codexclaw/test/probe-evidence.test.mjs \
  plugins/codexclaw/test/hook-bench-cwd.test.mjs \
  plugins/codexclaw/test/hook-bench-report.test.mjs \
  plugins/codexclaw/test/hook-bench-compare.test.mjs
```

The new test paths are created during B from 021, so these commands cannot be
claimed executable now. The existing paths were read in P. All listed targets
are direct arguments, so the commands observe the proposed files/adjacent contract.
Complete the extra mandatory fixtures in 021 §5 before claiming C.

### 8.3 Installed baseline and candidate

Main prepares `baseline/spec.json` and `candidate/spec.json` using 021 §1 and
approves them before these exact commands. Each spec points to its isolated
real-copy installation, input fixture and approval note. The terminal's `REPO`
is the common controller checkout, not whichever candidate was last installed.

```bash
: "${REPO:?set controller checkout}"
BASE=/Users/junny/cxc-probes/260905
umask 077
node "$REPO/plugins/codexclaw/scripts/probe-recorder.mjs" "$BASE/baseline/spec.json"
rc=$?
printf 'baseline recorder rc=%s\n' "$rc"
# Stop here if rc is not 0; do not auto-retry or silently reuse output.
node "$REPO/plugins/codexclaw/scripts/probe-evidence.mjs" run "$BASE/baseline/output"
rc=$?
printf 'baseline evidence rc=%s\n' "$rc"
# Expected UNKNOWN/2 until real, independently reviewed proof.json is available.
```

After review and identical fixture/config conditions, run candidate separately:

```bash
node "$REPO/plugins/codexclaw/scripts/probe-recorder.mjs" "$BASE/candidate/spec.json"
rc=$?
printf 'candidate recorder rc=%s\n' "$rc"
# Stop here if rc is not 0.
node "$REPO/plugins/codexclaw/scripts/probe-evidence.mjs" run "$BASE/candidate/output"
rc=$?
printf 'candidate evidence rc=%s\n' "$rc"
```

Copy only the needed original JSONL evidence into `output/evidence/` after the
run, retaining byte identity/private permissions; do not modify captured payloads
to add missing proof fields. Main authors `output/proof.json` as references to
those files per 021. Re-run the same analyzer command; inspect its full JSON.
No blanket session-home export. No provider log-capture API is invented here.

### 8.4 Synthetic hook benchmark, separately labeled

Set these to the **installer-returned roots verified in run.json**, not a find
result or version guess. These commands do not produce model/tier proof.

```bash
: "${BASELINE_PLUGIN:?installer-returned baseline root}"
: "${CANDIDATE_PLUGIN:?installer-returned candidate root}"
node "$REPO/plugins/codexclaw/scripts/hook-bench.mjs" \
  --plugin-root "$BASELINE_PLUGIN" --iterations 25 --json > "$BASE/baseline/bench.json"
rc=$?
printf 'baseline bench rc=%s\n' "$rc"
# Stop on nonzero rc; preserve stderr separately if diagnosing a failure.
node "$REPO/plugins/codexclaw/scripts/hook-bench.mjs" \
  --plugin-root "$CANDIDATE_PLUGIN" --iterations 25 --json > "$BASE/candidate/bench.json"
rc=$?
printf 'candidate bench rc=%s\n' "$rc"
node "$REPO/plugins/codexclaw/scripts/probe-evidence.mjs" bench \
  "$BASE/baseline/bench.json" "$BASE/candidate/bench.json" 10
rc=$?
printf 'benchmark analysis rc=%s\n' "$rc"
```

`10` is the existing comparator's diagnostic default, not a user-approved
optimization target. Main evaluates noise/repeats and each invariant before
adoption; no invented minimum improvement percentage. Use a new run directory for
repeats, never overwrite failed artifacts. Repeated benign measurements are not
retry-as-fix for failures. Benchmark env is synthetic; no shared provider startup.

### 8.5 Relevant invariant regressions, only after main authorizes remote checks

```bash
node --test --test-concurrency=1 \
  plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts \
  plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts \
  plugins/codexclaw/components/pabcd-state/test/worktree-guard.test.ts \
  plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts
```

For a candidate that changes component source, main's candidate owner must build
and prove committed dist freshness before installation using the existing packed
workflow. This wp1 plan does not silently run a build or the repository-wide suite.

## 9. Review gate, bypass statement and handoff

The source contract and plan map must agree before B. Main reviews all new-file
listings, current hunks, every fixture's reachability, exact physical CLI syntax,
isolation/trust preconditions, and the proof mapping using a real captured sample.
Full roadmap integration, approval/FSM/goal transitions and B dispatch remain main-owned.

| Layer | Executing surface | Bypass | Residual | Wording |
| --- | --- | --- | --- | --- |
| E7 methodology | agent and main review | agent can ignore docs | scope/behavior needs human/independent review | discipline, not runtime enforcement |
| Opt-in script check (not a new host E-tier) | recorder/analyzer | operator can bypass scripts or forge all artifacts | hashes bind bytes, not truth/authenticity or complete child inventory | eligible-for-review only |
| Native trust/permissions | installed Codex | separate host bypass flag exists but is excluded here | full-access probe still lacks OS containment | preserve native checks; no stronger guarantee claimed |

Final adoption layer: main's evidence/provenance/behavior judgment; there is no
new unbypassable verifier. Main must not promote a candidate merely because the
analyzer exits 0. Script transport proof and benchmark eligibility are necessary
inputs, not sufficient proof that dynamic routing preserved all invariants.

Authoring verification: source-only reading and document diff inspection; no
syntax checks of proposed code, tests, build, SSH, model calls, installation,
trust mutation, or production file writes during wp0. These proposals are not a
claim of implemented or empirically verified tools.
