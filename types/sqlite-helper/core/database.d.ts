import type { SqlJsStatic, SqlValue } from '../vendor/sqljs';
import { type ServiceErrorData } from './errors';
import type { ViewerRequest, ViewerFile } from '../viewer-contracts';
export interface Command {
    sql: string;
    binds?: SqlValue[] | Record<string, SqlValue>;
    mode?: 'update' | 'transaction' | 'exec' | 'runSql';
    kind?: 'check' | 'write';
    expectChanges?: number;
}
export interface QueryResult {
    columns: string[];
    rows: SqlValue[][];
}
export interface MutationResult {
    committed: true;
    persisted: false;
}
export interface ManagementMutationResult {
    persisted: true;
}
export interface BackgroundSaveFailure {
    stage: 'export' | 'write' | 'metadata' | 'registration';
    fileState: 'not-saved' | 'unknown' | 'saved';
    error: ServiceErrorData;
    memoryAvailable: boolean;
}
export interface Storage {
    read(): Promise<Uint8Array | null>;
    write(bytes: Uint8Array, options?: {
        create?: boolean;
    }): Promise<void>;
    assertExisting?(): Promise<void>;
    metadata?(): Promise<ViewerFile>;
    readSnapshot?(): Promise<{
        bytes: Uint8Array | null;
        metadata?: ViewerFile;
    }>;
}
export interface InitializationMarker {
    scope: 'char' | 'chat';
    charDbId: string;
    chatDbId?: string;
}
export interface TransactionHooks {
    beforeExecute?: () => void;
    initialization?: InitializationMarker;
    beforeSave?: () => Promise<void>;
    afterSave?: () => Promise<void>;
    management?: true;
}
/** Scoped databases keep only their identity here; the global management table has its own definition. */
export declare const SCOPED_META_TABLE_SQL = "CREATE TABLE IF NOT EXISTS __stsh_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)";
export declare class SingleDatabase {
    private readonly SQL;
    private readonly storage;
    onBackgroundSaveFailed?: ((failure: BackgroundSaveFailure) => void) | undefined;
    private readonly saveDebounceMs;
    private db?;
    private state;
    private transient;
    private initializationCommitted;
    private dirty;
    private saveTimer?;
    private saveTask?;
    private savesSealed;
    private firstSaveHooks?;
    private fileBaseline?;
    private tail;
    constructor(SQL: SqlJsStatic, storage: Storage, onBackgroundSaveFailed?: ((failure: BackgroundSaveFailure) => void) | undefined, saveDebounceMs?: number);
    get availability(): 'new' | 'ready' | 'disabled';
    get hasPendingFirstCommit(): boolean;
    /** Cancel only pending normal saves; the returned fact belongs to this close attempt. */
    sealBackgroundSaves(): boolean;
    resumeBackgroundSaves(cancelled: boolean): void;
    drain(): Promise<void>;
    close(): Promise<void>;
    /** Only the Worker may call this after sealing admission and draining all queues. */
    closeForRestart(): void;
    private enqueue;
    private disable;
    private ready;
    private configure;
    /** Management records describe this service's own state; their save must never be reported as this call's business write. */
    private persist;
    private cancelPendingSave;
    private scheduleSave;
    open(): Promise<void>;
    openExisting(): Promise<void>;
    openTransient(): Promise<void>;
    /** Manual reload discards only saves that have not started; a missing first file cannot be reloaded. */
    cancelPendingSaveForReload(): void;
    refresh(): Promise<void>;
    refreshIfChanged(): Promise<boolean>;
    private load;
    private checkFile;
    assertFileExisting(): Promise<void>;
    fileExists(): Promise<boolean>;
    getInitializationMarker(): Promise<InitializationMarker | undefined>;
    private initializationMarker;
    private storeInitialization;
    transaction(commands: Command[], onComplete: (() => void) | undefined, hooks: TransactionHooks & {
        management: true;
    }): Promise<ManagementMutationResult>;
    transaction(commands: Command[], onComplete?: () => void, hooks?: TransactionHooks & {
        management?: undefined;
    }): Promise<MutationResult>;
    private executeCommand;
    query(command: Command, beforeExecute?: () => void): Promise<QueryResult>;
    /** The whole read occupies one existing physical queue; no arbitrary SQL enters here. */
    viewer(request: ViewerRequest, beforeExecute?: () => void): Promise<unknown>;
}
