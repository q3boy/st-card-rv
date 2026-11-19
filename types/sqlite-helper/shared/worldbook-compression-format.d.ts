export declare const BROTLI_HEADER = "DVS-BROTLI-BASE64";
export declare const U20_HEADER = "DVS-BROTLI-U20";
export declare function isCompressedContent(content: unknown): content is string;
/** Tavern Helper embeds script source in an HTML module; keep the payload inert in that context too. */
export declare function commentCompressedScript(packed: string): string;
export declare function isCompressedScript(text: unknown): text is string;
export declare function uncommentCompressedScript(text: string): string;
