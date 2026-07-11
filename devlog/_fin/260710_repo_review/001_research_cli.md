# 001 — CLI 표면 탐색 보고 (탐색 에이전트 Noether, gpt-5.6-sol)

수집: 2026-07-10, 사이클 1 P단계 병렬 탐색. 읽기 전용. 원문 그대로 보존(사이클 1 B의 근거 소스).

## 1) CLI 표면 맵

> 범위 확인 결과 `cli/src`는 파일 수 0인 빈 디렉터리다. 현재 확인 가능한 CLI 코드는 자신을 "compiled component CLIs"의 얇은 위임기라고 설명하는 `bin/codexclaw.mjs`뿐이다(`bin/codexclaw.mjs:27-28`).

| 명령 표면 | 등록/디스패치 | 구현 대상 또는 구현 위치 |
|---|---|---|
| `help`, `--help`, `-h` | `bin/codexclaw.mjs:304-310` | 인라인 도움말 `bin/codexclaw.mjs:173-216` |
| `enable` | `bin/codexclaw.mjs:312-314` | `config-guard/dist/cli.js` 선언 `bin/codexclaw.mjs:37-46`, 실행 `bin/codexclaw.mjs:125-129` |
| `disable`, `uninstall` | `bin/codexclaw.mjs:315-318` | `config-guard/dist/cli.js` 선언 `bin/codexclaw.mjs:37-46`, 실행 `bin/codexclaw.mjs:125-129` |
| `status` | `bin/codexclaw.mjs:319-321` | `config-guard/dist/cli.js` 선언 `bin/codexclaw.mjs:37-46` |
| `doctor`, `reset` | `bin/codexclaw.mjs:322-325` | `cxc-ops/dist/cli.js` 선언 `bin/codexclaw.mjs:48-57`, 실행 `bin/codexclaw.mjs:131-135` |
| `orchestrate <verb>` | `bin/codexclaw.mjs:326-329` | `pabcd-state/dist/cli.js` 선언 `bin/codexclaw.mjs:59-68`, 실행 `bin/codexclaw.mjs:137-141` |
| `freeze` | `bin/codexclaw.mjs:330-335` | 동일한 `pabcd-state` 위임 `bin/codexclaw.mjs:59-68` |
| `metric` | `bin/codexclaw.mjs:337-340` | 동일한 `pabcd-state` 위임 `bin/codexclaw.mjs:137-141` |
| `divergence` | `bin/codexclaw.mjs:341-344` | 동일한 `pabcd-state` 위임 `bin/codexclaw.mjs:137-141` |
| `loop init\|show\|validate` | 하위 표면 `bin/codexclaw.mjs:190`, 디스패치 `bin/codexclaw.mjs:345-350` | 동일한 `pabcd-state` 위임 |
| `goalplan init\|show\|validate` | deprecated alias `bin/codexclaw.mjs:191`, 디스패치 `bin/codexclaw.mjs:345-350` | 동일한 `pabcd-state` 위임 |
| `serve`, `service` | `bin/codexclaw.mjs:351-355` | `messenger-bridge/dist/cli.js` 선언 `bin/codexclaw.mjs:103-112`, 실행 `bin/codexclaw.mjs:161-165` |
| `gui` | `bin/codexclaw.mjs:356-368` | 같은 파일의 인라인 Vite 실행 |
| `chat search`, `memory search` | 표면 `bin/codexclaw.mjs:197-198`, 디스패치 `bin/codexclaw.mjs:370-374` | `recall/dist/cli.js` 선언 `bin/codexclaw.mjs:81-90`, 실행 `bin/codexclaw.mjs:149-153` |
| `skill search\|show` | 표면 `bin/codexclaw.mjs:199`, 디스패치 `bin/codexclaw.mjs:375-378` | `skill-search/dist/cli.js` 선언 `bin/codexclaw.mjs:114-123`, 실행 `bin/codexclaw.mjs:155-159` |
| `subagents` | `bin/codexclaw.mjs:379-381` | `subagent-config/dist/cli.js` 선언 `bin/codexclaw.mjs:70-79`, 실행 `bin/codexclaw.mjs:143-147` |
| `map [dir]` | `bin/codexclaw.mjs:382-386` | 선택/부트스트랩 `bin/codexclaw.mjs:236-288`, `repomap.py` 경로 선언 `bin/codexclaw.mjs:261-264` |
| `provider` | `bin/codexclaw.mjs:387-389` | `provider-bridge/dist/cli.js` 선언 `bin/codexclaw.mjs:92-101`, `detect` 실행 `bin/codexclaw.mjs:167-171` |

