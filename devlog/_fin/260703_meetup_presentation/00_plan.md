---
created: 2026-07-03
tags: [meetup, presentation, pptx, plan]
aliases: [Codex Meetup Presentation Plan]
---

# 260703 Meetup Presentation — 15-Slide PPTX Generation for Codex Community Meetup

## Loop Specification (C2)
- **Loop Archetype**: Spec work → repair loop
- **Trigger**: User request to create a presentation deck for the Codex Community Meetup on July 13th
- **Goal**: Create a 15-slide presentation `/Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx` styled in a professional dark slate theme using `pptx` skill standards.
- **Non-Goals**: Creating keynotes or using Google Slides; publishing/deploying the deck.
- **Verifier**: `officecli validate` and `officecli view` issues check, plus visual QA via `python3 scripts/thumbnail.py` grid check.
- **Stop Condition**: 0 schema errors, 0 overflow issues, and successful visual inspection of all slides.
- **Memory Artifact**: `structured/episodes/live/2026-07-03.md`
- **Expected Terminal States**: `DONE`, `NEEDS_HUMAN`

---

## Part 1 — What is being built (plain terms)
We are creating a professional PowerPoint presentation deck of exactly 15 slides, titled **"나도 이거 써봐야겠다"** (I should use this too). It will be saved at `/Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx`. The presentation introduces the presenter (YEEE, non-developer, 4 months into AI) and explains how they built an autonomous agent system using **cli-jaw**, **codexclaw** (focusing on **opencodex** to run agents natively in Codex), **ima2-gen**, and **agbrowse** (emphasizing search). It is written in a technical "Architect Tone" to persuade developer audiences.

The presentation uses a dark slate theme with a modern sky-blue accent, using Trebuchet MS for titles and Calibri for body text.

---

## File Change Map

```mermaid
graph TD
    A[codexclaw Project Root] --> B[devlog/_plan/260703_meetup_presentation/00_plan.md]
    A --> C[devlog/_plan/260703_meetup_presentation/generate_deck.py]
    D[Developer Directory] --> E[/Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx]
    C -->|Generates| E
```

---

## Part 2 — Diff-level precision

### NEW Files

#### 1. `devlog/_plan/260703_meetup_presentation/generate_deck.py`
A Python script that programmatically constructs the presentation slide-by-slide using `python-pptx`.
It will set up:
- Presentation slide size: Widescreen 16:9 (`33.87cm x 19.05cm` or `13.33 in x 7.5 in`)
- Layout helper functions for cover slides, content columns, key metrics, and timelines.
- Exact styling variables:
  - Background (dark): `0B0F19` (Deep Slate Black)
  - Card Fill (dark-light): `1E293B` (Slate 800)
  - Text Primary: `F8FAFC`
  - Text Muted: `94A3B8`
  - Accent Color: `38BDF8` (Sky Blue)
  - Accent 2 (Highlight): `F59E0B` (Amber)
- Speaker notes on all content slides.

### Slide Outline

1. **Cover Slide**: "나도 이거 써봐야겠다: 비개발자가 시스템으로 풀어낸 AI 에이전트 워크플로우"
2. **Introduction**: "비개발자, 4개월 만에 시스템 설계자가 되다" (Journey from Feb 2026 to July 2026)
3. **The Core Problem**: "왜 내 에이전트는 조금만 복잡해지면 길을 잃을까?" (The AI Agent Plateau)
4. **The Paradigm Shift**: "채팅에서 시스템으로: 에이전트를 규정하는 '하네스'의 탄생" (The Envelope system)
5. **Introduction of Tools**: "cli-jaw & codexclaw: 개발자 환경에 완전히 밀착된 동반자"
6. **The Gateway (opencodex)**: "가장 중요한 진입점, opencodex" (Natively run in Codex without extra harnesses)
7. **The Power of Search**: "에이전트에게 눈을 달아주다: 검색의 중요성"
8. **agbrowse**: "agbrowse: 실시간 웹 정보와 DOM 탐색의 결합" (CDP browser automation)
9. **ima2-gen**: "ima2-gen: 텍스트를 넘어선 시각적 워크플로우 확장" (Inflow to image generation)
10. **The Workflow Engine**: "PABCD: 실패하지 않는 5단계 오케스트레이션" (I -> P -> A -> B -> C -> D)
11. **Practical Showcase**: "실제 적용 사례: 비개발자가 혼자서 대규모 기능을 배포하는 법" (Discord bot, PPTX, etc.)
12. **Why You Should Use This Too**: "이 좋은 걸 왜 아직도 안 쓰고 계십니까?" (Efficiency and precision)
13. **Getting Started in 3 Minutes**: "3분 만에 시작하는 에이전트 워크플로우" (Quick commands)
14. **Future Outlook**: "앞으로 다가올 미래: 다중 에이전트의 자율적 협업" (Boss + Frontend + Backend)
15. **Conclusion & CTA**: "지금 바로 여러분의 워크플로우에 🦈(Jaw)를 물려주세요" (Links and call to action)

---

## Verification Plan
1. Run `python3 devlog/_plan/260703_meetup_presentation/generate_deck.py` to create `/Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx`.
2. Run `officecli validate /Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx`.
3. Run `officecli view /Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx issues` to check for text overflows, overlapping shapes, or off-edge layouts.
4. Run `python3 scripts/thumbnail.py /Users/jun/Developer/codexmeetup/workflow_show_and_tell.pptx grid.png` to review the visual aesthetics.
