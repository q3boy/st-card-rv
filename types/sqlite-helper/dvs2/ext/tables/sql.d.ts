import type { SqlValue } from '../../../vendor/sqljs';
import type { CheckedCommand } from '../../../protocol';
import type { TableSchema } from './schema';
export declare function quoteIdentifier(value: string): string;
export declare function sqlLiteral(value: string | number | null | Uint8Array): string;
export declare function captureValue(value: unknown): SqlValue;
export declare function copyValues(values: Record<string, SqlValue>): Record<string, SqlValue>;
export declare function sameValue(a: SqlValue | undefined, b: SqlValue | undefined): boolean;
export type ManagedOperation = {
    kind: 'insert' | 'update' | 'remove';
    schema: TableSchema;
    oldRid?: Uint8Array;
    newRid?: Uint8Array;
    values: Record<string, SqlValue>;
};
export declare function managementCommands(operation: ManagedOperation, fid: Uint8Array): CheckedCommand[];
