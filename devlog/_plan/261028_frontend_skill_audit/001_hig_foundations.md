# 001 — HIG Foundations and Getting Started: platform-neutral principles

Source: sol explorer `hig1` (gpt-6-sol, read-only), 2026-10-28. It read all 18 Foundations
pages and the 9 Getting Started pages through the JSON data endpoint
`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`
(every page HTTP 200). Apple-specific visual idioms (Liquid Glass, materials, SF Symbols
specifics, app icon grids, platform chrome) were excluded by the packet.

This is research input (LEXICO-SPLIT-01). The shipped reference restates these as audit
questions in English; P-ids below are the ids the reference keeps.

## Raw explorer report (Korean, verbatim)

Foundations 18개와 Getting Started 하위 문서 9개를 모두 읽고, **렌더링된 웹 UI에서 확인할 수 있는 범용 원칙**만 추렸어요. 아래 항목은 Apple의 플랫폼별 시각 양식을 요구하지 않아요. 🌸

1. **P01 — 핵심 과업 우선:** 사용자가 가장 자주 이루려는 목표를 화면의 중심에 두세요. **확인:** 첫 화면에서 주요 과업과 시작 동작을 바로 찾을 수 있는지 확인해요. [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)

2. **P02 — 사용자 통제:** 탐색과 작업 흐름에서 건너뛰기, 취소, 되돌리기 또는 복구 경로를 제공하세요. **확인:** 안내 흐름을 벗어나고 실수한 작업에서 돌아올 수 있는지 직접 조작해 봐요. [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)

3. **P03 — 일관성과 피드백:** 같은 모양의 요소는 같은 방식으로 작동하고, 조작 결과는 분명히 보여야 해요. **확인:** 화면마다 같은 컨트롤의 동작을 비교하고 저장·선택·실패 직후 상태 변화를 살펴봐요. [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)

4. **P04 — 명확한 계층:** 중요도와 관계를 읽기 순서, 정렬, 간격, 그룹으로 드러내세요. **확인:** 제목·본문·주요 동작의 순서를 훑어보고, 관련 항목이 시각적으로 묶이는지 확인해요. [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)

5. **P05 — 필요한 만큼만 노출:** 처음에는 핵심 선택지를 보여주고 부가 기능은 찾을 수 있는 위치에 단계적으로 드러내세요. **확인:** 첫 화면이 과밀하지 않으면서 숨긴 기능의 진입점이 보이는지 확인해요. [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)

6. **P06 — 크기 변화에 적응:** 화면 폭과 텍스트 크기가 달라져도 내용과 기능을 유지하세요. **확인:** 좁은 뷰포트와 큰 글꼴에서 겹침·잘림·사라진 동작이 없는지 확인해요. [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)

7. **P07 — 읽기 쉬운 글자:** 서체와 굵기·크기로 계층을 만들되 본문 가독성을 우선하세요. **확인:** 작은 보조 문구까지 읽을 수 있고 서체 혼용이 계층을 흐리지 않는지 살펴봐요. [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)

8. **P08 — 확대 가능한 내용:** 사용자가 글자를 키워도 중요한 정보에 접근할 수 있어야 해요. **확인:** 브라우저 텍스트 확대·줌에서 문구가 잘리지 않고 필요한 경우 세로로 재배치되는지 확인해요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)

9. **P09 — 충분한 대비:** 글자와 아이콘을 배경에서 분명히 구별할 수 있게 하세요. **확인:** 실제 화면의 전경·배경 대비를 측정하고 밝은 모드와 어두운 모드를 각각 확인해요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

