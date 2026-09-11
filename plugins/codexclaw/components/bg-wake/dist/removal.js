/**
 * removal.ts — the uninstall checklist, kept next to the thing it uninstalls.
 *
 * 000_plan "제거 체크리스트": the honest count is 8 touch points, not "delete the
 * directory". Printing it from the component means the list cannot drift out of the
 * repo silently, and wp3 proves it is complete by actually applying it.
 */
export const REMOVAL_STEPS           = [
  "1. plugins/codexclaw/components/bg-wake/ 디렉터리 삭제",
  "2. plugins/codexclaw/hooks/ 의 bg-wake 훅 파일 3개 삭제 (stop / user-prompt-submit / session-start)",
  "3. plugins/codexclaw/.codex-plugin/plugin.json 의 hooks[] 에서 그 3줄 제거",
  "4. plugins/codexclaw/scripts/build.mjs 의 OPTIONAL_COMPONENTS 에서 \"bg-wake\" 제거 (빈 배열이면 그 상수와 filter 도 함께 정리)",
  "5. package.json 의 test glob 에서 bg-wake 줄 제거",
  "6. 디스패처 정리: plugins/codexclaw/bin/cxc.mjs 의 COMMAND_TABLE bg 항목 + HELP 줄 + \"bg-wake\" slice(3) 분기, bin/codexclaw.mjs 의 case \"bg\" + runBgWake() + HELP 줄",
  "7. package-lock.json 에 @codexclaw/bg-wake 항목이 있으면 npm install 로 재생성 (workspaces glob 만 쓰는 현재 lock 에는 없어 대개 no-op)",
  "8. node plugins/codexclaw/scripts/inventory.mjs --write 재실행 (README.md / README.ko.md / README.zh.md 훅 뱃지를 손으로 고치지 말 것)",
  "9. plugins/codexclaw/test/hook-e2e.test.mjs 의 훅 개수 핀을 3 줄여서 되돌리기",
];

export function removalText()         {
  return [
    "bg-wake 제거 체크리스트 (9단계)",
    "",
    ...REMOVAL_STEPS,
    "",
    "확인: npm run build && npm test && npm run gate",
    "",
    "이 목록은 260909에 실제로 전부 적용해서 build/test/gate 통과를 확인했다.",
    "",
    "끄기만 하려면 제거할 필요 없습니다.",
    "  즉시(이 워크트리):   cxc bg off",
    "  새 세션부터(전역):   export CXC_BGWAKE=0",
  ].join("\n");
}

