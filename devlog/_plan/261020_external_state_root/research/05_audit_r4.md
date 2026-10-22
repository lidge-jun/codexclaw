# research/05 — plan audit round 4 (gpt-6.1-sol, high)

VERDICT: FAIL

차단 사항:

- `devlog/_plan/261020_external_state_root/006_audit_r3.md:10` — **내용 비교 후 rename/unlink는 원자적 조건부 갱신이 아니에요.** 비교 통과 → writer가 새 goalplan 저장 → sync가 교체/삭제하면 writer의 변경이 사라져요. 실제 writer는 `goalplan.ts:932–933`에서 atomic rename으로 게시해요. `.cxc-sync.lock`은 writer가 따르지 않으므로 보호하지 못해요. 비교부터 교체까지 writer와 공유하는 잠금이 필요해요. `:13`의 “no data is overwritten”도 성립하지 않아요.

잔여 사항:

- `006:14` 잠금 파일 ignore·tracked 거부, `006:15` no-origin 지원 범위 예외는 round-3 해당 차단을 해결해요.
- Git 2.53.0 로컬 매뉴얼 기준, detached linked worktree에서 merge → `reset --soft` → 재stage/commit → 일반 push는 타당해요. push 경합은 거부되며 force가 필요하지 않아요.
- `006:10`의 NUL 파서는 rename/copy의 두 경로를 처리하거나 `--no-renames`를 지정해야 해요. union은 행 순서를 보장하지 않아요.
- `006:18` 테스트에는 **비교 직후 writer 게시**를 강제로 끼우는 검증이 빠져 있어요.

읽기 전용 감사이며 파일 변경·테스트 실행은 하지 않았어요.
