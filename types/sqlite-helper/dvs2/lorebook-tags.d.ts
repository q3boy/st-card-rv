import type { LorebookTags } from './types';
export declare function parseLorebookTags(name: string): LorebookTags;
export declare function parseMetadataSuffix(name: string): string | undefined;
export declare function isUserRule(tags: LorebookTags): boolean;
