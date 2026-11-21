# Korean UX Writing

Use this for Korean labels, headings, empty states, errors, notifications, onboarding, and button text.

## Principles

- Use familiar Korean words. Avoid technical terms and Chinese-derived bureaucratic phrases when simpler Korean works.
- Tell users what they can do next, especially in errors.
- Prefer the user's goal over the internal feature name.
- Minimize honorifics unless the product domain requires formality.
- Use Arabic numerals for counts and limits.
- Keep one purpose per sentence.
- Use active voice.
- Use exclamation marks sparingly.
- Do not add periods to buttons, labels, tabs, menu items, or large display headings.

## Good / Bad

| Avoid | Prefer |
| --- | --- |
| 요청 처리가 완료되었습니다. | 저장했어요 |
| 서버 에러가 발생했습니다. | 일시적으로 저장하지 못했어요. 잠시 후 다시 시도해주세요. |
| 다음 단계로 진행하시겠습니까? | 다음 단계로 갈까요? |
| 동네인증 가능한 위치가 아닙니다. | 이 위치에서는 동네인증을 할 수 없어요. |
| 회원님의 데이터가 정상적으로 조회되었습니다. | 정보를 불러왔어요. |

## Tone By Domain

| Domain | Tone |
| --- | --- |
| Fintech/payment | calm, exact, low-anxiety |
| Public/gov | plain, formal enough, action-oriented |
| B2B/ops | short, utilitarian, unambiguous |
| Education/kids | encouraging, clear, forgiving |
| Community/commerce | warm, familiar, concrete |
| AI tools | transparent, reversible, clear about limits |

Do not confuse visual warmth with childish copy. A UI can use soft 3D assets while keeping mature Korean copy.

## Error Messages

Every error should answer:

1. What happened?
2. Can the user fix it?
3. What should happen next?

Examples:

```text
일시적으로 결제할 수 없어요. 잠시 후 다시 시도해주세요.
파일이 너무 커요. 20MB 이하 파일을 올려주세요.
연결이 끊겼어요. 입력한 내용은 이 기기에 임시 저장했어요.
```

## Labels And Buttons

- Use verbs for actions: `저장`, `다시 시도`, `초대 보내기`.
- Avoid vague verbs: `처리`, `진행`, `수행`.
- Keep button text short, but do not clip long Korean text. Wrap or resize responsibly.
- Do not use all-caps English as a visual crutch in Korean UI.

## Product Microcopy

Plain and specific in task UI; marketing devices stay out ([copy registers](../copy/copy-registers.md), product register).

| Rule | Avoid | Prefer |
| --- | --- | --- |
| Buttons start with the action (verb or verb + object) | `확인`, `진행`, `OK` | `초대 보내기`, `파일 올리기` |
| Links name the destination | `여기를 클릭`, `자세히` | `요금제 비교 보기`, `설치 문서` |
| Settings describe the ON state | `알림 끄기` toggle | `새 댓글 알림` (켜면 받음) |
| Errors sit next to the field and say the fix | top banner `입력값 오류` | field: `이메일 주소에 @가 빠졌어요` |
| Undo beats confirmation for reversible actions | `정말 삭제하시겠습니까?` | delete, then toast `삭제했어요 · 되돌리기` |
| Confirm only irreversible or costly actions, and name the action | `확인` / `취소` | `3개 파일 영구 삭제` / `취소` |
| Empty states say why and point forward | `데이터가 없습니다` | `아직 연결한 기기가 없어요` + `기기 연결하기` |
| Placeholders show an example, never replace the label | label-less `입력하세요` | label `회사 이메일`, placeholder `name@company.com` |
| Success names what happened | `처리가 완료되었습니다` | `초대를 보냈어요` |
| One name per action across the flow | button `게시`, toast `업로드 완료` | button `게시`, toast `게시했어요` |

Inventory existing strings before rewriting so one vocabulary survives (same noun for the same thing on every screen).

