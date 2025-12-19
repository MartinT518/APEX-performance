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
import type { ISessionDataPoint } from '@/types/session';
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
  durationInSeconds?: number; // Primary field from Python script (extracted by extract_duration)
  elapsedDurationInSeconds?: number; // Alternative field name (from Garmin API directly)
  duration?: number | { seconds?: number; formatted?: string }; // Alternative field name or object
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
export interface GarminSyncResult {
  synced: number;
  errors: number;
  fallbackAvailable?: boolean;
  errorMessage?: string;
}

export async function syncGarminSessionsToDatabaseMCP(
  startDate: string,
  endDate: string,
  userId: string
): Promise<GarminSyncResult> {
  try {
    const supabase = createServerClient();

    logger.info(`Syncing Garmin activities from ${startDate} to ${endDate} using MCP client`);

    // Call Python script that uses MCP client
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'sync-garmin-mcp.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    let stdout: string;
    let stderr: string;
    
    try {
      const result = await execAsync(
        `${pythonCmd} "${scriptPath}" "${startDate}" "${endDate}"`,
        {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large responses
        }
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError) {
      // Python script execution failed
      logger.error('Python script execution failed', execError);
      const errorMessage = execError instanceof Error ? execError.message : String(execError);
      return {
        synced: 0,
        errors: 1,
        fallbackAvailable: true,
        errorMessage: `Garmin sync script failed: ${errorMessage}. Manual entry available.`
      };
    }

    if (stderr) {
      logger.warn('Python script stderr:', stderr);
    }

    let result: MCPResponse;
    try {
      result = JSON.parse(stdout);
    } catch (parseError) {
      logger.error('Failed to parse Python script output', parseError);
      logger.error('Raw stdout:', stdout.substring(0, 500));
      return {
        synced: 0,
        errors: 1,
        fallbackAvailable: true,
        errorMessage: 'Failed to parse Garmin sync response. Manual entry available.'
      };
    }

    if (!result.success) {
      if (result.error === 'RATE_LIMITED') {
        logger.warn('Garmin rate limited via MCP client');
        return {
          synced: 0,
          errors: 1,
          fallbackAvailable: true,
          errorMessage: 'Garmin API rate limited. Please try again later or use manual entry.'
        };
      }
      logger.error(`MCP sync failed: ${result.message || result.error}`);
      return {
        synced: 0,
        errors: 1,
        fallbackAvailable: true,
        errorMessage: result.message || result.error || 'Garmin sync failed. Manual entry available.'
      };
    }

    if (!result.activities || result.activities.length === 0) {
      logger.info('No Garmin activities found in date range');
      return { synced: 0, errors: 0 };
    }

    logger.info(`Fetched ${result.activities.length} activities from Garmin via MCP`);
    
    // Debug: Log first activity structure to verify Python response format
    if (result.activities.length > 0) {
      const firstActivity = result.activities[0];
      logger.info(`📊 Sample activity structure from Python script:`, {
        activityId: firstActivity.activityId,
        activityName: firstActivity.activityName,
        durationInSeconds: firstActivity.durationInSeconds,
        durationType: typeof firstActivity.durationInSeconds,
        hasDetails: !!firstActivity.details,
        startTimeLocal: firstActivity.startTimeLocal,
        endTimeLocal: firstActivity.endTimeLocal,
        keys: Object.keys(firstActivity)
      });
      
      // If duration is 0, log warning immediately
      if (firstActivity.durationInSeconds === 0) {
        logger.error(`❌ WARNING: First activity has durationInSeconds = 0 from Python script!`);
        logger.error(`   This suggests the Python extract_duration() function failed`);
        logger.error(`   Check Python script logs for duration extraction errors`);
      }
    }

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
        
        // Calculate duration FIRST - check multiple sources in order of reliability
        // The Python script's extract_duration() function returns durationInSeconds
        // But we also check other fields as fallbacks
        let durationSeconds: number | undefined;
        
        // Priority 1: Check durationInSeconds (primary field from Python script)
        // The Python script's extract_duration() function sets this field
        if (activity.durationInSeconds !== undefined && 
            activity.durationInSeconds !== null && 
            typeof activity.durationInSeconds === 'number' &&
            activity.durationInSeconds > 0) {
          durationSeconds = activity.durationInSeconds;
          logger.info(`Activity ${activity.activityId}: Using durationInSeconds from Python script: ${durationSeconds}`);
        }
        
        // Priority 2: Check elapsedDurationInSeconds (direct from Garmin API if Python didn't extract)
        if (!durationSeconds && activity.elapsedDurationInSeconds !== undefined && 
            activity.elapsedDurationInSeconds !== null && 
            typeof activity.elapsedDurationInSeconds === 'number' &&
            activity.elapsedDurationInSeconds > 0) {
          durationSeconds = activity.elapsedDurationInSeconds;
          logger.info(`Activity ${activity.activityId}: Using elapsedDurationInSeconds: ${durationSeconds}`);
        }
        
        // Priority 3: Check if duration is an object (formatted by Python or Garmin API)
        if (!durationSeconds && activity.duration && typeof activity.duration === 'object') {
          const durationObj = activity.duration as { seconds?: number; totalSeconds?: number; formatted?: string };
          durationSeconds = durationObj.seconds || durationObj.totalSeconds;
          if (durationSeconds) {
            logger.info(`Activity ${activity.activityId}: Using duration object seconds: ${durationSeconds}`);
          }
        }
        
        // Priority 4: Check flat numeric duration field
        if (!durationSeconds && typeof activity.duration === 'number' && activity.duration > 0) {
          durationSeconds = activity.duration;
          logger.info(`Activity ${activity.activityId}: Using flat duration number: ${durationSeconds}`);
        }
        
        // Priority 5: Check other alternative fields
        if (!durationSeconds) {
          durationSeconds = activity.elapsedDuration || activity.totalDuration;
          if (durationSeconds) {
            logger.info(`Activity ${activity.activityId}: Using alternative duration field: ${durationSeconds}`);
          }
        }
        
        // Priority 4: Try to calculate from start/end time if duration not available
        if (!durationSeconds && activity.startTimeLocal && activity.endTimeLocal) {
          try {
            const start = new Date(activity.startTimeLocal);
            const end = new Date(activity.endTimeLocal);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
              durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
              logger.info(`Activity ${activity.activityId}: Calculated duration from start/end times: ${durationSeconds} seconds`);
            }
          } catch (dateError) {
            logger.warn(`Activity ${activity.activityId}: Failed to parse start/end times for duration calculation`, dateError);
          }
        }
        
        // Priority 5: Try to extract from details if still not found
        if (!durationSeconds && activity.details) {
          try {
            const details = activity.details as Record<string, unknown>;
            
            // Check if details.duration is an object
            if (details.duration && typeof details.duration === 'object') {
              const durationObj = details.duration as { seconds?: number };
              durationSeconds = durationObj.seconds;
            } else {
              // Check various duration fields in details
              durationSeconds = details.elapsedDurationInSeconds as number | undefined ||
                              details.duration as number | undefined ||
                              details.durationInSeconds as number | undefined ||
                              details.elapsedDuration as number | undefined ||
                              details.totalDuration as number | undefined ||
                              (details.summaryDTO as Record<string, unknown> | undefined)?.elapsedDurationInSeconds as number | undefined ||
                              (details.summaryDTO as Record<string, unknown> | undefined)?.duration as number | undefined ||
                              (details.summaryDTO as Record<string, unknown> | undefined)?.elapsedDuration as number | undefined;
            }
            
            if (durationSeconds) {
              logger.info(`Activity ${activity.activityId}: Extracted duration from details: ${durationSeconds}`);
            }
          } catch (detailsError) {
            logger.warn(`Activity ${activity.activityId}: Failed to extract duration from details`, detailsError);
          }
        }
        
        // If still no duration, log full activity structure for debugging
        if (!durationSeconds || durationSeconds === 0) {
          logger.error(`❌ CRITICAL: No valid duration found for activity ${activity.activityId} (${activity.activityName})`);
          logger.error(`   This activity will be SKIPPED to avoid storing invalid data`);
          logger.error(`   Activity keys:`, Object.keys(activity));
          logger.error(`   Python script returned durationInSeconds: ${activity.durationInSeconds}`);
          logger.error(`   Duration fields checked: duration=${JSON.stringify(activity.duration)}, elapsedDuration=${activity.elapsedDuration}, elapsedDurationInSeconds=${activity.elapsedDurationInSeconds}`);
          logger.error(`   Start/End times: startTimeLocal=${activity.startTimeLocal}, endTimeLocal=${activity.endTimeLocal}`);
          
          if (i === 0) {
            // Log full structure for first activity to help debug
            logger.error(`   Full activity structure (first 2000 chars):`, JSON.stringify(activity, null, 2).substring(0, 2000));
          }
          
          // Skip this activity - don't store invalid data
          logger.warn(`⚠️ Skipping activity ${activity.activityId} due to missing duration`);
          errors++;
          continue; // Skip to next activity
        }
        
        const durationMinutes = Math.round(durationSeconds / 60);
        
        // Validate duration is reasonable (at least 1 minute, at most 24 hours)
        if (durationMinutes < 1) {
          logger.error(`❌ Invalid duration: ${durationMinutes} minutes (from ${durationSeconds} seconds) for activity ${activity.activityId}`);
          logger.warn(`⚠️ Skipping activity ${activity.activityId} due to invalid duration`);
          errors++;
          continue;
        }
        
        if (durationMinutes > 1440) { // 24 hours
          logger.warn(`⚠️ Suspiciously long duration: ${durationMinutes} minutes for activity ${activity.activityId} - storing anyway`);
        }
        
        logger.info(`✅ Final duration for ${activity.activityId}: ${durationMinutes} minutes (from ${durationSeconds} seconds)`);
        
        // Process activity details if available from Python script
        // NOTE: Activities can have summary data (duration, distance, etc.) even without detail metrics
        // So we should store the activity even if pointCount is 0, as long as we have duration
        let processingResult: SessionProcessingResult;
        
        let dataPoints: ISessionDataPoint[] = [];
        let pointCount = 0;
        
        if (activity.details) {
          // Try to convert Garmin details to session stream
          try {
            const stream = adaptGarminToSessionStream(activity.details);
            dataPoints = stream.dataPoints;
            pointCount = stream.dataPoints.length;
            
            if (pointCount === 0) {
              logger.info(`Activity ${activity.activityId}: No time-series data points found, but summary data available`);
              logger.info(`   This is normal for some activities - storing summary data only`);
            } else {
              logger.info(`Activity ${activity.activityId}: Extracted ${pointCount} data points`);
            }
          } catch (streamError) {
            logger.warn(`Failed to adapt activity ${activity.activityId} to session stream`, streamError);
            logger.info(`   Continuing with summary data only (duration, distance, etc.)`);
            // Continue with empty points - we still have summary data
            dataPoints = [];
            pointCount = 0;
          }
        } else {
          logger.info(`Activity ${activity.activityId}: No detail metrics available, using summary data only`);
        }
        
        // Build processing result with summary data (even if no data points)
        // This is valid - many activities have summary stats but no time-series data
        processingResult = {
          points: dataPoints,
          diagnostics: {
            status: 'VALID', // Valid even if no time-series data (summary data is available)
            validPointCount: pointCount,
            originalPointCount: pointCount,
            flaggedIndices: []
          },
          metadata: {
            dataSource: 'GARMIN',
            activityId: `${activity.activityId}`,
            activityName: activity.activityName,
            timestamp: new Date(activity.startTimeLocal).toISOString(),
            // Extract additional metrics from activity object (summary data)
            distanceKm: activity.distance ? (activity.distance as number) / 1000 : undefined,
            distanceInMeters: activity.distance as number | undefined,
            avgPace: activity.averagePace ? formatPaceFromSeconds(activity.averagePace as number) : undefined,
            averagePace: activity.averagePace as number | undefined, // seconds per km
            avgHR: activity.averageHR as number | undefined,
            maxHR: activity.maxHR as number | undefined,
            avgRunCadence: activity.avgRunCadence as number | undefined,
            calories: activity.calories as number | undefined,
            elevationGain: activity.elevationGain as number | undefined,
            trainingType: activity.activityType as string | undefined,
            // Store duration in metadata for reference
            durationInSeconds: durationSeconds,
            durationMinutes: durationMinutes,
            // Note: requiresManualDuration is false since we have valid duration
            hasTimeSeriesData: pointCount > 0
          }
        };

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
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      synced: 0,
      errors: 1,
      fallbackAvailable: true,
      errorMessage: `Garmin sync error: ${errorMessage}. Manual entry available.`
    };
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

