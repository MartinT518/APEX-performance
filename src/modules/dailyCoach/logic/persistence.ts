import { createServerClient } from '@/lib/supabase';
import type { SessionProcessingResult } from './sessionProcessor';
import { logger } from '@/lib/logger';
import { sanitizeErrorMessage } from '@/lib/errorSanitizer';

export interface SessionLogData {
  sessionDate: string;
  sportType: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
  durationMinutes: number;
  source: 'garmin_health' | 'manual_upload' | 'test_mock';
  metadata?: Record<string, unknown>;
}

export interface PersistenceResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Persists session log to session_logs table
 */
export async function persistSessionLog(
  sessionData: SessionLogData
): Promise<PersistenceResult> {
  try {
    const supabase = createServerClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, error: 'No authenticated user' };
    }

    const { data, error } = await supabase
      .from('session_logs')
      .insert({
        user_id: userId,
        session_date: sessionData.sessionDate,
        sport_type: sessionData.sportType,
        duration_minutes: sessionData.durationMinutes,
        source: sessionData.source,
        metadata: sessionData.metadata || null
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to persist session log', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }

    logger.info(`Session logged: ${data.id}`);
    return { success: true, sessionId: data.id };
  } catch (err) {
    logger.error('Failed to persist session log to Supabase', err);
    return { success: false, error: sanitizeErrorMessage(err) };
  }
}

/**
 * Validates and sanitizes metadata before storage
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  // Limit string lengths to prevent storage bloat
  if (metadata.dataSource) {
    sanitized.dataSource = String(metadata.dataSource).slice(0, 50);
  }
  if (metadata.activityId) {
    sanitized.activityId = String(metadata.activityId).slice(0, 100);
  }
  if (metadata.activityName) {
    sanitized.activityName = String(metadata.activityName).slice(0, 200);
  }
  if (metadata.timestamp) {
    sanitized.timestamp = String(metadata.timestamp).slice(0, 50);
  }
  if (typeof metadata.pointCount === 'number') {
    sanitized.pointCount = metadata.pointCount;
  }
  
  // Only store essential diagnostics fields
  if (metadata.diagnostics && typeof metadata.diagnostics === 'object') {
    const diag = metadata.diagnostics as Record<string, unknown>;
    sanitized.diagnostics = {
      status: String(diag.status || '').slice(0, 20),
      validPointCount: typeof diag.validPointCount === 'number' ? diag.validPointCount : 0,
      originalPointCount: typeof diag.originalPointCount === 'number' ? diag.originalPointCount : 0
    };
  }
  
  return sanitized;
}

/**
 * Converts SessionProcessingResult to SessionLogData
 */
export function sessionResultToLogData(
  result: SessionProcessingResult,
  durationMinutes: number
): SessionLogData {
  const sportType: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER' = 
    result.metadata?.dataSource === 'GARMIN' ? 'RUNNING' : 'OTHER';
  
  const source: 'garmin_health' | 'manual_upload' | 'test_mock' = 
    result.metadata?.dataSource === 'GARMIN' ? 'garmin_health' : 'test_mock';

  const rawMetadata = {
    dataSource: result.metadata?.dataSource || 'NONE',
    activityId: result.metadata?.activityId,
    activityName: result.metadata?.activityName,
    timestamp: result.metadata?.timestamp,
    pointCount: result.points.length,
    diagnostics: result.diagnostics
  };

  return {
    sessionDate: new Date().toISOString().split('T')[0],
    sportType,
    durationMinutes,
    source,
    metadata: sanitizeMetadata(rawMetadata)
  };
}

