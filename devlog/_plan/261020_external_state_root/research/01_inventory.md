# research/01 — durable path inventory (gpt-6.1-sol exploration lane, 2026-10-20, read-only)

**읽기 전용 경로 인벤토리**

조사 위치: `/Volumes/CLIsu/goat-worktrees/codexclaw/feat-external-state-root`  
파일을 수정하거나 테스트를 실행하지 않았어요. `rg`로 후보를 찾고 경로 생성·사용 코드를 확인했어요.

아래 경로 약어를 사용해요.

- `P/` = `plugins/codexclaw/components/pabcd-state/src/`
- `S/` = `plugins/codexclaw/components/subagent-config/src/`
- `O/` = `plugins/codexclaw/components/cxc-ops/src/`
- `K/` = `plugins/codexclaw/skills/`
- `R` = 읽기·존재 확인·경로 검증, `W` = 생성·쓰기, `D` = 삭제

**1. Durable filesystem 경로 생성 위치**

| 파일:행 | 경로 표현식 | 사용 |
|---|---|---|
| `P/state.ts:697` | `join(cwd, STATE_DIR)` | 최상위 ledger의 부모, W |
| `P/state.ts:700` | `join(dir, LEDGER_FILE)` | 최상위 `ledger.jsonl` append, W |
| `P/state.ts:743` | `join(cwd, STATE_DIR, INTERVIEWS_SUBDIR)` | interviews 디렉터리, R/W |
| `P/state.ts:747` | `join(interviewsDir(cwd), \`${sanitizeKey(sessionId)}.jsonl\`)` | scan ledger, R/W; 실제 append `:758`, read `:771` |
| `P/interview-ledger.ts:116` | `join(cwd, STATE_DIR, INTERVIEWS_SUBDIR, \`${sanitizeKey(sessionId)}.jsonl\`)` | Q/A ledger, R/W |
| `P/interview-ledger.ts:220` | `join(cwd, STATE_DIR, INTERVIEWS_SUBDIR)` | append용 mkdir, W |
| `P/orchestrate-cli.ts:448` | `join(cwd, STATE_DIR, LEDGER_FILE)` | transition ledger, R |
| `P/hook.ts:501` | `join(cwd, STATE_DIR, LEDGER_FILE)` | transition ledger, R |
| `P/goalplan.ts:322` | `resolve(cwd)` | goalplan 경로의 기준 |
| `P/goalplan.ts:323` | `resolve(projectRoot, STATE_DIR)` | 현재 checkout-local state root, R/W 검증 |
| `P/goalplan.ts:324` | `resolve(stateRoot, GOALPLANS_SUBDIR)` | goalplans root, R/W 검증 |
| `P/goalplan.ts:325` | `resolve(plansRoot, safeSlug)` | slug 디렉터리, R/W 검증 |
| `P/goalplan.ts:490` | `join(goalplanDir(cwd, slug), GOALPLAN_FILE)` | `goalplan.json`, R/W |
| `P/goalplan.ts:494` | `join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE)` | goalplan `ledger.jsonl`, R/W |
| `P/goalplan.ts:770` | `resolve(goalplanDir(cwd, slug), GOALPLAN_LOCK_DIR)` | `.goalplan.lock`, R/W/D |
| `P/goalplan.ts:800` | `join(dir, GOALPLAN_LOCK_OWNER_FILE)` | lock `owner.json`, R |
| `P/goalplan.ts:816` | `join(dir, GOALPLAN_LOCK_OWNER_FILE)` | lock `owner.json`, W |
| `P/goalplan.ts:923` | `goalplanDir(cwd, plan.slug)` | write対象ディレクトリ、W |
| `P/goalplan.ts:928` | `goalplanPath(cwd, plan.slug)` | atomic publication先、W |
| `P/goalplan.ts:929` | `` `${finalPath}.${process.pid}.${Date.now()}.tmp` `` | atomic publication一時ファイル、W/D |
| `P/goalplan.ts:948` | `goalplanDir(cwd, slug)` | ledger親ディレクトリ、W |
| `P/goalplan.ts:952` | `goalplanLedgerPath(cwd, slug)` | ledger append先、W |
| `P/goalplan.ts:1760` | `join(goalplanDir(cwd, slug), "schema-v2.marker")` | schema downgrade防止マーカー、R |
| `P/orchestrate-cli.ts:438` | `join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE)` | goalplan ledger、R |
| `P/hook.ts:491` | `join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE)` | goalplan ledger、R |
| `S/final-gate-guard.ts:123` | `join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json")` | cross-component final gate、R |
| `P/subagent-evidence.ts:86` | `resolve(cwd, STATE_DIR, EVIDENCE_SUBDIR)` | receipt containment root、R |
| `P/subagent-evidence.ts:98` | `join(cwd, STATE_DIR, EVIDENCE_ATTEMPTS_SUBDIR, …)` | session/agent/turn별 attempt JSON、R/W/D |
| `P/subagent-evidence.ts:220` | `join(cwd, STATE_DIR, EVIDENCE_ATTEMPTS_SUBDIR)` | attempt 디렉터리 생성、W |
| `P/subagent-evidence.ts:221` | `` `${p}.${process.pid}.${Date.now()}.tmp` `` | attempt atomic write 임시 파일、W |
| `P/subagent-evidence.ts:329` | `join(cwd, STATE_DIR, EVIDENCE_UNRECORDABLE_SUBDIR)` | unrecordable root、R/W |
| `P/subagent-evidence.ts:343` | `join(dir, \`${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}-${Date.now()}.json\`)` | verdict marker、W |
| `P/subagent-evidence.ts:355` | `join(unrecordableDir(cwd), \`.probe-${process.pid}-${Date.now()}\`)` | writable probe、W/D |
| `P/subagent-evidence.ts:407` | `join(cwd, STATE_DIR, EVIDENCE_ATTEMPTS_SUBDIR)` | spent-budget scan、R |
| `P/subagent-evidence.ts:419` | `join(dir, n)` | attempt JSON scan、R |
| `P/source-receipt.ts:101` | `resolve(cwd, ".codexclaw", "evidence")` | 독립적인 evidence-root containment 검사、R |
| `P/render-observations.ts:193` | `join(cwd, STATE_DIR, "evidence", sessionId, "qa")` | QA evidence 탐색 root、R |
| `P/render-observations.ts:197` | `join(dir, entry.name)` | QA evidence 재귀 탐색、R |
| `P/receipt-cli.ts:70` | `join(cwd, STATE_DIR, "evidence", sanitizeKey(sessionId), "test-receipt.json")` | test receipt、W/D |
| `P/receipt-cli.ts:183` | `join(path, "..")` | receipt 부모 디렉터리 생성、W |
| `P/freeze-cli.ts:92` | `join(args.cwd, STATE_DIR, PLAN_SUBDIR, slug)` | frozen plan tree、R |
| `P/freeze-cli.ts:35` | `join(dir, name)` | frozen plan 파일 재귀 탐색、R |
| `P/freeze-cli.ts:104` | `join(args.cwd, STATE_DIR, FREEZE_MANIFEST_DIR, FREEZE_MANIFEST_FILE)` | `interview/freeze.json`、R/W |
| `P/freeze-cli.ts:120` | `join(args.cwd, STATE_DIR, FREEZE_MANIFEST_DIR)` | manifest 부모 생성、W |
| `P/plan-cli.ts:178` | `resolve(args.cwd, "devlog", "_plan", unitName)` | implementation unit、W |
| `P/plan-cli.ts:184` | `join(unitDir, "000_plan.md")` | master plan、W |
| `P/plan-cli.ts:189` | `join(unitDir, \`${decade}_phase${n}.md\`)` | phase docs、W |
| `O/reset.ts:49` | `join(cwd, STATE_DIR)` | reset root；`:54`의 `--all`은 durable·volatile 모두 D |
| `O/reset.ts:68` | `join(stateDir, LEDGER_FILE)` | 최상위 ledger、D |
| `O/reset.ts:70` | `join(stateDir, INTERVIEWS_SUBDIR)` | interviews 전체、D |
| `O/reset.ts:78` | `join(stateDir, GOALPLANS_SUBDIR)` | goalplans 전체、D |
| `O/reset.ts:83` | `join(stateDir, INTERVIEW_SUBDIR)` | freeze manifest 디렉터리、D |
| `plugins/codexclaw/scripts/gate.mjs:38` | `join("devlog", "_plan", "mvp_hard")` | live plan 상대경로、R |
| `plugins/codexclaw/scripts/gate.mjs:39` | `join(repoRoot, planDir)` | live plan 존재 확인、R |
| `plugins/codexclaw/scripts/gate.mjs:40` | `join("devlog", "_fin", "mvp_hard")` | archive fallback 상대경로、R |
| `plugins/codexclaw/scripts/gate.mjs:41` | `join(repoRoot, finDir)` | archive 존재 확인、R |
| `plugins/codexclaw/scripts/gate.mjs:81` | `join(repoRoot, mvpHardDir(repoRoot))` | loop doc 디렉터리、R |
| `plugins/codexclaw/scripts/gate.mjs:87` | `join(dir, hits[0])` | loop doc、R |
| `plugins/codexclaw/scripts/gate.mjs:93` | `join(repoRoot, mvpHard, "000_INDEX.md")` | INDEX、R |
| `plugins/codexclaw/scripts/gate.mjs:106` | `join(repoRoot, mvpHard, docName)` | shared loop doc、R |
| `plugins/codexclaw/scripts/gate.mjs:250` | `join(repoRoot, "devlog", "_plan")` | verifier-claim scan root、R |

