import type { Database } from '../vendor/sqljs';
import type { FailureKind } from './errors';
export declare function wrapSQLiteErrors(db: Database): void;
export declare function sqliteCode(error: unknown): number | undefined;
export declare function sqliteFailureKind(error: unknown, phase: 'begin' | 'identity' | 'command' | 'binding' | 'commit'): FailureKind;
