import { type ServiceErrorData } from './core/errors';
import type { SqlValue } from './vendor/sqljs';
import type { SqlBinds, SerializedSqlBinds } from './core/binds';
export declare const PROTOCOL_VERSION = 23;
export declare const BUILD_ID: string;
export interface HelloInfo extends StorageInfo {
    protocolVersion: number;
    buildId: string;
}
export interface EntityRenamedEvent {
    type: 'entity-renamed';
    instanceId: string;
    storageId: string;
    configGeneration: number;
}
export interface EntityDeletedEvent {
    type: 'entity-deleted';
    instanceId: string;
    storageId: string;
    configGeneration: number;
    ticket: DeleteTicket;
}
export declare const EXTENSION_NAME: string;
export declare const EXTENSION_TEMPLATE_PATH: string;
export declare const EXTENSION_PATH: string;
export declare const WORKER_URL: string;
export declare const WORKER_NAME = "st-sqlite-helper";
export interface StorageBinding {
    storageId: string;
    configGeneration: number;
    scope?: 'global' | 'char' | 'chat';
    charDbId?: string;
    chatDbId?: string;
    characterEntity?: string;
    chatEntity?: string;
    characterReferenceId?: number;
    chatReferenceId?: number;
    identityGeneration?: number;
    chatIdentityGeneration?: number;
    entityRevision?: number;
}
export declare const isUuid: (value: unknown) => value is string;
export declare const bindingKey: (b: StorageBinding) => string;
export declare const identityBindingKey: (b: StorageBinding) => string;
export interface IdentityTicket {
    identityId: string;
    token?: string;
    generation?: number;
    referenceId?: number;
}
export interface RenameExpected {
    id: string | null;
    generation: number;
    confirmed: boolean;
    origin: 'generated' | 'legacy';
    parent?: string;
    referenceId?: number;
}
export interface RenameTicket {
    taskId: string;
    kind: 'char' | 'chat';
    oldEntity: string;
    newEntity: string;
    stage: 'pending' | 'applied' | 'unconfirmed' | 'conflict';
    expected?: RenameExpected;
    unobserved?: boolean;
}
export interface DeleteTicket {
    taskId: string;
    operationId: string;
    kind: 'char' | 'chat';
    entity: string;
    stage: 'pending' | 'unconfirmed' | 'applied' | 'cancelled';
    expected?: RenameExpected;
    deleteChats?: boolean;
    reason?: string;
    revision: number;
    credentials?: Array<{
        entity: string;
        chat: boolean;
        generation: number;
        id: string | null;
        parent?: string;
        referenceId: number;
    }>;
}
export type StorageMode = 'opfs' | 'directory';
export interface StorageStatus {
    mode?: StorageMode;
    autoReloadEnabled?: boolean;
    revision: number;
    state: 'uninitialized' | 'ready' | 'permission-required' | 'unavailable';
    initialized: boolean;
    switching: boolean;
    storageId?: string;
    configGeneration: number;
    permission?: PermissionState;
    error?: ServiceErrorData;
    entityRevision?: number;
}
export interface StorageInfo {
    storage: StorageStatus;
    directory?: FileSystemDirectoryHandle;
}
export interface SqlCommand {
    sql: string;
    binds?: SqlBinds;
}
export interface SerializedSqlCommand {
    sql: string;
    binds?: SerializedSqlBinds;
}
export type CheckedCommand = {
    kind: 'check';
    sql: string;
    binds?: SqlBinds;
} | {
    kind: 'write';
    sql: string;
    binds?: SqlBinds;
    expectChanges?: number;
};
export type SerializedCheckedCommand = {
    kind: 'check';
    sql: string;
    binds?: SerializedSqlBinds;
} | {
    kind: 'write';
    sql: string;
    binds?: SerializedSqlBinds;
    expectChanges?: number;
};
export interface BackgroundSaveFailedEvent {
    type: 'background-save-failed';
    instanceId: string;
    binding: StorageBinding;
    stage: 'export' | 'write' | 'metadata' | 'registration';
    fileState: 'not-saved' | 'unknown' | 'saved';
    memoryAvailable: boolean;
    error: ServiceErrorData;
}
export declare function rejectWriteOptions(options: unknown): void;
export type DatabaseAction = ({
    type: 'batch';
    operations: OrdinaryWriteAction[];
} | {
    type: 'refresh';
} | {
    type: 'transaction';
    commands: SerializedSqlCommand[];
    callId?: string;
} | {
    type: 'checked-transaction';
    commands: SerializedCheckedCommand[];
    callId?: string;
} | {
    type: 'update';
    sql: string;
    binds?: SerializedSqlBinds;
    callId?: string;
} | {
    type: 'exec';
    sql: string;
    callId?: string;
} | {
    type: 'runSql';
    sql: string | string[];
    callId?: string;
} | {
    type: 'query';
    sql: string;
    binds?: SerializedSqlBinds;
} | {
    type: 'viewer';
    request: import('./viewer-contracts').ViewerRequest;
} | {
    type: 'check-permission';
}) & {
    binding?: StorageBinding;
};
export type Action = {
    type: 'scan-cleanup';
    request: import('./scan-contracts').ScanCleanupRequest;
    binding: StorageBinding;
} | {
    type: 'scan';
    request: import('./scan-contracts').ScanRequest;
    binding: StorageBinding;
} | {
    type: 'scan-remove-entry';
    request: import('./scan-contracts').ScanEntryRequest;
    binding: StorageBinding;
} | {
    type: 'scan-remove-target';
    target: import('./scan-contracts').ScanTarget;
    binding: StorageBinding;
} | {
    type: 'entity-delete-begin';
    kind: 'char' | 'chat';
    entity: string;
    operationId: string;
    deleteChats?: boolean;
    binding?: StorageBinding;
} | {
    type: 'entity-delete-settle';
    taskId: string;
    kind: 'char' | 'chat';
    entity: string;
    expected?: RenameExpected;
    binding: StorageBinding;
    confirmed: boolean;
    absent: boolean;
    observedId?: string | null;
    remainingChatNames?: string[];
    failureReason?: string;
    requestOperationId?: string;
    nativeResult?: 'success' | 'failed' | 'unknown';
} | {
    type: 'entity-delete-pending';
    binding: StorageBinding;
} | {
    type: 'entity-delete-resume';
    binding: StorageBinding;
} | {
    type: 'entity-rename-begin';
    kind: 'char' | 'chat';
    oldEntity: string;
    newEntity: string;
    binding?: StorageBinding;
} | {
    type: 'entity-rename-settle';
    kind: 'char' | 'chat';
    taskId: string;
    oldEntity: string;
    newEntity: string;
    checkedOldEntity: string;
    checkedNewEntity: string;
    expected?: RenameExpected;
    observedId: string | null;
    confirmed: boolean;
    binding: StorageBinding;
} | {
    type: 'identity-restore';
    binding: StorageBinding;
    entity: string;
    generation?: number;
    readOnly?: boolean;
} | {
    type: 'restart-prepare';
    targetBuildId: string;
    targetProtocolVersion: number;
    automatic?: boolean;
    purpose?: 'update' | 'disable';
} | {
    type: 'restart-reply';
    attemptId: string;
    error?: ServiceErrorData;
} | {
    type: 'restart-cancel';
    attemptId: string;
} | {
    type: 'restart-commit';
    attemptId: string;
} | {
    type: 'restart-drain';
} | {
    type: 'chat-identity-acquire';
    entity: string;
    observedId: string | null;
    binding: StorageBinding;
} | {
    type: 'chat-identity-settle';
    entity: string;
    token: string;
    confirmed: boolean;
    binding: StorageBinding;
}
/** Without `create` only an existing registration is prepared; null means the role is not registered. */
 | {
    type: 'identity-acquire';
    entity: string;
    binding: StorageBinding;
    create?: boolean;
} | {
    type: 'identity-lookup';
    entity: string;
    binding: StorageBinding;
    readOnly?: boolean;
} | {
    type: 'hello';
} | {
    type: 'disconnect' | 'ping';
} | {
    type: 'storage-status';
} | {
    type: 'storage-configure';
    mode: StorageMode;
    autoReloadEnabled: boolean;
} | {
    type: 'open';
    directory: FileSystemDirectoryHandle;
} | DatabaseAction;
export type Request = Action & {
    requestId: string;
    protocolVersion: number;
};
export type ClientAction = Exclude<Action, {
    type: 'transaction' | 'checked-transaction' | 'query' | 'update';
}> | (Omit<Extract<Action, {
    type: 'update';
}>, 'binds'> & {
    binds?: SqlBinds;
}) | {
    type: 'query';
    binding?: StorageBinding;
    sql: string;
    binds?: SqlBinds;
} | (Omit<Extract<Action, {
    type: 'transaction';
}>, 'commands'> & {
    commands: SqlCommand[];
}) | (Omit<Extract<Action, {
    type: 'checked-transaction';
}>, 'commands'> & {
    commands: CheckedCommand[];
});
export type OrdinaryWriteAction = Extract<Action, {
    type: 'transaction' | 'checked-transaction' | 'update' | 'exec' | 'runSql';
}>;
export type WriteAction = OrdinaryWriteAction | Extract<Action, {
    type: 'batch';
}>;
export declare function isWriteAction(action: Action): action is WriteAction;
export type Response = {
    requestId: string;
    instanceId: string;
} & ({
    ok: true;
    result: unknown;
} | {
    ok: false;
    error: ServiceErrorData;
});
export type StorageEvent = StorageInfo & {
    type: 'storage-changed';
    instanceId: string;
};
export interface RestartEvent {
    type: 'restart-event';
    phase: 'prepare' | 'cancel' | 'exit';
    attemptId: string;
    targetBuildId: string;
    purpose?: 'update' | 'disable';
    error?: ServiceErrorData;
}
export type { SqlValue };
export type CallResult = {
    callId: string;
} & ({
    ok: true;
    result: import('./core/database').MutationResult;
} | {
    ok: false;
    error: ServiceErrorData;
});
