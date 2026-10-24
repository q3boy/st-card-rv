import type { SqlValue } from '../vendor/sqljs';
export type JsonValue = null | string | number | boolean | JsonValue[] | {
    [key: string]: JsonValue;
};
export type SqlInputValue = SqlValue | JsonValue[] | {
    [key: string]: JsonValue;
};
export type SqlBinds = SqlInputValue[] | Record<string, SqlInputValue>;
export type SerializedSqlBinds = SqlValue[] | Record<string, SqlValue>;
/** Page boundary: validate and freeze every value before any await or structured clone. */
export declare function serializeBinds(input: unknown): SerializedSqlBinds | undefined;
/** Worker boundary: reject raw JSON, never stringify it a second time. */
export declare function validateSerializedBinds(input: unknown): SerializedSqlBinds | undefined;
