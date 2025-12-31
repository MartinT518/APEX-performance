/**
 * Import Historical Data Script
 * 
 * Imports 2,707 days of health data and 2,012 activities from JSON files.
 * Maps all fields to database schema as specified in the roadmap.
 * 
 * Usage:
 *   tsx scripts/import-historical-data.ts --health-data <path> --activity-data <path> --activity-details <path>
 * 
 * Or set environment variables:
 *   HEALTH_DATA_PATH=<path>
 *   ACTIVITY_DATA_PATH=<path>
 *   ACTIVITY_DETAILS_PATH=<path>
 */

// Load environment variables from .env.local FIRST, before any other imports
// Must use synchronous require to ensure this runs before module evaluation
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

// Verify Supabase env vars are set before importing supabase.ts (which throws on import if missing)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     process.env.SUPABASE_ANON_KEY ||
                     process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('   Please set in .env.local:');
  console.error('     - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.error('     - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

// Create Supabase client directly to avoid module-level checks
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Simple logger for CLI scripts (avoids importing logger which might pull in supabase.ts)
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => {
    if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`, ...args);
  }
};

// Type for Database (simplified to avoid importing types that might pull in supabase.ts)
type Database = any;

// Create client directly (avoiding supabase.ts module-level checks)
// For CLI imports, use service role key to bypass RLS
function createSupabaseClient() {
  // Prefer service role key for CLI scripts (bypasses RLS)
  const serviceRoleKey = process.env.SUPABASE_SECRET_DEFAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyToUse = serviceRoleKey || supabaseKey;
  
  if (serviceRoleKey) {
    logger.info(`Using service role key (RLS bypassed) - Key: ${serviceRoleKey.substring(0, 15)}...`);
  } else {
    logger.warn('No service role key found, using anon key (RLS will be enforced)');
    logger.warn('⚠️  This will cause RLS violations. Set SUPABASE_SECRET_DEFAULT_KEY in .env.local');
  }
  
  const client = createClient<Database>(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false, // CLI script doesn't need session persistence
      autoRefreshToken: false
    },
    // Service role key should automatically bypass RLS
    // If RLS errors persist, verify the key format and Supabase configuration
  });
  
  // Verify we're using service role key
  if (serviceRoleKey && !keyToUse.startsWith('sb_secret_')) {
    logger.warn('⚠️  WARNING: Expected service role key format (sb_secret_...), but got different format');
  }
  
  return client;
}

interface HealthDataRow {
  date: string;
  hrv: number | null;
  hrv_method: string | null;
  resting_hr: number | null;
  sleep_duration: string | null; // May be in HH:MM:SS or seconds
  sleep_score: number | null;
  rem_percent: number | null;
  deep_percent: number | null;
  light_percent: number | null;
  bedtime: string | null;
  wake_time: string | null;
  body_battery: number | null;
  training_readiness: number | null;
  stress_score: number | null;
}

interface ActivityDataRow {
  activity_id: string | number;
  start_time: string;
  sport_type: string;
  duration: number | string; // May be in seconds or formatted string like "01:01:18"
  distance_km: string | number | null; // String in JSON like "11.63"
  elevation_gain: string | number | null;
  elevation_loss: string | number | null;
  avg_hr: string | number | null;
  max_hr: string | number | null;
  hr_source: string | null;
  avg_pace: string | null; // Format like "5:16"
  max_pace: string | null;
  cadence: string | number | null;
  power: string | number | null;
  calories: string | number | null;
  training_effect: string | null;
  device: string | null;
}

interface ActivityDetailData {
  activityId: string | number;
  distance?: number;
  duration?: number;
  movingDuration?: number;
  elevationGain?: number;
  elevationLoss?: number;
  averageSpeed?: number;
  averageMovingSpeed?: number;
  maxSpeed?: number;
  calories?: number;
  bmrCalories?: number;
  averageHR?: number;
  maxHR?: number;
  averageRunCadence?: number;
  maxRunCadence?: number;
  averagePower?: number;
  maxPower?: number;
  normalizedPower?: number;
  groundContactTime?: number;
  strideLength?: number;
  verticalOscillation?: number;
  verticalRatio?: number;
  totalExerciseReps?: number;
  avgVerticalSpeed?: number;
  avgGradeAdjustedSpeed?: number;
  splitType?: string;
  noOfSplits?: number;
  maxElevationGain?: number;
  averageElevationGain?: number;
  maxDistance?: number;
  maxDistanceWithPrecision?: number;
  avgStepFrequency?: number;
}

/**
 * Converts sleep duration string to seconds
 * Handles formats: "7h 30m", "7:30:00", "27000" (seconds as string)
 */
function parseSleepDuration(sleepDuration: string | null | undefined): number | null {
  if (!sleepDuration) return null;
  
  // If it's already a number (seconds)
  if (typeof sleepDuration === 'number') {
    return sleepDuration;
  }
  
  // Try parsing as number string (seconds)
  const asNumber = Number(sleepDuration);
  if (!isNaN(asNumber)) {
    return asNumber;
  }
  
  // Try parsing "HH:MM:SS" format first
  const hmsMatch = sleepDuration.match(/^(\d+):(\d+):(\d+)$/);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10);
    const minutes = parseInt(hmsMatch[2], 10);
    const seconds = parseInt(hmsMatch[3], 10);
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  
  // Try parsing "HH:MM" format (common in Garmin exports like "7:30", "8:44")
  const hmMatch = sleepDuration.match(/^(\d+):(\d+)$/);
  if (hmMatch) {
    const hours = parseInt(hmMatch[1], 10);
    const minutes = parseInt(hmMatch[2], 10);
    return (hours * 3600) + (minutes * 60);
  }
  
  // Try parsing "7h 30m" format
  const hourMinMatch = sleepDuration.match(/(\d+)h\s*(\d+)m/);
  if (hourMinMatch) {
    const hours = parseInt(hourMinMatch[1], 10);
    const minutes = parseInt(hourMinMatch[2], 10);
    return (hours * 3600) + (minutes * 60);
  }
  
  // Try parsing "HH:MM:SS" format (fallback, less strict)
  const timeMatch = sleepDuration.match(/(\d+):(\d+):(\d+)/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  
  logger.warn(`Could not parse sleep duration: ${sleepDuration}`);
  return null;
}

/**
 * Converts duration to minutes
 * Handles: number (seconds), string "HH:MM:SS", string "MM:SS"
 */
function parseDurationToMinutes(duration: number | string | null | undefined): number {
  if (duration === null || duration === undefined) return 0;
  
  if (typeof duration === 'number') {
    return Math.round(duration / 60); // Assume seconds
  }
  
  // Try parsing "HH:MM:SS" or "MM:SS"
  const timeMatch = duration.match(/(\d+):(\d+)(?::(\d+))?/);
  if (timeMatch) {
    const hours = timeMatch[3] ? parseInt(timeMatch[1], 10) : 0;
    const minutes = timeMatch[3] ? parseInt(timeMatch[2], 10) : parseInt(timeMatch[1], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : parseInt(timeMatch[2], 10);
    return (hours * 60) + minutes + (seconds / 60);
  }
  
  // Try parsing as number string (seconds)
  const asNumber = Number(duration);
  if (!isNaN(asNumber)) {
    return Math.round(asNumber / 60);
  }
  
  logger.warn(`Could not parse duration: ${duration}`);
  return 0;
}

/**
 * Maps HRV Method string to database enum
 */
function mapHrvMethod(method: string | null | undefined): 'GARMIN' | 'MANUAL' | 'UNKNOWN' {
  if (!method) return 'UNKNOWN';
  const upper = method.toUpperCase();
  if (upper.includes('GARMIN')) return 'GARMIN';
  if (upper.includes('MANUAL')) return 'MANUAL';
  return 'UNKNOWN';
}

/**
 * Maps HR Source string to database enum
 */
function mapHrSource(source: string | null | undefined): 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' {
  if (!source) return 'UNKNOWN';
  const upper = source.toUpperCase();
  if (upper.includes('WRIST') || upper.includes('OPTICAL')) return 'WRIST_HR';
  if (upper.includes('CHEST') || upper.includes('STRAP')) return 'CHEST_STRAP';
  return 'UNKNOWN';
}

/**
 * Parses pace string to seconds per km
 * Handles formats: "5:16" (MM:SS), "5:16/km" (MM:SS/km), or number
 */
function parsePaceToSeconds(pace: string | number | null | undefined): number | null {
  if (pace === null || pace === undefined) return null;
  
  if (typeof pace === 'number') {
    return pace; // Assume already in seconds per km
  }
  
  // Try parsing "MM:SS/km" format
  const matchWithKm = pace.match(/(\d+):(\d+)\/km/);
  if (matchWithKm) {
    const minutes = parseInt(matchWithKm[1], 10);
    const seconds = parseInt(matchWithKm[2], 10);
    return (minutes * 60) + seconds;
  }
  
  // Try parsing "MM:SS" format (common in Garmin exports)
  const match = pace.match(/(\d+):(\d+)/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    return (minutes * 60) + seconds;
  }
  
  return null;
}

/**
 * Imports health data (2,707 days)
 */
async function importHealthData(
  supabase: any,
  userId: string,
  healthDataPath: string
): Promise<{ imported: number; errors: number }> {
  logger.info(`Reading health data from: ${healthDataPath}`);
  
  const fileContent = fs.readFileSync(healthDataPath, 'utf-8');
  const healthData: HealthDataRow[] = JSON.parse(fileContent);
  
  logger.info(`Found ${healthData.length} health data records`);
  
  let imported = 0;
  let errors = 0;
  
  for (const row of healthData) {
    try {
      const date = row.date;
      if (!date) {
        errors++;
        continue;
      }
      
      const sleepSeconds = parseSleepDuration(row.sleep_duration);
      
      // Check if record already exists
      const { data: existing } = await supabase
        .from('daily_monitoring')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('daily_monitoring')
          .update({
            hrv: row.hrv,
            hrv_method: mapHrvMethod(row.hrv_method),
            rhr: row.resting_hr,
            sleep_seconds: sleepSeconds,
            sleep_score: row.sleep_score,
            rem_percent: row.rem_percent,
            deep_percent: row.deep_percent,
            light_percent: row.light_percent,
            bedtime: row.bedtime,
            wake_time: row.wake_time,
            body_battery: row.body_battery,
            training_readiness: row.training_readiness,
            stress_score: row.stress_score
          })
          .eq('id', existing.id);
        
        if (error) throw error;
        imported++;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('daily_monitoring')
          .insert({
            user_id: userId,
            date: date,
            hrv: row.hrv,
            hrv_method: mapHrvMethod(row.hrv_method),
            rhr: row.resting_hr,
            sleep_seconds: sleepSeconds,
            sleep_score: row.sleep_score,
            rem_percent: row.rem_percent,
            deep_percent: row.deep_percent,
            light_percent: row.light_percent,
            bedtime: row.bedtime,
            wake_time: row.wake_time,
            body_battery: row.body_battery,
            training_readiness: row.training_readiness,
            stress_score: row.stress_score
          });
        
        if (error) throw error;
        imported++;
      }
    } catch (error: any) {
      logger.error(`Error importing health data for date ${row.date}:`, error);
      errors++;
    }
  }
  
  return { imported, errors };
}

/**
 * Imports activity data (2,012 activities)
 */
async function importActivityData(
  supabase: any,
  userId: string,
  activityDataPath: string,
  activityDetailsMap: Map<string | number, ActivityDetailData>
): Promise<{ imported: number; errors: number }> {
  logger.info(`Reading activity data from: ${activityDataPath}`);
  
  const fileContent = fs.readFileSync(activityDataPath, 'utf-8');
  const activityData: ActivityDataRow[] = JSON.parse(fileContent);
  
  logger.info(`Found ${activityData.length} activity records`);
  
  let imported = 0;
  let errors = 0;
  
  for (const row of activityData) {
    try {
      const activityId = String(row.activity_id);
      
      // Validate and parse start time
      const startTimeStr = row.start_time;
      if (!startTimeStr || startTimeStr === null || startTimeStr === undefined || startTimeStr === '') {
        logger.warn(`Skipping activity ${activityId}: Missing start time`);
        errors++;
        continue;
      }
      
      let startTime: Date;
      try {
        startTime = new Date(startTimeStr);
        if (isNaN(startTime.getTime())) {
          logger.warn(`Skipping activity ${activityId}: Invalid start time format: ${startTimeStr}`);
          errors++;
          continue;
        }
      } catch (dateError) {
        logger.warn(`Skipping activity ${activityId}: Error parsing start time "${startTimeStr}":`, dateError);
        errors++;
        continue;
      }
      
      const sessionDate = startTime.toISOString().split('T')[0];
      
      const durationMinutes = parseDurationToMinutes(row.duration);
      // Convert distance_km from string to number if needed
      const distanceKm = typeof row.distance_km === 'string' ? parseFloat(row.distance_km) : (row.distance_km || null);
      
      // Get activity details if available
      const details = activityDetailsMap.get(row.activity_id) || activityDetailsMap.get(Number(row.activity_id));
      
      // Helper to convert string numbers to numbers
      const toNumber = (val: string | number | null | undefined): number | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        const num = parseFloat(String(val));
        return isNaN(num) ? null : num;
      };
      
      // Build metadata with biomechanical metrics
      const metadata: any = {
        activityId: activityId,
        distanceKm: distanceKm || (details?.distance ? (details.distance / 1000) : null),
        distanceInMeters: details?.distance || null,
        avgPace: row.avg_pace ? String(row.avg_pace) : null,
        averagePace: parsePaceToSeconds(row.avg_pace),
        maxPace: row.max_pace ? String(row.max_pace) : null,
        avgHR: toNumber(row.avg_hr) || details?.averageHR || null,
        maxHR: toNumber(row.max_hr) || details?.maxHR || null,
        avgCadence: toNumber(row.cadence) || details?.averageRunCadence || null,
        calories: toNumber(row.calories) || details?.calories || null,
        elevationGain: toNumber(row.elevation_gain) || details?.elevationGain || null,
        elevationLoss: toNumber(row.elevation_loss) || null,
        trainingEffect: row.training_effect || null,
        // Biomechanical metrics
        groundContactTime: details?.groundContactTime || null,
        strideLength: details?.strideLength || null,
        verticalOscillation: details?.verticalOscillation || null,
        verticalRatio: details?.verticalRatio || null,
        averagePower: toNumber(row.power) || details?.averagePower || null,
        maxPower: details?.maxPower || null,
        normalizedPower: details?.normalizedPower || null,
        avgStepFrequency: details?.avgStepFrequency || null,
        avgGradeAdjustedSpeed: details?.avgGradeAdjustedSpeed || null,
        movingDuration: details?.movingDuration || null
      };
      
      // Check if activity already exists (by activity_id in metadata)
      const { data: existing } = await supabase
        .from('session_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('session_date', sessionDate)
        .contains('metadata', { activityId: activityId })
        .maybeSingle();
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('session_logs')
          .update({
            duration_minutes: durationMinutes,
            metadata: metadata,
            hr_source: mapHrSource(row.hr_source),
            device: row.device || null
          })
          .eq('id', existing.id);
        
        if (error) throw error;
        imported++;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('session_logs')
          .insert({
            user_id: userId,
            session_date: sessionDate,
            sport_type: row.sport_type?.toUpperCase() === 'RUNNING' ? 'RUNNING' : 
                        row.sport_type?.toUpperCase() === 'CYCLING' ? 'CYCLING' :
                        row.sport_type?.toUpperCase() === 'STRENGTH' ? 'STRENGTH' : 'OTHER',
            duration_minutes: durationMinutes,
            source: 'garmin_health',
            metadata: metadata,
            hr_source: mapHrSource(row.hr_source),
            device: row.device || null
          });
        
        if (error) throw error;
        imported++;
      }
    } catch (error: any) {
      logger.error(`Error importing activity ${row.activity_id}:`, error);
      errors++;
    }
  }
  
  return { imported, errors };
}

/**
 * Main import function
 */
async function main() {
  const healthDataPath = process.env.HEALTH_DATA_PATH || process.argv.find(arg => arg.startsWith('--health-data='))?.split('=')[1];
  const activityDataPath = process.env.ACTIVITY_DATA_PATH || process.argv.find(arg => arg.startsWith('--activity-data='))?.split('=')[1];
  const activityDetailsPath = process.env.ACTIVITY_DETAILS_PATH || process.argv.find(arg => arg.startsWith('--activity-details='))?.split('=')[1];
  
  if (!healthDataPath || !activityDataPath) {
    logger.error('Missing required file paths. Provide --health-data and --activity-data, or set environment variables.');
    process.exit(1);
  }
  
  // Check files exist
  if (!fs.existsSync(healthDataPath)) {
    logger.error(`Health data file not found: ${healthDataPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(activityDataPath)) {
    logger.error(`Activity data file not found: ${activityDataPath}`);
    process.exit(1);
  }
  
  const supabase = createSupabaseClient();
  
  // Verify service role key is being used (should bypass RLS)
  const serviceRoleKey = process.env.SUPABASE_SECRET_DEFAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    logger.warn('⚠️  WARNING: No service role key found. RLS policies will be enforced.');
    logger.warn('   This may cause import failures. Set SUPABASE_SECRET_DEFAULT_KEY in .env.local');
  }
  
  // Get user ID - try multiple methods
  let userId: string | null = null;
  
  // Method 1: Try getUser() (works if session exists)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!userError && user) {
    userId = user.id;
  }
  
  // Method 2: If no user, check if we have a service role key (for CLI scripts)
  if (!userId) {
    const serviceRoleKey = process.env.SUPABASE_SECRET_DEFAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      logger.warn('No user session found. Using service role key.');
      logger.warn('Note: You may need to provide user_id as command line argument.');
      
      // Check for user_id as command line argument
      const userIdArg = process.argv.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
      if (userIdArg) {
        userId = userIdArg;
        logger.info(`Using user_id from command line: ${userId}`);
      } else {
        logger.error('No user session and no --user-id provided.');
        logger.error('Either:');
        logger.error('  1. Log in via the web app first, or');
        logger.error('  2. Run: npx tsx scripts/import-historical-data.ts --user-id=<your-user-id>');
        process.exit(1);
      }
    } else {
      logger.error('Not authenticated. Please log in first via the web app.');
      logger.error('Or provide user_id: npx tsx scripts/import-historical-data.ts --user-id=<your-user-id>');
      process.exit(1);
    }
  }
  
  if (!userId) {
    logger.error('Could not determine user ID');
    process.exit(1);
  }
  
  logger.info(`Importing data for user: ${userId}`);
  
  // Load activity details if provided
  const activityDetailsMap = new Map<string | number, ActivityDetailData>();
  if (activityDetailsPath && fs.existsSync(activityDetailsPath)) {
    logger.info(`Loading activity details from: ${activityDetailsPath}`);
    const detailsContent = fs.readFileSync(activityDetailsPath, 'utf-8');
    const detailsData: Record<string, any> = JSON.parse(detailsContent);
    
    for (const [activityId, activityData] of Object.entries(detailsData)) {
      // Extract data from nested structure (activity details have activity.summaryDTO nested)
      const summary = activityData?.activity?.summaryDTO || activityData?.summaryDTO || activityData?.summary || activityData;
      const details: ActivityDetailData = {
        activityId: activityId,
        distance: summary?.distance || activityData?.distance,
        duration: summary?.duration || activityData?.duration,
        movingDuration: summary?.movingDuration || activityData?.movingDuration,
        elevationGain: summary?.elevationGain || activityData?.elevationGain,
        elevationLoss: summary?.elevationLoss || activityData?.elevationLoss,
        averageSpeed: summary?.averageSpeed || activityData?.averageSpeed,
        averageMovingSpeed: summary?.averageMovingSpeed || activityData?.averageMovingSpeed,
        maxSpeed: summary?.maxSpeed || activityData?.maxSpeed,
        calories: summary?.calories || activityData?.calories,
        bmrCalories: summary?.bmrCalories || activityData?.bmrCalories,
        averageHR: summary?.averageHR || activityData?.averageHR,
        maxHR: summary?.maxHR || activityData?.maxHR,
        averageRunCadence: summary?.averageRunCadence || activityData?.averageRunCadence,
        maxRunCadence: summary?.maxRunCadence || activityData?.maxRunCadence,
        averagePower: summary?.averagePower || activityData?.averagePower,
        maxPower: summary?.maxPower || activityData?.maxPower,
        normalizedPower: summary?.normalizedPower || activityData?.normalizedPower,
        groundContactTime: summary?.groundContactTime || activityData?.groundContactTime,
        strideLength: summary?.strideLength || activityData?.strideLength,
        verticalOscillation: summary?.verticalOscillation || activityData?.verticalOscillation,
        verticalRatio: summary?.verticalRatio || activityData?.verticalRatio,
        avgStepFrequency: summary?.avgStepFrequency || activityData?.avgStepFrequency,
        avgGradeAdjustedSpeed: summary?.avgGradeAdjustedSpeed || activityData?.avgGradeAdjustedSpeed
      };
      
      activityDetailsMap.set(activityId, details);
      activityDetailsMap.set(Number(activityId), details); // Also index by number
    }
    logger.info(`Loaded ${activityDetailsMap.size} activity detail records`);
  }
  
  // Import health data
  logger.info('Starting health data import...');
  const healthResult = await importHealthData(supabase, userId, healthDataPath);
  logger.info(`Health data: ${healthResult.imported} imported, ${healthResult.errors} errors`);
  
  // Import activity data
  logger.info('Starting activity data import...');
  const activityResult = await importActivityData(supabase, userId, activityDataPath, activityDetailsMap);
  logger.info(`Activity data: ${activityResult.imported} imported, ${activityResult.errors} errors`);
  
  logger.info('Import complete!');
  logger.info(`Total: ${healthResult.imported + activityResult.imported} records imported, ${healthResult.errors + activityResult.errors} errors`);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Import failed:', error);
    process.exit(1);
  });
}

export { importHealthData, importActivityData };