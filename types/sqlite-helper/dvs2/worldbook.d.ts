export interface WorldbookEntry {
    book: string;
    uid: number;
    name: string;
    content: string;
    enabled: boolean;
    order: number;
    promptPrepared?: boolean;
}
export interface WorldbookReader {
    getCharWorldbookNames(avatar: string): {
        primary: string | null;
        additional: string[];
    };
    getWorldbook(book: string): Promise<Array<{
        uid: number;
        name: string;
        content: string;
        enabled: boolean;
        position: {
            order: number;
        };
    }>>;
}
export declare function worldbookEntryName(name: string): string;
export declare function allowsWorldbookStage(name: string, stage: 'narrative' | 'variable'): boolean;
export declare function isInputInjectCandidate(name: string): boolean;
export declare function sortWorldbookEntries(entries: readonly WorldbookEntry[]): WorldbookEntry[];
export declare function readWorldbooks(reader: WorldbookReader, avatar: string, assertCurrent: () => void): Promise<WorldbookEntry[]>;