경로 상수 정의도 함께 바뀔 가능성이 있어요.

| 파일:행 | 상수 |
|---|---|
| `P/state.ts:238,240,242` | `STATE_DIR`, `LEDGER_FILE`, `INTERVIEWS_SUBDIR` |
| `P/goalplan.ts:42–46` | `GOALPLANS_SUBDIR`, `GOALPLAN_FILE`, `GOALPLAN_LEDGER_FILE`, lock/owner 이름 |
| `P/subagent-evidence.ts:71,72,326` | evidence·attempts·unrecordable 디렉터리 |
| `P/freeze.ts:19–21` | `PLAN_SUBDIR`, `FREEZE_MANIFEST_DIR`, `FREEZE_MANIFEST_FILE` |
| `O/reset.ts:21,23–26` | reset 자체의 state/durable 이름 복제본 |

**직접 hardcode는 아니지만 같이 검토할 경계**

| 파일:행 | 표현식·동작 | 이유 |
|---|---|---|
| `P/plan-gate.ts:46` | `isAbsolute(att.planUnit) ? att.planUnit : resolve(cwd, att.planUnit)` | durable plan pointer를 cwd 기준으로 해석、R |
| `P/plan-gate.ts:72` | `isAbsolute(p) ? p : resolve(cwd, p)` | `planPaths` 해석、R |
| `P/plan-gate.ts:79` | `relative(resolve(cwd), unit)` | 외부 durable root면 `../…`로 저장될 수 있음 |
| `P/source-receipt.ts:193` | `isAbsolute(path) ? resolve(path) : resolve(cwd, path)` | receipt 입력 경로 해석、R |
| `P/source-receipt.ts:117,136,138,142,147,155` | `resolve(dirname(receiptPath), …)` 등 | receipt 안 artifact 경로는 receipt 상대경로、R |
| `P/subagent-evidence.ts:158` | absolute receipt 또는 `resolve(cwd, receiptPath)` | root 변경과 agent가 반환하는 경로의 일치 필요、R |
| `O/doctor.ts:202` | `joiner(cwd, ".codexclaw")` | WSL filesystem residency 검사；durable root가 외부면 별도 검사 필요 |
| `O/doctor.ts:167` | `join(projectRoot, ".codexclaw", "sessions")` | volatile session 검사；durable resolver로 옮기면 안 됨 |
| `P/source-identity.ts:178,213` | `.codexclaw/` prefix 제외 | checkout 내부의 다른 durable root를 선택하면 source fingerprint에 들어갈 수 있음 |
| `P/rule-impact-ledger.ts:106–111` | arbitrary path를 resolve하고 `.codexclaw` ancestor 감지 | 고정 durable 경로는 없지만 디렉터리 초기화 가정이 있음 |

