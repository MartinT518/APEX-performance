import { GarminClient } from './garminClient';
import { adaptGarminToSessionStream } from './garminAdapter';
import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { sessionResultToLogData } from '@/modules/dailyCoach/logic/persistence';
import type { SessionProcessingResult } from '@/modules/dailyCoach/logic/sessionProcessor';
import type { IGarminActivity } from '@/types/garmin';

/**
 * Syncs Garmin activities to session_logs table
 * Only inserts new sessions (checks by activity ID in metadata)
 * Filters activities by date range (startDate to endDate)
 */
export async function syncGarminSessionsToDatabase(
  garminClient: GarminClient | null,
  startDate: string,
  endDate: string,
  userId: string,
  reSync: boolean = false
): Promise<{ synced: number; errors: number }> {
  if (!garminClient) {
    logger.info('Garmin client not available, skipping sync');
    return { synced: 0, errors: 0 };
  }

  try {
    const supabase = createServerClient();

    // Parse date range
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999); // Include full end date
    
    logger.info(`Syncing Garmin activities from ${startDate} to ${endDate}`);
    
    // Fetch activities in smaller batches to avoid rate limiting
    // Conservative approach: small batches with delays
    const batchSize = 5; // Very conservative: 5 activities per batch
    const maxBatches = 50; // Safety limit to prevent infinite loops
    let allActivities: IGarminActivity[] = [];
    let rateLimited = false;
    
    // Fetch activities in batches with delays until we cover the date range
    for (let batch = 0; batch < maxBatches && !rateLimited; batch++) {
      try {
        const offset = batch * batchSize;
        logger.info(`Fetching batch ${batch + 1}: activities ${offset} to ${offset + batchSize - 1}`);
        
        const batchActivities = await garminClient.getRecentActivities(batchSize, offset);
        
        if (batchActivities.length === 0) {
          logger.info('No more activities available');
          break; // No more activities
        }
        
        // Filter activities by date range
        const activitiesInRange = batchActivities.filter(activity => {
          const activityTime = activity.startTimeGMT || activity.startTimeLocal;
          if (!activityTime) return false;
          const activityDate = new Date(activityTime as string);
          return activityDate >= rangeStart && activityDate <= rangeEnd;
        });
        
        allActivities = [...allActivities, ...activitiesInRange];
        logger.info(`Batch ${batch + 1} complete: ${batchActivities.length} activities, ${activitiesInRange.length} in date range (total in range: ${allActivities.length})`);
        
        // Check if we've passed the start date (oldest activity is before our range)
        const oldestActivity = batchActivities[batchActivities.length - 1];
        const oldestStartTime = oldestActivity?.startTimeGMT || oldestActivity?.startTimeLocal;
        if (oldestActivity && oldestStartTime && new Date(oldestStartTime as string) < rangeStart) {
          logger.info(`Reached start of date range. Oldest activity: ${oldestStartTime}`);
          break; // We've passed the start date, no more activities in range
        }
        
        // If we got fewer than requested, we've reached the end
        if (batchActivities.length < batchSize) {
          break;
        }
        
        // Add delay between batches to avoid rate limiting (longer delays)
        if (batch < maxBatches - 1) {
          const delay = batch === 0 ? 10000 : 5000; // 10 seconds after first batch, 5 seconds after others
          logger.info(`Waiting ${delay / 1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('RATE_LIMITED')) {
          logger.warn(`Rate limited while fetching batch ${batch + 1}. Stopping batch fetch.`);
          rateLimited = true;
          break; // Stop fetching more batches
        }
        logger.error(`Error fetching batch ${batch + 1}`, err);
        // Continue to next batch for other errors, but log it
      }
    }

    if (allActivities.length === 0) {
      logger.info('No Garmin activities found');
      return { synced: 0, errors: 0 };
    }

    logger.info(`Fetched ${allActivities.length} activities from Garmin (in ${Math.ceil(allActivities.length / batchSize)} batches)`);

    let synced = 0;
    let errors = 0;
    const activities = allActivities;

    // Process each activity with rate limiting protection
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      try {
        const sportType = mapGarminSportType(activity.activityType || activity.activityName || 'running');

        // Check if session already exists (by activity ID in metadata)
        const { data: existing } = await supabase
          .from('session_logs')
          .select('id, metadata')
          .eq('user_id', userId)
          .eq('metadata->>activityId', `${activity.activityId}`)
          .maybeSingle();

        if (existing && !reSync) {
          const existingMetadata = (existing as { metadata: Record<string, unknown> | null }).metadata;
          const hasEnhancedMetadata = existingMetadata && (
            existingMetadata.distanceKm !== undefined ||
            existingMetadata.avgPace !== undefined ||
            // For strength, check if protocol is missing
            (sportType === 'STRENGTH' ? existingMetadata.protocol !== undefined : true)
          );
          
          if (hasEnhancedMetadata) {
            continue; // Skip insertion, already has sufficient data
          }
          
          logger.info(`Session ${activity.activityId} needs enhancement.`);
        }

        // Add delay between requests to avoid rate limiting
        // Longer delays to be more conservative with Garmin's rate limits
        const delay = i < 3 ? 5000 : 3000; // 5 seconds for first 3, then 3 seconds
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Fetch activity details
        let details: Awaited<ReturnType<typeof garminClient.getActivityDetails>>;
        try {
          const activityId = typeof activity.activityId === 'number' ? activity.activityId : parseInt(String(activity.activityId), 10);
          if (isNaN(activityId)) {
            logger.warn(`Invalid activity ID: ${activity.activityId}`);
            errors++;
            continue;
          }
          details = await garminClient.getActivityDetails(activityId);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage === 'RATE_LIMITED') {
            logger.warn(`Rate limited by Garmin. Stopping sync. Synced ${synced} activities before rate limit.`);
            break; // Stop processing remaining activities
          }
          logger.warn(`Failed to fetch details for activity ${activity.activityId}`);
          errors++;
          continue;
        }
        
        if (!details) {
          logger.warn(`No details returned for activity ${activity.activityId}`);
          errors++;
          continue;
        }

        // Convert to session stream
        const stream = adaptGarminToSessionStream(details);
        
        // Map sport type from activity
        // Map sport type from activity (already defined above)
        // const sportType = mapGarminSportType(activity.activityType || activity.activityName || 'running');
        
        // Extract activity metadata (Garmin API may have different property names)
        const startTime = (activity.startTimeGMT || activity.startTimeLocal || details.startTimeGMT || new Date().toISOString()) as string;
        const durationSeconds = (activity.durationInSeconds || details.duration || 0) as number;
        
        // Capture summary metrics from Garmin objects
        const distanceMeters = (activity.distance || (details as any).summaryDTO?.distance || 0) as number;
        const avgSpeed = (activity.averageSpeed || (details as any).summaryDTO?.averageSpeed || 0) as number;
        const distanceKm = distanceMeters > 0 ? distanceMeters / 1000 : undefined;
        
        let avgPace: string | undefined;
        if (avgSpeed > 0) {
          const paceSeconds = 1000 / avgSpeed;
          const minutes = Math.floor(paceSeconds / 60);
          const seconds = Math.floor(paceSeconds % 60);
          avgPace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
        }
        
        // Capture strength exercises if available - check multiple possible locations
        let protocol: { warmup?: string; main: string[]; cooldown?: string } | undefined;
        const detailObj = details as any;
        const sets = detailObj.summaryDTO?.strengthTrainingDto?.exerciseSets ||
                     detailObj.summaryDTO?.strengthTrainingDto?.sets || 
                     detailObj.metadataDTO?.strengthTrainingDto?.sets ||
                     detailObj.strengthTrainingDto?.sets ||
                     detailObj.summaryDTO?.strengthSets || [];
        
        if (sets && Array.isArray(sets) && sets.length > 0) {
          const exercises: string[] = [];
          sets.forEach((set: any, idx: number) => {
            const weightVal = set.weight !== undefined ? set.weight : set.weight;
            const weightStr = (weightVal && weightVal > 0) ? ` @ ${(weightVal / 1000).toFixed(1)}kg` : '';
            const reps = set.repetitionCount || set.reps || 'Active';
            const repsStr = typeof reps === 'number' ? `${reps} reps` : reps;
            
            let name = set.exerciseName || `Set ${idx + 1}`;
            if (!set.exerciseName && set.exercises && Array.isArray(set.exercises) && set.exercises.length > 0) {
              name = set.exercises[0].name || set.exercises[0].category || name;
            }
            
            exercises.push(`${name}: ${repsStr}${weightStr}`);
          });
          protocol = { main: exercises };
        }

        // Create processing result
        const processingResult: SessionProcessingResult = {
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
            timestamp: new Date(startTime).toISOString(),
            distanceKm,
            avgPace,
            protocol // Add extracted protocol
          }
        };

        // Convert to session log data
        const durationMinutes = Math.round(durationSeconds / 60);
        const activityDate = new Date(startTime).toISOString().split('T')[0];
        const sessionLogData = sessionResultToLogData(processingResult, durationMinutes, activityDate);
        
        // Override sport type with mapped value
        const finalSportType = sportType;
        
        if (existing) {
          logger.info(`Updating existing session ${activity.activityId}`);
          const { error: updateError } = await supabase
            .from('session_logs')
            .update({
              sport_type: finalSportType,
              duration_minutes: durationMinutes,
              metadata: sessionLogData.metadata
            } as never)
            .eq('id', (existing as { id: string }).id);

          if (updateError) {
            logger.error(`Failed to update session ${activity.activityId}`, updateError);
            errors++;
          } else {
            synced++;
            logger.info(`Updated session ${activity.activityId}`);
          }
        } else {
          // Insert into database
          const insertData = {
            user_id: userId,
            session_date: sessionLogData.sessionDate,
            sport_type: finalSportType,
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
            logger.info(`Synced session ${activity.activityId}`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // Check for rate limiting - stop processing if we hit rate limit
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests')) {
          logger.warn(`Rate limited by Garmin. Stopping sync. Synced ${synced} activities before rate limit.`);
          break; // Stop processing remaining activities
        }
        
        logger.error(`Error processing activity ${activity.activityId}`, err);
        errors++;
      }
    }

    logger.info(`Garmin sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (err) {
    logger.error('Garmin sync failed', err);
    return { synced: 0, errors: 1 };
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

