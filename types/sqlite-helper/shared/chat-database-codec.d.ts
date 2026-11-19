export declare class ChatDatabaseDecodeError extends Error {
}
export declare const isSQLiteDatabase: (bytes: Uint8Array) => boolean;
export declare function createChatDatabaseCodec(module: WebAssembly.Module): (bytes: Uint8Array, encode: boolean, quality?: number) => Uint8Array;
export declare function loadCodecModule(): Promise<WebAssembly.Module>;
export declare function decodeChatDatabase(bytes: Uint8Array): Promise<Uint8Array>;
export declare function encodeChatDatabase(bytes: Uint8Array, quality?: number): Promise<Uint8Array>;
