import type { LorebookTags } from '../types';
/** Old names are interpreted together so FILTER_SKIP never changes narrative/AI scope. */
export declare function parseLegacyLorebookTags(name: string): LorebookTags;
export declare function legacyMetadataSuffix(name: string): string | undefined;