`plugins/codexclaw/bin/`, `bin/`, `cli/`에는 위 durable 항목을 직접 만드는 추가 filesystem 표현식이 없어요. CLI help 문자열은 아래에 있어요.

**2. 사용자·에이전트 노출 문자열의 durable 경로 hardcode**

아래는 주석이 아니라 help·error·hook directive·hook 출력 데이터에 있는 문자열이에요.

| 파일:행 | hardcoded 내용 |
|---|---|
| `P/goal-gate.ts:248` | `.codexclaw/evidence-unrecordable/` |
| `P/goal-gate.ts:290` | `.codexclaw/goalplans/${state.slug}/goalplan.json` 수리 지시 |
| `P/goalplan-cli.ts:738` | `<cwd>/.codexclaw/goalplans/<slug>/goalplan.json` |
| `P/source-receipt.ts:190` | evidence-root guard 오류의 `.codexclaw/evidence` |
| `P/evidence-cli.ts:69` | receipt가 `.codexclaw/evidence` 안에 있어야 한다는 오류 |
| `P/receipt-cli.ts:88` | `<cwd>/.codexclaw/evidence/<session>/test-receipt.json` |
| `P/subagent-evidence.ts:454` | `.codexclaw/evidence/` 아래 판단 기록 지시 |
| `P/subagent-evidence.ts:466` | `.codexclaw/evidence/` 아래 실제 validation 기록 지시 |
| `S/final-gate-guard.ts:183` | `.codexclaw/evidence/` 아래 receipts 기록 후 reviewer dispatch 지시 |
| `P/scan-cli.ts:312` | `<cwd>/.codexclaw/interviews/<session>.jsonl` |
| `P/freeze-cli.ts:81` | `.codexclaw/plan/<slug>/` |
| `P/freeze-cli.ts:82` | `.codexclaw/interview/freeze.json` |
| `P/freeze.ts:130` | frozen spec의 `.codexclaw/plan/` |
| `P/freeze.ts:133` | hash 비교 대상 `.codexclaw/interview/freeze.json` |
| `P/plan-cli.ts:167` | `devlog/_plan/<YYMMDD>_<slug>/` 생성 help |
| `P/plan-gate.ts:38` | 필수 `planUnit` 위치 `devlog/_plan/YYMMDD_slug/` |
| `P/plan-gate.ts:43` | JSON 예시의 `devlog/_plan/...` |
| `P/orchestrate-cli.ts:185` | PowerShell attest 예시의 `devlog/_plan/260714_slug` |
| `P/orchestrate-cli.ts:190` | POSIX attest 예시의 `devlog/_plan/260714_slug` |
| `P/orchestrate-cli.ts:193` | `testReceiptPath: ".codexclaw/evidence/<session>/test-receipt.json"` |
| `P/orchestrate-cli.ts:374` | A 전환 요구사항의 `devlog/_plan/YYMMDD_slug` |
| `P/hook.ts:1394` | P→A directive의 `devlog/_plan/YYMMDD_slug` |
| `P/hook.ts:1521` | 출력 `ledgerPath: .codexclaw/goalplans/${slug}/ledger.jsonl` |
| `P/hook.ts:1545` | 출력 `ledgerPath: .codexclaw/goalplans/${slug}/ledger.jsonl` |
| `P/hook.ts:1589` | 비어 있는 goalplan에 `.codexclaw/goalplans/${state.slug}/goalplan.json` 작성 지시 |
| `P/steering.ts:314` | progress 기록 위치 `.codexclaw/goalplans/${slug}/ledger.jsonl` |
| `plugins/codexclaw/bin/cxc.mjs:79` | `devlog/_plan` scaffold help |
| `bin/codexclaw.mjs:282` | `devlog/_plan` scaffold help |

