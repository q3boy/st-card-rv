declare const errorCodes: readonly ['VIEWER_LIMIT_EXCEEDED', 'SERVICE_DISABLED', 'SETTINGS_FAILED', 'AUTHORIZATION_CANCELLED', 'AUTHORIZATION_TIMEOUT', 'AUTHORIZATION_FAILED', 'SERVICE_RESTARTING', 'IDENTITY_FAILED', 'IDENTITY_CONFLICT', 'STALE_IDENTITY', 'ENTITY_RENAME_PENDING', 'ENTITY_RENAME_UNCONFIRMED', 'ENTITY_DELETE_PENDING', 'ENTITY_DELETE_UNCONFIRMED', 'UUID_SAVE_FAILED', 'UUID_REGISTRATION_FAILED', 'UUID_SYNC_FAILED', 'NOT_INITIALIZED', 'DATABASE_NOT_INITIALIZED', 'INSTANCE_DISABLED', 'SQL_FAILED', 'ROLLBACK_FAILED', 'SAVE_FAILED', 'LOAD_FAILED', 'PERMISSION_REQUIRED', 'INVALID_REQUEST', 'INTERNAL_ERROR', 'UNSUPPORTED_ENVIRONMENT', 'PROTOCOL_MISMATCH', 'ALREADY_INITIALIZED', 'CONNECTION_FAILED', 'RESULT_UNCONFIRMED', 'STALE_CONFIGURATION', 'CONFIG_CHANGING', 'CONFIG_FAILED'];
export type ErrorCode = (typeof errorCodes)[number];
export type FailureKind = 'request-rejected' | 'sql-rejected' | 'precondition-rejected' | 'service';
export type ExecutionState = 'not-started' | 'rolled-back' | 'committed' | 'unknown';
export interface ErrorDetail {
    message: string;
    name?: string;
    code?: ErrorCode;
    sqliteCode?: number;
}
export interface ServiceErrorData {
    code: ErrorCode;
    message: string;
    failureKind?: FailureKind;
    executionState?: ExecutionState;
    sqlError?: ErrorDetail;
    rollbackError?: ErrorDetail;
    operationId?: string;
    recoveryError?: ErrorDetail;
    saveError?: ErrorDetail;
    causeError?: ErrorDetail;
    resultState?: 'not-applied' | 'unconfirmed';
    /** Identity errors describe Tavern metadata, not a database transaction. Omitted means database. */
    resultKind?: 'database' | 'identity';
    /** For identity errors, resultState describes this step, not SQL execution. */
    identityStage?: 'save' | 'register' | 'sync';
    renameStage?: 'pending' | 'applied' | 'unconfirmed' | 'conflict';
    deleteStage?: 'pending' | 'applied' | 'unconfirmed' | 'conflict';
    /** True only after the UUID has been read back from Tavern. */
    identitySaved?: true;
    databaseScope?: 'char' | 'chat';
    initializationStage?: 'root-prepare' | 'target-save' | 'root-finalize';
    /** The original business operation is confirmed; root initialization may still be unresolved. */
    databasePersisted?: true;
    /** Evidence about this call's business SQL, distinct from metadata/root work. */
    businessResult?: 'not-started' | 'not-saved' | 'saved' | 'unknown';
    retryable?: boolean;
}
export declare function detail(error: unknown): ErrorDetail;
export declare class ServiceError extends Error {
    readonly data: ServiceErrorData;
    constructor(data: ServiceErrorData);
}
export declare function errorData(error: unknown): ServiceErrorData;
export declare function identityFailure(message: string, resultState?: ServiceErrorData['resultState'], cause?: unknown): ServiceError;
/** After attempting metadata persistence, failed readback cannot establish non-persistence. */
export declare function unconfirmedIdentity(error: unknown): ServiceError;
/** UUID persistence is known; later registration or local synchronization can still fail. */
export declare function savedIdentityFailure(error: unknown, field: 'chat_dbid', identityStage: 'register' | 'sync'): ServiceError;
/** File failures are classified from the original exception, never its message. */
export declare function fileRetryable(error: unknown): boolean;
export {};