10. **P10 — 색 이외의 단서:** 상태·의미·조작 가능성을 색만으로 전달하지 마세요. **확인:** 색을 구별하기 어려운 조건에서도 레이블, 형태 또는 아이콘으로 오류·선택 상태를 식별할 수 있는지 봐요. [Color](https://developer.apple.com/design/human-interface-guidelines/color)

11. **P11 — 여러 입력 방식:** 핵심 과업을 한 가지 제스처에만 묶지 마세요. **확인:** 마우스나 터치 없이 키보드로 주요 흐름을 끝낼 수 있고, 스와이프 전용 동작에는 보이는 대안이 있는지 확인해요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

12. **P12 — 누르기 쉬운 컨트롤:** 대상의 크기와 간격을 충분히 확보하세요. **확인:** 작은 화면에서 인접 버튼을 의도대로 선택할 수 있는지, 오조작을 부르는 밀집 구간이 없는지 살펴봐요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

13. **P13 — 대체 가능한 정보:** 중요한 정보를 시각이나 소리 한 방식에만 맡기지 마세요. **확인:** 의미 있는 이미지·아이콘의 대체 설명, 영상 자막·텍스트, 소리 알림의 시각적 표시를 확인해요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Icons](https://developer.apple.com/design/human-interface-guidelines/icons)

14. **P14 — 움직임의 목적:** 애니메이션은 변화 이해나 피드백에 기여해야 하며 반복 작업을 늦추지 않아야 해요. **확인:** 자주 누르는 컨트롤에 불필요한 대기 애니메이션이 있는지, 진행 중에도 다음 조작이나 취소가 가능한지 봐요. [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

15. **P15 — 움직임 줄이기:** 움직임에 의존하는 정보에는 정적인 단서를 제공하고 움직임 감소 선호를 존중하세요. **확인:** `prefers-reduced-motion` 조건에서 자동·반복·큰 이동 효과가 줄어들어도 상태를 이해할 수 있는지 확인해요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

16. **P16 — 시간 압박 줄이기:** 읽거나 반응할 시간이 더 필요한 사람을 고려하세요. **확인:** 중요한 메시지가 너무 빨리 자동으로 사라지지 않고, 사용자가 닫거나 다시 확인할 수 있는지 봐요. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

17. **P17 — 쉬운 행동 문구:** 평이한 말과 구체적인 동사로 다음 행동을 설명하세요. **확인:** 버튼·링크만 읽어도 결과를 예측할 수 있고 전문 용어나 문화권 한정 표현이 설명 없이 쓰이지 않는지 확인해요. [Writing](https://developer.apple.com/design/human-interface-guidelines/writing), [Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion)

18. **P18 — 상태별 다음 단계:** 빈 화면과 오류 화면에서 상황과 회복 방법을 알려주세요. **확인:** 빈 상태에는 시작 동작이, 오류에는 문제 가까이에 수정·재시도 방법이 나타나는지 봐요. [Writing](https://developer.apple.com/design/human-interface-guidelines/writing)

19. **P19 — 포용적인 표현:** 대상 사용자의 다양한 능력·언어·문화·상황을 고려해 말과 이미지를 고르세요. **확인:** 고정관념이나 배제하는 표현이 없는지, 처음 쓰는 사람도 필요한 지식을 화면에서 얻을 수 있는지 검토해요. [Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion)

20. **P20 — 필요한 순간의 권한 요청:** 기능에 실제로 필요한 데이터만, 사용자가 그 기능을 시작할 때 요청하고 용도를 설명하세요. **확인:** 첫 진입 때 무관한 권한 요청이 뜨지 않는지, 요청 문구가 데이터와 사용 목적을 구체적으로 밝히는지 살펴봐요. [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)

21. **P21 — 언어 방향과 지역화:** RTL 언어에서는 읽기·탐색 방향을 맞추되 숫자, 사진, 로고의 의미를 보존하세요. **확인:** RTL 화면에서 이전/다음 흐름과 정렬을 확인하고 숫자 자릿수·사진·로고가 무작정 반전되지 않았는지 봐요. [Right to left](https://developer.apple.com/design/human-interface-guidelines/right-to-left)

22. **P22 — 표시 환경 선호:** 밝은·어두운 표시 환경에서 내용의 의미와 가독성을 유지하세요. **확인:** 모드를 전환한 채 이미지를 포함한 각 화면을 열어 대비, 경계, 텍스트가 유지되는지 확인해요. [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

**가져오지 못한 페이지:** 없어요. 다만 이 목록은 HIG에서 추린 제품 디자인 원칙이에요. **WCAG 2.2 AA 적합 판정**에는 해당 성공 기준을 별도로 대조해야 해요.

