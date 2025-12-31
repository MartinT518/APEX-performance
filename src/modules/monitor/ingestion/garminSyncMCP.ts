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

interface WellnessData {
  date: string;
  hrv: number | null;
  rhr: number | null;
  sleepSeconds: number | null;
  sleepScore: number | null;
}

interface WellnessSyncResponse {
  success: boolean;
  wellness_data?: WellnessData[];
  count?: number;
  error?: string;
  message?: string;
}

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
  userId: string,
  reSync: boolean = false,
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<GarminSyncResult> {
  try {
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // CRITICAL: If client provided access token, set it immediately for RLS
    if (clientAccessToken && userId) {
      logger.info('Setting session from client-provided tokens in syncGarminSessionsToDatabaseMCP');
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: clientAccessToken,
          refresh_token: clientRefreshToken || '',
        } as { access_token: string; refresh_token: string });
        
        if (error) {
          logger.error('Error setting session in syncGarminSessionsToDatabaseMCP:', error);
        } else {
          logger.info('Session set successfully', {
            hasSession: !!data.session,
            userId: data.session?.user?.id
          });
        }
      } catch (sessionError: any) {
        logger.warn('Failed to set session from client token:', sessionError?.message);
      }
      
      // Wait for session to propagate
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Verify session is set for RLS (auth.uid() must be available)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn('No session found in syncGarminSessionsToDatabaseMCP, RLS may fail');
      // Try getUser as fallback
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('No user session available for RLS. Sync may fail with RLS violations.');
      } else {
        logger.info(`User session verified: ${user.id}`);
      }
    } else {
      logger.info(`Session verified for user: ${session.user.id}`);
    }

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
        const sportType = mapGarminSportType(activity.activityType);

        // Check if session already exists
        const { data: existing } = await supabase
          .from('session_logs')
          .select('id, metadata')
          .eq('user_id', userId)
          .eq('metadata->>activityId', `${activity.activityId}`)
          .maybeSingle();

        // If session exists but metadata is incomplete (or we are forcing a re-sync), update it
        if (existing && !reSync) {
          const existingMetadata = (existing as { metadata: Record<string, unknown> | null }).metadata;
          const hasEnhancedMetadata = existingMetadata && (
            existingMetadata.distanceKm !== undefined ||
            existingMetadata.avgPace !== undefined ||
            existingMetadata.avgHR !== undefined ||
            // For strength, check if protocol is missing
            (sportType === 'STRENGTH' ? existingMetadata.protocol !== undefined : true)
          );
          
          if (hasEnhancedMetadata) {
            continue; // Skip insertion, already has sufficient data
          }
          
          logger.info(`Session ${activity.activityId} needs enhancement.`);
        }

        const activityDate = new Date(activity.startTimeLocal).toISOString().split('T')[0];
        // const sportType = mapGarminSportType(activity.activityType); // Already defined above
        
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
        
        // Extract hr_source from Garmin data for source quality weighting
        // Check multiple possible locations in Garmin response
        let hrSource: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null = null;
        if (activity.details) {
          const details = activity.details as any;
          // Try various locations where Garmin might store HR source
          const hrSourceValue = details.summaryDTO?.hrSource ||
                               details.metadataDTO?.hrSource ||
                               details.hrSource ||
                               activity.hrSource ||
                               (details.summaryDTO as any)?.heartRateSource;
          
          if (hrSourceValue) {
            const hrSourceStr = String(hrSourceValue).toUpperCase();
            if (hrSourceStr.includes('CHEST') || hrSourceStr.includes('STRAP') || hrSourceStr.includes('HRM')) {
              hrSource = 'CHEST_STRAP';
            } else if (hrSourceStr.includes('WRIST') || hrSourceStr.includes('OPTICAL') || hrSourceStr.includes('WATCH')) {
              hrSource = 'WRIST_HR';
            } else {
              hrSource = 'UNKNOWN';
            }
          }
        }
        
        // If hr_source not found, try to infer from device type
        if (!hrSource && activity.device) {
          const deviceStr = String(activity.device).toUpperCase();
          if (deviceStr.includes('HRM') || deviceStr.includes('CHEST') || deviceStr.includes('STRAP')) {
            hrSource = 'CHEST_STRAP';
          } else if (deviceStr.includes('WATCH') || deviceStr.includes('FORERUNNER') || deviceStr.includes('FENIX')) {
            hrSource = 'WRIST_HR';
          }
        }
        
        // Default to UNKNOWN if still not found
        if (!hrSource) {
          hrSource = 'UNKNOWN';
        }
        
        logger.debug(`Activity ${activity.activityId}: Extracted hr_source = ${hrSource}`);
        
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
            // Extract protocol for strength training - check multiple possible locations
            protocol: (() => {
               if (!activity.details) return undefined;
               const details = activity.details as any;
               
                // Try to find strength sets in various known Garmin response locations
                const sets = details.summaryDTO?.strengthTrainingDto?.exerciseSets || 
                             details.summaryDTO?.strengthTrainingDto?.sets || 
                             details.metadataDTO?.strengthTrainingDto?.sets ||
                             details.strengthTrainingDto?.sets ||
                             (details.summaryDTO as any)?.strengthSets || [];
                             
                if (sets && Array.isArray(sets) && sets.length > 0) {
                  return {
                    main: sets.map((set: any, idx: number) => {
                      const weightVal = set.weight !== undefined ? set.weight : set.weight;
                      const weightStr = (weightVal && weightVal > 0) ? ` @ ${(weightVal / 1000).toFixed(1)}kg` : '';
                      const reps = set.repetitionCount || set.reps || 'Active';
                      const repsStr = typeof reps === 'number' ? `${reps} reps` : reps;
                      
                      let name = set.exerciseName || `Set ${idx + 1}`;
                      if (!set.exerciseName && set.exercises && Array.isArray(set.exercises) && set.exercises.length > 0) {
                        name = set.exercises[0].name || set.exercises[0].category || name;
                      }
                      
                      return `${name}: ${repsStr}${weightStr}`;
                    })
                  };
                }
               return undefined;
            })(),
            // Store duration in metadata for reference
            durationMinutes: durationMinutes,
            // Note: requiresManualDuration is false since we have valid duration
            hasTimeSeriesData: pointCount > 0
          }
        };

