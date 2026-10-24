import type { Database, Statement } from '../vendor/sqljs';
export declare function skipHead(sql: string, emptySeparators?: boolean): string;
export declare function checkQueryPrefix(sql: unknown): asserts sql is string;
export type SqlMethod = 'query' | 'update' | 'transaction' | 'exec';
export declare function checkPrefix(sql: unknown, method: SqlMethod): asserts sql is string;
export declare function prepareQuery(db: Database, sql: string): Statement;
export declare function prepareSingle(db: Database, sql: string, method: SqlMethod): Statement;
export type CheckedSqlCommand = {
    kind: 'check';
    sql: string;
    binds?: unknown;
} | {
    kind: 'write';
    sql: string;
    binds?: unknown;
    expectChanges?: number;
};
/** Shared shape/SQL validation; page and Worker validate their own binding representation. */
export declare function validateCheckedCommands(input: unknown): asserts input is CheckedSqlCommand[];
