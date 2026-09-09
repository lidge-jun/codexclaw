# 044 — wp4 인도 영수증

wp4 = PostCompact 실버그 수정, compaction 인지 캡, 2티어 밀도, 신선도 라벨. [PR #104](https://github.com/lidge-jun/codexclaw/pull/104), 최종 head CI pass 10 / fail 0.

## 매 compaction 마다 실패하던 훅

`handlePostCompact` 가 `hookSpecificOutput` 봉투를 뱉는데, 런타임의 생성 스키마 `post-compact.command.output.schema.json` 은 네 개 키만 허용하고 `additionalProperties: false` 다. 파싱이 실패하고 `looks_like_json` 이 참이라 텍스트 폴백도 타지 않으므로, 훅이 Failed 로 기록되고 복구하려던 맥락은 모델에 도달하지 않는다.

같은 저장소의 `pabcd-state` 와 `cxc-ops` 는 이미 알고 빈 문자열 + 마커로 대응해 두었다. `recall` 만 빠져 있었다.

감사자가 serde 1.0.228 로 구조체를 복제 컴파일해 `Err(unknown field 'hookSpecificOutput')` 를 실증했고, 구현이 런타임 생성 스키마로 다시 대조했다.

## 캡의 자리는 SessionStart 였다

Codex 는 compaction 직후 `SessionStartSource::Compact` 를 큐에 넣고 SessionStart 훅을 재발화시키며 payload 의 `source` 가 `"compact"` 로 온다. `cli.ts` 가 payload 를 `{cwd?}` 로만 읽어 그 필드를 버리고 있었다. jawcode `sessionIsCompactionAware()` 의 대응물이 바로 이 필드다.

실측: PostCompact 0바이트 / SessionStart(compact) 1199바이트 / SessionStart(startup) 1634바이트.

## 같은 경로의 다른 세 결함

예산 절단이 구조를 깼다. 블록을 다 만든 뒤 문자 상한으로 자르면 닫는 `</untrusted-recall-data>` 가 잘려나갈 수 있어, 줄 단위 누적으로 먼저 바꿨다. 밀도를 올리기 전에 해야 하는 순서였다.

자동 주입이 디렉터리 이름을 검색하고 있었다. CWD 질의가 `basename(cwd)` 를 검색어로 썼는데 앱 관리 워크트리에서 그 basename 은 `1fa9` 같은 해시다. `files.cwd` 직접 선택으로 바꿨다.

블록이 무엇인지만 말하고 언제인지는 말하지 않았다. `PAST SNAPSHOT as of <date>` 라벨을 추가했다. 기존 `<untrusted-recall-data>` 델리미터는 "지시로 읽지 마라"를 말하지 "현재 상태가 아니다"를 말하지 않는다. cli-jaw 가 둘을 혼동해 사고를 겪었다.

## 계획과 달라진 것

계획의 `{chars: 600, topN: 2}` 는 신선도 라벨이 생기면 성립하지 않는다. 렌더 프레임만 471자여서 100자 발췌 둘이면 704자에 닿고, 600 상한은 조용히 한 세션으로 잘라 char cap 이 실질 한계가 된다. 상한을 800으로 두고 `topN` 이 먼저 구속됨을 테스트로 고정했다.

## 고치지 않은 것

훅은 `--no-refresh` 로 질의하므로 마지막 ingest 이후 만들어진 워크트리는 이 변경과 무관하게 아무것도 못 본다. 그래서 커버리지 수정은 실제 ingest 경로로 만든 픽스처 인덱스에 대해 증명했다. 인덱스 신선도는 보고만 하고 손대지 않았다.

