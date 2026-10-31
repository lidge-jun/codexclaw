# 005 — WCAG 2.2 Level A + AA criteria, axe mapping and local contradictions

Source: sol explorer `wcag` (gpt-6-sol, read-only), agent `01a17e1c-1c3e-7ca1-be01-c7ae21db650d`, 2026-10-28.
W3C sources: https://www.w3.org/TR/WCAG22/ , https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ ;
axe rules: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md .

Main check of the count: WCAG 2.1 had 30 A + 20 AA. 2.2 adds 2 A (3.2.6, 3.3.7) and 4 AA
(2.4.11, 2.5.7, 2.5.8, 3.3.8) and removes 4.1.1 Parsing (A): 31 A + 24 AA = 55. Note that
3.2.6 Consistent Help and 3.3.7 Redundant Entry are Level **A**, not AA; the goal objective
lists them among the "new in 2.2" set, which is still correct.

Open decision resolved by main: `prefers-reduced-motion` stays a codexclaw product rule
(DEFAULT) and is labelled as such; it is not presented as a WCAG AA requirement. WCAG 2.2.2
(A) covers auto-moving content; 2.3.3 (AAA) covers motion from interactions.

## Raw explorer report (Korean, verbatim)

**WCAG 2.2 A/AA는 총 55개입니다.** 아래 `새` 표시는 2.2에서 추가된 항목입니다. `axe` 열은 해당 성공 기준 태그가 붙은 규칙 ID이며, `수동` 뒤에는 관찰할 절차를 적었습니다. 규칙 통과만으로 기준 전체를 충족했다고 판정할 수는 없습니다. [WCAG 2.2 본문](https://www.w3.org/TR/WCAG22/), [2.2 변경점](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/), [axe 규칙·태그 표](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)

| 기준·등급 | 이름 | axe 규칙 또는 수동 절차 |
|---|---|---|
| 1.1.1 A | Non-text Content | `aria-meter-name`, `aria-progressbar-name`, `image-alt`, `input-image-alt`, `object-alt`, `role-img-alt`, `svg-img-alt` |
| 1.2.1 A | Audio-only and Video-only (Prerecorded) | `audio-caption`; 녹화 영상의 대체 자료도 수동 확인 |
| 1.2.2 A | Captions (Prerecorded) | `video-caption`; 자막의 실제 내용도 확인 |
| 1.2.3 A | Audio Description or Media Alternative (Prerecorded) | 수동: 영상의 시각 정보가 음성 설명 또는 텍스트 대체 자료에 있는지 확인 |
| 1.2.4 AA | Captions (Live) | 수동: 실시간 방송의 동기화된 자막을 시청 |
| 1.2.5 AA | Audio Description (Prerecorded) | 수동: 녹화 영상의 핵심 시각 정보에 음성 설명이 있는지 청취 |
| 1.3.1 A | Info and Relationships | `aria-hidden-body`, `aria-required-children`, `aria-required-parent`, `definition-list`, `dlitem`, `list`, `listitem`, `td-headers-attr`, `th-has-data-cells`, `p-as-heading`, `table-fake-caption`, `td-has-header` |
| 1.3.2 A | Meaningful Sequence | 수동: 화면 읽기 순서가 의미를 보존하는지 확인 |
| 1.3.3 A | Sensory Characteristics | 수동: 모양·위치·색·소리만으로 지시하는 안내가 없는지 확인 |
| 1.3.4 AA | Orientation | `css-orientation-lock` |
| 1.3.5 AA | Identify Input Purpose | `autocomplete-valid` |
| 1.4.1 A | Use of Color | `link-in-text-block`; 상태·의미 전달도 수동 확인 |
| 1.4.2 A | Audio Control | `no-autoplay-audio` |
| 1.4.3 AA | Contrast (Minimum) | `color-contrast` |
| 1.4.4 AA | Resize Text | `meta-viewport`; 200% 확대 시 손실도 확인 |
| 1.4.5 AA | Images of Text | 수동: 예외 외의 글자가 이미지로만 제공되는지 확인 |
| 1.4.10 AA | Reflow | 수동: 해당 320 CSS px 상당 화면에서 양방향 스크롤·손실 확인 |
| 1.4.11 AA | Non-text Contrast | 수동: 필요한 UI 경계·상태·그래픽을 인접 색과 3:1로 측정 |
| 1.4.12 AA | Text Spacing | `avoid-inline-spacing`; 지정된 간격을 적용해 잘림 확인 |
| 1.4.13 AA | Content on Hover or Focus | 수동: 팝업의 해제·호버 유지·가시성을 조작해 확인 |
| 2.1.1 A | Keyboard | `frame-focusable-content`, `scrollable-region-focusable`, `server-side-image-map`; 전체 작업도 키보드로 수행 |
| 2.1.2 A | No Keyboard Trap | 수동: 모든 위젯에 들어가고 키보드로 빠져나오기 |
| 2.1.4 A | Character Key Shortcuts | 수동: 단일 문자 단축키의 해제·재설정·포커스 제한 확인 |
| 2.2.1 A | Timing Adjustable | `meta-refresh`; 세션 제한 등도 수동 확인 |
| 2.2.2 A | Pause, Stop, Hide | `blink`, `marquee`; 실제 자동 갱신·이동 콘텐츠도 확인 |
| 2.3.1 A | Three Flashes or Below Threshold | 수동: 점멸 콘텐츠의 횟수·임계값 확인 |
| 2.4.1 A | Bypass Blocks | `bypass` |
| 2.4.2 A | Page Titled | `document-title` |
| 2.4.3 A | Focus Order | 수동: Tab 이동이 의미와 조작 순서를 보존하는지 확인 |
| 2.4.4 A | Link Purpose (In Context) | `area-alt`, `link-name`; 링크 맥락도 확인 |
| 2.4.5 AA | Multiple Ways | 수동: 페이지를 찾는 서로 다른 경로 확인 |
| 2.4.6 AA | Headings and Labels | 수동: 제목·레이블이 주제와 목적을 설명하는지 확인 |
| 2.4.7 AA | Focus Visible | 수동: 키보드로 모든 초점 표시 확인 |
| 2.4.11 AA **새** | Focus Not Obscured (Minimum) | 수동: 초점 요소가 고정 헤더·패널 등에 완전히 가려지지 않는지 확인 |
| 2.5.1 A | Pointer Gestures | 수동: 복합 제스처마다 단일 포인터 대안 확인 |
| 2.5.2 A | Pointer Cancellation | 수동: 누르기·놓기·취소 동작 확인 |
| 2.5.3 A | Label in Name | `label-content-name-mismatch` |
| 2.5.4 A | Motion Actuation | 수동: 기기 움직임 기능의 UI 대안·비활성화 확인 |
| 2.5.7 AA **새** | Dragging Movements | 수동: 드래그 작업을 드래그 없이 완료 |
| 2.5.8 AA **새** | Target Size (Minimum) | `target-size`; 예외·간격도 수동 확인 |
| 3.1.1 A | Language of Page | `html-has-lang`, `html-lang-valid`, `html-xml-lang-mismatch` |
| 3.1.2 AA | Language of Parts | `valid-lang`; 언어 변경 구간도 확인 |
| 3.2.1 A | On Focus | 수동: 초점만으로 예고 없는 맥락 변경이 일어나는지 확인 |
| 3.2.2 A | On Input | 수동: 입력 변경만으로 예고 없는 맥락 변경이 일어나는지 확인 |
| 3.2.3 AA | Consistent Navigation | 수동: 반복 탐색 요소의 순서 비교 |
| 3.2.4 AA | Consistent Identification | 수동: 같은 기능의 이름·표현 비교 |
| 3.2.6 A **새** | Consistent Help | 수동: 반복되는 도움 수단의 상대적 순서 비교 |
| 3.3.1 A | Error Identification | 수동: 오류 항목과 설명이 문자로 제시되는지 확인 |
| 3.3.2 A | Labels or Instructions | `form-field-multiple-labels`; 필요한 입력 안내도 확인 |
| 3.3.3 AA | Error Suggestion | 수동: 알려진 수정법이 오류와 함께 제시되는지 확인 |
| 3.3.4 AA | Error Prevention (Legal, Financial, Data) | 수동: 제출의 취소·검토·확인 수단 확인 |
| 3.3.7 A **새** | Redundant Entry | 수동: 같은 절차에서 재입력 요구와 예외 확인 |
| 3.3.8 AA **새** | Accessible Authentication (Minimum) | 수동: 인지 기능 시험 없이 로그인·복구 가능한지 확인 |
| 4.1.2 A | Name, Role, Value | 아래 29개 규칙 |
| 4.1.3 AA | Status Messages | 수동: 초점 이동 없이 상태 메시지가 보조기기에 전달되는지 확인 |

**4.1.2의 29개 규칙:** `area-alt`, `aria-allowed-attr`, `aria-braille-equivalent`, `aria-command-name`, `aria-conditional-attr`, `aria-deprecated-role`, `aria-hidden-body`, `aria-hidden-focus`, `aria-input-field-name`, `aria-prohibited-attr`, `aria-required-attr`, `aria-roles`, `aria-tab-name`, `aria-toggle-field-name`, `aria-tooltip-name`, `aria-valid-attr-value`, `aria-valid-attr`, `button-name`, `duplicate-id-aria`, `frame-title-unique`, `frame-title`, `input-button-name`, `input-image-alt`, `label`, `link-name`, `nested-interactive`, `select-name`, `summary-name`, `aria-roledescription`. **4.1.1 Parsing은 obsolete/removed이므로 55개에 포함하지 않습니다.** [W3C 4.1.1](https://www.w3.org/TR/WCAG22/#parsing)

공식 CLI의 `--tags`는 쉼표로 구분한 태그 목록을 받고, `--exit`는 위반 시 종료 코드 1을 반환합니다. 로컬 파일에는 절대 `file://` URL을 전달할 수 있습니다. 현재 규칙 표의 관련 태그는 `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa`입니다. [CLI README](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/cli/README.md), [CLI 인자 정의](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/cli/src/bin/cli.ts), [URL 처리](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/cli/src/lib/utils.ts)

```sh
npx @axe-core/cli "file:///absolute/path/page.html" --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa --exit
```

로컬 `rg`에서 확인한 **판정에 영향을 주는 문구**는 다음과 같습니다. 나머지 초점·모션 언급은 제품 검사 지침 또는 일반 서술이며, 그 자체로 WCAG 등급을 잘못 명시하지 않았습니다.

| 위치 | 판정과 수정 |
|---|---|
| [favicon-logo.md](plugins/codexclaw/skills/dev-uiux-design/references/favicon-logo.md:319) | **오류:** `prefers-reduced-motion`을 WCAG 2.1 AA 의무라고 표기. 모션 애니메이션 관련 [2.3.3은 AAA](https://www.w3.org/TR/WCAG22/#animation-from-interactions)입니다. 제품 정책상 필수라고 분리하고, A의 자동 이동 콘텐츠 정지 요건은 2.2.2로 설명하세요. |
| [favicon-logo.md](plugins/codexclaw/skills/dev-uiux-design/references/favicon-logo.md:152), [platform-runtime.md](plugins/codexclaw/skills/dev-frontend/references/core/platform-runtime.md:22), [korea-2026.md](plugins/codexclaw/skills/dev-frontend/references/core/korea-2026.md:37) | **대체로 정확:** 44×44 CSS px는 AAA 2.5.5 또는 더 엄격한 제품 기준입니다. AA [2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum)의 24×24 크기·간격·예외를 명시하면 혼동이 줄어듭니다. |
| [a11y-patterns.md](plugins/codexclaw/skills/dev-frontend/references/core/a11y-patterns.md:131) | **오류:** “axe-core or Lighthouse … score ≥90”은 적합성 판정이 아닙니다. 자동 검사 결과와 55개 기준의 수동 검사를 별도 게이트로 두세요. |
| [color-system.md](plugins/codexclaw/skills/dev-uiux-design/references/color-system.md:88) | **수정 필요:** `bold ≥18.5px`은 부정확한 경계입니다. W3C의 큰 글자 정의인 18pt(약 24 CSS px), 굵은 글자 14pt(약 18.67 CSS px)로 표기하세요. [1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) |
| [visual-verification.md](plugins/codexclaw/skills/dev-frontend/references/core/visual-verification.md:57) | **조건 누락:** 입력 테두리 3:1은 상태를 식별하는 데 필요한 시각 정보일 때 적용됩니다. 비활성·비필수 경계 등 [1.4.11 예외](https://www.w3.org/TR/WCAG22/#non-text-contrast)를 반영하세요. |
| [platform-runtime.md](plugins/codexclaw/skills/dev-frontend/references/core/platform-runtime.md:13), [anti-slop.md](plugins/codexclaw/skills/dev-frontend/references/core/anti-slop.md:257) | **수정 필요:** `ring-2`나 기본 브라우저 링의 교체만으로 적합성을 판정할 수 없습니다. 실제 표시·가림 여부를 검사하고 접근 가능한 기본 링은 유지 가능하게 하세요. [2.4.7](https://www.w3.org/TR/WCAG22/#focus-visible), [2.4.11](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum) |
| [platform-runtime.md](plugins/codexclaw/skills/dev-frontend/references/core/platform-runtime.md:12), [ux-preflight.md](plugins/codexclaw/skills/dev-uiux-design/references/ux-preflight.md:70), [a11y-patterns.md](plugins/codexclaw/skills/dev-frontend/references/core/a11y-patterns.md:138) | **수치 정확, 범위 축소:** 4.5:1·큰 글자 3:1은 1.4.3, 필요한 UI·그래픽 3:1은 1.4.11입니다. “WCAG AA minimum”이 색 대비 외의 적합성까지 뜻하지 않도록 쓰세요. |

**미해결 판단:** `prefers-reduced-motion`을 WCAG의 직접 의무와 별개인 프로젝트 필수 정책으로 유지할지, 일반 권장으로 낮출지는 부모 작업에서 결정해야 합니다. 이 조사에서는 파일을 수정하거나 CLI 검사를 실행하지 않았습니다.

