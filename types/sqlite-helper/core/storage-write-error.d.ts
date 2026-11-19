/** Storage knows whether failure happened before writing or after a confirmed close. */
export declare class StorageWriteError extends Error {
    readonly fileState: 'not-saved' | 'saved';
    constructor(message: string, fileState: 'not-saved' | 'saved', options?: ErrorOptions);
}
