/** Pure scan evidence DTOs shared by the page and Worker, with no Tavern or browser client dependency. */
export type ChatIdentityRaw = {
    present: false;
} | {
    present: true;
    value: unknown;
};
export interface TavernDiscoveryCandidate {
    parent: string;
    chatId: string;
}
export interface TavernDiscoveryMatch {
    avatar: string;
    file: string;
    parent: string;
    chatId: string;
    observedId: string;
    observedRaw: ChatIdentityRaw;
    localRaw?: ChatIdentityRaw;
    rolePresent?: boolean;
}
export interface TavernDiscoveryResult {
    matches: TavernDiscoveryMatch[];
    complete: boolean;
    issues: string[];
}
