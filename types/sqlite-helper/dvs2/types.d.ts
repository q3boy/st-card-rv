import type { ExtensionKey, DvsScriptConfig } from './contracts';
import type { JSONSchema7 } from '../vendor/json-schema';
import type { Component, Ref, ShallowRef } from '../vendor/vue';
import type { JsonValue } from '../core/binds';
import type { DvsTables, DvsPromptTables, DvsPromptValues, DvsUpdateSourceState, DvsState, DvsPromptState, DvsApi, DvsRegistration, DvsRegisterOptions } from './ext/tables/contracts';
import type { BusinessDatabaseHandle, PublicDatabaseApi } from '../sdk/public-contracts';
import type { DvsHelperPort } from './ext/tables/helper';
import type { WorldbookReader } from './worldbook';
import type { ModelMessage } from './model-request';
import type { RequestSnapshot } from './config';
import type { VariablePatch } from './ext/tables/patch-format';
import type { TableSchema } from './ext/tables/schema';
import type { DvsFloorData } from './ext/tables/contracts';
import type { DvsPreNarrativeComponent } from './ext/pre_narr_ui/contracts';
export type StageName = 'collect' | 'userReq' | 'userResp' | 'aiReq' | 'aiResp';
export type CoreStep = StageName;
export type PluginStep = 'collect.pre' | 'collect.post' | 'userReq.pre' | 'userResp.post' | 'aiReq.pre' | 'aiResp.post';
export type ReservedStep = 'userReq.post' | 'aiReq.post' | 'userResp.pre' | 'aiResp.pre';
export type Step = CoreStep | PluginStep | ReservedStep;
export interface StageSteps {
    collect: 'collect.pre' | 'collect' | 'collect.post';
    userReq: 'userReq.pre' | 'userReq';
    userResp: 'userResp' | 'userResp.post';
    aiReq: 'aiReq.pre' | 'aiReq';
    aiResp: 'aiResp' | 'aiResp.post';
}
export interface BoundExtension {
    readonly definition: ExtensionDefinition;
    readonly instance: Extension;
    readonly config: Readonly<Record<string, unknown>>;
}
export interface Stage<S extends StageName> {
    execute(input: StageInput<S>, plan: StagePlan<S>): Promise<StageResult<S>>;
}
export interface StagePlan<S extends StageName> {
    readonly steps: readonly StageSteps[S][];
    readonly plugins: Partial<{
        [P in Extract<StageSteps[S], PluginStep>]: readonly BoundExtension[];
    }>;
}
export interface StageError<S extends StageName = StageName> {
    readonly step: StageSteps[S];
    readonly key?: ExtensionKey;
    readonly cause: unknown;
}
export interface StageInput<S extends StageName> {
    readonly context: StageContextData<S>;
    readonly exchange: StageExchange;
    readonly signal: AbortSignal;
    readonly reportError: (error: StageError<S>) => void;
}
export type StageResult<S extends StageName> = {
    readonly success: true;
    readonly context: StageContextData<S>;
} | {
    readonly success: false;
    readonly context: StageContextData<S>;
    readonly error: StageError<S>;
};
export type { ExtensionKey, ExtensionOverrides, DvsScriptConfig, DvsConfigApi } from './contracts';
export type MaybePromise<T> = T | Promise<T>;
export type Dependency = ExtensionKey | {
    readonly type: 'strong' | 'weak';
    readonly key: ExtensionKey;
};
export type ExtensionDependencies = Partial<Record<StageName, readonly Dependency[]>>;
export interface ExtensionDefinition {
    readonly key: ExtensionKey;
    readonly default_config?: Readonly<Record<string, unknown>>;
    readonly controller?: ExtensionControllerDefinition;
    readonly display?: ExtensionDisplay;
}
export interface ExtensionControllerDefinition {
    readonly dependencies?: ExtensionDependencies;
    readonly allowFailure?: boolean | readonly PluginStep[];
    summarize?(type: CapsuleKind, data: ReadonlyJsonValue): JsonValue | undefined;
    new (helper: ExtensionHelper): Extension;
}
export interface Extension {
    readonly helper: ExtensionHelper;
    collectPre?(ctx: StageContext<'collect'>): MaybePromise<void>;
    collectPost?(ctx: StageContext<'collect'>, task: UserTaskAvailability): MaybePromise<void>;
    userReqPre?(ctx: StageContext<'userReq'>, request: ModelRequestDraft): MaybePromise<void>;
    userRespPost?(ctx: StageContext<'userResp'>, data: unknown): MaybePromise<void>;
    aiReqPre?(ctx: StageContext<'aiReq'>, request: ModelRequestDraft): MaybePromise<void>;
    aiRespPost?(ctx: StageContext<'aiResp'>, data: unknown): MaybePromise<void>;
}
export interface DvsRegistrationApi {
    register(options: DvsRegistration, lifetime?: DvsRegisterOptions): Promise<() => void>;
}
export interface LorebookEntry {
    book: string;
    uid: number;
    name: string;
    content: string;
    enabled: boolean;
    order: number;
    promptPrepared?: boolean;
}
export type MessageCapsules = Readonly<Partial<Record<ExtensionKey, CapsuleData>>>;
export interface MessageSource {
    readonly floorid: number;
    readonly swipeid: number;
    readonly content: string;
}
export interface UserMessage extends MessageSource {
    readonly capsule: MessageCapsules;
}
export interface AiMessage extends MessageSource {
    readonly capsule: MessageCapsules;
    readonly versionid?: string;
}
export interface PreviousMessage extends MessageSource {
    readonly versionid?: string;
}
export interface HistoryMessage extends MessageSource {
    readonly role: 'user' | 'assistant';
}
export interface StageContextData<S extends StageName = StageName> {
    readonly user?: UserMessage;
    readonly ai?: AiMessage;
    readonly prev?: PreviousMessage;
    readonly history?: readonly HistoryMessage[];
    readonly curr: {
        readonly user?: UserMessage;
        readonly ai?: AiMessage;
    };
    readonly versionid?: string;
    readonly rawLorebook?: readonly Readonly<LorebookEntry>[];
    lorebook?: LorebookEntry[];
    readonly payload: StagePayload<S>;
    readonly narrativePrompt: NarrativePrompt;
    readonly helper: StageHelper;
}
export interface StageContext<S extends StageName, C = unknown> extends StageContextData<S> {
    readonly config: Readonly<C>;
    getCapsule(): CapsuleData | undefined;
    setCapsule(value: CapsuleData): void;
    setEjs(name: string, value: unknown): void;
}
export type ExtensionResults = Record<ExtensionKey, unknown>;
export interface LorebookIdentity {
    book: string;
    uid: number;
}
export interface LorebookOptimizePayload {
    filterRules: LorebookEntry[];
    skipEntries: LorebookIdentity[];
}
export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T : T extends object ? {
    readonly [K in keyof T]: DeepReadonly<T[K]>;
} : T;
export type ReadonlySqlInputValue = ReadonlyJsonValue | Readonly<Uint8Array>;
export type ReadonlyTables = Readonly<Record<string, readonly Readonly<Record<string, ReadonlySqlInputValue>>[]>>;
export type SourceTablesPayload = {
    state: DvsUpdateSourceState;
    tables: DvsTables | DvsPromptTables;
    readonly rawTables: ReadonlyTables;
    readonly uniqueKeys: Readonly<Record<string, readonly string[]>>;
    filterGroups: TableFilterGroup[];
};
export interface TableFilterGroup {
    table: string;
    key: string;
    condition: string;
}
export type CommittedTablesPayload = Omit<SourceTablesPayload, 'state' | 'tables'> & {
    state: DvsState;
    tables: DvsTables;
};
export type TablesPayload<S extends StageName> = S extends 'aiResp' ? SourceTablesPayload | CommittedTablesPayload : SourceTablesPayload;
export interface StagePayload<S extends StageName = StageName> {
    tables?: TablesPayload<S>;
    lb_opt?: LorebookOptimizePayload;
    tables_opt?: TablesOptimizePayload;
}
export type TableBusinessKey = Record<string, string | number | null>;
export type TablesOptimizePayload = Record<string, Record<string, TableBusinessKey[]>>;
export interface NarrativePromptPart {
    order?: number;
    instruct?: string;
    cot?: string;
    data?: unknown;
    insist?: string;
}
export interface NarrativePrompt {
    afterUserInput: Partial<Record<ExtensionKey, NarrativePromptPart>>;
}
export interface ModelTask {
    order?: number;
    instruct: string;
    cot?: string;
    insist?: string;
    example: {
        data: unknown;
    };
    schema: JSONSchema7;
}
export interface ModelRequestDraft {
    data?: string;
    task?: ModelTask;
}
export type RequestStage = 'userReq' | 'aiReq';
export type TaskMap = Partial<Record<ExtensionKey, ModelTask>>;
export type CapsuleData = JsonValue;
export type ReadonlyJsonValue = null | string | number | boolean | readonly ReadonlyJsonValue[] | {
    readonly [key: string]: ReadonlyJsonValue;
};
export type CapsuleRecords = Partial<Record<ExtensionKey, CapsuleData>>;
export interface UserTaskAvailability {
    required: boolean;
    reusable: boolean;
    reuseError?: unknown;
}
export interface StageExchange {
    readonly userTasks: Record<ExtensionKey, UserTaskAvailability>;
    readonly tasks: Record<RequestStage, TaskMap>;
    readonly data: Record<RequestStage, Partial<Record<ExtensionKey, string>>>;
    modelData?: Readonly<Record<ExtensionKey, unknown>>;
    readonly capsules: {
        user: CapsuleRecords;
        ai: CapsuleRecords;
    };
    readonly ejs: Record<string, unknown>;
}
export interface PreparedModelRequest {
    readonly tasks: TaskMap;
    readonly messages: readonly ModelMessage[];
    readonly schema: JSONSchema7;
    readonly snapshot: RequestSnapshot;
}
export interface TurnRuntime {
    readonly config: DvsScriptConfig;
    userSkipped: boolean;
    user?: UserMessage;
    ai?: AiMessage;
    prev?: PreviousMessage;
    history?: readonly HistoryMessage[];
    curr: {
        user?: UserMessage;
        ai?: AiMessage;
    };
    versionid?: string;
    narrativeScan?: readonly Readonly<LorebookEntry>[];
    variableScan?: readonly Readonly<LorebookEntry>[];
    lorebook?: LorebookEntry[];
    readonly payload: StagePayload;
    readonly narrativePrompt: NarrativePrompt;
    readonly exchange: StageExchange;
    readonly prepared: Partial<Record<RequestStage, PreparedModelRequest>>;
    readonly capsuleBase: Partial<Record<RequestStage, CapsuleRecords>>;
}
export interface ExtensionHelper {
    readonly sqlite: PublicDatabaseApi;
    readonly lorebook: WorldbookReader;
}
export interface StageHelper {
    readonly char: BusinessDatabaseHandle;
    readonly chat: BusinessDatabaseHandle;
    readonly sql: DvsHelperPort;
    readonly registration: Readonly<DvsRegistration>;
    readonly signal: AbortSignal;
    assertCurrent(): void;
    readLorebook(): Promise<LorebookEntry[]>;
}
export interface TurnPreparation {
    prepareNarrativeTables(entries: readonly Readonly<LorebookEntry>[]): void;
    applyNarrativeTables(skipped?: boolean): void;
    prepareUserPrompt(): Promise<void>;
    scanVariableLorebook(): Promise<readonly Readonly<LorebookEntry>[]>;
    injectEjs(environment: Record<string, unknown>): void;
    cleanupOrphans(readReferences: () => readonly string[]): Promise<void>;
}
export interface DvsNarrative {
    rows(table: string, key: string): DvsPromptValues[];
}
export type PlotPlanCapsule = {
    本轮方向: JsonValue;
    情节步骤: JsonValue;
    事实与边界: JsonValue;
    结束位置: JsonValue;
    [name: string]: JsonValue;
};
export interface TablesOptimizeCapsule {
    filters: TablesOptimizePayload;
}
export interface LorebookOptimizeCapsule {
    excludedEntries: Array<{
        lorebook: string;
        uid: number;
        name: string;
    }>;
}
export type TablesCapsule = VariablePatch;
export type LorebookRequest = 'narrative' | 'user' | 'ai';
export interface LorebookTags {
    metadata?: 'ddl' | 'init' | 'version';
    stages: readonly LorebookRequest[];
    user?: 'filterable' | 'filter_rules' | 'lorebook_filter_rules' | 'table_filter_rules' | 'plot';
    ai?: 'rules' | 'data' | 'cot';
}
export interface LorebookOptimizeConfig {
    llm_filter: boolean;
    filter_mode?: 'include' | 'exclude';
}
export type CapsuleKind = 'user' | 'ai';
export type CapsuleSummaries = Partial<Record<ExtensionKey, JsonValue>>;
export interface CapsuleDocument {
    records: CapsuleRecords;
    analyses?: CapsuleAnalysis[];
}
export interface CapsuleAnalysis {
    extensions: ExtensionKey[];
    content: string | JsonValue[];
}
export interface ReadonlyCapsuleAnalysis {
    readonly extensions: readonly ExtensionKey[];
    readonly content: string | readonly ReadonlyJsonValue[];
}
export interface DisplayTarget {
    readonly key: string;
    readonly chatId: string;
    readonly floorid: number;
    readonly swipeid: number;
    readonly type: CapsuleKind;
}
export interface DisplayDetail<Prepared = unknown> {
    readonly record: ReadonlyJsonValue | undefined;
    readonly analyses: readonly ReadonlyCapsuleAnalysis[];
    readonly prepared: Prepared | undefined;
}
export interface DisplaySharedState<State extends object = Record<string, unknown>, Prepared = unknown> {
    readonly open: Readonly<Ref<boolean>>;
    readonly summary: Readonly<ShallowRef<ReadonlyJsonValue | undefined>>;
    readonly detail: Readonly<ShallowRef<DisplayDetail<Prepared> | undefined>>;
    readonly state: Partial<State>;
}
export interface DisplayRuntime {
    readonly registered: boolean;
    readonly busy: boolean;
    readonly busyReason?: string;
    readonly pending: boolean;
    readonly error?: string;
    readonly cancelled?: string;
    readonly canReroll: boolean;
    readonly canClearUser: boolean;
    readonly blockedReason?: string;
}
export type DisplayLoadState = {
    readonly status: 'unloaded' | 'loading' | 'ready';
} | {
    readonly status: 'error';
    readonly error: unknown;
};
export interface DisplayDatabases {
    readonly char: BusinessDatabaseHandle;
    readonly chat: BusinessDatabaseHandle;
    readonly sql: DvsHelperPort;
}
export interface DisplayHelper {
    preNarrativeComponent?(key: string): DvsPreNarrativeComponent | undefined;
    preNarrativeButtonText?(key: string): string | undefined;
    getCapsule(key: ExtensionKey): ReadonlyJsonValue | undefined;
    openDatabases(): Promise<DisplayDatabases>;
    readFloorData(): Promise<DvsFloorData>;
    readLorebook(): Promise<readonly Readonly<LorebookEntry>[]>;
    readonly lorebook: WorldbookReader;
    assertCurrent(): void;
}
export interface DisplayActions {
    reroll(): Promise<void>;
    clearUser(): Promise<void>;
    reopenPreNarrative(): Promise<void>;
}
export interface DisplayContext<State extends object = Record<string, unknown>, Prepared = unknown> extends DisplaySharedState<State, Prepared> {
    readonly key: ExtensionKey;
    readonly target: DisplayTarget;
    readonly config: Readonly<Record<string, unknown>>;
    readonly versionid: Readonly<Ref<string | undefined>>;
    readonly runtime: Readonly<ShallowRef<DisplayRuntime>>;
    readonly load: Readonly<ShallowRef<DisplayLoadState>>;
    readonly helper: DisplayHelper;
    readonly actions: DisplayActions;
    readonly signal: AbortSignal;
}
export interface DisplayPrepareInput {
    readonly ctx: DisplayContext;
    readonly record: ReadonlyJsonValue | undefined;
    readonly analyses: readonly ReadonlyCapsuleAnalysis[];
    readonly signal: AbortSignal;
}
export interface DisplayProps<State extends object = Record<string, unknown>, Prepared = unknown> {
    readonly ctx: DisplayContext<State, Prepared>;
}
export type VueComponent = Component;
export interface ExtensionCapsuleDisplay {
    component: VueComponent;
    button?: VueComponent;
    summary?: VueComponent;
}
export interface ExtensionDisplay {
    prepare?(input: DisplayPrepareInput): MaybePromise<unknown>;
    user?: ExtensionCapsuleDisplay;
    ai?: ExtensionCapsuleDisplay;
}
export type NonGenerationApi = Pick<DvsApi, 'getState' | 'onRegistrationChange' | 'onUpdate' | 'getUpdateStatus' | 'onUpdateStatus' | 'regen' | 'reInject' | 'table' | 'lorebookVersionCheck'>;
export interface TablesReadContext extends DisplayDatabases {
    readonly target: DisplayTarget;
    readonly versionid?: string;
    readonly registration: Readonly<DvsRegistration>;
    readonly schemas: Readonly<Record<string, TableSchema>>;
    readonly signal: AbortSignal;
    assertCurrent(): void;
}
export interface TablesQueryFunctions {
    openState(input: TablesReadContext): Promise<DvsState>;
    openPromptState(input: TablesReadContext): Promise<DvsPromptState>;
    openFloorData(input: {
        current: TablesReadContext;
        before?: TablesReadContext;
        swipeCount: number;
    }): Promise<DvsFloorData>;
}
export interface NonGenerationController {
    prepareTables(target: DisplayTarget, signal: AbortSignal): Promise<TablesReadContext>;
    getState(target: DisplayTarget, signal: AbortSignal): Promise<DvsState>;
    getPromptState(target: DisplayTarget, signal: AbortSignal): Promise<DvsPromptState>;
    readFloorData(target: DisplayTarget, signal: AbortSignal): Promise<DvsFloorData>;
    reroll(target: DisplayTarget): Promise<void>;
    clearUser(target: DisplayTarget): Promise<void>;
    reopenPreNarrative(target: DisplayTarget): Promise<void>;
}
