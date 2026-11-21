# Agent action UX — when the software acts for the person

Read when an agent, automation or AI feature takes actions on the person's behalf: runs
tasks on machines, edits files, sends messages, pays, books, merges, or waits for a login
or one-time code. [Conversational AI](conversational-ai.md) covers chat turns; this file
covers what happens around an action. Sources (2026-10/11): Browser London "UX patterns
for 2027", Neon Apps "prompt-driven UI", Design Bootcamp "10 UI/UX trends for 2027"
(Apple Snippets confirmation guidance), Dribbble/Unfold "design in the age of agents";
Apple HIG alerts and feedback pages (devlog 006).

## The contract (UX-AGENT-ACTION-01, DEFAULT)

An agent surface shows **intent → plan → action → result**, and the person can see, stop,
approve and undo at each step. Every pattern below is required unless the action is
read-only.

| Pattern | What the screen does | Korean copy sample |
|---|---|---|
| **Intent preview** | Restate the parsed goal as editable fields before acting (target, scope, machine, deadline). One field can be fixed without retyping the request. | "PR #7634 리뷰 · build-server-1 · 오늘 18:00까지" |
| **Plan checklist** | Steps listed before execution and ticked live; the current step is marked by weight and a glyph, not by hue. | "1 저장소 동기화 · 2 테스트 실행 · 3 리뷰 작성" |
| **Review and approve** | Show the exact change: diff, recipients, amount, file list. Buttons: approve all, edit, skip one. | "변경 3개 파일 · 42줄 추가 · 7줄 삭제" |
| **Scoped confirmation** | Only for irreversible or external actions (pay, delete, send, merge, publish). The primary button names the verb and the object; it is a neutral ink button (FE-COLOR-RESTRAINT-01). The danger hue appears only when loss is unexpected or not the person's explicit choice. Always a safe exit. Keep it short (Apple keeps confirmation snippets compact). | "메일 3통 보내기" / "취소" |
| **Activity log** | A dated, filterable record of what the agent did, on which machine, with what result and who approved. Each row links to its evidence (diff, screenshot, receipt). | "21:32 · build-server-1 · 테스트 74/81 통과 · 승인: 김병준" |
| **Pause and stop** | A visible pause for running work; stop says what will be kept. | "일시 정지" / "중지 (완료된 2단계는 유지)" |
| **Undo after the fact** | Prefer undo over up-front confirmation for reversible actions; offer it for a stated window in the toast and in the log. | "보관함으로 옮겼습니다 · 실행 취소" |
| **Blocked: needs the person** | Logins, OTPs, CAPTCHAs, payment cards and judgment calls stop the run and go to the person's phone or the board with the exact ask. The run resumes after approval; nothing is retried silently. | "GitHub 로그인이 필요합니다 · 휴대폰에서 승인" |
| **Confidence** | Say when the agent is guessing and what it would need to be sure; no raw percentages. | "확실하지 않음: 배포 브랜치가 두 개입니다. 어느 쪽인가요?" |
| **Seeded empty state** | A blank prompt is replaced by 3 to 5 concrete example intents from the real product. | "어젯밤 실패한 테스트 다시 돌리기" |
| **Result** | Outcome first, then what changed and where the evidence is; failures name the next step. | "완료 · PR #7634에 리뷰 12개 · 로그 보기" |

## Rules

- Autonomy is per action class, set by the person: read-only runs freely; reversible
  actions run with undo; irreversible and external actions always stop for approval.
- Status is shown in form and text, never color alone; running, waiting for you, done and
  failed each have a glyph and a label.
- Never claim completion the log cannot back; a step without evidence reads "확인 안 됨".
- Approval requests carry enough context to decide on a phone screen: what, where, why
  now, what happens if ignored.
- Do not interrupt for information an activity log can hold (HIG: alerts are for critical,
  actionable information).

## Checklist

- [ ] Intent preview editable before the first action
- [ ] Plan visible, current step marked without hue
- [ ] Exact diff or payload shown before approval
- [ ] Irreversible actions: named-verb neutral button + safe exit
- [ ] Pause, stop and undo reachable while running and after
- [ ] Blocked states routed to the person with the exact ask
- [ ] Every log row has time, machine, result, approver, evidence
