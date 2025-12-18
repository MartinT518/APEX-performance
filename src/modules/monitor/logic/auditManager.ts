import { useMonitorStore } from '../monitorStore';
import { usePhenotypeStore } from '../phenotypeStore';

/**
 * FR-M2 & FR-M3: Audit Manager
 * 
 * Logic to trigger "Active Audits" based on context.
 */

interface IAuditCheckResult {
    requiresAudit: boolean;
    auditType: 'STRENGTH' | 'FUELING' | 'NONE';
    message?: string;
}

export const checkAuditNecessity = (
    lastRunDurationMinutes: number = 0
): IAuditCheckResult => {
    const monitorState = useMonitorStore.getState();
    const phenotypeState = usePhenotypeStore.getState();

    // 1. CHASSIS CHECK (Strength)
    // Requirement: Daily prompt if no data found.
    // We check if we have a log for today.
    // NOTE: This is informational only - doesn't block analysis, but affects agent votes
    // The strength session will default to "not performed" if not logged, which triggers Agent A AMBER
    // if (!monitorState.todayEntries.strengthSession) {
    //     return {
    //         requiresAudit: true,
    //         auditType: 'STRENGTH',
    //         message: "Missing Chassis Data: Did you lift today?"
    //     };
    // }

    // 2. FUELING AUDIT
    // Requirement: Trigger on runs > 90 mins
    if (lastRunDurationMinutes > 90) {
        if (!monitorState.todayEntries.fuelingLog) {
            return {
                requiresAudit: true,
                auditType: 'FUELING',
                message: "Long Run Detected: Fueling Audit Required."
            };
        }
    }

    return {
        requiresAudit: false,
        auditType: 'NONE'
    };
};
