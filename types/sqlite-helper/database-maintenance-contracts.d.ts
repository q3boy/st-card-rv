import type { ServiceErrorData } from './core/errors';
import type { ScopedRepairPlan } from './scoped-database-repair-rules';
import type { ManagementRepairObservation, ScanFileBytes, ScanRecord } from './scan-contracts';
import type { TavernDiscoveryResult } from './scan-discovery-contracts';
export type DatabaseMaintenanceTarget = {
    scope: 'global';
} | {
    scope: 'char';
    charDbId: string;
} | {
    scope: 'chat';
    charDbId: string;
    chatDbId: string;
};
export interface MaintenanceReason {
    code: string;
    object?: string;
}
export interface MaintenancePlan {
    kind: 'none' | 'repair' | 'reset' | 'reconstruct' | 'blocked';
    evidence: string;
    target: DatabaseMaintenanceTarget;
    relativePath: string;
    /** Every known shared reference affected by this operation, including recovered global coordinates. */
    records: ScanRecord[];
    reasons: MaintenanceReason[];
    /** Concrete content the operation cannot preserve. Empty means no known loss. */
    loss: string[];
    file: 'present' | 'missing' | 'unknown';
    scopedRepair?: ScopedRepairPlan;
    diagnostics?: Array<{
        object: string;
        error: ServiceErrorData;
    }>;
}
export interface DatabaseMaintenanceEvidence {
    discovery?: TavernDiscoveryResult;
    observations?: ManagementRepairObservation[];
}
export type DatabaseMaintenanceRequest = DatabaseMaintenanceEvidence & {
    phase: 'prepare' | 'apply';
    expected: MaintenancePlan;
    backupDigest?: string;
};
export type DatabaseMaintenanceResult = {
    status: 'prepared';
    plan: MaintenancePlan;
    file?: ScanFileBytes;
    digest?: string;
} | {
    status: 'repaired' | 'reset' | 'skipped' | 'blocked' | 'partial';
    plan: MaintenancePlan;
    requiresRescan: true;
    message?: string;
};
/** Explicitly starts a new association while preserving every old database file. */
export interface IdentityRestartPlan {
    kind: 'restart' | 'blocked';
    scope: 'chat' | 'role';
    avatar: string;
    file?: string;
    evidence: string;
    expectedRole: ScanRecord | null;
    expectedChats: ScanRecord[];
    newCharDbId?: string;
    chats: Array<{
        file: string;
        chatDbId: string;
    }>;
    preservedFiles: string[];
    reasons: MaintenanceReason[];
    loss: string[];
    observations?: ManagementRepairObservation[];
    discovery?: TavernDiscoveryResult;
    chatFiles?: string[];
}
export interface IdentityRestartEvidence extends DatabaseMaintenanceEvidence {
    chatFiles?: string[];
}
export type IdentityRestartRequest = IdentityRestartEvidence & ({
    phase: 'inspect';
    scope: 'chat' | 'role';
    avatar: string;
    file?: string;
} | {
    phase: 'check';
    expected: IdentityRestartPlan;
} | {
    phase: 'apply';
    expected: IdentityRestartPlan;
    confirmedChats: Array<{
        file: string;
        chatDbId: string;
    }>;
});
export interface IdentityRestartResult {
    status: 'planned' | 'checked' | 'restarted' | 'skipped' | 'blocked' | 'partial';
    plan: IdentityRestartPlan;
    requiresRescan?: true;
    message?: string;
}
