# diagram-viewer visualize 서브셋 통합 계획

날짜: 2026-07-13
상태: PLAN READY, 구현 전
작업 등급: C2 — 번들 skill 계약 추출, 라우팅 변경, upstream drift 감지

## 배경

`diagram-viewer`는 현재 실행 환경을 먼저 판별한 뒤, 다이어그램 종류와 사용 가능한 렌더링 표면에 맞춰 출력 경로를 고르는 라우터다. Codex Desktop에서는 네이티브로 처리할 수 있는 형식을 우선 사용하고, 그 밖의 형식은 HTML을 만들어 브라우저에서 여는 경로로 보낸다. CLI에서는 jaw 렌더러가 있으면 jaw에 맡기고, 그렇지 않으면 browser-render 경로를 사용한다.

Codex Desktop 앱에 번들된 `visualize` skill은 대화 안에서 동작하는 inline visualization 계약을 문서화한다. 이 skill 자체가 렌더러나 실행 라이브러리를 제공하는 것은 아니다. fragment 포맷, `::codex-inline-vis` 디렉티브, CSS 변수, 유틸리티 클래스, 레이아웃 및 시각 구성 규칙은 모두 Desktop 호스트 런타임이 제공한다. 즉 `visualize`는 실행 코드가 아니라, 에이전트가 호스트에 어떤 조각을 어떤 형식으로 넘겨야 하는지를 설명하는 계약 문서다.

이번 통합의 목적은 `diagram-viewer`가 런타임에 `visualize` skill을 호출하거나 작업을 위임하지 않고도, Desktop에서 같은 inline rendering 계약을 직접 사용할 수 있게 만드는 것이다. 필요한 계약을 `diagram-viewer` 내부의 명시적인 서브셋으로 보관하고, 지원되는 시각화는 대화 안에 바로 렌더링한다. 서브셋이 다루지 않는 시각화는 기존 browser-render 경로로 계속 처리한다.

## 아키텍처 결정

### 1. 호출 위임이 아니라 계약 내장

`diagram-viewer`는 번들 `visualize` skill의 실행 여부나 가용성에 의존하지 않는다. 대신 inline visualization을 만드는 데 필요한 문서 계약을 `reference/visualize-contract.md`에 추출해 자체 참조로 둔다.

이 방식의 경계는 다음과 같다.

- 포함하는 것: fragment 포맷, 호스트 CSS 변수, 유틸리티 클래스, composition, layout, typography, color, charts, icons, `::codex-inline-vis` 출력 규칙.
- 포함하지 않는 것: 별도 렌더러 구현, 호스트 CSS 재구현, Desktop 내부 API 호출, `visualize` skill 호출 또는 위임 계층.
- 실행 주체: fragment를 해석하고 실제 UI를 그리는 Codex Desktop 호스트 런타임.
- `diagram-viewer`의 책임: 환경과 시각화 유형을 판별하고, 지원되는 경우 계약에 맞는 fragment와 디렉티브를 생성하는 것.

### 2. upstream drift를 자동 감지

내장 계약은 upstream `visualize` 문서의 스냅샷이므로 원본이 바뀌면 차이가 누적될 수 있다. `upstream/visualize-upstream.md`에 추적 기준과 변경 이력을 남기고, `upstream/sync-check.sh`가 현재 upstream 내용의 hash와 기록된 hash를 비교하도록 한다.

검사 결과는 두 상태로 단순화한다.

- hash 일치: 현재 내장 계약이 추적 중인 upstream 스냅샷과 동기화된 상태.
- hash 불일치: 계약 재검토가 필요한 drift 상태. 자동으로 계약 문서를 덮어쓰지 않고 실패로 알린다.

### 3. browser-render는 호환성 fallback으로 유지

inline-vis는 기존 렌더링 경로를 대체하지 않는다. Desktop 호스트 계약이 다루지 않는 3D, audio, physics 계열과 그 밖의 비지원 형식은 현재 browser-render 경로를 그대로 사용한다. CLI의 jaw/browser-render 선택도 유지한다.

따라서 이번 변경은 기존 기능을 제거하는 전환이 아니라, Desktop의 지원 형식에 한해 더 가까운 렌더링 경로를 앞에 추가하는 확장이다.

## 변경 파일

```text
plugins/codexclaw/skills/dev-diagram-viewer/
  SKILL.md                              MODIFY — Desktop inline-vis 라우팅 추가
  reference/
    visualize-contract.md              NEW — visualize inline 계약의 로컬 서브셋
  upstream/
    visualize-upstream.md              NEW — upstream 스냅샷과 변경 이력
    sync-check.sh                       NEW — upstream hash drift 검사
```

### `reference/visualize-contract.md` — visualize 계약 추출

Desktop inline rendering에 필요한 계약을 한 문서에 모은다. 구현자가 원본 번들 skill을 다시 추측하지 않고 fragment를 만들 수 있을 정도로 구체적이어야 한다.

포함 범위:

