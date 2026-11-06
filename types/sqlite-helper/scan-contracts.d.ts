export type ScanRequest = {
    operation: 'records';
} | {
    operation: 'inventory';
} | {
    operation: 'file';
    charDbId: string;
    chatDbId?: string;
} | {
    operation: 'database';
    charDbId: string;
    chatDbId?: string;
} | {
    operation: 'read';
    relativePath: string;
};
export interface ScanTarget {
    scope: 'char' | 'chat';
    charDbId: string;
    chatDbId?: string;
    origin: 'generated' | 'legacy';
    state: 'never' | 'creating' | 'ready';
}
export interface ScanRecord {
    scope: 'char' | 'chat';
    referenceId: number;
    parentReferenceId?: number;
    avatar: string;
    file?: string;
    id: string | null;
    parent?: string;
    state: 'active' | 'retained' | 'deleted';
    generation?: number;
    confirmed?: boolean;
    origin?: 'generated' | 'legacy';
    initialization?: ScanTarget['state'];
    taskReasons: string[];
    parentDependency: boolean;
    shared: boolean;
}
export interface ScanIssue {
    relativePath: string;
    reason: string;
}
export interface ScanSchemaDifference {
    kind: 'object' | 'version' | 'foreign-key' | 'legacy';
    /** Object name for `object` and `legacy` differences. */
    name?: string;
    type?: 'table' | 'index' | 'view';
    /** The text the management schema assertion throws for this difference. */
    message: string;
    /** What exactly differs, shown to the user. */
    detail: string;
}
export interface ScanSnapshot {
    schemaVersion?: number;
    directoryName: string;
    /** `valid` is the only state whose records and registrations were read. */
    management: 'valid' | 'uninitialized' | 'invalid' | 'unreadable';
    differences: ScanSchemaDifference[];
    rootReadable: boolean;
    records: ScanRecord[];
    targets: ScanTarget[];
    issues: ScanIssue[];
}
export interface ScanFile {
    charDbId: string;
    chatDbId?: string;
    relativePath: string;
    status: 'exists' | 'missing' | 'unknown';
    size?: number;
    reason?: string;
}
export interface ScanEntry {
    relativePath: string;
    kind: 'file' | 'directory';
    size?: number;
    /** The first 16 bytes are the SQLite file header. */
    sqlite?: boolean;
    /** The directory directly contains browser temporary files, which are skipped and never listed. */
    temporary?: boolean;
    /** Metadata, header or listing could not be read. */
    reason?: string;
}
export interface ScanInventory {
    entries: ScanEntry[];
    issues: ScanIssue[];
}
/** Facts read from a role or chat database file on disk; unsaved changes of a loaded instance are not included. */
export interface ScanDatabase {
    charDbId: string;
    chatDbId?: string;
    relativePath: string;
    status: 'checked' | 'missing' | 'unknown';
    reason?: string;
    /** The in-database `__stsh_meta` table. */
    meta: 'absent' | 'valid' | 'invalid';
    /** Absent when there is no identity row; `invalid` when the row is not a usable JSON identity. */
    identity?: {
        scope: string;
        charDbId: string;
        chatDbId?: string;
    } | 'invalid';
    /** DVS system table differences; empty when the database has no `_dvs_` tables. */
    dvs: string[];
}
/** The complete original bytes of one file, read for the backup download. */
export interface ScanFileBytes {
    relativePath: string;
    size: number;
    lastModified: number;
    bytes: Uint8Array;
}
export type ScanResult = ScanSnapshot | ScanInventory | ScanFile | ScanDatabase | ScanFileBytes;
/** Permission is bounded by the concrete selection the user confirmed. */
export interface ScanCleanupRequest {
    operationId: string;
    expected: ScanRecord;
    removeRecord: boolean;
    removeFile: boolean;
    observation: {
        status: 'deleted' | 'same' | 'unknown';
        reason: string;
        observedId?: string | null;
    };
    /**
     * A chat in a selected group: its role record is already marked deleted, which replaces the
     * Tavern chat readback. The chat may have changed from `active` to `retained` since the scan.
     */
    parentDeleted?: true;
}
export interface ScanCleanupResult {
    scope: 'char' | 'chat';
    referenceId: number;
    partial: boolean;
    /** This request marked the record deleted (and a role's active chats retained) and saved it; never undone. */
    marked?: true;
    file: {
        status: 'removed' | 'missing' | 'shared' | 'retained' | 'none' | 'blocked';
        relativePath?: string;
        message: string;
    };
    record: {
        status: 'removed' | 'retained' | 'blocked';
        message: string;
    };
}
/** Removal of one file or empty directory that had no basis when scanned. */
export interface ScanEntryRequest {
    relativePath: string;
    entry: 'file' | 'directory';
}
export interface ScanEntryResult {
    relativePath: string;
    status: 'removed' | 'missing' | 'skipped';
    message: string;
}
export interface ScanTargetResult {
    status: 'removed' | 'skipped';
    message: string;
}
export interface ScanBasisFacts {
    /** Role database UUIDs of every role record, in any state. */
    roles: string[];
    /** `[parent role UUID, chat UUID]` of every chat record with a UUID, in any state. */
    chats: Array<[string, string]>;
    /** Parent UUIDs of every chat record, including chats without their own UUID. */
    chatParents: string[];
    targets: Array<Pick<ScanTarget, 'scope' | 'charDbId' | 'chatDbId'>>;
}
/**
 * Whether a path has a reason to be kept. Comparison ignores case, because a case-insensitive file
 * system (Windows) resolves a differently cased name to the registered file; keeping one extra file is safer.
 */
export declare function scanEntryHasBasis(relativePath: string, kind: 'file' | 'directory', facts: ScanBasisFacts): boolean;
export declare function scanBasisFacts(snapshot: Pick<ScanSnapshot, 'records' | 'targets'>): ScanBasisFacts;
