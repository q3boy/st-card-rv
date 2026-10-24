import type { Database } from '../vendor/sqljs';
import { type ViewerRequest } from '../viewer-contracts';
export declare function readViewer(db: Database, request: Exclude<ViewerRequest, {
    operation: 'file' | 'tables';
}> | {
    operation: 'tables';
}): unknown;