`O/doctor.ts:209`의 “`.codexclaw state lives on …`”도 root 분리 후 의미를 조정해야 해요. 특정 durable 하위 경로를 hardcode한 문자열은 아니에요.

**3. 주어진 durable·volatile 목록 밖의 항목**

**프로젝트 `.codexclaw/`**

| 항목·위치 | 분류 | 이유 |
|---|---|---|
| `.gitignore` — 다섯 component의 `src/codexclaw-dir.ts:19` | checkout-local 메타데이터 | 생성된 runtime state를 ignore하면서 committed `rules/`를 허용함；durable root로 이동할 업무 기록이 아님 |
| 호출자가 정하는 rule-impact ledger — `P/rule-impact-ledger.ts:102–111` | durable 권장 | rule-impact 측정 기록은 누적 분석 자료；고정 파일명·기본 하위 경로는 이 모듈에 없음 |

`.gitignore` writer 복제본은 `bg-wake`, `cxc-ops`, `messenger-bridge`, `pabcd-state`, `subagent-config`에 있어요.

명시된 durable 디렉터리 **내부**에는 다음 보조 파일이 있어요. 별도 미분류 top-level 항목은 아니지만 이동 정책을 정할 때 구분해야 해요.

| 항목 | 성격 |
|---|---|
| `goalplans/<slug>/.goalplan.lock/owner.json` — `P/goalplan.ts:770,800,816` | volatile lock；동일 durable plan을 수정하는 모든 checkout이 공유해야 하므로 plan 옆에 두는 의미가 있음 |
| `goalplans/<slug>/goalplan.json.<pid>.<time>.tmp` — `P/goalplan.ts:929` | volatile atomic-write scratch；대상과 같은 filesystem에 있어야 함 |
| `goalplans/<slug>/schema-v2.marker` — `P/goalplan.ts:1760` | durable downgrade 방지 기록 |
| `evidence-attempts/*.json.<pid>.<time>.tmp` — `P/subagent-evidence.ts:221` | volatile atomic-write scratch |
| `evidence-unrecordable/.probe-<pid>-<time>` — `P/subagent-evidence.ts:355` | volatile writable probe |

