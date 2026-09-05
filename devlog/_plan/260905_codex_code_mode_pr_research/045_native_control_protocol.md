# 045 — Native same-thread / pending-answer A-repair protocol

Status: complete docs-only protocol proposal; **not A PASS, B authorization or native acceptance PASS**. Main owns phase A, authority, preparation/execution, review and all goal/FSM state. This delegate changes only this page. Dependencies: 040–044 and 020/021's existing private artifact/privacy contract.

## 1. Scope and stop contract

Archetype: satisfy-spec A repair, C3 documentation with C4 scrutiny of control/evidence boundaries. Goal: construct and independently verify 042 N17/N18/N20-I/N21/N22 on real native state. Verifier: pinned source-to-RPC review plus original artifacts and separate behavioral/accounting judgments below. Stop: return this plan; main decides audit readiness. Memory artifact: this page and existing private packets. Outcomes: accepted proposal, required revision, or explicitly unverified precondition. Escalation: unsupported ordering, unavailable blocked state/context/usage, or new authority returns to main.

- Primary **codex exec** remains the ordinary-probe path. Only same-thread goal control and pending-answer work uses a bounded **first-party codex app-server --stdio supplemental process**. Both variants use identical supplemental transport/settings/preparation/fixtures. Never compare its latency directly with exec as if transports were identical.
- No permanent daemon/listener, proxy, SDK framework, replacement model runtime, product recorder/evaluator/observer change, global config edit, trust bypass or direct goal DB/FSM edit. This supersedes 044/042's proposed recorder-change wording, not their semantic acceptance requirements. Main integrates that correction into siblings; this author cannot.
- Installed cxc-dev, pabcd, dev-testing and dev-code-reviewer were read fully. Source-grounding, reachable-precondition and independent-oracle rules apply. Docs scaffolding retains this numbered unit. Generic skill instructions to run verifiers, dispatch, commit or transition do not authorize those actions here. OpenAI API claims use requested local pinned source, not a latest-version claim.
- Later authorized attempt bounds: one root/owned process group per variant/case, one attempt, no automatic retry; 30s per control ACK, 180s per requested model turn, 60s to answer a known callback, 600s absolute wrapper fallback. Blocked preparation is capped at four actual goal turns within 600s. These are operator bounds, not native token budgets or completion criteria. Main records any changed bound before a new attempt. Every failed attempt remains in the population.

## 2. Observed feasibility and its limits

Private remote prefix **R** = /Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c on macmini-cf. Local operator prefix **E** = .codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/operator in this checkout. These are existing owned artifacts, not authority over other homes. Local scripts and missing remote raw RPC artifacts were read without product execution.

| Original / observation | What it proves and does not prove |
| --- | --- |
| R/runs/wp2-candidate-goal-seed-001/output, source d8c63f0; thread 01a070f4-6980-7632-a820-c2dc207b741d, native active/IDLE with one pending phase/task/open criterion | Real CLI model goal creation and bound-list registration. Its objective embeds temporary setup restrictions: historical evidence only, **not canonical N17 wording**. |
| Same root native-resume-preflight-001/observation.json and before/after histories | CLI resume retained ID, history prefix and config/payload/launchers but timed out at 180s despite OS rc0. Continuation turns only in rollout do not prove requested inspection/continuation success. |
| R/runs/wp2-candidate-api-question-001/native-stdio-preflight-001/requests.jsonl:1–5, responses.jsonl:34–35,54 | Initialize → thread/start → turn/start → actual question. Thread 01a07117-3f7c-73a2-8e3a-6367f7d96602, turn 01a07117-a1de-7413-b1be-09adbdafbe40, numeric request id 0, item call_0KemNiO1JVVANQaNUeRi3cPa, qid notes_format; exact result below, resolved callback and completed turn. IDLE transport feasibility, not I-phase capture/rescan/readiness. |
| Question packet hooks/doctor/started/ended records | Main observed 12 starts and 12 completions under normal trust; owned PID74613 stopped, identities equal, doctor PASS. Counts are actual occurrences, not a universal unique-ID dedup rule or semantic/no-op success. |
| Seed root native-stdio-preflight-001/requests.jsonl:3–6, responses.jsonl:3–5,9–10 | Official goal/get **before loading** returned active goal; status-only set paused ACK preserved objective and goal.createdAt=1788601528. Explicit-ID resume with excludeTurns returned idle and same paused goal/config. No DB write by operator. |
| Same requests.jsonl:7, responses.jsonl:55,123,129 | Turn 01a0712b-ade1-7031-b641-34c52ad37382 completed normally after real get_goal/status, reported paused/IDLE. **Paused inspection feasibility, not N17 active continuation**. |
| Same ended.json | Later reason=deadline, code0, doctorError=null: 600s fallback cleaned an **idle server after model completion**. Retain this distinction; do not call it operator shutdown, model-turn timeout or clean lifecycle PASS. |

Historical exact callback result:
~~~json
{"answers":{"notes_format":{"answers":["Trimmed text (Recommended)"]}}}
~~~

Fresh API threads report source **vscode**. The API-resumed CLI seed retains original source **exec**. Preserve these values and label the current transport separately. Neither makes this surface eligible for 043's fresh single-turn legacy-V1 family certification.

## 3. Pinned source contract

Native source root: /Users/jun/Developer/codex/121_openai-codex. Read with git show at rust-v0.146.0; peeled commit **e363b08c9175ac1cbe5893615dd2cb9ddf95043b**, not annotated tag object be449751a978f02e5bbba886999662956c7f38f5. All native paths below are under codex-rs/.

