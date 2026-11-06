import type { JsonValue, SqlInputValue } from '../core/binds';
import type { SqlValue } from '../vendor/sqljs';
import type { BusinessDatabaseHandle } from '../sdk/public-contracts';
export type DvsValues = Record<string, SqlInputValue>;
export type DvsTables = Record<string, DvsValues[]>;
export type DvsPromptValue = JsonValue;
export type DvsPromptValues = Record<string, DvsPromptValue>;
export type DvsPromptTables = Record<string, DvsPromptValues[]>;
export type DvsFieldNames = string | readonly string[];
export type DvsDataScalar = null | string | number | boolean;
export interface DvsFieldScope {
    fields?: DvsFieldNames;
    except?: DvsFieldNames;
}
/** Synchronous transformations of copied author data; registered business keys keep their original values. */
export interface DvsDataTable {
    excludeFields(names: DvsFieldNames): DvsDataTable;
    excludeValues(values: DvsDataScalar | readonly DvsDataScalar[], scope?: DvsFieldScope): DvsDataTable;
    replaceValues(from: DvsDataScalar, to: SqlInputValue, scope?: DvsFieldScope): DvsDataTable;
    replaceText(from: string | RegExp, to: string, scope?: DvsFieldScope): DvsDataTable;
    rows(): DvsValues[];
}
export type DvsPromptRow = Readonly<Record<string, SqlValue>>;
export interface DvsPromptTable {
    get(...keys: SqlInputValue[]): Promise<DvsPromptRow | null>;
    row(): Promise<DvsPromptRow | null>;
    rows(): Promise<readonly DvsPromptRow[]>;
    query(condition: string, ...values: SqlInputValue[]): DvsPromptTable;
    orderBy(...columns: string[]): DvsPromptTable;
}
export interface DvsPromptState {
    table(name: string): DvsPromptTable;
}
export interface DvsRow {
    [field: string]: any;
    update(): Promise<void>;
    remove(): Promise<void>;
}
export interface DvsTable {
    get(...keys: SqlInputValue[]): Promise<DvsRow | null>;
    row(): Promise<DvsRow | null>;
    rows(): Promise<DvsRow[]>;
    query(condition: string, ...values: SqlInputValue[]): DvsTable;
    orderBy(...columns: string[]): DvsTable;
    insert(values: DvsValues): Promise<DvsRow>;
}
export interface DvsState {
    readonly char: BusinessDatabaseHandle;
    readonly chat: BusinessDatabaseHandle;
    readonly fid: Uint8Array;
    table(name: string): DvsTable;
    transaction<T>(callback: (state: DvsState) => T | Promise<T>): Promise<T>;
}
export interface DvsUpdateSourceState {
    readonly char: BusinessDatabaseHandle;
    readonly chat: BusinessDatabaseHandle;
    readonly fid: Uint8Array | null;
    table(name: string): DvsPromptTable;
}
export interface DvsRegistration {
    scriptId: string;
    uniqueKeys: Record<string, readonly string[]>;
    /** Request-only rows start empty on every attempt and must be removed by preUpdate. */
    virtualTables?: Record<string, DvsVirtualTable>;
    narrativePrepare(input: {
        char: BusinessDatabaseHandle;
        chat: BusinessDatabaseHandle;
        tables: DvsTables;
    }): DvsTables | DvsPromptTables | Promise<DvsTables | DvsPromptTables>;
    beforeGen(state: DvsUpdateSourceState, tables: DvsTables): DvsTables | Promise<DvsTables>;
    preUpdate?(state: DvsUpdateSourceState, newTables: DvsTables, oldTables: DvsTables): DvsTables | Promise<DvsTables>;
    postUpdate?(state: DvsState, newTables: DvsTables, oldTables: DvsTables): void | Promise<void>;
}
export type DvsVirtualFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
export interface DvsVirtualTable {
    keys: readonly string[];
    fields: Record<string, DvsVirtualFieldType>;
}
export interface DvsUpdateStatus {
    phase: 'idle' | 'preparing' | 'requesting' | 'retrying' | 'processing';
    /** One-based current attempt; retrying waits for attempt + 1. Zero before the first request. */
    attempt: number;
    maxAttempts: number;
    retryDelayMs: number;
}
export interface DvsLorebookVersionOptions {
    onExpired: 'WARNING_MESSAGE' | 'AUTO_UPDATE';
}
export interface DvsInjectFlags {
    filter: boolean;
    plot: boolean;
}
export interface DvsRegisterOptions {
    /** Ends only this registration; it does not cancel SQL already in progress. */
    signal?: AbortSignal;
}
export interface DvsApi {
    getInject(): Promise<DvsInjectFlags>;
    setInject(flags: DvsInjectFlags): Promise<DvsInjectFlags>;
    reInject(): Promise<void>;
    lorebookVersionCheck(options: DvsLorebookVersionOptions): Promise<void>;
    register(options: DvsRegistration, lifetime?: DvsRegisterOptions): Promise<() => void>;
    /** Reports current readiness immediately and stays subscribed across registrations. */
    onRegistrationChange(callback: (ready: boolean) => void | Promise<void>): () => void;
    table(name: string, rows?: readonly DvsValues[]): DvsDataTable;
    getState(target?: {
        messageId: number;
        swipeId?: number;
    }): Promise<DvsState>;
    onUpdate(callback: () => void | Promise<void>): () => void;
    getUpdateStatus(): DvsUpdateStatus;
    onUpdateStatus(callback: (status: DvsUpdateStatus) => void): () => void;
    regen(): Promise<void>;
}
declare global {
    const DVS: DvsApi;
}