**사용자 홈의 `~/.codexclaw/` — 프로젝트 root와 구분 필요**

| 항목·위치 | 분류 | 이유 |
|---|---|---|
| `recall/index.sqlite` 및 SQLite sidecars — `components/recall/src/index-db.ts:22,26` | volatile | 원본 Codex 세션에서 재생성하는 index |
| `skill-cache/<key>.cache` — `components/skill-search/src/cache.ts:17,36` | volatile | TTL catalog cache |
| `model-catalog.json` 및 temp — `S/live-catalog.ts:75,87` | volatile | 다시 조회할 수 있는 live model catalog |
| `serve.out.log`, `serve.err.log` — `components/messenger-bridge/src/service.ts:48,49` | volatile | service stdout/stderr |
| `serve.cmd` — `components/messenger-bridge/src/service.ts:249,254` | volatile | 재생성 가능한 Windows service launcher |
| 글로벌 `subagents.json` — `S/store.ts:130,134` | durable 사용자 설정 | 프로젝트의 volatile `subagents.json`과 의미가 다름；프로젝트 durable resolver 범위 밖 |

추가로 `bin/codexclaw.mjs:371` 이후의 `venvs/repomap`, `K/ast-grep/scripts/ast_grep_helper.py:240`의 `runtime/ast-grep/…`는 사용자 홈의 재생성 가능한 runtime 위치를 **조회**해요. 조사한 해당 코드가 직접 쓰는 항목은 아니에요.

`bg/ledger.jsonl`은 `components/bg-wake/src/store.ts:83`의 **volatile** ledger예요. 최상위 durable `ledger.jsonl`과 구분해야 해요.

**4. 테스트 영향 목록과 대략적인 규모**

