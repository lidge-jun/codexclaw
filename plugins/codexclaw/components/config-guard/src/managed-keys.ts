/**
 * managed-keys.ts — the closed list of non-feature config.toml keys codexclaw will edit.
 *
 * Two vocabularies stay separate on purpose:
 *   - DECLARED_FEATURES (features.ts) — booleans inside [features], written by the
 *     official `codex features enable` CLI.
 *   - CONFIG_MANAGED_KEYS (here) — scalars in other tables, written by toml-edit.ts
 *     because no persisted CLI setter exists for them.
 *
 * 260829 정정 — 불변식의 범위를 좁힌다. 초고는 근거를 "사용자가 소유한 부수효과 있는
 * 스위치를 절대 대신 켜지 않는다"로 적었는데, 그 서술은 실제 동작과 모순이다. `cxc enable`
 * 은 [features] boolean 네 개를 켜고, SessionStart self-heal 도 그중 소프트 플래그를 켠다.
 * 두 어휘를 가르는 기준은 TOML 테이블 이름이 아니라 이것이다 — codexclaw 없이도 의미가
 * 있는 스위치인가.
 *
 *   - DECLARED_FEATURES: codexclaw 가 동작하기 위해 필요하다고 선언한 플래그. 효과가
 *     codexclaw 안에서 끝나고, 되돌리기는 매니페스트가 보장한다. 설치가 켠다.
 *   - CONFIG_MANAGED_KEYS: 효과가 codexclaw 밖까지 미치는 스위치.
 *     `memories.dedicated_tools` 는 메모리 파이프라인 전체를 바꾸고, 그건 codexclaw 를
 *     지우더라도 사용자가 계속 안고 가는 결과다.
 *
 * features.ts 가 multi_agent_v2 를 비선언으로 남긴 것도 같은 기준이다 — codexclaw 는 V1
 * 로도 동작하므로 그건 "필요한 플래그"가 아니다.
 *
 * 260909 — `memories.dedicated_tools` 가 판별식을 통과한다. autoEnable 은 더 이상 리터럴
 * `false` 가 아니라 엔트리별 boolean 이다. 목록의 성격은 그대로다(효과가 밖으로 나가는
 * 스위치들), 다만 개별 엔트리가 스스로 근거를 대면 설치가 켤 수 있다.
 *
 * 근거. 260829 가 이 키를 막은 이유는 "지우더라도 남는 결과"였고, 남는 결과의 실체는 딱
 * 하나 — 모델이 제멋대로 부른 `memories.add_ad_hoc_note` 가 만든 노트 파일이다. 그 파일은
 * `~/.codex/memories/extensions/ad_hoc/notes/` 에 남아 이후 모든 세션의 메모리 요약에
 * 들어간다. 그래서 아래 caution 이 "명시 요청 없는 쓰기를 막는 장치를 먼저 확인하라"를
 * 전제조건으로 못박았다. wp1-A 가 그 장치를 만들었다 —
 * pabcd-state/src/memory-write-gate.ts 의 PreToolUse 게이트는 사용자가 그 턴에 실제로
 * 요청했다는 근거(remember 관용구, 또는 `cxc memory allow-write`)가 없으면 메모리 쓰기를
 * 거부하고, 도구 호출과 memories 경로를 향한 일반 파일 쓰기 양쪽을 모두 덮는다. 전제조건이
 * 충족됐으므로 caution 이 요구하던 확인이 끝났고, 남는 것은 읽기 도구 세 개와 게이트가
 * 지키는 쓰기 도구 하나다.
 *
 * 반론과 답. codexclaw 를 지우면 게이트는 사라지는데 키는 config.toml 에 남을 수 있다 —
 * 즉 "게이트 있으니 켜도 된다"가 게이트 없는 상태를 만들어낼 수 있다. 답은 매니페스트
 * 원복이다. 설치가 켠 키는 activate.ts 가 `tableKeys` 에 설치 이전 값과 함께 기록하고,
 * deactivate.ts:129-157 이 그 값으로 되돌린다(없던 키는 줄째로 지운다). 게이트와 키는 같은
 * `cxc disable` 로 함께 사라진다. 정직한 한계: 원복은 `cxc disable` 을 거쳐야 하고,
 * 플러그인 디렉터리를 그냥 지우면 키만 남는다. 그건 이 목록의 모든 항목과 [features] 플래그
 * 네 개가 이미 공유하는 한계이지 이 키가 새로 만든 위험이 아니다.
 */

export interface ManagedKey {
  table: string;
  key: string;
  /**
   * True when `cxc enable` may write this key itself. Decided per ENTRY, never for the
   * list as a whole: membership here still means "the effect reaches past codexclaw",
   * so each key has to earn auto-enable on its own evidence (see the 260909 note above).
   */
  autoEnable: boolean;
  /**
   * The side effect, in the user's view. Printed before an explicit `cxc config set`
   * write, and printed by `cxc enable` for a key installation turned on by itself.
   */
  caution: string;
}

export const CONFIG_MANAGED_KEYS: readonly ManagedKey[] = [
  {
    table: "memories",
    key: "dedicated_tools",
    autoEnable: true,
    caution:
      "memories/{list,read,search,add_ad_hoc_note} 네 도구가 열립니다. " +
      "add_ad_hoc_note는 메모리에 새 노트를 만드는 쓰기 경로이지만, " +
      "codexclaw 의 PreToolUse 메모리 쓰기 게이트가 명시 요청 없는 쓰기를 거부합니다. " +
      "설치가 이 키를 켜고, 'cxc disable' 이 설치 이전 값으로 되돌립니다.",
  },
];

/** "<table>.<key>" — the id used by the CLI and by the install manifest. */
export function managedKeyId(entry: Pick<ManagedKey, "table" | "key">): string {
  return `${entry.table}.${entry.key}`;
}

/** The subset installation is allowed to write on its own. */
export function autoEnabledManagedKeys(): ManagedKey[] {
  return CONFIG_MANAGED_KEYS.filter((entry) => entry.autoEnable);
}

/** Look up a managed key by its dotted id. Null when it is not on the list. */
export function findManagedKey(id: string): ManagedKey | null {
  const wanted = id.trim();
  return CONFIG_MANAGED_KEYS.find((entry) => managedKeyId(entry) === wanted) ?? null;
}
