import type { QueryResult, MutationResult } from '../../../core/database';
import { type SqlBinds } from '../../../core/binds';
import type { DatabasePort } from '../../../sdk/contracts';
import type { CheckedCommand } from '../../../protocol';
export interface DvsHelperPort {
    query(sql: string, binds?: SqlBinds): Promise<QueryResult>;
    checkedTransaction(commands: CheckedCommand[]): Promise<MutationResult>;
}
export declare function createHelperPort(port: DatabasePort): DvsHelperPort;
