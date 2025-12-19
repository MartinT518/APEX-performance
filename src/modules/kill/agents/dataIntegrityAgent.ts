/**
 * Data Integrity Agent (KILL Layer)
 * 
 * Purpose: Middleware that runs BEFORE any session is persisted to session_logs.
 * Prevents "Garbage In" from triggering false Agent votes.
 * 
 * Critical Logic:
 * - High-Rev Sovereignty: If is_high_rev === true, allow HR up to max_hr_override + 5
 * - Cadence Lock Detection: Correlation > 0.95 for >5mins → SUSPECT
 * - Sensor Dropout: Delta HR > 40bpm in <3sec → flag window
 * - Clipping: Value stuck for >120 seconds → flag
 */

import { IPhenotypeProfile } from '@/types/phenotype';
import { ISessionDataPoint } from '@/types/session';
import { validateHighRevPhysiology } from '../logic/highRevFilter';
import { detectCadenceLock } from '../logic/cadenceLock';
import { detectDropouts, detectClipping } from '../logic/integrity';
import { logger } from '@/lib/logger';

export type IntegrityStatus = 'VALID' | 'SUSPECT' | 'REJECTED';

export interface SessionIntegrity {
  status: IntegrityStatus;
  confidence: number; // 0.0 - 1.0
  flags: string[];
  reason?: string;
}

export interface IDataIntegrityInput {
  sessionPoints: ISessionDataPoint[];
  phenotypeProfile: IPhenotypeProfile;
  diagnostics?: {
    highRevDiagnostics?: { flaggedIndices: number[] };
    cadenceLockDiagnostics?: { flaggedIndices: number[] };
    dropoutDiagnostics?: { flaggedIndices: number[] };
    clippingDiagnostics?: { flaggedIndices: number[] };
  };
}

/**
 * Evaluates data integrity of a session before agents execute.
 * 
 * Returns:
 * - REJECTED: >20% flagged OR critical failure (cadence lock >5min) → Block agent execution
 * - SUSPECT: 10-20% flagged → Agents can run but with reduced confidence
 * - VALID: <10% flagged → Full confidence
 */
export function evaluateDataIntegrity(input: IDataIntegrityInput): SessionIntegrity {
  const { sessionPoints, phenotypeProfile } = input;
  const flags: string[] = [];
  
  if (sessionPoints.length === 0) {
    return {
      status: 'VALID',
      confidence: 1.0,
      flags: [],
      reason: 'No session data to validate'
    };
  }

  // Run all integrity checks
  const highRevDiagnostics = validateHighRevPhysiology(sessionPoints, phenotypeProfile);
  const cadenceLockDiagnostics = detectCadenceLock(sessionPoints, phenotypeProfile);
  const dropoutDiagnostics = detectDropouts(sessionPoints);
  const clippingDiagnostics = detectClipping(sessionPoints);

  // Collect all flagged indices
  const allFlaggedIndices = new Set<number>();
  
  highRevDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));
  cadenceLockDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));
  dropoutDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));
  clippingDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));

  const totalFlagged = allFlaggedIndices.size;
  const flaggedRatio = totalFlagged / sessionPoints.length;

  // Check for critical failures
  const cadenceLockDuration = cadenceLockDiagnostics.flaggedIndices.length;
  const cadenceLockMinutes = cadenceLockDuration / 60; // Assuming 1Hz data
  
  // Critical failure: Cadence lock >5 minutes
  if (cadenceLockMinutes > 5) {
    flags.push(`Critical: Cadence lock detected for ${cadenceLockMinutes.toFixed(1)} minutes`);
    return {
      status: 'REJECTED',
      confidence: 0.0,
      flags,
      reason: `Critical data integrity failure: Cadence lock >5 minutes (${cadenceLockMinutes.toFixed(1)}min)`
    };
  }

  // High-Rev Sovereignty Check
  // CRITICAL: If user is high-rev, allow HR up to max_hr_override + 5
  // Don't flag high HR for high-rev users (e.g., 185bpm marathon HR is VALID)
  if (phenotypeProfile.is_high_rev) {
    const maxHROverride = phenotypeProfile.config.max_hr_override;
    if (maxHROverride) {
      const highRevCeiling = maxHROverride + 5;
      // Remove any flags that were incorrectly set for high-rev users
      // The highRevDiagnostics should have already handled this, but we verify here
      const highRevPoints = sessionPoints.filter(p => 
        p.heartRate && p.heartRate > highRevCeiling
      );
      
      if (highRevPoints.length > 0) {
        // These points exceed even the high-rev ceiling - flag them
        flags.push(`High-Rev: HR exceeded ${highRevCeiling}bpm (max_hr_override + 5) in ${highRevPoints.length} points`);
      } else {
        // High-rev user within bounds - this is valid, don't add flags
        logger.info(`High-Rev user: HR within bounds (up to ${highRevCeiling}bpm)`);
      }
    }
  }

  // Aggregate flags from all checks
  if (highRevDiagnostics.status === 'SUSPECT') {
    flags.push('High-Rev filter: Excessive supra-physiological readings');
  }
  
  if (cadenceLockDiagnostics.flaggedIndices.length > 0) {
    flags.push(`Cadence lock: ${cadenceLockDiagnostics.flaggedIndices.length} points flagged`);
  }
  
  if (dropoutDiagnostics.flaggedIndices.length > 0) {
    flags.push(`Sensor dropouts: ${dropoutDiagnostics.flaggedIndices.length} points flagged`);
  }
  
  if (clippingDiagnostics.flaggedIndices.length > 0) {
    flags.push(`Sensor clipping: ${clippingDiagnostics.flaggedIndices.length} points flagged`);
  }

  // Determine status based on flagged ratio
  if (flaggedRatio > 0.2) {
    // >20% flagged → REJECTED
    return {
      status: 'REJECTED',
      confidence: 0.0,
      flags,
      reason: `Data integrity failure: ${(flaggedRatio * 100).toFixed(1)}% of data flagged (threshold: 20%)`
    };
  } else if (flaggedRatio > 0.1) {
    // 10-20% flagged → SUSPECT
    const confidence = 1.0 - (flaggedRatio - 0.1) * 5; // Decay from 1.0 to 0.5
    return {
      status: 'SUSPECT',
      confidence: Math.max(0.5, confidence),
      flags,
      reason: `Data integrity suspect: ${(flaggedRatio * 100).toFixed(1)}% of data flagged`
    };
  } else {
    // <10% flagged → VALID
    const confidence = 1.0 - flaggedRatio * 2; // Slight decay for any flags
    return {
      status: 'VALID',
      confidence: Math.max(0.9, confidence),
      flags: flags.length > 0 ? flags : [],
      reason: flags.length > 0 ? `Minor flags detected but within acceptable range` : undefined
    };
  }
}

