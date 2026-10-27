# 004 — Architect consultation record

Architect: sol subagent `Kant`, agent id `01a17e1c-1bae-7400-b95f-83ef964231d2` (gpt-6-sol, read-only),
2026-10-28. Proposal below verbatim; main dispositions follow.

## Proposal (verbatim)

**제안: 제품 디자인 감사는 두 소유자로 나누고, QA와 반복 실행은 기존 소유자에 연결합니다.** 아래는 수정 없이 작성한 설계안이에요. 🌸

| 결정 | 새 참조 파일과 책임 |
|---|---|
| **D1** | `dev-uiux-design/references/product-audit.md`: 대상 페르소나, 핵심 사용자 여정, 이상적인 완료 상태를 먼저 정의합니다. 현재 상태와 이상 상태의 차이를 **gap ledger**로 기록하고, 사용자 영향·근거·우선순위·해결 조건을 붙입니다. 기존 [Design Read](plugins/codexclaw/skills/dev-uiux-design/references/design-read.md:30)는 이미 대상 독자와 제약을 수집하므로 감사가 이를 확장합니다. |
| **D2** | `dev-uiux-design/references/platform-neutral-principles.md`: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)를 참고해 명료성, 정보 위계, 일관성, 피드백, 접근성 같은 **플랫폼 중립 판단 질문**으로 재서술합니다. 이는 원전에서 도출하는 제안이며 iOS 고유 시각 요소나 컴포넌트를 규칙으로 옮기지 않습니다. 취향 판단은 이미 디자인 소유자에게 있습니다([역할 경계](plugins/codexclaw/skills/dev-uiux-design/references/role-boundaries.md:5)). |
| **D3** | `dev-frontend/references/core/wcag22-aa-audit.md`: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) **AA 전체 적용 기준**의 판정표를 둡니다. 기준별 적용 여부, 시험 방법, 결과, 증거, 미검증 항목을 기록하고 미검증 항목으로 적합 판정을 내리지 않습니다. 기존 접근성 기준과 위젯 패턴을 재기술하지 말고 연결합니다([기준](plugins/codexclaw/skills/dev-frontend/references/core/platform-runtime.md:8), [패턴](plugins/codexclaw/skills/dev-frontend/references/core/a11y-patterns.md:1)). |
| **D4** | `dev-frontend/references/core/visual-audit.md`: 렌더된 **anti-slop violation ledger**에 규칙 ID, 화면·상태·뷰포트, 전후 스크린샷, 수정 내용과 재검증 결과를 요구합니다. 시각 QA의 전후 관문 및 PR의 `Before / After / Verification / Remaining gaps` 항목도 여기서 정의합니다. 기존 [anti-slop 규칙](plugins/codexclaw/skills/dev-frontend/references/core/anti-slop-enforcement.md:20)과 [뷰포트·상태 검사](plugins/codexclaw/skills/dev-frontend/references/core/visual-verification.md:5)를 재사용합니다. 전후 비교가 가능한 기준 화면이 없으면 그 사실을 기록합니다. |
| **D5** | **MODIFY 라우터·색인:** 두 `SKILL.md`의 Modular References에 각각 “제품 디자인 감사”와 “접근성 적합성/전후 시각 감사” 조건 행을 추가하고, 각 `references/topic-index.md`에도 동일한 진입 행을 넣습니다([디자인 라우터](plugins/codexclaw/skills/dev-uiux-design/SKILL.md:27), [프런트 라우터](plugins/codexclaw/skills/dev-frontend/SKILL.md:18), [디자인 색인](plugins/codexclaw/skills/dev-uiux-design/references/topic-index.md:1), [프런트 색인](plugins/codexclaw/skills/dev-frontend/references/core/topic-index.md:1)). 연결만 보강할 기존 파일은 `dev-uiux-design/references/design-read.md`, 두 역할의 `role-boundaries.md`, `dev-frontend/references/core/platform-runtime.md`, `anti-slop-enforcement.md`, `visual-verification.md`, `preflight-full.md`, `dev/references/skill-ownership.md`입니다. 본문 절차를 여러 곳에 복제하지 않습니다. |
| **D6** | **소유권 유지:** 디자인 판단과 gap ledger는 `dev-uiux-design`, 구현·WCAG 판정·렌더 위반과 전후 검증은 `dev-frontend`가 맡습니다([기존 소유권 표](plugins/codexclaw/skills/dev/references/skill-ownership.md:18)). 수동 QA의 증거와 receipt는 `cxc-qa`의 [계약](plugins/codexclaw/skills/qa/references/evidence-contract.md:1)을 사용합니다. 두 번 이상 감사·수정 주기가 필요한 실행은 `cxc-loop`의 [다중 주기 규칙](plugins/codexclaw/skills/loop/SKILL.md:44)으로 넘깁니다. 이 두 소유자의 규칙은 이번 변경에서 복제하거나 수정하지 않습니다. |