숫자는 **경로 생성·fixture·경로 assertion·경로를 담은 입력 문자열의 대략적인 참조 수**예요. 테스트 케이스 개수가 아니고, helper를 통해 반복 사용하는 횟수도 포함하지 않았어요.

`PT/` = `plugins/codexclaw/components/pabcd-state/test/`

| 테스트 파일 | 대략적 참조 수 | 내용 |
|---|---:|---|
| `PT/state.test.ts` | 4–6 | top ledger、interviews、goalplans ignore 정책 |
| `PT/goalplan.test.ts` | 8–12 | plan/ledger/lock 및 symlink 경계 |
| `PT/goalplan-regression.test.ts` | 1 helper | `goalplanDir()` 아래 snapshot fixture 생성 |
| `PT/goalplan-concurrency.test.ts` | 1 직접 경로＋lock helpers | goalplan JSON 손상 및 동시 수정 |
| `PT/goalplan-public-surface.test.ts` | 7 | plan/ledger/lock 및 goalplans 미생성 |
| `PT/work-phase-states.test.ts` | 3 | `goalplanDir()` 아래 plan JSON |
| `PT/steering.test.ts` | 12 | goalplan ledger·lock·plan |
| `PT/steering-ops.test.ts` | 2 | goalplan lock、devlog evidence 문자열 |
| `PT/review-binding.test.ts` | 18–19 | devlog unit、goalplan JSON·lock |
| `PT/review-round.test.ts` | 3 | devlog pointer、goalplan ledger |
| `PT/review-deadlock.test.ts` | 9 | devlog unit、goalplan ledger |
| `PT/final-gate.test.ts` | 8 | evidence、goalplan ledger·marker |
| `PT/goal-gate.test.ts` | 3 | unrecordable evidence 및 goalplan 보조 경로 |
| `PT/hook.test.ts` | 25–35 | ledger、devlog、evidence、goalplans |
| `PT/hook-continuation.test.ts` | 2 | 출력 goalplan ledger 경로 assertion |
| `PT/orchestrate-cli.test.ts` | 30–35 | devlog、ledger、evidence |
| `PT/check-gate-generated.test.ts` | 2 | `<tmp>/.codexclaw/evidence/<session>/test-receipt.json` |
| `PT/worktree-source-integration.test.ts` | 4 | native cwd의 evidence·goalplan 위치 |
| `PT/split-cwd-cycle.test.ts` | 2 | devlog unit |
| `PT/nongit-bound-cycle.test.ts` | 5 | devlog fixture、goalplans 미생성 |
| `PT/subagent-evidence.test.ts` | 25–30 | evidence、attempts、unrecordable |
| `PT/source-receipt.test.ts` | 7 | evidence-root 경계 |
| `PT/render-observations.test.ts` | 4 | evidence QA tree |
| `PT/crlf-inputs.test.ts` | 3–4 | evidence receipt |
| `PT/freeze.test.ts` | 3 | `<tmp>/.codexclaw/plan/<slug>` |
| `PT/help-verbs.test.ts` | 1 | help가 freeze manifest를 만들지 않음 |
| `PT/scan-cli.test.ts` | 3 | interviews ledger |
| `PT/plan-cli.test.ts` | 3–4 | devlog scaffold |
| `PT/plan-gate.test.ts` | 7–8 | devlog planUnit·planPaths |
| `PT/attest.test.ts` | 4 | devlog pointer 문자열 정규화 |
| `PT/reviewer-producer-contract.test.ts` | 3 | devlog unit fixture |
| `PT/memory-write-gate.test.ts` | 4–5 | devlog를 쓰는 shell 입력 예시 |

다른 component 및 plugin 테스트:

