# 009. Codex 음성 기능 상태 요약

## 조사 범위와 증거 수준

1. 이 문서는 2026-07-13 기준 Codex 음성 아키텍처의 상태를 요약한다.
2. 외부 모델 관련 내용은 Tier 1 웹 검색의 snippet 기반 발견이다.
3. 따라서 GPT-Live-1 및 GPT-Realtime-2의 Codex 통합 여부는 Tier 2 원문 검증 전제의 확정 기록이 아니다.
4. 공개 검색에서 확인한 내용과 저장소 코드 상태를 구분해 읽어야 한다.
5. 특히 “모델이 존재한다”와 “Codex가 해당 모델을 연결한다”는 서로 다른 주장이다.
6. 현재 공개 자료에는 Codex 음성 모델 통합의 로드맵이나 일정이 없다.

## 모델 상태

7. GPT-Live-1에 관해서는 OpenAI Help Center의 2026-07-12 업데이트 snippet이 발견되었다.
8. 해당 snippet은 GPT-Live-1이 처음에는 Codex 또는 ChatGPT 데스크톱 앱에서 제공되지 않는다고 명시한다.
9. 이 표현은 초기 제공 범위에 대한 설명이지 향후 통합 일정을 약속하는 문장이 아니다.
10. 그러므로 Codex 지원 예정일을 역산하거나 추정해서는 안 된다.
11. GPT-Realtime-2는 2026-05-07에 GPT-5급 음성 모델로 발표된 것으로 조사되었다.
12. 발표 snippet에는 Codex 통합이 언급되지 않았다.
13. 모델 발표만으로 Codex CLI, Desktop App, Mobile의 사용 가능성을 결론 내릴 수 없다.
14. 두 모델 모두 “공개 모델 상태”와 “Codex 제품 통합 상태”를 분리해 추적해야 한다.
15. 현재 조사 결과에는 Codex 음성 모델 통합의 공개 로드맵이 없다.
16. 구체적 타임라인 또한 확인되지 않았다.

## 저장소 코드 검색

