import { createServerClient } from '@/lib/supabase';
import type { SessionProcessingResult } from './sessionProcessor';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';
import { sanitizeErrorMessage } from '@/lib/errorSanitizer';

// Type for session_logs insert - matches database schema
interface SessionLogInsert {
  user_id: string;
  session_date: string;
  sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
  duration_minutes: number;
  source?: 'garmin_health' | 'manual_upload' | 'test_mock';
  metadata?: Database['public']['Tables']['session_logs']['Row']['metadata'] | null;
}

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

    const insertData: SessionLogInsert = {
      user_id: userId,
      session_date: sessionData.sessionDate,
      sport_type: sessionData.sportType,
      duration_minutes: sessionData.durationMinutes,
      source: sessionData.source,
      metadata: (sessionData.metadata as Database['public']['Tables']['session_logs']['Row']['metadata']) || null
    };

    // Type assertion needed due to TypeScript type inference limitation with session_logs table
    // Runtime is safe - table exists in database and RLS policies are enforced
    const supabaseClient = supabase as unknown as {
      from: (table: string) => {
        insert: (data: SessionLogInsert) => {
          select: (columns: string) => {
            single: () => Promise<{ data: { id: string } | null; error: unknown }>;
          };
        };
      };
    };

    const { data, error } = await supabaseClient
      .from('session_logs')
      .insert(insertData)
      .select('id')
      .single();

    if (error || !data) {
      if (error) {
        logger.error('Failed to persist session log', error);
        return { success: false, error: sanitizeErrorMessage(error) };
      }
      return { success: false, error: 'Failed to create session log' };
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
export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
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
  
  // Store enhanced metrics from Garmin
  if (typeof metadata.distanceKm === 'number') {
    sanitized.distanceKm = metadata.distanceKm;
  }
  if (typeof metadata.distanceInMeters === 'number') {
    sanitized.distanceInMeters = metadata.distanceInMeters;
  }
  if (metadata.avgPace) {
    sanitized.avgPace = String(metadata.avgPace).slice(0, 20);
  }
  if (typeof metadata.averagePace === 'number') {
    sanitized.averagePace = metadata.averagePace;
  }
  if (typeof metadata.avgHR === 'number') {
    sanitized.avgHR = metadata.avgHR;
  }
  if (typeof metadata.maxHR === 'number') {
    sanitized.maxHR = metadata.maxHR;
  }
  if (typeof metadata.avgRunCadence === 'number') {
    sanitized.avgRunCadence = metadata.avgRunCadence;
  }
  if (typeof metadata.calories === 'number') {
    sanitized.calories = metadata.calories;
  }
  if (typeof metadata.elevationGain === 'number') {
    sanitized.elevationGain = metadata.elevationGain;
  }
  if (metadata.trainingType) {
    sanitized.trainingType = String(metadata.trainingType).slice(0, 50);
  }
  if (typeof metadata.durationMinutes === 'number') {
    sanitized.durationMinutes = metadata.durationMinutes;
  }
  
  // Allow protocol for exercises and workout structure
  if (metadata.protocol && typeof metadata.protocol === 'object') {
    sanitized.protocol = metadata.protocol;
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
  durationMinutes: number,
  sessionDate?: string // Allow passing custom date for historical sync
): SessionLogData {
  const trainingType = (result.metadata?.trainingType as string || '').toLowerCase();
  
  // Determine sport type and source
  let sportType: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER' = 'OTHER';
  if (result.metadata?.dataSource === 'GARMIN') {
    if (trainingType.includes('run') || trainingType.includes('treadmill')) {
      sportType = 'RUNNING';
    } else if (trainingType.includes('cycle') || trainingType.includes('bike') || trainingType.includes('spinning')) {
      sportType = 'CYCLING';
    } else if (trainingType.includes('strength') || trainingType.includes('weight') || trainingType.includes('lifting') || trainingType.includes('gym')) {
      sportType = 'STRENGTH';
    } else {
      sportType = 'RUNNING'; // Default Garmin to RUNNING if unsure
    }
  }

  const source: 'garmin_health' | 'manual_upload' | 'test_mock' = 
    result.metadata?.dataSource === 'GARMIN' ? 'garmin_health' : 'test_mock';

  // Extract metrics from data points if available
  const validPoints = result.points.filter(p => p.heartRate && p.heartRate > 0);
  const avgHR = validPoints.length > 0
    ? Math.round(validPoints.reduce((sum, p) => sum + (p.heartRate || 0), 0) / validPoints.length)
    : undefined;
  
  const maxHR = validPoints.length > 0
    ? Math.max(...validPoints.map(p => p.heartRate || 0))
    : undefined;

  // Calculate distance from speed if available (Backwards compatibility or if metadata missing)
  let distanceKm: number | undefined = result.metadata?.distanceKm as number | undefined;
  if (distanceKm === undefined && result.points.length > 0 && result.points[0].speed) {
    // Sum up distance from speed * time intervals
    let totalDistance = 0;
    for (let i = 1; i < result.points.length; i++) {
      const prevPoint = result.points[i - 1];
      const currPoint = result.points[i];
      if (prevPoint.speed && currPoint.timestamp && prevPoint.timestamp) {
        const timeDiff = (currPoint.timestamp - prevPoint.timestamp) / 1000; // seconds
        totalDistance += (prevPoint.speed * timeDiff) / 1000; // convert m/s * s to km
      }
    }
    distanceKm = totalDistance > 0 ? totalDistance : undefined;
  }

  // Calculate pace from distance and duration
  let pace: string | undefined = result.metadata?.avgPace as string | undefined;
  if (!pace && distanceKm && durationMinutes > 0) {
    const paceSeconds = (durationMinutes * 60) / distanceKm;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    pace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }

  const rawMetadata = {
    dataSource: result.metadata?.dataSource || 'NONE',
    activityId: result.metadata?.activityId,
    activityName: result.metadata?.activityName,
    timestamp: result.metadata?.timestamp,
    pointCount: result.points.length,
    diagnostics: result.diagnostics,
    cadenceLockDetected: result.cadenceLockDetected || false,
    // Enhanced metrics
    distanceKm,
    avgPace: pace,
    avgHR,
    maxHR,
    durationMinutes,
    protocol: result.metadata?.protocol, // Keep protocol in metadata
    trainingType: result.metadata?.trainingType,
    calories: result.metadata?.calories,
    elevationGain: result.metadata?.elevationGain,
    avgRunCadence: result.metadata?.avgRunCadence
  };

  return {
    sessionDate: sessionDate || new Date().toISOString().split('T')[0],
    sportType,
    durationMinutes,
    source,
    metadata: sanitizeMetadata(rawMetadata)
  };
}

