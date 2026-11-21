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

