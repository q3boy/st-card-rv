/**
 * Storage directory layout of the database files. Imports nothing, so the page and the Worker share it.
 *
 * ```text
 * global.sqlite
 * characters/<charDbId>/char.sqlite
 * characters/<charDbId>/chats/<chatDbId>.sqlite
 * ```
 */
export declare const GLOBAL_DATABASE = "global.sqlite";
export declare const CHARACTERS_DIRECTORY = "characters";
export declare const CHATS_DIRECTORY = "chats";
export declare const CHARACTER_DATABASE = "char.sqlite";
export declare const DATABASE_EXTENSION = ".sqlite";
/** The directories to enter in order, and the file name inside the last one. */
export interface DatabaseLocation {
    directories: string[];
    file: string;
}
/** Without a role id this is the global database; an empty chat id names the role database. */
export declare function databaseLocation(charDbId?: string, chatDbId?: string): DatabaseLocation;
/** Storage-relative path of a database file, such as `characters/<id>/chats/<chat>.sqlite`. */
export declare function databasePath(charDbId?: string, chatDbId?: string): string;
/** Where a storage-relative path sits in the layout. Ids are lower-cased and not checked further. */
export type DatabasePathPart = {
    kind: 'global';
} | {
    kind: 'characters';
} | {
    kind: 'character';
    charDbId: string;
} | {
    kind: 'chats';
    charDbId: string;
} | {
    kind: 'char';
    charDbId: string;
} | {
    kind: 'chat';
    charDbId: string;
    chatDbId: string;
};
/**
 * Fixed names are compared without case, because a case-insensitive file system (Windows) resolves a
 * differently cased name to the same entry. Callers judge the returned ids themselves.
 */
export declare function parseDatabasePath(relativePath: string, entry: 'file' | 'directory'): DatabasePathPart | undefined;
/**
 * Chrome writes through `<name>.crswap` / `<name>.<n>.crswap` siblings before replacing the target file.
 * These browser temporary files are never listed, removed or read.
 */
export declare const isTemporaryFileName: (name: string) => boolean;
/**
 * Validates a storage-relative path and returns its segments, or an error message.
 * Both purposes reject empty, `.`/`..` and separator-containing segments and temporary files;
 * removal additionally refuses `global.sqlite` and the `characters` directory itself.
 */
export declare function checkRelativePath(relativePath: unknown, purpose: 'read' | 'remove'): string[] | string;
