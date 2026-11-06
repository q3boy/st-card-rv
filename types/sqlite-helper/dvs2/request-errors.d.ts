import type { RequestSnapshot } from './config';
export interface DvsRequestErrorContext {
    character?: string;
    chat?: string;
    messageId?: number;
}
export interface ModelRequestTrace {
    request?: unknown;
    response: {
        status?: number;
        statusText?: string;
        body?: string;
        finishReason?: string | null;
    };
}
export interface DvsRequestErrorRecord {
    id: number;
    time: string;
    purpose: 'input_inject' | 'variable';
    attempt: number;
    stage: string;
    reason: string;
    context?: DvsRequestErrorContext;
    model: string;
    apiUrl: string;
    request: unknown;
    response: ModelRequestTrace['response'];
}
export declare const dvsRequestErrors: {
    getRecords(): readonly DvsRequestErrorRecord[];
    subscribe(listener: () => void): () => void;
    clear(): void;
};
export declare function createRequestErrorCapture(snapshot: RequestSnapshot, purpose: DvsRequestErrorRecord['purpose'], attempt: number, context?: DvsRequestErrorContext): {
    trace: ModelRequestTrace;
    record(error: unknown, stage: string): void;
};
