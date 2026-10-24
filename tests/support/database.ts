import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { createRequire } from 'node:module';

let sqlPromise: Promise<SqlJsStatic> | undefined;
export async function sqlJs(): Promise<SqlJsStatic> {
  return (sqlPromise ??= initSqlJs({
    wasmBinary: await Bun.file(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')).arrayBuffer(),
  }));
}
export function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}
