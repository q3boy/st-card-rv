/** Internal viewer transport, deliberately excluded from the public business API. */
export declare const VIEWER_LIMITS: Readonly<{
    rows: 20000;
    columns: 200;
    resultBytes: number;
    detailCharacters: 1048576;
    previewCharacters: 100;
}>;
/** Display filtering only; ordinary system tables remain available to the read-only transport. */
export declare function isViewerSystemTable(name: string): boolean;
export type ViewerRequest = {
    operation: 'tables';
} | {
    operation: 'file';
} | {
    operation: 'table' | 'ddl';
    table: string;
} | {
    operation: 'detail';
    table: string;
    column: string;
    key: ViewerKey;
};
export interface ViewerKey {
    columns: string[];
    values: (string | number)[];
}
export type ViewerCell = {
    type: 'null';
} | {
    type: 'integer' | 'real';
    value: number;
} | {
    type: 'text';
    value: string;
    truncated: boolean;
} | {
    type: 'blob';
    bytes: number;
};
export interface ViewerColumn {
    name: string;
    declaredType: string;
    primaryKeyOrder: number;
    sortable: boolean;
}
export interface ViewerTable {
    table: string;
    columns: ViewerColumn[];
    rows: {
        cells: ViewerCell[];
        key?: ViewerKey;
    }[];
    keyColumns: string[];
    initialSortColumns: string[];
}
export interface ViewerDetail {
    found: boolean;
    type?: 'text' | 'null' | 'integer' | 'real' | 'blob';
    text?: string;
    truncated?: boolean;
}
export interface ViewerFile {
    directoryName: string;
    name: string;
    relativePath: string;
    size: number;
    lastModified: number;
}
