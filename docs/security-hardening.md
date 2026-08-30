# Runtime security and resource boundaries

This document records the trust and resource boundaries shared by the local GUI,
PABCD state, recall, subagent configuration, and messenger bridge.

## Data flow and ownership

- The browser talks only to the loopback `cxc serve` or Vite development API.
  Mutating requests require a loopback `Host`, JSON content type, and the
  `x-codexclaw-local: 1` header. Both servers use the same 1 MB JSON reader.
- Goalplans live below `<cwd>/.codexclaw/goalplans/<slug>`. A slug is an
  identifier, not a path: separators, dot segments, stored/requested mismatches,
  and symlinked state roots are rejected.
- Automatic recall is project-scoped. Cross-project search remains available
  only through an explicit `cxc chat search` command. Injected history is wrapped
  in an `untrusted-recall-data` block and must never be interpreted as policy.
- `.codexclaw/subagents.json` is intended as operator-local state. If Git tracks
  it, spawn-time model, effort, and prompt overrides are ignored unless the
  operator reviews it, runs `cxc subagents trust-token`, and exports the printed
  value. The value binds the canonical repository path and exact config digest,
  so it cannot silently trust another checkout or later edits.
- Recursive delegation is authorized with a parent-minted, project/session-bound,
  single-use capability. Public marker text is only a request from a root
  dispatcher; it is never authority when supplied by a child. Worker evidence
  verification likewise ignores child-authored exemption text. After its retry
  budget it is fail-closed on the VERDICT and bounded on the CONTROL FLOW: the
  child is released with an unresolved record, and `update_goal {status:"complete"}`
  is denied until that record is settled with a valid receipt
  (`cxc evidence resolve --receipt <path>`, which has no override flag). Blocking a
  child forever was not the safety property — a read-only child cannot write the
  receipt, so re-prompting it only hid the outcome from the parent. `status:"blocked"`
  remains the honest escape hatch, and unreadable verification state denies rather
  than reads as clean.
- Telegram callback authorization binds chat, named agent, binding, and forum
  topic. Approval IDs are random across restarts; Discord output disables all
  automatic mention parsing.

## Resource limits

| Resource | Boundary |
| --- | --- |
| Local API body | 1,000,000 bytes |
| Enforcement hook stdin | 4 MiB; oversized PreToolUse/SubagentStop fails closed |
| Codex JSONL event / final reply | 8 MiB each; oversized records are dropped and reported, retained output is capped exactly |
| Telegram/Discord attachment | 25 MiB declared and streamed bytes |
| Attachments handled per message | 4 |
| Concurrent messages downloading media | 2 globally; overload is rejected without queuing |
| Attachment download | 30 seconds |
| Job history | 1,000 rows per binding and 90 days |
| Event ring / pending JSONL | 200 entries; 1,024 pending events and 1 MiB; overflow becomes one drop summary |
| JSONL files | Rotate at 50 MiB with three retained files |

Downloads stream into mode-0600 files inside mode-0700 temporary directories.
Bridge/recall SQLite databases and sidecars are also restricted to mode 0600 on
POSIX systems. Process cancellation targets the whole POSIX Codex process group,
so descendants do not outlive a cancelled turn even if the direct child exits
while a grandchild keeps an inherited pipe open. Startup reconciles crash-stale
`running` jobs to terminal errors before retention pruning.

## Decision log

[Decision Log]
- 목적과 의도: 로컬 자동화 기능을 유지하면서 브라우저, 저장 상태, 과거 대화, 메신저 콜백 사이의 신뢰 경계를 명시한다.
- 기존 구현 및 제약 조건: 각 실행 경로가 독립적으로 성장해 Vite와 운영 API, 채팅과 토픽, 현재 프로젝트와 전역 recall의 정책이 달랐다.
- 검토한 주요 대안: 별도 로그인 세션, 전역 recall 완전 제거, 프로젝트 설정 완전 금지, 대용량 기능 제거.
- 선택한 방식: 기존 UI/API 계약을 유지하는 공통 loopback guard, 명시적 전역 검색, Git 추적 설정 opt-in, 스트리밍 및 높은 안전 상한을 적용한다.
- 다른 대안 대신 이 방식을 선택한 이유: 정상 사용 흐름과 설치 호환성을 보존하면서 재현된 공격/누수 경로를 직접 닫을 수 있다.
- 장점, 단점 및 영향: 정상 크기 요청과 출력은 동일하다. 비정상 대용량 출력은 명시적으로 잘리고, Git에 포함된 subagent 설정은 검토 전까지 적용되지 않는다.

[Decision Log]
- 목적과 의도: 장시간 실행되는 messenger bridge의 메모리, 파일, DB, 소켓 수명을 유한하게 만든다.
- 기존 구현 및 제약 조건: jobs와 일부 Map이 무한 성장했고, 이벤트 기록과 정적 파일 제공은 요청마다 동기 파일 IO를 수행했다.
- 검토한 주요 대안: 외부 queue/log/database 도입, 프로세스 주기 재시작, 내부 보존/캐시 정책.
- 선택한 방식: SQLite 보존/인덱스 및 재시작 정리, map sweep, bounded single-drain event writer, immutable asset cache, single-flight polling을 사용한다.
- 다른 대안 대신 이 방식을 선택한 이유: 제3자 런타임 의존성 없이 현재 단일 프로세스 구조 안에서 검증 가능하다.
- 장점, 단점 및 영향: 오래된 job 상세는 보존 기간 이후 삭제된다. GUI가 사용하는 최근 이력과 재시드 범위는 그대로 유지된다.

[Decision Log]
- 목적과 의도: 정책 훅과 장시간 bridge가 공격자 제어 입력 때문에 fail-open 또는 무한 메모리 대기열로 전환되지 않게 한다.
- 기존 구현 및 제약 조건: 공개 문자열 토큰이 권한처럼 사용됐고, 큰 hook/JSONL 입력과 느린 디스크 및 동시 다운로드에 전역 상한이 없었다.
- 검토한 주요 대안: 재귀 위임 완전 제거, 모든 초과 입력 프로세스 실패, 외부 작업 큐 도입, 입력 전체 허용.
- 선택한 방식: 일회성 재귀 capability, enforcement 입력의 명시적 deny/block, byte/count bounded drain, 즉시 거부형 media semaphore를 적용한다.
- 다른 대안 대신 이 방식을 선택한 이유: 정상 위임과 일반 크기 메시지를 유지하면서 권한과 자원 경계를 입력 문자열 및 디스크 속도와 분리한다.
- 장점, 단점 및 영향: 정상 흐름은 유지된다. 과부하 media 요청은 재시도 안내를 받고, oversized hook/event는 조용히 우회되지 않고 명시적으로 거부 또는 기록된다.

## Verification expectations

Changes to these boundaries require a focused regression test and the repository
test/build gate. Dependency changes must also leave `npm audit` at zero known
vulnerabilities. Security tests cover cross-origin mutation, traversal and
symlink state, schema downgrade, cross-project recall, cross-topic callbacks,
restart-stale approvals, and tracked project prompt overrides.
Additional tests cover one-use recursion grants, evidence-marker spoofing,
uncooperative download timeouts, partial writes, slow-log backpressure,
oversized JSONL framing, stale running jobs, and descendant process cleanup.