| 테스트 파일 | 대략적 참조 수 |
|---|---:|
| `plugins/codexclaw/components/subagent-config/test/final-gate-guard.test.ts` | 5 |
| `plugins/codexclaw/components/subagent-config/test/spawn-items-managed.test.ts` | 2 |
| `plugins/codexclaw/components/subagent-config/test/dispatch-contract.test.ts` | 2；devlog anchor 문자열만 |
| `plugins/codexclaw/components/cxc-ops/test/cxc-ops.test.ts` | 14–15；reset fixture와 보존·삭제 assertion |
| `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts` | 1；goalplans 미생성 |
| `plugins/codexclaw/test/build.test.mjs` | 1；ledger 미생성 |
| `plugins/codexclaw/test/payload-bin.test.mjs` | 3；devlog unit |
| `plugins/codexclaw/test/hook-e2e.test.mjs` | 10；ledger·interviews·evidence·attempts |
| `plugins/codexclaw/test/qa-validate-evidence.test.mjs` | 3；evidence QA tree |
| `plugins/codexclaw/test/gate.test.mjs` | 2；`devlog/_plan/mvp_hard` |
| `plugins/codexclaw/test/gate-verifier-claims.test.mjs` | 4–6；`_plan`·`_fin` fixtures |

별도 성격의 테스트도 있어요.

- `plugins/codexclaw/test/visualizer-packaging.test.mjs:93`: shipped 파일에 `devlog/_plan` 문자열이 없는지 검사해요. 임시 durable state fixture는 아니에요.
- `plugins/codexclaw/test/emergence-html-structure.test.mjs:13`: repo의 `devlog/_fin/260701_emergence_harness/emergence_gap.html`을 참조해요.
- `interview-ledger.test.ts`, `interview-readiness.test.ts`는 관련 동작 테스트지만, 검색된 devlog 참조 자체는 주석이에요. 고정 durable 경로 assertion으로 세지 않았어요.
- `probe-evidence-family.test.mjs`의 `evidence/…`는 probe fixture의 상대경로예요. `.codexclaw/evidence/`로 세지 않았어요.

**Git·origin**

다음 관련 테스트 파일은 `git init`을 실행해요.

- `PT/state.test.ts:126`
- `PT/goalplan.test.ts:58`
- `PT/hook.test.ts:1160`
- `PT/orchestrate-cli.test.ts:1015`
- `PT/check-gate-generated.test.ts:30`
- `PT/split-cwd-cycle.test.ts:34`
- `PT/worktree-source-integration.test.ts:29` 및 여러 추가 fixture

이 파일들에서 **`origin` remote를 추가하는 코드는 발견하지 못했어요.** `plan-cli`, `goalplan-public-surface`, `nongit-bound-cycle`의 `init` 문자열은 CLI `plan/loop init`이며 Git 초기화가 아니에요.

따라서 새 resolver가 Git origin을 프로젝트 식별자로 요구한다면 기존 fixture는 대부분 그 조건을 충족하지 않아요.

**5. Skill/reference·structure·docs의 경로 지시**

**실제 기록 위치·작성·보존 계약**

