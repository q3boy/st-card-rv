import type { SqlBinds } from '../core/binds';
import type { MutationResult, QueryResult } from '../core/database';
import type { SqlCommand } from '../protocol';
import type { ServiceErrorData, FailureKind, ExecutionState } from '../core/errors';
/** Each property access captures a fixed target; each write commits its own memory transaction. */
export interface PublicDatabaseApi {
    readonly root: BusinessDatabaseHandle;
    readonly char: BusinessDatabaseHandle | null;
    readonly chat: BusinessDatabaseHandle | null;
}
export interface BusinessDatabaseHandle {
    /** Per-proxy write delay, default 3000 ms. false/0 disable; maximum 2147483647. */
    debounce(milliseconds: number | false): this;
    query(sql: string, binds?: SqlBinds): Promise<QueryResult>;
    update(sql: string, binds?: SqlBinds): Promise<MutationResult>;
    exec(sql: string): Promise<MutationResult>;
    transaction(commands: SqlCommand[]): Promise<MutationResult>;
    runSql(sql: string | string[]): Promise<MutationResult>;
}
declare global {
    const SqliteHelper: PublicDatabaseApi;
}
export type { SqlBinds, SqlCommand, MutationResult, QueryResult };
/** Business decisions use these fields, never the diagnostic data. */
export type PublicErrorCode = 'AUTH_CANCELLED' | 'AUTH_DENIED' | 'AUTH_TIMEOUT' | 'AUTH_FAILED' | 'SQL_INVALID' | 'SQL_FAILED' | 'SQL_SAVED' | 'SQL_COMMITTED' | 'SQL_UNKNOWN' | 'COM_DISCONNECTED' | 'SYS_DISABLED' | 'SYS_UNSUPPORTED' | 'SYS_VERSION' | 'SYS_BUSY' | 'SYS_FAILED' | 'DB_UNINITIALIZED' | 'DB_MISSING' | 'DB_FAILED' | 'DB_UNAVAILABLE' | 'DB_BUSY';
export type PublicErrorLevel = 'info' | 'warning' | 'error';
/** Advice only; callers must not automatically resubmit writes or refresh pages. */
export type PublicErrorSuggestion = 'abort_quiet' | 'retry_later' | 'refresh_page';
export interface PublicErrorData extends ServiceErrorData {
    method?: 'query' | 'update' | 'exec' | 'transaction' | 'runSql';
}
export interface PublicError {
    readonly code: PublicErrorCode;
    readonly message: string;
    readonly level: PublicErrorLevel;
    readonly suggestion?: PublicErrorSuggestion;
    readonly failureKind: FailureKind;
    /** Only describes this call's business write, never a query or identity preparation. */
    readonly executionState?: ExecutionState;
    readonly data: PublicErrorData;
}
export type { FailureKind, ExecutionState };
