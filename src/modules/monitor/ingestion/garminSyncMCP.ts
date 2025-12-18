/**
 * Garmin Sync using MCP Server's Python Client
 * 
 * This module uses the MCP server's Python client via subprocess to:
 * - Use OAuth token persistence (~/.garminconnect/)
 * - Use efficient get_activities_by_date() method
 * - Avoid rate limiting from repeated authentication
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { sessionResultToLogData } from '@/modules/dailyCoach/logic/persistence';
import type { SessionProcessingResult } from '@/modules/dailyCoach/logic/sessionProcessor';

import { adaptGarminToSessionStream } from './garminAdapter';
import path from 'path';

/**
 * Format pace from seconds per km to MM:SS/km format
 */
function formatPaceFromSeconds(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

const execAsync = promisify(exec);

interface MCPActivity {
  activityId: number;
  activityName: string;
  activityType: string;
  startTimeGMT: string;
  startTimeLocal: string;
  endTimeLocal?: string; // May be available
  durationInSeconds?: number; // May be undefined, check multiple sources
  duration?: number; // Alternative field name
  elapsedDuration?: number; // Another alternative
  totalDuration?: number; // Another alternative
  distance?: number; // Distance in meters
  averagePace?: number; // Average pace in seconds per km
  averageHR?: number; // Average heart rate
  maxHR?: number; // Maximum heart rate
  avgRunCadence?: number; // Average running cadence
  calories?: number; // Calories burned
  elevationGain?: number; // Elevation gain in meters
  details?: unknown; // Full activity details from get_activity()
  // Formatted fields from Python response builder
  duration_formatted?: string; // HH:MM:SS format
  [key: string]: unknown; // Allow any other fields
}

interface MCPResponse {
  success: boolean;
  activities?: MCPActivity[];
  count?: number;
  error?: string;
  message?: string;
}

/**
 * Syncs Garmin activities using MCP server's Python client
 * This provides token persistence and efficient date-range queries
 */
export async function syncGarminSessionsToDatabaseMCP(
  startDate: string,
  endDate: string,
  userId: string
): Promise<{ synced: number; errors: number }> {
  try {
    const supabase = createServerClient();

    logger.info(`Syncing Garmin activities from ${startDate} to ${endDate} using MCP client`);

    // Call Python script that uses MCP client
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'sync-garmin-mcp.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const { stdout, stderr } = await execAsync(
      `${pythonCmd} "${scriptPath}" "${startDate}" "${endDate}"`,
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large responses
      }
    );

    if (stderr) {
      logger.warn('Python script stderr:', stderr);
    }

    const result: MCPResponse = JSON.parse(stdout);

    if (!result.success) {
      if (result.error === 'RATE_LIMITED') {
        logger.warn('Garmin rate limited via MCP client');
        return { synced: 0, errors: 1 };
      }
      logger.error(`MCP sync failed: ${result.message || result.error}`);
      return { synced: 0, errors: 1 };
    }

    if (!result.activities || result.activities.length === 0) {
      logger.info('No Garmin activities found in date range');
      return { synced: 0, errors: 0 };
    }

    logger.info(`Fetched ${result.activities.length} activities from Garmin via MCP`);

    let synced = 0;
    let errors = 0;

    // Process each activity
    for (let i = 0; i < result.activities.length; i++) {
      const activity = result.activities[i];
      
      try {
        // Check if session already exists
        const { data: existing } = await supabase
          .from('session_logs')
          .select('id, metadata')
          .eq('user_id', userId)
          .eq('metadata->>activityId', `${activity.activityId}`)
          .maybeSingle();

        // If session exists but metadata is incomplete, update it
        if (existing) {
          const existingMetadata = (existing as { metadata: Record<string, unknown> | null }).metadata;
          const hasEnhancedMetadata = existingMetadata && (
            existingMetadata.distanceKm !== undefined ||
            existingMetadata.avgPace !== undefined ||
            existingMetadata.avgHR !== undefined
          );
          
          if (!hasEnhancedMetadata) {
            // Update existing session with enhanced metadata
            logger.info(`Updating existing session ${activity.activityId} with enhanced metadata`);
            
            // Build enhanced metadata from activity
            const enhancedMetadata = {
              ...existingMetadata,
              distanceKm: activity.distance ? (activity.distance as number) / 1000 : existingMetadata?.distanceKm,
              distanceInMeters: activity.distance as number | undefined || existingMetadata?.distanceInMeters,
              avgPace: activity.averagePace ? formatPaceFromSeconds(activity.averagePace as number) : existingMetadata?.avgPace,
              averagePace: activity.averagePace as number | undefined || existingMetadata?.averagePace,
              avgHR: activity.averageHR as number | undefined || existingMetadata?.avgHR,
              maxHR: activity.maxHR as number | undefined || existingMetadata?.maxHR,
              avgRunCadence: activity.avgRunCadence as number | undefined || existingMetadata?.avgRunCadence,
              calories: activity.calories as number | undefined || existingMetadata?.calories,
              elevationGain: activity.elevationGain as number | undefined || existingMetadata?.elevationGain,
              trainingType: activity.activityType as string | undefined || existingMetadata?.trainingType
            };
            
            // Sanitize and update
            const { sanitizeMetadata } = await import('@/modules/dailyCoach/logic/persistence');
            const sanitized = sanitizeMetadata(enhancedMetadata);
            
            const { error: updateError } = await supabase
              .from('session_logs')
              .update({ metadata: sanitized } as never)
              .eq('id', (existing as { id: string }).id);
            
            if (updateError) {
              logger.error(`Failed to update session ${activity.activityId}`, updateError);
            } else {
              logger.info(`Updated session ${activity.activityId} with enhanced metadata`);
            }
          }
          continue; // Skip insertion, already exists (and now updated)
        }

        const activityDate = new Date(activity.startTimeLocal).toISOString().split('T')[0];
        const sportType = mapGarminSportType(activity.activityType);
        
        // Process activity details if available from Python script
        let processingResult: SessionProcessingResult;
        
        if (activity.details) {
          // Convert Garmin details to session stream
          try {
            const stream = adaptGarminToSessionStream(activity.details);
            
            processingResult = {
              points: stream.dataPoints,
              diagnostics: {
                status: 'VALID',
                validPointCount: stream.dataPoints.length,
                originalPointCount: stream.dataPoints.length,
                flaggedIndices: []
              },
              metadata: {
                dataSource: 'GARMIN',
                activityId: `${activity.activityId}`,
                activityName: activity.activityName,
                timestamp: new Date(activity.startTimeLocal).toISOString(),
                // Extract additional metrics from activity object
                distanceKm: activity.distance ? (activity.distance as number) / 1000 : undefined,
                distanceInMeters: activity.distance as number | undefined,
                avgPace: activity.averagePace ? formatPaceFromSeconds(activity.averagePace as number) : undefined,
                averagePace: activity.averagePace as number | undefined, // seconds per km
                avgHR: activity.averageHR as number | undefined,
                maxHR: activity.maxHR as number | undefined,
                avgRunCadence: activity.avgRunCadence as number | undefined,
                calories: activity.calories as number | undefined,
                elevationGain: activity.elevationGain as number | undefined,
                trainingType: activity.activityType as string | undefined
              }
            };
          } catch (streamError) {
            logger.warn(`Failed to adapt activity ${activity.activityId} to session stream`, streamError);
            // Fall through to empty points
            processingResult = {
              points: [],
              diagnostics: {
                status: 'VALID',
                validPointCount: 0,
                originalPointCount: 0,
                flaggedIndices: []
              },
              metadata: {
                dataSource: 'GARMIN',
                activityId: `${activity.activityId}`,
                activityName: activity.activityName,
                timestamp: new Date(activity.startTimeLocal).toISOString(),
                // Extract additional metrics from activity object even without data points
                distanceKm: activity.distance ? (activity.distance as number) / 1000 : undefined,
                distanceInMeters: activity.distance as number | undefined,
                avgPace: activity.averagePace ? formatPaceFromSeconds(activity.averagePace as number) : undefined,
                averagePace: activity.averagePace as number | undefined,
                avgHR: activity.averageHR as number | undefined,
                maxHR: activity.maxHR as number | undefined,
                avgRunCadence: activity.avgRunCadence as number | undefined,
                calories: activity.calories as number | undefined,
                elevationGain: activity.elevationGain as number | undefined,
                trainingType: activity.activityType as string | undefined
              }
            };
          }
        } else {
          // Fallback if details not available
          processingResult = {
            points: [],
            diagnostics: {
              status: 'VALID',
              validPointCount: 0,
              originalPointCount: 0,
              flaggedIndices: []
            },
            metadata: {
              dataSource: 'GARMIN',
              activityId: `${activity.activityId}`,
              activityName: activity.activityName,
              timestamp: new Date(activity.startTimeLocal).toISOString()
            }
          };
        }

        // Calculate duration - check multiple sources
        // The MCP Python response builder formats duration as { seconds: number, formatted: string }
        let durationSeconds: number | undefined;
        
        // Check if duration is an object (formatted by Python)
        if (activity.duration && typeof activity.duration === 'object') {
          const durationObj = activity.duration as { seconds?: number; formatted?: string };
          durationSeconds = durationObj.seconds;
        } else {
          // Check flat fields
          durationSeconds = activity.durationInSeconds || 
                           (typeof activity.duration === 'number' ? activity.duration : undefined) ||
                           activity.elapsedDuration || 
                           activity.totalDuration;
        }
        
        // Log activity structure for debugging (first time only)
        if (i === 0) {
          logger.info(`Sample activity keys:`, Object.keys(activity));
          logger.info(`Sample duration field:`, activity.duration);
        }
        logger.info(`Activity ${activity.activityId}: duration=${JSON.stringify(activity.duration)}, durationInSeconds=${activity.durationInSeconds}, distance=${activity.distance}`);
        
        // Try to calculate from start/end time if duration not available
        if (!durationSeconds && activity.startTimeLocal && activity.endTimeLocal) {
          const start = new Date(activity.startTimeLocal);
          const end = new Date(activity.endTimeLocal);
          durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
          logger.info(`Calculated duration from start/end times: ${durationSeconds} seconds`);
        }
        
        // Try to extract from details if still not found
        if (!durationSeconds && activity.details) {
          const details = activity.details as Record<string, unknown>;
          
          // Check if details.duration is an object
          if (details.duration && typeof details.duration === 'object') {
            const durationObj = details.duration as { seconds?: number };
            durationSeconds = durationObj.seconds;
          } else {
            durationSeconds = details.duration as number | undefined ||
                            details.durationInSeconds as number | undefined ||
                            details.elapsedDuration as number | undefined ||
                            details.totalDuration as number | undefined ||
                            (details.summaryDTO as Record<string, unknown> | undefined)?.duration as number | undefined ||
                            (details.summaryDTO as Record<string, unknown> | undefined)?.elapsedDuration as number | undefined;
          }
          
          logger.info(`Extracted duration from details: ${durationSeconds}`);
        }
        
        // If still no duration, log full activity structure for debugging
        if (!durationSeconds) {
          logger.warn(`No duration found for activity ${activity.activityId} (${activity.activityName}). Activity keys:`, Object.keys(activity));
          logger.warn(`Full activity (first 500 chars):`, JSON.stringify(activity, null, 2).substring(0, 500));
        }
        
        const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : 0;
        logger.info(`Final duration for ${activity.activityId}: ${durationMinutes} minutes (from ${durationSeconds || 0} seconds)`);
        const sessionLogData = sessionResultToLogData(processingResult, durationMinutes, activityDate);
        
        // Insert into database
        const insertData = {
          user_id: userId,
          session_date: sessionLogData.sessionDate,
          sport_type: sportType,
          duration_minutes: sessionLogData.durationMinutes,
          source: sessionLogData.source,
          metadata: sessionLogData.metadata
        };
        
        const { error: insertError } = await supabase
          .from('session_logs')
          .insert(insertData as never);

        if (insertError) {
          logger.error(`Failed to insert session for activity ${activity.activityId}`, insertError);
          errors++;
        } else {
          synced++;
          logger.info(`Synced Garmin activity: ${activity.activityName} (${activity.activityId})`);
        }
      } catch (err) {
        logger.error(`Error processing activity ${activity.activityId}`, err);
        errors++;
      }
    }

    logger.info(`Garmin sync complete (MCP): ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (err) {
    logger.error('Garmin sync failed (MCP)', err);
    return { synced: 0, errors: 1 };
  }
}

function mapGarminSportType(activityType: string): 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER' {
  const type = activityType.toLowerCase();
  if (type.includes('running') || type.includes('run')) {
    return 'RUNNING';
  }
  if (type.includes('cycling') || type.includes('bike') || type.includes('biking')) {
    return 'CYCLING';
  }
  if (type.includes('strength') || type.includes('weight') || type.includes('lifting')) {
    return 'STRENGTH';
  }
  return 'OTHER';
}