**배치 근거와 한도:** 조건부 절차는 L4 참조에 두고 L3에는 읽을 조건만 둡니다. 하나의 의무에는 하나의 원본과 고유한 규칙 ID를 사용합니다([배치·소유권 표준](structure/70_prompt_architecture.md:18)). 두 `SKILL.md`는 각각 **전체 10,240 UTF-8 바이트** 한도이며, 현재 3,987/3,807바이트입니다. L2 `description`은 320자, `short_description`은 100자 한도입니다. 새 참조는 **파일당 목표 16 KiB**, **24 KiB 초과 시 보고** 대상이며 후자는 차단 한도가 아닙니다([예산](structure/70_prompt_architecture.md:44), [검사 상수](plugins/codexclaw/scripts/check-prompt-architecture.mjs:26)). 링크와 규칙 ID의 단일 정의도 게이트가 검사합니다([검사 범위](structure/70_prompt_architecture.md:59)).

대안은 하나의 감사 파일에 전 과정을 담는 방식입니다. 찾기는 쉽지만 디자인 판단, 구현 판정, QA receipt의 소유권이 섞이고 참조 크기도 커집니다. **남은 판단**은 감사 대상이 웹 화면에 한정되는지, 기존 화면의 전후 캡처를 확보할 수 있는지입니다. 웹이 아닌 화면에는 WCAG 2.2 적합 판정을 그대로 적용하지 않도록 본 작업에서 범위를 확정해야 합니다.

## Main dispositions

| Decision | Disposition | Reason |
|---|---|---|
| D1 product-audit.md in dev-uiux-design | ACCEPT, renamed `experience-audit.md` | Persona, journey, ideal state and gap ledger are design judgment (role-boundaries.md:5). "Experience" separates it from the rendered audit in D4. |
| D2 platform-neutral-principles.md | ACCEPT as `universal-principles.md` | Holds the P-ids (001) and J-ids (002) as audit questions with HIG URLs; Apple visuals excluded. |
| D3 wcag22-aa-audit.md in dev-frontend | ACCEPT as `wcag22-aa.md` | One owner for the A/AA criterion table, axe tag command and manual procedures; other files link to it instead of restating levels. |
| D4 visual-audit.md in dev-frontend | ACCEPT as `visual-audit-loop.md` | Violation ledger, per-violation verifier and pass rule, before/after pairs, PR section, cxc-loop routing. Reuses visual-verification.md viewports and anti-slop rule ids. |
| D5 router/index MODIFY rows | AMEND | Router rows and topic-index rows: yes. `dev/references/skill-ownership.md` is outside scope (objective Scope OUT: other skills' rule content); ownership stays expressed in the two role-boundaries.md files. |
| D6 ownership kept | ACCEPT | cxc-qa receipts and cxc-loop rules are linked, never restated or edited. |
| Open: non-web surfaces | DECIDED | wcag22-aa.md applies to web content; native apps map through dev-frontend stacks/mobile-native.md and are named out of scope of the axe command. |
| Open: no "before" capture available | DECIDED | visual-audit-loop.md records "no baseline" with the reason; such a row cannot claim a before/after pair and needs a fresh after capture plus verifier only. |
| Explorer `fe` open question: one QA scenario per violation or per screen-state | DECIDED: per screen-state | evidence-contract.md is scenario-based; a scenario lists the violation ids it closes, so one capture can close several ids and the receipt stays per scenario. |

D5 omissions: `design-read.md` gets no edit because the SKILL.md router row and the
topic-index row already send audits to the experience audit, and Design Read stays the
direction owner the audit links to. `anti-slop-enforcement.md` does get a two-line pointer
(020 G2), because the frontend router sends "visual audits" to that file today.

## Reflection round 1 (same architect)

Verdict MISALIGNED with three gaps, all folded on 2026-10-28:

| Gap | Severity | Disposition |
|---|---|---|
| S1 closure differs: ux-preflight allows a wontfix decider, visual-audit-loop required every S1 verified | High | Unified: S1 closes verified, or wontfix decided by the user or product owner (never the agent) and listed as open; 010 F and 020 B section 5 and Status column changed |
| 030 writes structure/INDEX.md and docs-site but IN scope omitted them | Medium | 030 Scope IN lists both paths |
| D5 omissions for design-read.md and anti-slop-enforcement.md not recorded | Low | Recorded above; anti-slop-enforcement pointer added as 020 G2 |

## Reflection round 2 (same architect)

Verdict MISALIGNED with two gaps:

| Gap | Severity | Disposition |
|---|---|---|
| PR template fixed "Axe ... 0 violations" while closure allows listed remaining violations | Medium | Folded: the template now reports the actual count and rule ids and points conformance claims to FE-WCAG22-01 (020 B section 6) |
| G2 missing from the 020 file change map | Low | Rebutted: `020_phase2.md:24` already has the row "MODIFY references/core/anti-slop-enforcement.md, Audit pointer (diff G2)", written in the round 1 fold |

## Reflection round 3

Verdict **ALIGNED**, no remaining gaps (same architect, 2026-10-28).