| 파일:행 | 내용 |
|---|---|
| `K/dev-scaffolding/references/implementation-log.md:14,20` | `devlog/` tree의 `_plan/`, `_fin/` |
| `K/dev-scaffolding/references/implementation-log.md:32` | P에서 master plan 및 phase docs 작성 |
| `K/dev-scaffolding/references/implementation-log.md:36` | 완료 시 `_plan/` → `_fin/` 이동 |
| `K/dev-scaffolding/references/implementation-log.md:54,59` | implementation unit·closure record 의미 |
| `K/dev-scaffolding/references/source-of-truth-layout.md:28,75` | `devlog/_plan/` unit 사용·생성 조건 |
| `K/dev-backend/references/core/architecture.md:126,127` | active `_plan/`, completed `_fin/` 디렉터리 예시 |
| `K/pabcd/references/implementation-units.md:4,27` | `_fin/` archive 및 `devlog/_plan/YYMMDD_slug/` unit |
| `K/pabcd/references/phase-control.md:6` | `.codexclaw/ledger.jsonl` audit trail |
| `K/pabcd/references/phase-control.md:7` | `.codexclaw/interviews/<sessionId>.jsonl` |
| `K/pabcd/references/phase-control.md:66` | P→A의 필수 real `devlog/_plan/YYMMDD_slug/` |
| `K/pabcd/references/phase-control.md:77` | planUnit attest 예시 |
| `K/pabcd/references/phase-control.md:80` | `.codexclaw/evidence/<session>/test-receipt.json` attest 예시 |
| `K/loop/references/durable-goalplan.md:52` | `.codexclaw/goalplans/<slug>/goalplan.json` 저장 형태 |
| `K/qa/references/evidence-contract.md:3` | `.codexclaw/evidence/<sessionId>/qa/<scenario-id>/` |
| `K/qa/references/evidence-contract.md:35` | main/worker receipt의 evidence root |
| `K/qa/references/evidence-contract.md:47` | validator 입력 경로 예시 |
| `K/qa/references/evidence-contract.md:51` | `.codexclaw/evidence/<sessionId>/qa-receipt.json` 출력 |
| `K/qa/references/scope-and-binding.md:22` | non-empty evidence receipt 없이 완료 금지 |
| `K/interview/references/ledger-grounding.md:10` | interviews ledger를 grounding에 사용 |
| `K/interview/references/runtime-status.md:6` | hook의 interviews ledger 기록 설명 |
| `K/skill-hub/references/catalog.md:24` | QA capability의 `.codexclaw/evidence/` 사용 |
| `structure/INDEX.md:11` | planning state가 `devlog/_plan/`에 있다는 설명 |
| `structure/INDEX.md:124` | state engine의 `.codexclaw/ledger.jsonl` 소유 설명 |
| `structure/INDEX.md:269` | freeze manifest 출력 위치 |
| `structure/20_pabcd_dispatch_doctrine.md:139` | child가 parent evidence root에 쓸 수 없는 topology 문제 |
| `docs/security-hardening.md:11` | `<cwd>/.codexclaw/goalplans/<slug>` containment 계약 |

**과거 자료 링크·출처 — 현재 작성 위치 지시와 구분**

링크를 보존하거나 archive migration 정책에 맞춰 조정할 대상이에요.

| 파일 | 해당 행 |
|---|---|
| `K/README.md` | 116 |
| `K/pabcd/references/dispatch-surfaces.md` | 130 |
| `K/search/references/deep-research.md` | 153 |
| `K/dev/references/reader-documents.md` | 136 |
| `K/dev/references/stacked-prs.md` | 186, 320 |
| `K/dev-debugging/references/logic-analysis.md` | 10 |
| `K/dev-devops/references/agent-pr-intake.md` | 136, 137, 140, 142 |
| `K/dev-devops/references/repo-bootstrap.md` | 214 |
| `K/dev-devops/references/local-gc.md` | 125, 126 |
| `K/dev-uiux-design/references/color-system.md` | 39 |
| `K/dev-frontend/references/core/motion.md` | 143, 598, 1079, 1080 |
| `K/dev-frontend/references/core/liquid-glass.md` | 7 |
| `structure/70_prompt_architecture.md` | 3 |
| `structure/30_contradiction_register.md` | 81 |
| `structure/00_philosophy.md` | 69, 74 |
| `structure/20_pabcd_dispatch_doctrine.md` | 171, 179, 208, 214 |
| `structure/60_native_capabilities.md` | 90, 142 |
| `structure/10_subagent_skill_routing.md` | 13 |
| `structure/INDEX.md` | 72, 76, 110, 120, 180, 345, 347, 350, 356, 372 |

**명시된 source 검색 범위 밖의 추가 소비자**

`K/qa/scripts/validate-evidence.mjs`도 함께 검토해야 해요.

- `:333`: `.codexclaw/evidence/<sessionId>/qa/`에서 session evidence 디렉터리를 유도하는 계약 설명.
- `:435`: CLI usage에 `<.codexclaw/evidence/<sessionId>/qa/>` hardcode.

마지막 `git status`에서는 `?? devlog/_plan/261020_external_state_root/`가 나타났어요. 이 탐색 lane은 파일을 생성·수정하지 않았으며, 공유 checkout의 동시 작업 결과로 보입니다.
