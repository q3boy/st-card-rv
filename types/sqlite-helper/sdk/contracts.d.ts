import type { Action, StorageBinding, StorageStatus, SqlCommand } from '../protocol';
import type { SqlBinds } from '../core/binds';
import type { MutationResult, QueryResult } from '../core/database';
export declare const SERVICE_API_VERSION = 30;
/** Internal transport, never published as the business API. */
export interface CapturedTargetPort {
    execute(action: Action, debounceMs?: number | 'default'): Promise<unknown>;
}
export interface DatabasePort {
    readonly binding: StorageBinding;
    execute(action: Action): Promise<unknown>;
    enqueue(action: Action, debounceMs: number): Promise<MutationResult>;
    flush(): Promise<void>;
}
export interface SharedService {
    readonly apiVersion: number;
    readonly buildId: string;
    /** Internal default supplied by the page host; absent on older SharedWorker services. */
    readonly defaultDebounceMs?: number;
    ready(): Promise<void>;
    captureTarget(scope: 'global' | 'char' | 'chat', beforeResolve?: () => Promise<void>): CapturedTargetPort | null;
    getDatabase(): Promise<DatabasePort>;
    getHandles(prepared?: StorageBinding): Promise<{
        root: DatabasePort;
        char: DatabasePort | null;
        chat: DatabasePort | null;
    }>;
    initialize(directory: FileSystemDirectoryHandle): Promise<void>;
    getStorageStatus(): Promise<StorageStatus>;
    /** Restores confirmed fixed identities on reconnect; never reads historical chat metadata. */
    reconnect(): Promise<void>;
    /** Optional only for compatible pre-runtime services retained by an extension host. */
    runtime?: RuntimeApi;
}
export interface RuntimeStatus {
    state: string;
    workerMode?: import('../protocol').WorkerMode;
    protocolVersion: number;
    buildId?: string;
    instanceId?: string;
    facadeBuildId: string;
    hostBuildId: string;
    serviceBuildId: string;
    targetBuildId: string;
    preparationState?: 'idle' | 'preparing' | 'prepared';
}
export interface RuntimeApi {
    getStatus(): RuntimeStatus;
    /** Resolves after this page restores; other pages restore independently. */
    restart(): Promise<void>;
}
export interface GlobalSharing {
    initializeGlobal(name: string, value: unknown): void;
    waitGlobalInitialized(name: string): Promise<unknown>;
    SqliteHelper?: import('./public-contracts').PublicDatabaseApi;
}
export type { SqlBinds, SqlCommand, StorageStatus, MutationResult, QueryResult };