- fragment의 필수 구조와 허용되는 포맷.
- `::codex-inline-vis` 디렉티브 형식과 fragment 연결 규칙.
- Desktop 호스트가 제공하는 CSS 변수.
- 호스트 유틸리티 클래스와 적용 범위.
- composition 및 컴포넌트 조합 원칙.
- layout, spacing, responsive 구성 규칙.
- typography와 정보 위계 규칙.
- color 토큰, 대비, 상태 표현 규칙.
- charts 작성 규칙과 데이터 표현 원칙.
- icons 사용 규칙.

문서에는 호스트 제공 항목과 fragment 작성자가 책임지는 항목을 구분한다. 호스트 자산을 로컬 코드로 재구현하거나 임의의 CSS 계약을 추가하지 않는다.

### `upstream/visualize-upstream.md` — 추적 스냅샷

현재 계약이 어느 upstream 상태에서 추출됐는지 재현할 수 있게 기록한다.

- upstream 원본의 식별 경로 또는 식별자.
- 추적 시점의 version.
- 정규화된 원문 기준 hash와 hash 알고리즘.
- 로컬 `visualize-contract.md`가 반영한 범위.
- 동기화 날짜.
- 변경 시마다 추가하는 짧은 changelog.

hash와 version은 구현 시 실제 번들 원본을 읽고 계산한 값만 기록한다. 계획 단계에서 임의의 값을 넣지 않는다.

### `upstream/sync-check.sh` — drift 검사

스크립트는 추적 중인 upstream 원본을 읽어 같은 방식으로 hash를 계산하고, `visualize-upstream.md`에 기록된 값과 비교한다.

요구 동작:

1. upstream 원본과 추적 메타데이터의 존재 여부를 확인한다.
2. 입력을 정해진 방식으로 정규화한 뒤 hash를 계산한다.
3. 일치하면 현재 version과 hash를 출력하고 성공한다.
4. 불일치하면 기대 hash와 실제 hash를 함께 출력하고 실패한다.
5. 파일을 자동 수정하거나 계약을 자동 병합하지 않는다.

로컬 환경마다 번들 설치 위치가 달라질 수 있으므로, 원본 위치는 스크립트 안에 사용자 홈 절대 경로로 고정하지 않는다. 저장소 관례와 실제 번들 탐색 방식을 확인해 재현 가능한 입력 규칙을 정한다.

### `SKILL.md` — Desktop inline-vis 라우팅

환경 감지 이후의 Desktop 라우팅에 inline-vis 분기를 추가한다. `visualize`에 위임한다고 적힌 기존 설명은 계약 내장 방식으로 바로잡고, 지원 여부를 기준으로 `visualize-contract.md` 또는 browser-render를 선택하게 한다.

기존 Mermaid 네이티브 처리와 browser-render 설명이 새 라우팅 표 및 quick reference와 모순되지 않도록 함께 정리한다. CLI 경로는 동작을 바꾸지 않는다.

## `SKILL.md` 라우팅 변경

### Codex Desktop

1. 기존 `environment-detection.md`의 신호로 Desktop 환경을 확인한다.
2. 요청한 시각화 유형이 inline-vis 계약의 지원 범위인지 판별한다.
3. 지원되는 유형이면 `reference/visualize-contract.md`에 따라 fragment를 생성한다.
4. 생성한 fragment를 `::codex-inline-vis` 디렉티브로 출력해 Desktop 호스트가 대화 안에서 렌더링하게 한다.
5. 지원되지 않는 유형이면 기존 browser-render 경로로 보낸다.

Desktop에서 inline-vis로 처리할 대상은 upstream 계약이 실제로 커버하는 유형으로 제한한다. 특히 3D, audio, physics는 지원 대상으로 확대 해석하지 않는다.

| 환경 | 유형 | 경로 |
|---|---|---|
| Desktop | visualize 계약이 커버하는 차트·시각화 | `visualize-contract.md`에 맞는 fragment → `::codex-inline-vis` |
| Desktop | 3D | 기존 browser-render |
| Desktop | audio | 기존 browser-render |
| Desktop | physics | 기존 browser-render |
| Desktop | 그 밖의 inline-vis 비지원 형식 | 기존 browser-render |

### CLI

CLI 라우팅은 현재 계약을 유지한다.

- jaw Web UI가 활성화된 경우: jaw의 기존 렌더링 경로 사용.
- jaw 렌더러를 사용할 수 없는 경우: 기존 browser-render 경로 사용.

CLI에서는 `::codex-inline-vis`가 Desktop 호스트 계약이라는 점을 분명히 하고, 이를 범용 출력 형식처럼 사용하지 않는다.

## upstream 동기화 절차

