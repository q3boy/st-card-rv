import type { DvsConfig, RequestSnapshot } from './config';
import type { DvsRequestErrorContext, ModelRequestTrace } from './request-errors';
export interface ModelMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ModelResponse {
    content: string;
    finishReason: string | null;
}
export interface RequestOptions {
    getRequestHeaders?: () => Record<string, string>;
    fetch?: typeof fetch;
    purpose?: 'update' | 'test';
    protocol?: {
        name: string;
        schema: Record<string, unknown>;
    };
    errorContext?: DvsRequestErrorContext;
    trace?: ModelRequestTrace;
}
export type ModelErrorKind = 'network' | 'timeout' | 'cancelled' | 'http' | 'service' | 'response' | 'stale';
export declare class ModelRequestError extends Error {
    readonly kind: ModelErrorKind;
    readonly status?: number | undefined;
    readonly statusText?: string | undefined;
    constructor(kind: ModelErrorKind, message: string, status?: number | undefined, statusText?: string | undefined);
}
export declare function redactModelError(message: string, key: string): string;
export declare function buildModelBody(config: DvsConfig, key: string, messages: readonly ModelMessage[], protocol?: RequestOptions['protocol']): Record<string, unknown>;
export declare function listModels(snapshot: RequestSnapshot, signal?: AbortSignal, options?: RequestOptions): Promise<string[]>;
export declare function requestModel(snapshot: RequestSnapshot, messages: readonly ModelMessage[], signal?: AbortSignal, options?: RequestOptions): Promise<ModelResponse>;
