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
 * installation must never flip a side-effecting switch the user owns. features.ts:18-20
 * left multi_agent_v2 undeclared for exactly this reason, and dedicated_tools has the
 * same shape — off by default upstream, with a write path attached. Turning one on is
 * an explicit `cxc config set` call, never a side effect of `cxc enable`.
 */










export const CONFIG_MANAGED_KEYS                        = [
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
export function managedKeyId(entry                                   )         {
  return `${entry.table}.${entry.key}`;
}

/** Look up a managed key by its dotted id. Null when it is not on the list. */
export function findManagedKey(id        )                    {
  const wanted = id.trim();
  return CONFIG_MANAGED_KEYS.find((entry) => managedKeyId(entry) === wanted) ?? null;
}

