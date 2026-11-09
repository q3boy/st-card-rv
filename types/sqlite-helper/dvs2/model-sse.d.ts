/** 单次模型 POST 回复的 SSE 分帧；不管理连接、重试或模型 JSON。 */
export declare class ModelSseParser {
    private line;
    private skipLf;
    private data;
    hasData: boolean;
    push(text: string): string[];
    private readLine;
    get incomplete(): boolean;
}
