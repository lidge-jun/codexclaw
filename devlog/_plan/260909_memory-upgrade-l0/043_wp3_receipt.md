# 043 — wp3 인도 영수증

wp3 = 프로젝트 스코핑(--cwd / --cwd-only)과 memory 0건 시 chat 자동 보완. [PR #108](https://github.com/lidge-jun/codexclaw/pull/108), 최종 head CI pass 10 / fail 0.

## 스코핑의 근거

네이티브 메모리에는 프로젝트 스코핑이 없다. phase-1 후보 질의가 `cwd_filters: None` 을 넘기고, `stage1_outputs` 에는 `cwd` 컬럼이 아예 없다 — 스키마를 덤프해 10개 컬럼 전부를 확인했고 `cwd` 도 `git_branch` 도 없다. 이전 노트가 언급한 필드는 Rust in-memory 타입이지 영속 스키마가 아니었다. 우회로는 `thread_id` → `threads.cwd` 조인이고 `loadThreadMeta` 가 이미 그 Map 을 만든다.

`--cwd` 는 필터가 아니라 점수 가산이다. 해당 프로젝트에 히트가 없을 때 빈 페이지를 주면 안 되기 때문이고, 이는 `kindPriority` 가 게이트가 아닌 이유와 같다. 배제가 실제로 필요한 경우를 위해 `--cwd-only` 를 따로 두었다.

## 실측 (12,745파일 / 1,214,276메시지, memory 285파일)

같은 질의 `배포`:

| 스코프 | 히트 | 상위 |
|---|---|---|
| 없음 | 5 (109ms) | file, file, file, stage1, stage1 |
| `--cwd opencodex` | 5 (136ms) | opencodex stage1 이 2위 진입 |
| `--cwd codexclaw` | 5 (154ms) | codexclaw stage1 이 1·2·4위 |
| `--cwd-only codexclaw` | 5 (142ms) | 동일 |
| `--cwd worktrees/1fa9` | 5 (135ms) | 빈 결과 아님 — 부스트의 목적 |
| `--cwd-only worktrees/1fa9` | 0 (2.7s) | 경고와 `--cwd` 재시도 안내 |

보완 경로는 `recommended_plugins`(memory 0건)에서 chat 3건을 반환한다. 도구 로그는 `includeTools: false` 로 무조건 제외한다 — 회수 오염의 원인이기 때문이다. 결과에는 `(chat/chat)` 라벨과 경고가 붙어 보완 답변이 통합된 기억으로 오인되지 않는다.

## CI 가 잡은 windows 버그

`buildCwdScope` 가 질의 cwd 에 `path.resolve()` 를 걸었다. windows 에서 `path.resolve("/proj/here")` 는 `\\proj\\here` 를 돌려주므로 질의 쪽만 백슬래시가 되고 저장 쪽은 슬래시로 남아 모든 비교가 false 가 된다. 실패 7건 전부가 이 한 줄이었다. chat 검색이 영향받지 않은 이유는 cwd 를 resolve 없이 넘기기 때문이고, 그래서 wp5 의 구분자 테스트는 windows 에서도 통과했다.

정규화를 비교 시점에 대칭으로 옮겼다. `normalizeCwd` 가 구분자를 `/` 로 접고 후행 구분자를 떼고 드라이브 문자를 대문자로 올린다. 경로 대소문자는 건드리지 않는다 — 접으면 대소문자를 구분하는 플랫폼에서 `/Repo` 가 `/repo` 에 매치되는 새 버그가 생긴다.

## 계획과 달라진 것

frontmatter `cwd` 파싱을 선두 블록으로 좁혔다. 계획의 `/^cwd:/m` 은 `raw_memories.md` 를 `/Users/jun` 으로 오라벨링한다 — 이 파일은 스레드별 블록 448개를 이은 집합체다.

산문 언급에 절반 부스트를 주었다. 구조화된 `cwd` 만 보면 `--cwd-only` 가 `MEMORY.md` 를 통째로 버리는데, 프로젝트 규칙이 실제로 사는 곳이 거기다.

`--no-tools` 는 재사용하지 않았다. 그 플래그는 chat 검색 사용자의 것이라 의미가 겹친다. 보완은 항상 도구 로그를 빼고 돌고, 보완 자체를 끄는 `--no-chat` 을 따로 두었다.

## 남은 비용

`--cwd-only` 가 0건일 때 2.7초가 걸린다. chat 검색의 기존 `--cwd` 필터가 느린 인덱스 경로여서이고 이번 변경이 들인 비용은 아니다. `--cwd` 부스트만 쓰면 140ms 대다. chat 검색의 후행 슬래시 `--cwd` 가 0건을 주는 것도 이 브랜치가 건드리지 않은 기존 문제다.

