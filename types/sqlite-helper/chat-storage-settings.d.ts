export interface ChatStorageOptions {
    compressed: boolean;
    quality: number;
}
export declare const DEFAULT_CHAT_STORAGE_OPTIONS: Readonly<ChatStorageOptions>;
export declare const COMPRESSION_LEVELS: readonly [{
    readonly quality: 3;
    readonly label: '低';
}, {
    readonly quality: 4;
    readonly label: '中';
}, {
    readonly quality: 7;
    readonly label: '高';
}, {
    readonly quality: 9;
    readonly label: '超高';
}];
export type CompressionQuality = (typeof COMPRESSION_LEVELS)[number]['quality'];
export type CompressionBenchmarkInput = {
    source: 'standard';
} | {
    source: 'chat';
    bytes: Uint8Array;
};
export interface CompressionMeasurement {
    quality: CompressionQuality;
    ms: number;
    bytes: number;
}
export type CompressionBenchmarkEvent = {
    phase: 'building';
    floor: number;
} | {
    phase: 'ready';
    bytes: number;
} | {
    phase: 'cooldown';
    quality: CompressionQuality;
    seconds: number;
} | {
    phase: 'encoding';
    quality: CompressionQuality;
} | {
    phase: 'result';
    measurement: CompressionMeasurement;
} | {
    phase: 'complete';
} | {
    phase: 'error';
    message: string;
};
export declare function isChatStorageOptions(value: unknown): value is ChatStorageOptions;
