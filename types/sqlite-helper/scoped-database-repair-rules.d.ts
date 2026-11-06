import type { InitializationMarker } from './core/database';
import type { ServiceErrorData } from './core/errors';
export type ScopedCell = string | number | null | Uint8Array;
export interface ScopedRepairReason {
    code: string;
    object?: string;
}
export interface ScopedRepairDiagnostic {
    object: string;
    error: ServiceErrorData;
}
export interface ScopedRepairPlan {
    kind: 'none' | 'repair' | 'reset-required' | 'blocked';
    evidence: string;
    objects: string[];
    reasons: ScopedRepairReason[];
    /** All valid owned markers, including duplicate rows; used to reject another live owner's data. */
    identities?: InitializationMarker[];
    diagnostics?: ScopedRepairDiagnostic[];
}
export interface ScopedTableFact {
    name: string;
    type: string;
    sql: string | null;
    columns: string[];
    rows: ScopedCell[][];
    /** Present only for known Helper/DVS tables. */
    expectedColumns?: readonly string[];
    matches?: boolean;
}
export interface ScopedObjectFact {
    name: string;
    type: string;
    table: string;
    sql: string | null;
}
export interface ScopedRepairFacts {
    tables: ScopedTableFact[];
    objects: ScopedObjectFact[];
    expectedIndexes: readonly string[];
    externalForeignKeys: Array<{
        table: string;
        parent: string;
    }>;
    diagnostics: ScopedRepairDiagnostic[];
    readFailure?: 'read' | 'database';
}
export interface ScopedTableRepair {
    name: string;
    columns: readonly string[];
    rows: ScopedCell[][];
}
export interface ScopedRepairDecision {
    kind: ScopedRepairPlan['kind'];
    reasons: ScopedRepairReason[];
    repairs: ScopedTableRepair[];
}
interface TableDecision {
    kind: ScopedRepairPlan['kind'];
    rows: ScopedCell[][];
    reasons: ScopedRepairReason[];
}
export declare const scopedValueKey: (value: unknown) => string;
export declare function helperMetadataIdentities(table: ScopedTableFact | undefined): InitializationMarker[];
/** The coordinator, not this rule, confirms that the external chat/role owns the requested identity. */
export declare function decideHelperMetadata(table: ScopedTableFact | undefined, identity: InitializationMarker): TableDecision;
/** Author migration versions are retained; they are never compared with the Helper release version. */
export declare function decideDvsVersion(table: ScopedTableFact | undefined): TableDecision;
export declare function decideDvsCounter(table: ScopedTableFact | undefined): TableDecision;
/** No current-branch fid list is accepted: absence from a visible branch cannot prove an orphan. */
export declare function normalizeDvsIndex(rows: ScopedCell[][], entities: {
    state: 'known' | 'unknown';
    rids: readonly ScopedCell[];
}): {
    rows: ScopedCell[][];
    removed: number;
};
/** Explicit stages inspect metadata, preserve DVS history, then check reconstruction dependencies. */
export declare function decideScopedRepair(facts: ScopedRepairFacts, identity: InitializationMarker, options?: {
    requireIdentity?: boolean;
}): ScopedRepairDecision;
export {};