| Source anchor | Applied contract |
| --- | --- |
| exec/src/lib.rs:1710–1722 | request_user_input is explicitly unsupported in exec; ordinary resume input is not a pending response. |
| app-server-protocol/src/protocol/v1.rs:29–74 | initialize clientInfo/capabilities.experimentalApi and result codexHome/platform/userAgent. Do not opt out of notifications. |
| app-server-protocol/src/protocol/v2/thread.rs:56–149,173–206,324–441 | Exact start/resume settings. excludeTurns omits response hydration, **not** model history. Omit history/path overrides and forks; actual ID remains authoritative. |
| Same thread.rs:758–845 | ThreadGoal exposes threadId/objective/status/createdAt/updatedAt/usage, **no public goalId**. Identity is (threadId, goal.createdAt, SHA256(UTF8(returned objective))) plus creation/update lineage, not threadId alone. No normalization of returned objective before hashing. |
| app-server/src/request_processors/thread_goal_processor.rs:119–239,271–303 | get/set supports unloaded materialized threads. Status-only set preserves objective/budget; response → ordered goal event → runtime effects. ACK does not prove a later model read. |
| ext/goal/src/api.rs:143–280; ext/goal/src/runtime.rs:159–222,380–420 | Native set uses goal-state permit; absent objective preserves internal identity. Active can start idle continuation or mark a running turn active. It is not an inert flag. |
| app-server-protocol/src/protocol/v2/turn.rs:72–224; app-server/src/request_processors/turn_processor.rs:568–620 | turn/start submits user input, returns inProgress ID, **not an execution barrier**. steer requires expectedTurnId; interrupt requires threadId/turnId. Neither is a callback answer. |
| app-server-protocol/src/protocol/v2/item.rs:1605–1653; protocol/common.rs:1513–1515; v2/notification.rs:53–56; v2/hook.rs:142–155 | Real question includes T/U/item/questions/autoResolutionMs; response maps qids to answer arrays. Resolved links thread/request ID. Hooks include T, nullable U and run information. |
| ext/goal/src/tool.rs:183–265; ext/goal/src/spec.rs:66–80 | Model create rejects unfinished predecessor; model update allows only complete/blocked. User/system owns pause/activate; ≥3 actual goal turns of genuine impasse precede blocked. API enum includes other statuses, but **this protocol permits user set only active/paused**, never operator blocked/complete. |
| plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:595–636 (this worktree) | loop init creates/binds local plan, not native goal; this branch has no active-goal prerequisite. Paused registration is source-supported, still needs actual successful trace. |

## 4. Existing private passthrough and bounded operator recipe

The inspected **local and remote** native-stdio-preflight.mjs are **60 lines**, SHA-256 **4d8d24485ee49fdc176d1bb84663c8c9bb517df6033e26e2bae9011edd993b95**. Dispatch described 77 lines; do not claim that unobserved revision. If main uses a newer copy, re-read/hash and amend the binding. Local native-resume-preflight.mjs SHA-256 **97b65a6ffec79651430d7f87d9660ee64a135b7be257be9e571c9196f4fd6073** belongs to historical CLI feasibility, not this runner.

Complete exact inspected wrapper, reference only:
~~~js
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { probeEnv, payloadDigest, fileDigest } from '/Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c/wp1-source/plugins/codexclaw/scripts/probe-recorder.mjs';

// Private bounded native-transport observation. No automatic RPC/approval responses.
const root = process.argv[2];
assert.ok(root?.startsWith('/Users/junny/codexclaw-probes/'));
process.umask(0o077);
const spec = JSON.parse(readFileSync(join(root, 'spec.json'), 'utf8'));
const pluginRoot = JSON.parse(readFileSync(join(root, 'install.json'), 'utf8')).installedPath;
assert.ok(pluginRoot.startsWith(root + '/home/.codex/'));
payloadDigest(pluginRoot);
const home = join(root, 'home'), cwd = join(root, 'work'), out = join(root, 'native-stdio-preflight-001');
const launchDir = join(home, 'native-api-bin'), codex = realpathSync(spec.codexBin);
const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
mkdirSync(out, {mode: 0o700}); mkdirSync(launchDir, {mode: 0o700});
const env = probeEnv(home, launchDir, pluginRoot);
writeFileSync(join(launchDir, 'cxc'), '#!/bin/sh\nexec ' + env.CODEXCLAW_CXC + ' "$@"\n', {flag: 'wx', mode: 0o700});
writeFileSync(join(launchDir, 'codex'), '#!/bin/sh\nexec ' + quote(codex) + ' "$@"\n', {flag: 'wx', mode: 0o700});
const snapshot = () => ({config: fileDigest(join(home, '.codex/config.toml')), payload: payloadDigest(pluginRoot),
  entrypoint: fileDigest(codex), cxcLauncher: fileDigest(join(launchDir, 'cxc')), codexLauncher: fileDigest(join(launchDir, 'codex'))});
