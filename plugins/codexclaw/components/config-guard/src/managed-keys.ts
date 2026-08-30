/**
 * managed-keys.ts — the closed list of non-feature config.toml keys codexclaw will edit.
 *
 * Two vocabularies stay separate on purpose:
 *   - DECLARED_FEATURES (features.ts) — booleans inside [features], written by the
 *     official `codex features enable` CLI.
 *   - CONFIG_MANAGED_KEYS (here) — scalars in other tables, written by toml-edit.ts
 *     because no persisted CLI setter exists for them.
 *
 * autoEnable is typed as the literal `false` for every entry, which is the point:
 * installation must never write a key from THIS list on its own. Turning one on is an
 * explicit `cxc config set` call, never a side effect of `cxc enable`.
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
 *     지우더라도 사용자가 계속 안고 가는 결과다. 그래서 자동으로 켜지 않는다.
 *
 * features.ts 가 multi_agent_v2 를 비선언으로 남긴 것도 같은 기준이다 — codexclaw 는 V1
 * 로도 동작하므로 그건 "필요한 플래그"가 아니다.
 */

export interface ManagedKey {
  table: string;
  key: string;
  /** Never true: installation does not write a key from this list on its own. */
  autoEnable: false;
  /** Shown before any write so the user decides with the side effect in view. */
  caution: string;
}

export const CONFIG_MANAGED_KEYS: readonly ManagedKey[] = [
  {
    table: "memories",
    key: "dedicated_tools",
    autoEnable: false,
    caution:
      "memories/{list,read,search,add_ad_hoc_note} 네 도구가 열립니다. " +
      "add_ad_hoc_note는 메모리에 새 노트를 만드는 쓰기 경로이므로, " +
      "명시 요청 없는 쓰기를 막는 장치를 먼저 확인하세요.",
  },
];

/** "<table>.<key>" — the id used by the CLI and by the install manifest. */
export function managedKeyId(entry: Pick<ManagedKey, "table" | "key">): string {
  return `${entry.table}.${entry.key}`;
}

/** Look up a managed key by its dotted id. Null when it is not on the list. */
export function findManagedKey(id: string): ManagedKey | null {
  const wanted = id.trim();
  return CONFIG_MANAGED_KEYS.find((entry) => managedKeyId(entry) === wanted) ?? null;
}