17. 현재 코드베이스에서 `voice`, `audio`, `speech`, `tts`, `microphone`, `realtime` 키워드의 GitHub 코드 검색 결과는 0건이다.
18. 이 0건은 음성 관련 기능이 역사적으로 없었다는 뜻이 아니다.
19. 음성 관련 CLI 코드가 [#27801](https://github.com/openai/codex/pull/27801)에서 정리되었기 때문이다.
20. 따라서 현재 소스 검색은 “남아 있는 CLI 음성 구현”을 찾는 데 유효하다.
21. 반대로 과거 PR과 app-server의 진화 과정은 GitHub PR 기록에서 확인해야 한다.
22. 검색어가 0건이라는 결과를 Desktop/App-server 전체의 음성 인프라 부재로 확대 해석하면 안 된다.

## 표면별 현재 상태

23. Codex CLI TUI의 음성 지원은 명시적으로 제거된 상태다.
24. [#27801](https://github.com/openai/codex/pull/27801)은 `/realtime` 명령을 삭제했다.
25. 같은 정리에서 CLI 음성 캡처와 재생 경로도 제거되었다.
26. WebRTC 통합과 오디오 장치 선택 코드도 CLI 표면에서 빠졌다.
27. `cpal` 및 `codex-realtime-webrtc` 의존성도 제거 대상에 포함되었다.
28. 따라서 CLI에 음성 명령이 남아 있을 것이라는 가정은 현재 코드와 맞지 않는다.
29. CLI의 텍스트 턴과 MCP 오디오 파일 입력은 [#22679](https://github.com/openai/codex/pull/22679)의 별도 경로로 이해해야 한다.

30. Codex Desktop App의 app-server는 반대 방향으로 realtime 음성 배관이 계속 진화하고 있다.
31. WebRTC에서 AVAS로 이어지는 잠금 및 아키텍처 방향이 정리되어 왔다.
32. handoff 제어는 음성 모델과 Codex 오케스트레이터의 경계를 다룬다.
33. durable session 구조는 Thread 전환과 재연결 수명을 안정화하는 데 사용된다.
34. 지연 시간 최적화 PR들이 연결 설정과 오디오 전환 비용을 줄이는 방향으로 병합되었다.
35. 이 흐름은 Desktop/App-server에 실시간 음성 plumbing이 존재한다는 근거다.
36. 다만 plumbing의 존재가 GPT-Live-1 또는 GPT-Realtime-2의 공식 연결을 뜻하지는 않는다.

37. ChatGPT Mobile에서는 원격 Codex 접근이 2026-05-14에 언급되었다.
38. 조사된 자료에는 음성 handoff 가능성을 시사하는 표면이 있지만, Codex 음성 제어의 완전한 제품 계약은 확인되지 않았다.
39. 원격 접근과 음성 모델 직접 통합을 동일시하면 안 된다.
40. Mobile은 Desktop/App-server 세션을 조작하거나 넘겨받는 경로와 모델 제공 경로를 분리해서 봐야 한다.

## 주요 PR 타임라인

41. 초기 realtime 기반과 세션 경계는 [#12268](https://github.com/openai/codex/pull/12268)에서 추적한다.
42. 관련 음성 구조의 확장은 [#16396](https://github.com/openai/codex/pull/16396)에서 이어진다.
43. 세부 realtime 변경은 [#16805](https://github.com/openai/codex/pull/16805), [#16806](https://github.com/openai/codex/pull/16806), [#16807](https://github.com/openai/codex/pull/16807)에서 확인한다.
44. [#17058](https://github.com/openai/codex/pull/17058)은 해당 계열의 후속 변경을 구성한다.
45. 세션 및 오디오 파이프라인 진화는 [#18597](https://github.com/openai/codex/pull/18597)과 연결된다.
46. 파일 기반 MCP 오디오 입력은 [#22679](https://github.com/openai/codex/pull/22679)로 분리해서 기록한다.
47. Desktop/App-server realtime 제어는 [#27114](https://github.com/openai/codex/pull/27114), [#27116](https://github.com/openai/codex/pull/27116), [#27127](https://github.com/openai/codex/pull/27127)에서 추적한다.
48. 추가 handoff 및 세션 변경은 [#27173](https://github.com/openai/codex/pull/27173), [#27720](https://github.com/openai/codex/pull/27720)과 함께 봐야 한다.
49. CLI 음성 제거의 기준점은 [#27801](https://github.com/openai/codex/pull/27801)이다.
50. 이후 realtime 안정화는 [#27917](https://github.com/openai/codex/pull/27917), [#27986](https://github.com/openai/codex/pull/27986)에서 이어진다.
51. AVAS와 세션 아키텍처의 최신 계열은 [#28826](https://github.com/openai/codex/pull/28826), [#28836](https://github.com/openai/codex/pull/28836), [#28856](https://github.com/openai/codex/pull/28856)으로 연결된다.
52. 최신 최적화 및 보완 PR은 [#29554](https://github.com/openai/codex/pull/29554)까지 조사 대상에 포함한다.

## 아키텍처 판정

53. `codex-core`와 `app-server`에는 성숙한 realtime 음성 인프라가 존재한다.
54. 그 인프라는 WebRTC/AVAS 잠금, handoff, durable session, 지연 시간 개선을 중심으로 계속 다듬어지고 있다.
55. 이 인프라의 주된 제품 표면은 Desktop 및 Mobile 원격 접근 쪽이다.
56. Codex CLI는 [#27801](https://github.com/openai/codex/pull/27801) 이후 음성 표면이 아니다.
57. 따라서 “Codex는 음성을 지원한다”는 한 문장 요약은 표면을 생략해 부정확하다.
58. 더 정확한 요약은 “Desktop/Mobile을 위한 realtime plumbing은 진화 중이며 CLI 음성은 제거됨”이다.
59. MCP 오디오 파일 입력은 실시간 음성 지원과 별개의 텍스트 턴 기능이다.
60. GPT-Live-1과 GPT-Realtime-2의 Codex 연결은 공개적으로 계획되었다고 말할 근거가 없다.
61. 공개 로드맵이나 일정이 나타나기 전까지는 통합 상태를 미정으로 유지해야 한다.

## 후속 검증 항목

62. 모델 지원 여부는 최신 공식 Help Center 원문에서 Tier 2 방식으로 재확인해야 한다.
63. GPT-Realtime-2 발표문에 Codex 관련 문장이 실제로 있는지도 원문 기준으로 확인해야 한다.
64. app-server의 최신 프로토콜에서 realtime 명령과 세션 이벤트를 다시 대조해야 한다.
65. CLI 빌드 의존성에서 WebRTC 및 오디오 장치 라이브러리 제거가 유지되는지 확인해야 한다.
66. Mobile 원격 Codex 문서에서 “음성 handoff”의 실제 제품 계약을 분리해 확인해야 한다.
67. 새 PR이 모델 통합을 추가하지 않는 한, 인프라 개선을 모델 출시 일정으로 해석하지 않는다.
68. 후속 연구는 PR 본문, diff, 공식 제품 문서를 각각 독립된 증거로 기록해야 한다.

## 최종 결론

69. 현재 Codex의 음성 상태는 표면별로 비대칭이다.
70. CLI TUI에는 사용자 음성 캡처·재생·WebRTC 기반 realtime 기능이 없다.
71. Desktop/App-server에는 realtime voice plumbing이 있고, 품질과 세션 동작이 계속 개선된다.
72. Mobile은 원격 Codex 접근과 handoff 가능성이 있으나, 음성 모델 통합 계약은 별도 문제다.
73. GPT-Live-1은 초기 Codex 및 ChatGPT Desktop 미지원으로 조사되었다.
74. GPT-Realtime-2는 GPT-5급 음성 모델로 발표되었지만 Codex 연동은 언급되지 않았다.
75. 따라서 현재 가장 안전한 결론은 “배관은 존재하고 다듬어지고 있으나, CLI에는 없고 새 음성 모델의 Codex 통합 계획은 공개되지 않았다”이다.
