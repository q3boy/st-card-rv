export type ManagementCell = string | number | null | Uint8Array;
export declare const MANAGEMENT_COLUMNS: {
    readonly __stsh_meta: readonly ['key', 'value'];
    readonly __stsh_targets: readonly ['scope', 'char_dbid', 'chat_dbid', 'origin', 'state'];
    readonly __stsh_roles: readonly ['role_id', 'avatar_name', 'char_dbid', 'generation', 'confirmed', 'origin', 'state'];
    readonly __stsh_chats: readonly ['chat_id', 'role_id', 'file_name', 'chat_dbid', 'parent_char_dbid', 'generation', 'confirmed', 'origin', 'state'];
};
export type ManagementTableName = keyof typeof MANAGEMENT_COLUMNS;
export type ManagementRepairReasonCode = 'repair-object' | 'rebuild-table' | 'repair-version' | 'merge-duplicates' | 'restore-parent' | 'restore-identity' | 'restore-target' | 'remove-unused-record' | 'unreadable' | 'legacy-format' | 'unknown-version' | 'unknown-management-object' | 'object-kind' | 'missing-table' | 'missing-columns' | 'extra-columns' | 'invalid-record' | 'conflicting-records' | 'unresolved-parent' | 'external-foreign-key';
export interface ManagementRepairReason {
    code: ManagementRepairReasonCode;
    object?: string;
}
export interface ManagementRepairDiagnostic {
    object: string;
    error: import('./core/errors').ServiceErrorData;
}
export interface ManagementRecordCoordinate {
    scope: 'char' | 'chat';
    referenceId: number;
    avatar: string;
    file?: string;
    id: unknown;
    parent?: unknown;
}
export interface ManagementRepairObservation {
    scope: 'char' | 'chat';
    referenceId: number;
    avatar: string;
    file?: string;
    status: 'same' | 'deleted' | 'unknown';
    observedId?: string | null;
    reason?: string;
}
export interface ManagementTargetFact {
    scope: 'char' | 'chat';
    charDbId: string;
    chatDbId?: string;
    origin: 'generated' | 'legacy';
}
export interface ManagementRepairPlan {
    kind: 'none' | 'light' | 'rebuild' | 'blocked';
    evidence: string;
    objects: string[];
    reasons: ManagementRepairReason[];
    recordChanges: number;
    recordsToCheck?: ManagementRecordCoordinate[];
    diagnostics?: ManagementRepairDiagnostic[];
}
export interface ManagementObjectFact {
    name: string;
    type: string;
    table: string;
    sql: string | null;
    /** Undefined for an extension object that is not one of the twelve current definitions. */
    matches?: boolean;
    expectedType?: string;
}
export interface ManagementTableFact {
    columns: string[];
    rows: ManagementCell[][];
}
export interface ManagementRepairFacts {
    objects: ManagementObjectFact[];
    tables: Partial<Record<ManagementTableName, ManagementTableFact>>;
    unreadable: string[];
    externalForeignKeys: Array<{
        table: string;
        parent: string;
    }>;
    sequences: Partial<Record<'__stsh_roles' | '__stsh_chats', number>>;
    targetFiles: Array<{
        target: ManagementTargetFact;
        state: 'ready' | 'missing' | 'needs-repair' | 'unknown';
    }>;
    recordChecks: Array<{
        record: ManagementRecordCoordinate;
        observation?: ManagementRepairObservation;
        files: 'present' | 'absent' | 'unknown';
    }>;
    diagnostics?: ManagementRepairDiagnostic[];
}
/** Internal pure decision; row contents never enter the page-facing plan. */
export interface ManagementRepairDecision {
    kind: ManagementRepairPlan['kind'];
    replaceTables: ManagementTableName[];
    recreateObjects: string[];
    rows: Partial<Record<ManagementTableName, ManagementCell[][]>>;
    reasons: ManagementRepairReason[];
    recordChanges: number;
    recordsToCheck: ManagementRecordCoordinate[];
    targetsToCheck: ManagementTargetFact[];
    insertTargets: ManagementCell[][];
}
export declare const managementValueKey: (value: unknown) => string;
interface MissingManagementFields {
    roleIdentity: boolean;
    chatIdentity: boolean;
    chatParent: boolean;
    targetsTable: boolean;
}
/** Selects only repairs whose values can be retained or derived from existing management rows. */
export declare function decideManagementRepair(facts: ManagementRepairFacts): ManagementRepairDecision;
type ManagementRows = Record<ManagementTableName, ManagementCell[][]>;
interface IdentityRecoveryInput {
    roles: ManagementCell[][];
    chats: ManagementCell[][];
    targets: ManagementCell[][];
    missing: Pick<MissingManagementFields, 'chatIdentity' | 'chatParent'>;
}
/** Produces recoverable identities, unused-row removals and the exact external checks still needed. */
export declare function recoverManagementIdentities(input: IdentityRecoveryInput, facts: Pick<ManagementRepairFacts, 'recordChecks' | 'targetFiles'>): {
    rows: {
        __stsh_roles: ManagementCell[][];
        __stsh_chats: ManagementCell[][];
        __stsh_targets: ManagementCell[][];
    };
    replaceTables: ManagementTableName[];
    recordChanges: number;
    reasons: ManagementRepairReason[];
    recordsToCheck: ManagementRecordCoordinate[];
    targetsToCheck: ManagementTargetFact[];
    roleIdentityRedirect: Map<string, Set<string>>;
};
interface NormalizedManagementRecords {
    rows: ManagementRows;
    replaceTables: ManagementTableName[];
    recordChanges: number;
    reasons: ManagementRepairReason[];
    targetsToCheck: ManagementTargetFact[];
    blocked?: ManagementRepairReason;
    counts: {
        before: Map<ManagementTableName, number>;
        meta: number;
        versionChanged: boolean;
        restoredParents: number;
    };
}
/** Validates version and target rows, then merges equivalent records and redirects their child references. */
export declare function normalizeManagementRecords(input: ManagementRows, missing: Pick<MissingManagementFields, 'roleIdentity' | 'chatIdentity'>, roleIdentityRedirect: Map<string, Set<string>>, targetFiles: ManagementRepairFacts['targetFiles']): NormalizedManagementRecords;
export {};