실행 파일 별칭은 `codexclaw`과 `cxc` 모두 같은 파일을 가리킨다(`package.json:12-15`).

## 2) orchestrate 게이트 로직 요약

- 래퍼는 `orchestrate` 인수를 해석하지 않고 `process.argv.slice(2)` 전체를 `runPabcdState`로 전달한다(`bin/codexclaw.mjs:326-329`). 해당 함수도 `pabcd-state/dist/cli.js`를 동기 실행할 뿐이다(`bin/codexclaw.mjs:137-141`).
- `A>B`의 `auditOutput`/`auditVerdict` 조건은 래퍼 범위에서 등장하지 않는다. 실질 구현은 컴포넌트 소스(`plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`)에 있다(래퍼 근거: `bin/codexclaw.mjs:59-68`).
- `C>D`의 `checkOutput`/`exitCode` 역시 래퍼 범위 밖, 같은 컴포넌트 소스 소관.
- `--session`은 도움말에서 "Mutating PABCD commands require the current session id"로 계약(`bin/codexclaw.mjs:208-210`); 실제 필수화는 위임 대상에서 수행(`bin/codexclaw.mjs:326-329`).

## 3) 발견 사항

1. **High — 소스 감사 공백.** "thin delegator over compiled component CLIs"(`bin/codexclaw.mjs:27`)이고 `orchestrate`는 `dist/cli.js`로 바로 넘어간다(`bin/codexclaw.mjs:59-68`). `cli/src`가 비어 있어 이 경로만으로는 transition/attest 게이트를 소스 기준으로 검토할 수 없다. (보정: 실소스는 `plugins/codexclaw/components/*`에 존재 — 002 보고 참조.)
2. **Med — GUI 실행 실패가 성공 종료로 위장될 수 있다.** `process.exit(typeof res.status === "number" ? res.status : 0)`(`bin/codexclaw.mjs:366-367`). `spawnSync` 실행 오류로 `status === null`이면 0으로 종료.
3. **Med — 실패한 repo-map venv가 다음 실행에서 유효한 것으로 간주.** `let hasVenv = existsSync(venvPython)`(`bin/codexclaw.mjs:265-266`) 후 pip 실패 시 메모리 변수만 false(`bin/codexclaw.mjs:274-276`); 남은 venv가 다음 실행에서 재선택(`bin/codexclaw.mjs:248-250`).
4. **Med — `map --help` 인터프리터 우선순위가 주석과 다름.** 주석은 bare `python3` 선택(`bin/codexclaw.mjs:225-227`), 실제 fallback은 `env.CODEXCLAW_PYTHON || "python3"`(`bin/codexclaw.mjs:238-251`).
5. **Med — `uv` 탐지가 종료 코드 무시.** `const hasUv = !spawnSync("uv", ["--version"], ...).error`(`bin/codexclaw.mjs:280`).
6. **Low — ENOENT 진단이 실패 명령을 숨김.** 선택 명령은 `sel.cmd`(`bin/codexclaw.mjs:281-282`)인데 모든 ENOENT에 "python3 not found"(`bin/codexclaw.mjs:283-285`).
7. **Low — 공백뿐인 `CODEXCLAW_PYTHON`이 실행 파일명으로 사용.** truthiness만 검사(`bin/codexclaw.mjs:239-240`), 부트스트랩 억제(`bin/codexclaw.mjs:269`).
8. **Low — 명령 목록 3중 수동 중복.** 헤더 목록(`bin/codexclaw.mjs:5-25`), `TOP_LEVEL_HELP`(`bin/codexclaw.mjs:173-212`), switch registry(`bin/codexclaw.mjs:304-390`).

## 4) 검증에 쓴 명령어

```sh
find cli/src -type f -print | sort
git ls-files --stage -- cli/src package.json bin
nl -ba bin/codexclaw.mjs
rg -n 'auditOutput|auditVerdict|checkOutput|exitCode|--session|transition|attest' cli/src package.json bin
node --check bin/codexclaw.mjs
node bin/codexclaw.mjs --help
```
