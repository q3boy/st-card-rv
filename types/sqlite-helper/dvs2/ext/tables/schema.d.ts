import type { DvsHelperPort } from './helper';
import type { DvsVirtualTable } from './contracts';
export interface DvsColumn {
    name: string;
    type: string;
    notnull: number;
    pk: number;
    hidden: number;
}
export interface TableSchema {
    name: string;
    indexName: string;
    keys: readonly string[];
    columns: DvsColumn[];
    virtual?: never;
}
export type RequestTableSchema = TableSchema | {
    name: string;
    keys: readonly string[];
    columns: Array<Pick<DvsColumn, 'name' | 'type' | 'hidden'>>;
    virtual: true;
};
export declare function validateVirtualTables(input: Record<string, DvsVirtualTable> | undefined, realKeys: Record<string, readonly string[]>): Record<string, DvsVirtualTable>;
export declare function requestSchemas(real: Record<string, TableSchema>, virtualTables?: Record<string, DvsVirtualTable>): Record<string, RequestTableSchema>;
/** DVS system tables; the read-only scan compares stored definitions with these statements. */
export declare const DVS_VERSION_TABLE_SQL = "CREATE TABLE IF NOT EXISTS \"_dvs_version\" (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), version TEXT NOT NULL)";
export declare const DVS_GC_COUNTER_TABLE_SQL = "CREATE TABLE \"_dvs_gc_counter\" (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), successful_updates INTEGER NOT NULL CHECK (typeof(successful_updates) = 'integer' AND successful_updates >= 0))";
export declare function indexTableName(name: string): string;
export declare function createIndexSql(name: string): string;
export declare function validateUniqueKeys(input: Record<string, readonly string[]>): Record<string, readonly string[]>;
export declare function inspectSchemas(helper: DvsHelperPort, uniqueKeys: Record<string, readonly string[]>): Promise<Record<string, TableSchema>>;
