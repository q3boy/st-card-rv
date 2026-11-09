export type OutputFormat = 'text' | 'json_schema' | 'json_object';
export type SecretAction = {
    kind: 'keep';
} | {
    kind: 'replace';
    value: string;
} | {
    kind: 'clear';
};
export interface DvsConfig {
    apiUrl: string;
    model: string;
    outputFormat: OutputFormat;
    stream: boolean;
    maxTokens: number;
    historyCount: number;
    temperature: number;
    frequencyPenalty: number;
    presencePenalty: number;
    topP: number;
    topK: number;
    maxAttempts: number;
    retryIntervalMs: number;
    requestTimeoutSeconds: number;
    extraBody: Record<string, unknown>;
}
export declare const DEFAULT_DVS_CONFIG: DvsConfig;
export interface RequestSnapshot {
    config: DvsConfig;
    key: string;
    assertCurrent(): void | Promise<void>;
}
export declare function readModelConfig(value: Partial<DvsConfig>): DvsConfig;