const sessionLogData = sessionResultToLogData(processingResult, durationMinutes, activityDate);
        
        // Insert into database
        // Insert or Update into database
        if (existing) {
          logger.info(`Updating existing session ${activity.activityId}`);
          const { error: updateError } = await supabase
            .from('session_logs')
            .update({
              sport_type: sportType,
              duration_minutes: sessionLogData.durationMinutes,
              metadata: sessionLogData.metadata,
              hr_source: hrSource,
              device: activity.device || null
            } as never)
            .eq('id', (existing as { id: string }).id);

          if (updateError) {
            logger.error(`Failed to update session for activity ${activity.activityId}`, updateError);
            errors++;
          } else {
            synced++;
            logger.info(`Updated Garmin activity: ${activity.activityName} (${activity.activityId})`);
          }
        } else {
          const insertData = {
            user_id: userId,
            session_date: sessionLogData.sessionDate,
            sport_type: sportType,
            duration_minutes: sessionLogData.durationMinutes,
            source: sessionLogData.source,
            metadata: sessionLogData.metadata,
            hr_source: hrSource,
            device: activity.device || null
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
  if (type.includes('running') || type.includes('run') || type.includes('treadmill')) {
    return 'RUNNING';
  }
  if (type.includes('cycling') || type.includes('bike') || type.includes('biking') || type.includes('spinning')) {
    return 'CYCLING';
  }
  if (type.includes('strength') || type.includes('weight') || type.includes('lifting') || type.includes('gym') || type.includes('training')) {
    return 'STRENGTH';
  }
  return 'OTHER';
}

/**
 * Syncs Garmin wellness data (HRV, RHR, Sleep) using MCP Python client
 * This provides access to get_hrv_data method which isn't available in npm garminconnect
 */
export async function syncGarminWellnessToDatabaseMCP(
  startDate: string,
  endDate: string,
  userId: string,
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{ synced: number; errors: number }> {
  try {
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // CRITICAL: If client provided access token, set it immediately for RLS
    if (clientAccessToken && userId) {
      logger.info('Setting session from client-provided tokens in syncGarminWellnessToDatabaseMCP');
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: clientAccessToken,
          refresh_token: clientRefreshToken || '',
        } as { access_token: string; refresh_token: string });
        
        if (error) {
          logger.error('Error setting session in syncGarminWellnessToDatabaseMCP:', error);
        } else {
          logger.info('Session set successfully for wellness sync', {
            hasSession: !!data.session,
            userId: data.session?.user?.id
          });
        }
      } catch (sessionError: any) {
        logger.warn('Failed to set session from client token:', sessionError?.message);
      }
      
      // Wait for session to propagate
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Verify session is set for RLS
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn('No session found in syncGarminWellnessToDatabaseMCP, RLS may fail');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('No user session available for RLS. Wellness sync may fail with RLS violations.');
      } else {
        logger.info(`User session verified: ${user.id}`);
      }
    } else {
      logger.info(`Session verified for user: ${session.user.id}`);
    }
    
    logger.info(`Syncing Garmin wellness data from ${startDate} to ${endDate} using MCP client`);

    // Call Python script that uses MCP client
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'sync-garmin-wellness-mcp.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    let stdout: string;
    let stderr: string;
    
    try {
      const result = await execAsync(
        `${pythonCmd} "${scriptPath}" "${startDate}" "${endDate}"`,
        {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError) {
      const error = execError as { stdout?: string; stderr?: string; code?: number };
      stdout = error.stdout || '';
      stderr = error.stderr || '';
      
      // If Python script failed, try to parse error from stdout
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error === 'RATE_LIMITED') {
            throw new Error('Rate limit exceeded. Please wait a few minutes before trying again.');
          }
          if (parsed.error === 'AUTH_FAILED') {
            throw new Error('Authentication failed. Please run garmin-connect-mcp-auth to re-authenticate.');
          }
        } catch {
          // Not JSON, continue with error handling
        }
      }
      
      // Log both stdout and stderr for debugging
      logger.error(`Python script execution failed`);
      logger.error(`STDOUT: ${stdout}`);
      logger.error(`STDERR: ${stderr}`);
      
      // Try to parse error from stdout if it's JSON
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            throw new Error(`Wellness sync script error: ${parsed.error} - ${parsed.message || ''}`);
          }
        } catch {
          // Not JSON, continue with generic error
        }
      }
      
      throw new Error(`Wellness sync script failed: ${stderr || stdout || 'Unknown error'}`);
    }

    // Parse JSON response from Python script
    interface WellnessSyncResponse {
      success: boolean;
      wellness_data?: Array<{
        date: string;
        hrv: number | null;
        rhr: number | null;
        sleepSeconds: number | null;
        sleepScore: number | null;
      }>;
      count?: number;
      entries_with_data?: number;
      error?: string;
      message?: string;
    }

    let response: WellnessSyncResponse;
    try {
      response = JSON.parse(stdout);
    } catch (parseError) {
      logger.error(`Failed to parse Python script response: ${stdout}`);
      throw new Error('Invalid response from wellness sync script');
    }

    if (!response.success) {
      throw new Error(response.message || response.error || 'Wellness sync failed');
    }

    if (!response.wellness_data || response.wellness_data.length === 0) {
      logger.info('No wellness data returned from sync');
      return { synced: 0, errors: 0 };
    }

    const entriesWithData = response.entries_with_data || 0;
    logger.info(`Received ${response.wellness_data.length} wellness entries (${entriesWithData} with data)`);

    // Sync wellness data to database
    let synced = 0;
    let errors = 0;
    let skipped = 0;

    for (const wellness of response.wellness_data) {
      try {
        // Check if entry exists
        const { data: existing } = await supabase
          .from('daily_monitoring')
          .select('id')
          .eq('user_id', userId)
          .eq('date', wellness.date)
          .maybeSingle() as any;

        const updateData = {
          hrv: wellness.hrv,
          rhr: wellness.rhr,
          sleep_seconds: wellness.sleepSeconds,
          sleep_score: wellness.sleepScore,
          updated_at: new Date().toISOString()
        };

        // Only update if we have at least one non-null value
        if (wellness.hrv !== null || wellness.rhr !== null || wellness.sleepSeconds !== null) {
          if (existing) {
            const { error } = await supabase
              .from('daily_monitoring')
              .update(updateData as never)
              .eq('id', existing.id);
            if (error) {
              logger.error(`Failed to update wellness for ${wellness.date}: ${error.message}`, error);
              errors++;
            } else {
              synced++;
            }
          } else {
            const { error } = await supabase
              .from('daily_monitoring')
              .insert({
                user_id: userId,
                date: wellness.date,
                ...updateData
              } as never);
            if (error) {
              logger.error(`Failed to insert wellness for ${wellness.date}: ${error.message}`, error);
              errors++;
            } else {
              synced++;
            }
          }
        } else {
          // No data to sync for this date - this is not an error, just skip
          skipped++;
        }
      } catch (err) {
        logger.error(`Failed to sync wellness for ${wellness.date}`, err);
        errors++;
      }
    }

    logger.info(`Wellness sync complete: ${synced} synced, ${errors} errors, ${skipped} skipped (no data)`);
    return { synced, errors };
  } catch (err) {
    logger.error('Wellness sync via MCP failed', err);
    return { synced: 0, errors: 1 };
  }
}