1. `upstream/sync-check.sh`를 실행해 drift 여부를 확인한다.
2. hash가 다르면 upstream `visualize` 문서의 변경 내용을 검토한다.
3. fragment 포맷, CSS 변수, 유틸리티 클래스, 구성 규칙 등 로컬 서브셋에 영향을 주는 변경만 `reference/visualize-contract.md`에 반영한다.
4. 새 version, hash, 동기화 날짜를 `upstream/visualize-upstream.md`에 갱신한다.
5. 같은 문서의 changelog에 무엇이 바뀌었고 라우팅 또는 fragment 생성에 어떤 영향이 있는지 적는다.
6. 해당 구현 단위의 devlog에도 변경 파일, 판단 근거, 검증 결과를 기록한다.
7. `sync-check.sh`를 다시 실행해 새 스냅샷과 로컬 추적 값이 일치하는지 확인한다.

drift 감지는 업데이트 필요성을 알리는 장치다. upstream 변경을 무조건 자동 수용하지 않으며, Desktop 호스트에서 실제로 제공되는 계약인지 검토한 뒤 반영한다.

## 변경하지 않는 파일

다음 파일은 이번 통합 범위 밖이며 그대로 유지한다.

- `plugins/codexclaw/skills/dev-diagram-viewer/reference/environment-detection.md` — 현재 환경 감지 기준을 계속 사용한다.
- `plugins/codexclaw/skills/dev-diagram-viewer/reference/html-templates.md` — browser-render fallback의 템플릿 원본으로 유지한다.
- `plugins/codexclaw/skills/dev-diagram-viewer/scripts/diagram-to-html.sh` — 기존 browser-render 실행 경로를 유지한다.
- `plugins/codexclaw/skills/dev-diagram-viewer/agents/openai.yaml` — skill 등록 및 트리거 메타데이터를 변경하지 않는다.

또한 이번 단위에서는 Desktop 호스트 런타임, 번들 `visualize` skill 원본, jaw 렌더러를 수정하지 않는다.

## 구현 순서

1. 현재 번들 `visualize` 원본을 식별하고 version 및 hash 산정 방식을 확정한다.
2. 원본에서 Desktop inline rendering에 필요한 계약을 `reference/visualize-contract.md`로 추출한다.
3. 추적 기준과 최초 changelog를 `upstream/visualize-upstream.md`에 기록한다.
4. `upstream/sync-check.sh`를 작성해 일치와 drift 두 경우를 검증한다.
5. `SKILL.md`의 Desktop 라우팅 표, delivery workflow, type detection, quick reference, `visualize` 연동 설명을 계약 내장 방식에 맞춰 갱신한다.
6. 비지원 유형과 CLI가 기존 fallback으로 남는지 문서 및 스크립트 검증을 수행한다.
7. 구현 결과와 upstream 기준을 이 devlog 단위에 기록한다.

## 수용 기준

1. `diagram-viewer`가 `visualize`를 호출하거나 위임하지 않으며, 로컬 계약을 참조한다고 명시돼 있다.
2. `reference/visualize-contract.md`에 fragment 포맷, CSS 변수, 유틸리티 클래스, composition, layout, typography, color, charts, icons 계약이 빠짐없이 정리돼 있다.
3. Desktop의 지원 유형은 계약에 맞는 fragment와 `::codex-inline-vis` 디렉티브로 출력된다.
4. Desktop의 3D, audio, physics 및 기타 비지원 유형은 browser-render로 남는다.
5. CLI는 jaw 또는 browser-render를 고르는 기존 경로를 유지한다.
6. `sync-check.sh`는 hash 일치 시 성공하고, upstream 내용이 달라지면 파일을 수정하지 않은 채 실패한다.
7. `visualize-upstream.md`만 읽어도 추적 version, hash, 동기화 날짜, changelog를 확인할 수 있다.
8. 변경 금지 파일 네 개에는 diff가 없다.
9. `SKILL.md`, 계약 문서, upstream 추적 문서 사이에 지원 범위와 용어의 모순이 없다.

## 구현 단계 검증 명령

```bash
bash plugins/codexclaw/skills/dev-diagram-viewer/upstream/sync-check.sh
bash -n plugins/codexclaw/skills/dev-diagram-viewer/upstream/sync-check.sh
git diff --check

rg -n "fragment|codex-inline-vis|CSS|utility|composition|layout|typography|color|chart|icon" \
  plugins/codexclaw/skills/dev-diagram-viewer/reference/visualize-contract.md

rg -n "version|hash|changelog|sync" \
  plugins/codexclaw/skills/dev-diagram-viewer/upstream/visualize-upstream.md

rg -n "codex-inline-vis|visualize-contract|browser render|browser-render|3D|audio|physics|jaw" \
  plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md

git diff --exit-code -- \
  plugins/codexclaw/skills/dev-diagram-viewer/reference/environment-detection.md \
  plugins/codexclaw/skills/dev-diagram-viewer/reference/html-templates.md \
  plugins/codexclaw/skills/dev-diagram-viewer/scripts/diagram-to-html.sh \
  plugins/codexclaw/skills/dev-diagram-viewer/agents/openai.yaml
```

drift 실패 경로는 upstream 원본의 임시 복사본을 입력으로 쓸 수 있게 만든 뒤, 내용 한 줄을 바꾼 복사본으로 비정상 종료와 진단 메시지를 확인한다. 실제 번들 원본은 검증 과정에서 수정하지 않는다.
