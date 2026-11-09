import type { JSONSchema7 } from '../../../vendor/json-schema';
import type { JsonValue } from '../../../core/binds';
export interface DvsPreNarrativeModelRequest {
    messages: readonly {
        role: 'system' | 'user' | 'assistant';
        content: string;
    }[];
    outputFormat?: 'text' | 'json_object' | 'json_schema';
    schema?: JSONSchema7;
}
export interface DvsPreNarrativePrompt {
    userInput(): string;
    prevNarrative(): string;
    historyNarrative(count: number): string;
    plotPlan(): string;
    expand(text: string): string;
}
export interface DvsPreNarrativeWorldbookEntry {
    book: string;
    uid: number;
    name: string;
    content: string;
    enabled: boolean;
    order: number;
}
export interface DvsPreNarrativeWorldbook {
    getEntries(names: readonly string[]): Promise<DvsPreNarrativeWorldbookEntry[]>;
}
export interface DvsPreNarrativeContext {
    userInput: string;
    plotPlan: JsonValue | null;
    result?: JsonValue;
    prompt: DvsPreNarrativePrompt;
    worldbook: DvsPreNarrativeWorldbook;
    requestModel(request: DvsPreNarrativeModelRequest): Promise<{
        content: string;
        finishReason: string | null;
    }>;
    complete(result: JsonValue): void;
    cancel(): void;
    signal: AbortSignal;
}
export interface DvsPreNarrativeComponent {
    mount(container: HTMLElement, context: DvsPreNarrativeContext): () => void;
    mountResult(container: HTMLElement, result: JsonValue): () => void;
    toPrompt(result: JsonValue): string | Promise<string>;
}
export interface DvsPreNarrativeRegistration {
    key: string;
    buttonText?: string;
    insist?: string;
    condition: string;
    narrativeEntriesSkip?: readonly string[];
    component: DvsPreNarrativeComponent;
}
export type PreNarrativeUiRecord = {
    key: null;
} | {
    key: string;
} | {
    key: string;
    result: JsonValue;
};
export declare function isPreNarrativeUiRecord(input: unknown): input is PreNarrativeUiRecord;
