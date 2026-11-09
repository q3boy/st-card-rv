import type { LorebookEntry } from '../../types';
export type WorldbookEntry = LorebookEntry;
export interface MigrationEntry extends LorebookEntry {
    version: string;
}
export declare function strictVersion(version: string): string;
export declare function migrations(entries: readonly LorebookEntry[], current: string | null): MigrationEntry[];
export declare function initializationEntry(entries: readonly LorebookEntry[], welcomeId: number): LorebookEntry[];