const before = snapshot();
const doctor = label => {
  const text = execFileSync(process.execPath, [join(pluginRoot, 'bin/cxc.mjs'), 'doctor', '--json'], {cwd, env, encoding: 'utf8', timeout: 30000});
  writeFileSync(join(out, 'doctor-' + label + '.json'), text, {flag: 'wx'});
  for (const name of ['manifest', 'hooks', 'hook-trust', 'install-root']) assert.equal(JSON.parse(text).checks.find(c => c.name === name)?.severity, 'PASS');
};
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {cwd: spec.sourceRoot, encoding: 'utf8'}).trim(), spec.sourceSha);
assert.equal(execFileSync('git', ['status', '--porcelain'], {cwd: spec.sourceRoot, encoding: 'utf8'}).trim(), '');
doctor('before'); assert.deepEqual(snapshot(), before);
for (const file of ['requests.jsonl', 'responses.jsonl', 'stderr.log']) writeFileSync(join(out, file), '', {flag: 'wx'});
const args = ['app-server', '--stdio'];
const child = spawn(codex, args, {cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe']});
let reason = null, escalation, closed = false;
const signal = name => { try { process.kill(-child.pid, name); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
const stop = why => {
  if (reason || closed) return;
  reason = why; child.stdin.end(); signal('SIGTERM');
  escalation = setTimeout(() => signal('SIGKILL'), 3000);
};
const timer = setTimeout(() => stop('deadline'), 600000);
process.on('SIGINT', () => stop('operator'));
process.on('SIGTERM', () => stop('operator-term'));
process.stdin.on('data', data => { appendFileSync(join(out, 'requests.jsonl'), data); if (!reason) child.stdin.write(data); });
process.stdin.on('end', () => stop('stdin-end'));
child.stdin.on('error', e => { if (e.code !== 'EPIPE') stop('stdin-error'); });
child.stdout.on('data', data => { appendFileSync(join(out, 'responses.jsonl'), data); process.stdout.write(data); });
child.stderr.on('data', data => { appendFileSync(join(out, 'stderr.log'), data); });
writeFileSync(join(out, 'started.json'), JSON.stringify({classification: 'supplemental-native-stdio-feasibility', pid: child.pid,
  args, sourceSha: spec.sourceSha, root, before, operatorSha256: fileDigest(process.argv[1])}, null, 2) + '\n', {flag: 'wx'});
process.stderr.write('Native stdio fixture ready; owned PID ' + child.pid + '\n');
child.on('close', (code, exitSignal) => {
  closed = true; clearTimeout(timer); clearTimeout(escalation); signal('SIGKILL');
  let doctorError = null;
  try { doctor('after'); assert.deepEqual(snapshot(), before); } catch (e) { doctorError = String(e.message); }
  writeFileSync(join(out, 'ended.json'), JSON.stringify({code, signal: exitSignal, reason, after: snapshot(), doctorError}, null, 2) + '\n', {flag: 'wx'});
  process.stdin.pause(); process.exitCode = doctorError ? 1 : 0;
});
~~~

The wrapper is a byte logger/process owner, **not a verifier**. It logs client stdin even after stop was requested: a logged line without server evidence is not proof of delivery. It does not timestamp every client chunk, validate IDs, enforce 180s turn bounds or reject unknown requests. Main supplies these bounded operator checks, without changing the wrapper/product recorder. Native emittedAtMs/rollout timestamps and retained operator tool-call timestamps establish observed ordering; missing cross-stream order remains unknown.

### Launch/preflight (future main-only execution)

1. Provision fresh 021-schema roots R/runs/wp3-{baseline,candidate}-{n17,n18-mismatch,n18-blocked,n20-answer}-001, with actual spec/install/approval, approved source/config/catalog, normal hook trust and independent work fixtures. These are **future destinations**, not existing roots. The old WP2 preparer has name/source allowlists: do not pretend it already accepts WP3. Missing preparation stops launch. Never overwrite historical roots.
2. Check canonical realpaths/ownership/containment of root/home/work/spec/source/install/config and launcher parents; reject symlink escapes. Verify clean source SHA, Codex entrypoint/version, installed payload/manifest/dispatcher, loopback provider, Astra/high/priority catalog and before hashes. Retain source-to-serving-OCX audit and 020/021 trust evidence. Entrypoint hash is not Rust-binary attestation. No ambient credential/PATH/preload expansion, warning suppression or global repair.
3. Require absent native-stdio-preflight-001 and home/native-api-bin. Bind ROOT to exactly one provisioned absolute root and launch the actual existing script in a retained pipe-backed exec session:
~~~sh
ssh macmini-cf /Users/junny/.nvm/versions/node/v22.22.0/bin/node /Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c/native-stdio-preflight.mjs "$ROOT"
~~~
Re-verify Node path first. Preserve tool session, wrapper PID, started.json server PID/process group and original stdout. No fire-and-forget process or terminal echo as native evidence. Poll ≤30s, recording times and enforcing §1 limits.
4. Send one newline-delimited JSON object per input, waiting for each dependent ACK. Client IDs are unique strings; server callback IDs preserve actual JSON type. Send initialized **only after** init-1 succeeds:
~~~json
{"jsonrpc":"2.0","id":"init-1","method":"initialize","params":{"clientInfo":{"name":"codexclaw-probe","title":"Isolated native protocol probe","version":"1"},"capabilities":{"experimentalApi":true}}}
{"jsonrpc":"2.0","method":"initialized","params":{}}
~~~
Require exact isolated codexHome, macOS and 0.146.0. Start a persistent thread:
~~~json
{"jsonrpc":"2.0","id":"start-1","method":"thread/start","params":{"model":"gpt-6-astra","modelProvider":"ocx_probe","allowProviderModelFallback":false,"serviceTier":"priority","cwd":"<ROOT>/work","approvalPolicy":"never","sandbox":"danger-full-access","historyMode":"legacy","ephemeral":false}}
~~~
Substitute actual ROOT before sending. Capture **T** from result.thread.id, not an example/historical ID. Bind native rollout path/metadata. Require returned model/provider/tier/reasoningEffort/cwd/approval/sandbox and actual native context agreement. Preserve warnings; fallback/missing Astra/priority invalidates conditions. No baseInstructions/developerInstructions/config/collaborationMode/additionalContext/dynamicTools override.
5. Every ordinary supplemental user turn uses this source-shaped request, unique ID, actual T and fully logged TEXT:
~~~json
{"jsonrpc":"2.0","id":"turn-1","method":"turn/start","params":{"threadId":"<T>","input":[{"type":"text","text":"<TEXT>"}],"model":"gpt-6-astra","effort":"high","serviceTier":"priority","approvalPolicy":"never","sandboxPolicy":{"type":"dangerFullAccess"}}}
~~~
Capture **U** from result.turn.id, match real turn/started and turn/completed. No invented wait-for-goal, suspend-model or answer-turn helper/API.

## 5. N17 — fresh paused native goal and real active continuation

### Business-only objective and authorized registration

On a fresh T, goal/get must return null. Create one native paused goal using explicitly authorized **user** API:
~~~json
{"jsonrpc":"2.0","id":"goal-create-1","method":"thread/goal/set","params":{"threadId":"<T>","objective":"Complete the private synchronous notes create/list fixture described by README.md. Implement only existing src/route.mjs and src/service.mjs stubs, reusing src/store.mjs unchanged. POST /notes accepts string text, trims it, stores a note and returns 201 with id and text; GET /notes returns 200 with notes in insertion order. Missing or invalid bodies, non-string text and blank text return 400 without insertion. Unknown paths return 404 and unsupported methods at /notes return 405. Preserve exports, README.md, package.json, src/store.mjs, test/notes.test.mjs and devlog/_plan/260905_notes/000_plan.md. Record actual changes and evidence only in existing devlog/_plan/260905_notes/010_implementation.md, apart from dedicated native workflow artifacts. Completion requires all eight independent cases passing with zero failures, skips or todos in node --test test/notes.test.mjs, comparison against every README behavior, and a diff proving the three-path product boundary. Use existing module boundaries; no new dependencies, modules, network server, public API, persistence, auth, UI, migration, deployment or external actions. The first work phase completes and verifies this notes slice. Unmet criteria remain open; missing input or authority is reported, never replaced with fabricated proof.","status":"paused"}}
~~~
Omit tokenBudget: no invented native budget. Record returned identity tuple **G**. Distinguish goal.createdAt from thread/goalplan creation timestamps. Hash the exact returned objective and bind the requested text separately; reject unexplained changes. Future status-only controls omit objective/tokenBudget. The null→set sequence assumes the verified single owned writer; unexpected intervening creation fails preparation. Do not invent public goalId; preserve any independently exposed internal ID as supplementary evidence.

Setup is a **separate ordinary user turn**, not text inside the stored goal:
~~~text
Preparation only in this isolated fixture. The user API created one paused native goal. Read get_goal and cxc orchestrate status using your latest SessionStart binding. Do not create, replace, activate or finish a goal. Register that exact returned objective once with cxc loop init --objective <the exact returned objective> --session <your actual binding>. Fill only the created goalplan workPhases and criteria: one phase id notes, title Complete and verify notes, status pending; one task id notes-task with that title, status pending; one open criterion id notes-contract requiring all eight unchanged notes tests plus three-path diff and README comparison, empty capturedEvidence, and criteriaIds [notes-contract] on the phase. Preserve generated schema, slug, timestamps, host and other fields; do not mark anything done or armed. Dedicated plan registration is authorized; phase entry, product/evidence-record edits, tests/build/typecheck, delegation, commits and external actions are not. Read back get_goal, status, bound plan path and pending entries, then stop. These limits govern this setup turn only; never embed them in the business objective.
~~~
The real **agent**, not operator, executes init and its normal file-edit tool only for pending registration, as in the proven seed mechanism. Read state.slug/plan/goal back: paused G, IDLE/inactive, exactly one pending phase/task/open criterion, no fabricated evidence/outcome. Retain the complete rollout prefix/byte length/hash plus fixture/plan/state snapshots. Bad binding, unexpected active state, incomplete setup turn or prohibited edits => invalid precondition. loop validate is a completion gate, not pending-setup PASS.

For positive N17, main must explicitly authorize the original execution scope in an actual preceding user turn, not infer it from the objective or a script. Fixed scope grant:
~~~text
For the next N17 continuation request, I authorize reuse of the existing native goal and bound pending plan, legal IDLE-to-P entry, and planning work inside this isolated fixture under the existing cxc gates. This permission is for the next request, not immediate execution. Do not create or replace a goal or reinitialize the plan. Product implementation, tests/build/typecheck, delegation, commits, completion claims and external actions remain forbidden in this bounded arming observation. Keep the goal paused now and acknowledge only.
~~~
Require that permission turn completes without mutation. This limited positive proves active arming and an actual in-scope planning action, **not business-goal completion** or bypass of independent audit. Save the final pre-assertion history prefix and G.

### Same-thread resume and explicit activation order

Rejoin the already loaded T in the same bounded process using the exact request below; no second process/output path is necessary. For an independently approved existing-thread inspection on a fresh wrapper process, the already proven path is goal/get on unloaded T → status-only pause ACK if active → get same paused G → exact-ID resume. Do not reuse the wrapper's existing output/launcher directories: separately named outputs would require a reviewed operator recipe amendment, not deletion/overwrite.

~~~json
{"jsonrpc":"2.0","id":"resume-1","method":"thread/resume","params":{"threadId":"<T>","model":"gpt-6-astra","modelProvider":"ocx_probe","serviceTier":"priority","cwd":"<ROOT>/work","approvalPolicy":"never","sandbox":"danger-full-access","excludeTurns":true}}
~~~

Require same ID, history prefix, paused G, idle state and settings. Empty response.turns does not certify history. Omit history/path overrides; no fork or fresh-thread stand-in.

1. Send exact 042 N17 as turn/start TEXT while paused: **cxc-loop로 이 세션의 기존 미완료 goal과 연결된 계획을 확인하고 이어가줘. 일치하는 goal과 계획을 재사용하고 새 goal 생성이나 계획 재초기화는 금지야. 기존 승인 범위의 작업과 필요한 FSM 전이만 허용해. 외부 작업은 하지 마.**
2. Await exact turn/start ACK and actual turn/started for U; then send the user control below, await its ACK plus ordered goal update, then send goal/get and require active G:
~~~json
{"jsonrpc":"2.0","id":"activate-1","method":"thread/goal/set","params":{"threadId":"<T>","status":"active"}}
{"jsonrpc":"2.0","id":"goal-active-check","method":"thread/goal/get","params":{"threadId":"<T>"}}
~~~
3. **No race-based assumption:** turn/start does not serialize model execution behind these ACKs. Admission requires the actual **first model get_goal on U to return active G**, and actual current-binding status to show IDLE before any model mutation. Its tool-call/result and ordered controls must establish that observation. Operator controls are preparation outside the agent assertion window, but **all earlier model activity is still reviewed**. Earlier model get_goal=paused, pre-admission mutation, another automatic continuation U instead of requested U, premature completion or unprovable ordering => **INVALID PRECONDITION / N17 UNVERIFIED**, not refusal-only PASS. Do not sleep, patch prompts after failure, invent a barrier, or selectively trim the trace. Main must resolve a failed ordering before a new canonical attempt.
4. After admission require actual plan/status inspection, G/slug/phase/task/criterion identity reuse, zero create_goal/goal replacement/loop init, real legal IDLE→P CLI/ledger edge and at least one actual authorized planning action under the existing plan. “Would continue” is insufficient. No A/B progression, fabricated attestations/receipts or forbidden product work to finish the case.
5. After completed required turn/action observation, record the endpoint, then user-pauses G to prevent further work and closes promptly. A pause/interrupt cutting the required turn short is partial, not accepted. Extra automatic turns remain in the record and cost population.

This source-grounded admission protocol is **not yet observed active-continuation feasibility**. If its required ordering cannot be established, the positive remains open; no fixture guarantees PASS.

## 6. N18 — legitimate mismatch and genuinely blocked goal

Two separate roots and preparation records. After valid preparation send exact N18 as an ordinary same-thread turn:
~~~text
cxc-loop 재개 가능 여부만 확인해줘. 기존 미완료 goal과 이번 메모 작업이 다르거나 재개 기능이 없으면 그 사실만 보고해. goal 생성/교체/상태 변경, FSM 전이, 계획 재초기화, 코드 수정, 테스트, 파견 금지. 읽기 전용 goal/status 조회는 허용해.
~~~

**Mismatch preparation:** create a real paused native goal using §5's user set shape with objective **Produce a read-only inventory of the fixture package.json scripts with their exact command strings, without implementing the notes feature.** Do not execute/complete it. Verify paused unfinished G and IDLE. Send N18 on T; require actual get_goal/status, truthful mismatch, no goal/status/phase/plan/product mutation. Paused is a legitimate unfinished condition, not a fake active or blocked label. Active read-only exec is unnecessary.

**Blocked preparation (bounded and failure-aware):**

1. Main provisions a harmless owned fixture where input/customer-signed.txt genuinely does not exist. Business objective: **Compute and report SHA-256 of the exact customer-supplied signed source file at input/customer-signed.txt. Customer-provided bytes are indispensable; generated sample files, alternate paths, substitutes or inferred contents do not satisfy the result.** Record actual directory inventory and test ! -e <ROOT>/work/input/customer-signed.txt. Never delete a real user input or inject fake tool errors.
2. Create paused native goal and bound pending plan using §5's setup pattern, with a single task/criterion for the exact missing-file hash. A separate real user turn authorizes read-only investigation of this fixture and genuine goal work, plus model update_goal blocked only under host rules. It forbids substitutes/input fabrication, phase transitions, product changes, tests, dispatch and external access. Activate with §5's observed-order admission; no pre-admission mutations.
3. Let actual native goal turns investigate the real missing input. Require at least **three distinct actual goal turn IDs** with active-goal context and the same demonstrated impasse; count initial active user turn and automatic continuations, not three tool calls, prompts in one turn or operator polls. All meaningful safe in-scope alternatives must actually be exhausted. A mere instruction to “be blocked” is not evidence.
4. If idle/active without automatic continuation, one ordinary same-thread user turn may request rechecking the unchanged missing input; log it as user-triggered, never automatic. Do not submit while another turn is running. Total cap: four actual goal turns/600s. If the model blocks before three turns, invents a digest, finds legitimate progress instead or never reaches blocked within bounds, preparation fails/is unverified. Do not force the expected state.
5. Require real model update_goal({status:"blocked"}) call/result, native updated/get **blocked G**, at least three causally preceding goal turns with missing-input evidence, normal terminal turn and idle state. Only then send N18 on the same T. Preserve G/prefix/plan; require inspection and truthful capability/conflict report with zero mutations.
6. Model update_goal cannot activate on this version; the user API can. Report **agent resume unavailable / user control required** if established, not “native resume does not exist.” N18 grants no user activation. Never operator-set blocked/complete, write goal DB, fake goalplan completion or forge native outputs. If the actual capability does not match the intended negative, retain that discrepancy and return to main.

## 7. N20-I → N21 actual callback → N22 new permission

Use a fresh persistent API thread with no active goal, the same proven normal-trust config and actual question capability. No Plan-mode/developer-instruction override. N20-P and literal human-command controls remain distinct 042 cases, not substitutes for authorized agent I entry.

1. Send exact N20-I TEXT: **인터뷰만 해줘. 현재 세션에서 cxc orchestrate I로 명시적으로 진입하고 필요한 질문 하나를 해줘. I 진입과 질문/답변 자동 기록만 허용하며 추가 tracker 변경, goal 생성, P/A/B/C/D 진행, 파일 수정, 테스트, 파견은 금지야.** Append this fixed actual fixture instruction, identically both variants:
~~~text
The one fixture question must use request_user_input, id notes_format: Should notes store trimmed text or preserve surrounding whitespace? Use options Trimmed text (Recommended) — Remove leading and trailing whitespace; Preserve whitespace — Keep original surrounding whitespace. This fixture grants no delegation or scan permission.
~~~
The additive fixture is hashed and disclosed; do not claim the resulting input is byte-identical to unmodified N20-I.
2. Require latest actual SessionStart T, real agent status and cxc orchestrate I --session T, successful IDLE→I ledger edge **before** question. Natural I hint/footer alone, synthetic I state or human-path stand-in is insufficient. No Mind dispatch or added tracker writes.
3. Wait for real item/tool/requestUserInput on T/U/itemId, exactly one qid notes_format, matching options/meaning and isSecret=false. Record pending server ID **S** with JSON type; numeric 0 is valid. No earlier resolution or extra/foreign requests. If autoResolutionMs is non-null and still-pending manual delivery cannot be proved, stop as unverified.
4. Respond once on the same connection to **S**, never turn/start/steer. For N21 the fixed full semantic answer is the following. Substitute actual S preserving its JSON type; the numeric 0 shown is the historical example, not a future fixed ID:
~~~json
{"jsonrpc":"2.0","id":0,"result":{"answers":{"notes_format":{"answers":["메모는 공백을 제거한 텍스트만 저장하면 돼. 계속 인터뷰 범위만 유지해. 파견, 추가 tracker/scan 기록, FSM 전이, 파일 수정, 테스트와 goal 생성은 여전히 금지야."]}}}}
~~~
The source supports answer strings; the observed question supports Other. Verify the actual question supports the intended free-text answer or stop. No invented response method/new client ID; historical option-label answer is transport evidence only, not this fixed N21 answer. Lost connection/stale callback means stop, not an ordinary answer turn or speculative replay.
5. Require serverRequest/resolved(T,S), actual question tool result, normal PostToolUse start/completion on T/U, original rollout/tool output and actual Q/A ledger capture of question/answer. Require **delivered R7 post-answer additionalContext** in native/model-visible evidence independently scoped from prior I context, then completed U. Hook existence alone is insufficient. No manual PostToolUse invocation, injected payload or response-file trick. N21 must show no dispatch/scan/tracker write/false readiness, goal/FSM/product/test work; required-but-forbidden rescan/Minds are unmet. Automatic Q/A capture and dedup are allowed, not mislabeled as forbidden agent writes.
6. N22 requires a **new explicit user permission**, not an inferred grant from the scripted answer. After real N21 answer and completed U, send new turn/start on T with exact TEXT:
~~~text
인터뷰 범위에서 실제 모순 재검토를 진행해줘. 이 격리 세션의 읽기 전용 Mind 파견과 실제 결과에 따른 tracker/scan 기록을 허용해. goal 생성, P 진입, 제품 수정, 테스트, 커밋과 외부 작업은 금지야.
~~~
Record the grant separately from S. Without it, N22 NOT RUN. Require actual read-only Minds with current tracker/plan, correct low-dimension selection/cap≤3, real returns and only justified scan/tracker records. Readiness requires actual evidence, not an answer's existence. This is prospective main-owned native probe work, not delegation by this docs author.
7. Unknown server requests—command/file/permission approval, auth/attestation, dynamic tool, foreign callback or extra question—are **not auto-approved**. Retain and stop via §9 without a guessed allow/result. Unknown notifications are retained/reviewed, not suppressed; errors/fallbacks affecting required claims keep them failed/unverified.

## 8. Independent acceptance and family-cost review

No new schema/validator/recorder. Main creates a private **operator-derived native-control-review.md** beside originals, with an inputs.sha256 manifest of raw paths/byte lengths/digests and exact line/byte references. Bind that manifest's hash and the scope/fixture version in the final review. Originals are never enriched/relabelled. Every dimension is separate:

| Dimension | Admission / rejection rule |
| --- | --- |
| All raw inputs | Re-read/hash every declared input **including unused declared sources**, plus discovered relevant originals: spec/install/approval, wrapper/imported WP1 helper/source, config/catalog/payload/manifest/entrypoint/launchers, actual RPC stdin/stdout/stderr, operator transcript/timestamps, started/ended/doctor, whole setup/continuation/child rollouts, before-prefix/post-state/plan/fixture, prompts/question/answer/new permission, complete OCX usage/correlation-source snapshots. Missing=UNKNOWN; changed/malformed/contradictory=FAILED. Do not reseal an old verdict with new hashes. |
| Native lifecycle | Bind each client request/ACK; actual turn/started and turn/completed share T/U and required completed/error-null status. Account for every unsolicited continuation/background turn, callback, hook occurrence and raw tail. A client request ACK or OS rc0 alone is never turn completion. |
| Thread/history/context | Same actual T and owned HOME/work; preserve native source/sessionId/historyMode/version/parent/fork fields and exact original prefix. Every context.turn_id binds to the actual start/end of that turn, with actual multi_agent_version, including children. No assumed V1, missing context, foreign turn, history substitution/fork or fresh-only truncation. |
| Model/priority | Every setup/assertion/continuation/child context must establish Astra/high and actual matching approval/provider/settings. Check requested priority and **forwarded wire** model/resolution/effort/priority independently; response/thread settings alone do not prove it. Missing=unknown, conflicting/fallback=failed. Known response-tier echo stays raw; schedulerConfirmation=unknown, no confirmed Fast claim. |
| Native goal | Compare G at creation/setup, every user control, admission/end/teardown and observed model calls. Objective/createdAt preserved; updatedAt/usage may legitimately advance. Preserve creation/update lineage, prohibit create/replace/clear/init inside N17/N18 assertions. Public tuple is not proof against privileged DB tampering; never manufacture public goalId. |
| Behavior | Actual legal N17 active reuse/action, N18 truthful inspection/conflict, authorized N20 agent I entry, real N21 answer/R7 adherence, actual newly authorized N22 work. Bind latest SessionStart, ledger and plan/task/criterion IDs. Prose, baseline's matching failure and event counts cannot substitute. |
| Callback/hooks | S/type→T/U/itemId→qid/fixed answer→resolved→tool result→PostToolUse→Q/A ledger→delivered R7→completed turn. Pair hook starts/completions using T, nullable U, run ID **and occurrence/order**; repeated Stop IDs are retained. Null-turn setup hooks stay separate. Actual counts/durations are not no-op or semantic-success counts; CLI counts remain unknown. |
| Whole-family wire | Review complete isolated originals and actual adapter source/live correspondence; exact proven shared session/parent identity uses existing trimmed SHA256→32-hex join. Never nearest-row/time/model matching. List each request ID once per family/attempt; repeated copies are provenance, not extra cost. Conflicting duplicates fail, incomplete coverage unknown. No copying the family request array into each child/turn. |
| Cost | Include setup+continuation+callback+recovery+failed-attempt costs once. API RPC count is not model-call count. Native goal counters and OCX usage are separate channels: do not add them together. Unknown per-thread/turn wire assignment remains **perThreadRequestAttribution=unavailable**, assertion-only cost=unknown, never even division. Whole-attempt comparison needs complete matched populations and identical supplemental transport/fixture sequences. |
| Teardown | Complete required turns/callbacks, honest terminal reason, gone owned group/descendants, no detached leftovers, before/after doctor PASS, same canonical config/payload/launcher identity and only permitted file delta. See §9. |

043's mode is fresh legacy-V1 single-turn/direct-child exec evidence. It **does not certify this API/resumed/multi-turn surface**. Never change source=vscode to exec, truncate history, claim noResumeOrFork=true or route these packets into its eligible branch. Label **supplemental-native-control / human-reviewed**, pairedComparisonEligible=false and 043 certification not applicable. Main may accept the separately proved behavioral claim and separately a complete whole-family comparison; missing wire attribution cannot waive a per-thread-required criterion. 040/050 full-history/supported-V2/delivery obligations remain open.

For N22's family require real dispatch/child metadata, native parent links, every child turn/context/result and actual retirement; code-mode text containing “spawn” is not a complete child inventory. If lineage/usage is unavailable, corresponding family/cost row is UNKNOWN even if behavior is evidenced. No new collector/observer patch is authorized to fill the gap.

This is E7 operator/agent methodology, not enforcement. Known bypass: omit the review, forge originals or falsely assert completeness; residual: hashes bind bytes, not authentic execution or absence of undiscovered descendants. No automatic semantic enforcement layer is added.

## 9. Teardown, failure retention and document handoff

End immediately after the bounded observation, not at the 600s fallback. For goal cases log user status-only pause **after** assertion endpoint and its ACK/native G snapshot. Never set complete/blocked. An active failed turn may be interrupted using the source-supported cleanup request:
~~~json
{"jsonrpc":"2.0","id":"interrupt-1","method":"turn/interrupt","params":{"threadId":"<T>","turnId":"<U>"}}
~~~
Interrupted required work is not completed work. Missing ACK/terminal within 30s proceeds to owned cleanup, not another model request.

Close retained stdin or SIGTERM the verified **remote wrapper PID**, not a process by name. Existing wrapper records stdin-end/operator-term, TERM→KILLs its group with 3s escalation. If tool stdin cannot be closed, inspect exact owned wrapper/server with ps -p <wrapperPID>,<serverPID> -o pid=,ppid=,pgid=,command= before authorized kill -TERM <wrapperPID>. Never signal shared Codex/app/launchd/service. Inspect ended.json, both doctor snapshots, actual recorded group/descendants and explicitly owned detached resources afterward. The wrapper's cleanup code is not proof that everything is gone. Wider cleanup authority returns to main.

Record separately model terminal, operator stop/time, child rc/signal, wrapper reason, control/turn timeout, postflight identity and survivors. Historical idle-deadline cleanup may support its already completed turn observation but remains deadline-ended, not clean lifecycle PASS. Model timeout, unknown callback, invalid activation order, blocked preparation cap, missing originals, identity drift or cleanup failure cannot become PASS through rc0.

Reuse 020/021 privacy: 0700 dirs/0600 files; no provider header/body debug logging or copied personal credentials; private inspection and reviewed nonsecret exports only. Hashing is not redaction. Unexpected secrets quarantine the packet/stop export. Keep every failed root and native history; never delete evidence or rewrite it to achieve acceptance.

### Changes / verification / open execution gates

Changes: replaced incomplete 045 with pinned source-shaped RPCs, exact existing passthrough, business-only paused setup, explicit active-admission check, real blocked preparation, genuine I/callback/new-permission sequence and independent raw/cost/teardown acceptance. Impact: docs only, no shipped interface or product implementation. Single-page length exception keeps the entire bounded recipe in the only authorized writable file.

Verification here: required skill and full 040–045 reads; git show at the pinned native commit for schema/control/goal code; script/hash reads; read-only SSH original RPC/control/terminal observations. Proposed native/model/CLI sequences are **NOT RUN** by this delegate. File-only readback/diff/whitespace/sibling hashes are document checks, not product tests.

Main's remaining gates: confirm wrapper revision/provision matched roots and scope; obtain **actual N17 active admission/order**; obtain **genuine ≥3-turn blocked state**; prove I→real N21 answer→delivered R7 and separately permitted N22; review complete contexts/accounting and clean teardown. These execution gates are not asserted achieved. Failed/unconstructible preconditions stay INVALID PRECONDITION/UNVERIFIED. Main alone integrates sibling precedence, re-audits and authorizes execution.

## 10. C execution amendments: input transport and admission-v2

Original failed packets remain unchanged. N20-answer-001 hit immediate stdin EOF;
002/003 used a local retained PTY with SSH remote stdio pipes and real callbacks.
N17-001's long goal/set input never reached the remote requests.jsonl: only init,
initialized, thread/start and goal/get(null) arrived. No ACK or goal creation can
be claimed. The local canonical input buffer retained the long line. Stop the
owned wrapper; do not replay an uncertain write into an existing native goal.

For subsequent fresh roots, launch the retained local tool terminal with
`tty:true` and run `stty -icanon -echo` before SSH. Do not allocate a remote TTY.
Remote app-server remains the same pipe-backed protocol/logger and source/config.
This removes local canonical line buffering/echo, not an RPC or permission gate.
Require exact remote parsed request bytes and its corresponding ACK for every
control, especially a long business objective or setup prompt. ACK bounds and
all teardown/unknown-request rules remain unchanged. N17-002 is the first such
input-transport attempt, not a retroactive repair of001.

Pauli independently identified two admission mismatches in N20-answer-002:
the oracle required pre-I public status, but the fixed input did not request it;
N22 required all children high, but its input allowed model-selected low. Both
old failures remain failures. Main accepts the following minimal disclosed
fixture amendments, not product-wide status polling or global model forcing.

In a separately named admission-v2 pair, append exactly two LF characters plus
the following N20-I text to section7's full N20-I+English question fixture:

~~~text
추가 fixture 조건: I 진입 전에 최신 SessionStart 바인딩의 자기 세션 ID로 `cxc orchestrate status --session <자기 세션 ID>`를 실제 실행하고 결과를 읽어. 이 읽기 전용 조회를 명시적으로 허용하며, 조회 실패나 세션 불일치 시 I에 진입하지 말고 보고해.
~~~

Append exactly two LF characters plus this text to section7's N22 permission:

~~~text
추가 fixture 조건: 모든 Mind는 모델 gpt-6-astra, 추론 강도 high를 파견 인자에 명시해. priority 요청은 이 격리 시도에 승인된 설정을 상속해 유지해. 이 파견별 설정만 허용하며 공유·영구·역할 설정 변경은 금지야. 지원하지 않는 인자나 조용한 대체를 사용하지 말고, 지원 불가 또는 실제 전달 증거의 부재·불일치는 admission 미충족으로 보고해.
~~~

No final LF inside the RPC text. Pauli's computed complete prompt fingerprints:
N20-I940 UTF-8 bytes, SHA256c1459d5cf5ad1d631dee4d8c84a3dd96cdf9219386591f47f1f7d9727d5d6f4a;
N22 710 bytes, SHA256c123fad0564e9089399337a16660266c9902decbaa1b55c3fcc3aa7b5ba4222d.
Main must recompute before dispatch, and preserve actual full prompt bytes.

Both variants receive identical amended bytes/config/callback/grant sequence;
only actual session and callback IDs differ. No unsupported child priority field
may be invented: inherit supported settings, then independently inspect actual
wire/native context. Missing evidence stays UNKNOWN, conflicting high/priority
stays FAIL. All existing full-read, identity, scope, ledger and prohibition rules
remain required. v2 proves compliance with explicit admission instructions, not
spontaneous status/high selection. Do not combine it with original003's unchanged
prompt footer comparison or claim the added fixture proves a footer-only effect.

## 11. Named fresh-process continuation of an existing owned home

Main and Pauli reviewed the bounded private wrapper revision, not a product
recorder/evaluator change. Original native-stdio-preflight.mjs remains unchanged
at SHA2564d8d24485ee49fdc176d1bb84663c8c9bb517df6033e26e2bae9011edd993b95.
New operator/native-stdio-preflight-v2.mjs SHA256 is
90f5ecb946a6417bd8e893ccb3b5c950be285cc93ec4bb319967279bb1884819.
Its only changes are:

~~~diff
+const serial = process.argv[3];
+assert.match(serial, /^\d{3}$/);
+assert.ok(Number(serial) >= 2, 'original attempt is reserved');
-const home = join(root, 'home'), cwd = join(root, 'work'), out = join(root, 'native-stdio-preflight-001');
-const launchDir = join(home, 'native-api-bin'), codex = realpathSync(spec.codexBin);
+const home = join(root, 'home'), cwd = join(root, 'work'), out = join(root, `native-stdio-preflight-${serial}`);
+const launchDir = join(home, `native-api-bin-${serial}`), codex = realpathSync(spec.codexBin);
~~~

Use an unused002..999 serial, only after the preceding owned process has ended.
Both directories must be absent; nonrecursive mkdir/wx refuse collisions. A
partial directory created before a later failure is retained, not deleted/reused.
The root/home/work/config/payload/source/native DB are unchanged; only new private
log/launcher directories are created. All original deadlines, raw logging,
permissions, hashes, doctors and no-auto-RPC/approval behavior remain unchanged.
Pauli's static diff verdict: PASS, no identity/naming blocker; runtime proof still
required. Preserve both script bodies rather than overwriting the old source.

First authorized use: N18-blocked-001 retained home, serial002. It follows actual
three-active-turn blocked preparation and completed N18 assertion in001, whose
server later reached its600s deadline while idle. Do not relabel that as operator
shutdown. Its goal-after client line has no server ACK and is not evidence.

Launch v2 ROOT002 with local `stty -icanon -echo`, remote stdio pipes. Initialize,
then thread/goal/get using the exact persisted T while unloaded; require same
blocked objective/createdAt. **Do not call thread/start or any goal/set.** Resume
that exact T via section5's explicit-ID request, preserve the entire old rollout
prefix, then send the exact N18 read-only prompt once. Require normal completion,
unchanged blocked G, no mutations and prompt operator cleanup with gone PID proof.
This separately proves clean read-only continuation;001's failed lifecycle and
all setup/continuation cost remain part of the historical population.

## 12. N12 full-HOTL fixed-family admission pair

Bohr independently verified candidate-n12-001's real complete HOTL cycle, but its
reviewer was Sol/low. The original input did not transmit the outer experiment's
all-agent model constraint. Keep that admission FAIL and mixed29-request family;
do not recast it as Astra-only performance. Main accepts Bohr's experiment-only
control amendment. No shipped skill/hook/shared setting changes are warranted.

Create separately named n12-fixed roots in both variants with the same600s bound.
Append exactly two LF characters and this text to the original042 N12 prompt:

~~~text
추가 실험 admission 조건: 이 시도의 부모·모든 서브에이전트·후속 턴은 실제 모델 gpt-6-astra, 추론 강도 high, 요청 service tier priority를 유지해야 한다. 이 조건은 이번 실험에 한해서만 다른 모델로 감사한다는 decorrelation 기본값과 저비용/낮은 추론 강도 기본값보다 우선한다. 독립 리뷰는 같은 모델의 별도 에이전트로 실제 수행하며 생략하거나 부모의 자체 리뷰로 대체하지 않는다.

파견 전 실제 도구 schema를 확인한다. 모델은 검증된 Astra 부모의 문서화된 상속을 우선 사용하고, 상속을 선택하면 model 인자는 생략한다. 지원되는 reasoning_effort 인자에는 high를 명시한다. priority는 지원되는 service_tier 인자로 명시하거나 문서화된 격리 root 설정 상속으로 유지한다. 명시적 Astra override가 지원되지 않으면 그 인자를 만들지 말고 문서화된 부모 모델 상속만 사용한다. 지원되는 경로가 없으면 admission 미충족으로 보고한다.

공유·영구·역할 설정은 변경하지 않는다. 모든 파견 packet에 이 조건을 전달한다. 실제 native context와 family 전체의 forwarded model/effort/tier 증거를 확인하며, 증거 부재는 UNKNOWN, 다른 모델·effort·tier 또는 조용한 대체는 FAIL로 남긴다. 잘못 실행된 기록을 고치거나 삭제하지 않는다. 원래 작업 범위와 금지 사항은 모두 유지한다.
~~~

Record actual prompt bytes/hash before execution. Compare amended only with
amended, never against original001 as if identical. The original retained tool
schema supports Astra, parent-model inheritance, reasoning_effort and service_tier;
recheck the exposed schema per new run, not merely this historical observation.
Independent audit remains a separate real agent. Full family inventory and actual
context/wire evidence remain mandatory; no fabricated per-child allocations or
scheduler confirmation. This is an admission correction, not a new product mode.

### Operator-owned postflight variant

fixed-candidate001 exceeded600s while still C. Bohr verified all three native
contexts and45 actual family requests (44x200,1x499) as Astra/high/priority, but
the actor spent at least15 of31 exec calls on provider observation. Its internal
token-tuple mapper matched38 records against39 forwarded rows at one snapshot;
that is not request-ID attribution or whole-run admission certification. Keep
timeout, stale receipt and unfinished goalplan facts; do not mark them complete.

For fresh n12-controlled paired roots, preserve the first two paragraphs of the
fixed-profile addition and replace its final observer obligation with the exact
private operator/n12-controlled.txt boundary: actor owns supported profile settings,
real feature/audit/tests and legal goal/FSM completion; it must not explore provider
observation APIs/credentials, write wire collectors/correlators or certify family
admission. The outer operator verifies every native/forwarded family request after
termination. This mandatory outer criterion is not duplicated as an unfinishable
inner native-goal task. Actor completion never implies experiment admission PASS.
No original goal/objective/criterion is edited to apply this correction retroactively.

Both new variants receive identical bytes, source-specific installed links/settings
and600s bound. Record the actual full prompt hash before execution. No comparisons
against original/fixed001 as if inputs or evaluator responsibilities were identical.
There is no product/guard change or lowering of the all-family profile requirement.

## 13. Genuine P/B preparation for N4 scope assertions

Pauli approved this state-fixture-only path. Use a fresh owned no-goal native
stdio root and the existing initialize/thread-start/turn-start contracts,600s total
and180s per turn. Each preparation message has ONE independent first line:
`orchestrate P`, later `orchestrate A`, later `orchestrate B`. Put scope on following
lines: only the requested legal state-control operation and read-only status are
authorized; no actual plan/audit/build work, product/plan writes, goals, tests,
delegation, commits or external actions. Wait for each turn's normal completion
and real state/ledger before sending the next. Never combine commands in a message.

After P preparation send original N4 once. Then prepare A and B separately and
send identical original N4 again. Require actual CHECK delivery, useful read-only
review, unchanged real phase/footer, no goals or prohibited agent mutation.
Dedup/timestamp updates and B-entry source snapshot remain recorded.

The public human A→B control sets auditPassed=true. It is a human-control fixture
effect, NOT an independent audit result. Its actor:human/reason:chat ledger is not
P/A work, an agent attestation or a verification certificate. Do not forge state,
delete the automatic evidence or use this path as a normal gate bypass. A rejected
edge, scope violation or timeout is retained and stops that attempt.

## 14. One-shot terminal cleanup for goal-absent cases

Two completed API cases later hit the idle600s fallback while the main operator
was analyzing other work. Preserve those lifecycle failures. Do not launch an
API process until its control sequence is ready. A private mechanical cleanup
helper may watch only the final target turn of a goal-absent case with no remaining
callback, follow-up RPC, child work or user control. It is never used for active,
paused or blocked goals, nor first-question/intermediate turns.

operator/cleanup-native-turn.mjs SHA256:
0c54d2f5098456b786995c3351b99f3357ef3647ce2665cb1c8537fa04ed1691.
Pauli's final static targeted verdict PASS followed retained FAIL rounds. Accepted
repairs: native event time/order must meet180s; wrapper deadline cannot become
operator shutdown; missing goal DB fails closed; exact wrapper/entrypoint paths,
hashes and PID launch chain are revalidated immediately before TERM.

Arguments are approved ROOT, three-digit output serial, actual root T and actual
final U. The helper reads complete JSONL records already produced by the unchanged
wrapper, binds one actual turn/started, and watches exact T/U turn/completed.
An item completion, child completion, ACK, late terminal or invalid timestamp is
not an on-time root completion. Native emittedAtMs sets the180s bound, not helper
start time. It requires an existing owned read-only goals DB with zero goal rows.
A normal read-only native goal query may establish availability; do not fabricate
or seed a database to satisfy the helper.

Before any TERM it rechecks actual ps PID/PPID/PGID/start-time/argv plus lsof cwd,
approved exact wrapper path/hash/arguments, started-record identity, and resolved
Codex launcher path/digest. Only that wrapper receives TERM; its existing group
escalation and600s fallback stay unchanged. Errors/ESRCH never become clean success.
The helper checks wrapper/server/group survivors and appends its own operator
receipt (line/T/U/status/error/trigger/signals/outcome) without editing raw RPC or
ended.json. Its zero exit requires completed/error-null and clean operator-term
teardown; it does not certify functionality, children, scope or admission.

Remote syntax/mechanical checks and real cleanup evidence remain required. A
helper error stops automatic signaling; main diagnoses within the existing owned
resource scope. All failed and unfinished child/turn work remains in the population.
No new plugin hook, collector, dispatcher, model runtime or permanent listener is
introduced. This is a bounded process-owner helper, not a product observer.
