/**
 * sqlite.ts — lazy node:sqlite access shared by the recall component.
 *
 * node:sqlite is experimental but present in Node 22.5+/24. It resolves lazily
 * via createRequire (repo convention, see pabcd-state goal-active.ts) so
 * environments without it degrade to a caller-handled error instead of failing
 * module load.
 */
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);













function sqliteModule()                               {
  return nodeRequire("node:sqlite")                                ;
}

export function openDbReadOnly(path        )       {
  const { DatabaseSync } = sqliteModule();
  return new DatabaseSync(path, { readOnly: true })                   ;
}

export function openDbReadWrite(path        )       {
  const { DatabaseSync } = sqliteModule();
  return new DatabaseSync(path)                   ;
}
