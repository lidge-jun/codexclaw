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

export type Stmt = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
};

export type RwDb = {
  prepare: (sql: string) => Stmt;
  exec: (sql: string) => void;
  close: () => void;
};

function sqliteModule(): typeof import("node:sqlite") {
  return nodeRequire("node:sqlite") as typeof import("node:sqlite");
}

export function openDbReadOnly(path: string): RwDb {
  const { DatabaseSync } = sqliteModule();
  return new DatabaseSync(path, { readOnly: true }) as unknown as RwDb;
}

export function openDbReadWrite(path: string): RwDb {
  const { DatabaseSync } = sqliteModule();
  return new DatabaseSync(path) as unknown as RwDb;
}
