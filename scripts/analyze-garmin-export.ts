/**
 * Analyze Garmin Export File
 * 
 * This script analyzes a Garmin JSON export file to verify:
 * 1. What duration fields are present in the raw data
 * 2. What the Python extract_duration() function would extract
 * 3. What the TypeScript code would receive
 * 
 * Usage:
 *   npx tsx scripts/analyze-garmin-export.ts <path-to-garmin-export.json>
 * 
 * Or pipe JSON directly:
 *   cat garmin-activity.json | npx tsx scripts/analyze-garmin-export.ts
 * 
 * Example Garmin export structure:
 *   - Single activity object
 *   - Array of activities
 *   - Full Garmin API response (activity list or details)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Simulate Python extract_duration() function logic
 */
function extractDurationPython(activity: Record<string, unknown>, details: Record<string, unknown> | null = null): { durationSeconds: number; source: string } {
  let durationSeconds = 0;
  let source = "none";
  
  // Priority 1: Check duration.totalSeconds (if duration is dict)
  const durationObj = activity.duration;
  if (durationObj) {
    if (typeof durationObj === 'object' && durationObj !== null && !Array.isArray(durationObj)) {
      const totalSeconds = (durationObj as Record<string, unknown>).totalSeconds;
      if (totalSeconds && (typeof totalSeconds === 'number') && totalSeconds > 0) {
        return { durationSeconds: Math.floor(totalSeconds), source: "duration.totalSeconds" };
      }
    } else if (typeof durationObj === 'number' && durationObj > 0) {
      return { durationSeconds: Math.floor(durationObj), source: "duration (number)" };
    }
  }
  
  // Priority 2: Check elapsedDuration
  const elapsedDuration = activity.elapsedDuration;
  if (elapsedDuration && typeof elapsedDuration === 'number' && elapsedDuration > 0) {
    return { durationSeconds: Math.floor(elapsedDuration), source: "elapsedDuration" };
  }
  
  // Priority 3: Check elapsedDurationInSeconds
  const elapsedDurationInSeconds = activity.elapsedDurationInSeconds;
  if (elapsedDurationInSeconds && typeof elapsedDurationInSeconds === 'number' && elapsedDurationInSeconds > 0) {
    return { durationSeconds: Math.floor(elapsedDurationInSeconds), source: "elapsedDurationInSeconds" };
  }
  
  // Priority 4: Fall back to details object if available
  if (details) {
    // Check details.duration.totalSeconds
    const detailsDuration = details.duration;
    if (detailsDuration) {
      if (typeof detailsDuration === 'object' && detailsDuration !== null && !Array.isArray(detailsDuration)) {
        const totalSeconds = (detailsDuration as Record<string, unknown>).totalSeconds;
        if (totalSeconds && typeof totalSeconds === 'number' && totalSeconds > 0) {
          return { durationSeconds: Math.floor(totalSeconds), source: "details.duration.totalSeconds" };
        }
      } else if (typeof detailsDuration === 'number' && detailsDuration > 0) {
        return { durationSeconds: Math.floor(detailsDuration), source: "details.duration (number)" };
      }
    }
    
    // Check details.elapsedDuration
    const detailsElapsed = details.elapsedDuration;
    if (detailsElapsed && typeof detailsElapsed === 'number' && detailsElapsed > 0) {
      return { durationSeconds: Math.floor(detailsElapsed), source: "details.elapsedDuration" };
    }
    
    // Check details.elapsedDurationInSeconds
    const detailsElapsedSeconds = details.elapsedDurationInSeconds;
    if (detailsElapsedSeconds && typeof detailsElapsedSeconds === 'number' && detailsElapsedSeconds > 0) {
      return { durationSeconds: Math.floor(detailsElapsedSeconds), source: "details.elapsedDurationInSeconds" };
    }
    
    // Check details.summaryDTO
    const summaryDTO = details.summaryDTO;
    if (summaryDTO && typeof summaryDTO === 'object' && summaryDTO !== null && !Array.isArray(summaryDTO)) {
      const summary = summaryDTO as Record<string, unknown>;
      const summaryElapsed = summary.elapsedDuration;
      if (summaryElapsed && typeof summaryElapsed === 'number' && summaryElapsed > 0) {
        return { durationSeconds: Math.floor(summaryElapsed), source: "details.summaryDTO.elapsedDuration" };
      }
      
      const summaryDuration = summary.duration;
      if (summaryDuration && typeof summaryDuration === 'number' && summaryDuration > 0) {
        return { durationSeconds: Math.floor(summaryDuration), source: "details.summaryDTO.duration" };
      }
    }
  }
  
  return { durationSeconds: 0, source: "none" };
}

/**
 * Analyze a single activity object
 */
function analyzeActivity(activity: Record<string, unknown>, index: number = 0) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Activity ${index + 1}`);
  console.log(`${'='.repeat(80)}`);
  
  // Basic info
  console.log(`\n📋 Basic Information:`);
  console.log(`   Activity ID: ${activity.activityId ?? 'N/A'}`);
  console.log(`   Activity Name: ${activity.activityName ?? 'N/A'}`);
  console.log(`   Activity Type: ${JSON.stringify(activity.activityType ?? 'N/A')}`);
  console.log(`   Start Time GMT: ${activity.startTimeGMT ?? 'N/A'}`);
  console.log(`   Start Time Local: ${activity.startTimeLocal ?? 'N/A'}`);
  console.log(`   End Time Local: ${activity.endTimeLocal ?? 'N/A'}`);
  
  // Duration fields in activity
  console.log(`\n⏱️  Duration Fields in Activity Object:`);
  const durationFields = [
    'duration',
    'elapsedDuration',
    'elapsedDurationInSeconds',
    'durationInSeconds',
    'totalDuration',
    'movingDuration',
    'pausedDuration'
  ];
  
  let foundAnyDuration = false;
  durationFields.forEach(field => {
    const value = activity[field];
    if (value !== undefined && value !== null) {
      foundAnyDuration = true;
      const type = typeof value;
      if (type === 'object' && value !== null) {
        console.log(`   ${field}: ${JSON.stringify(value)} (${type})`);
        // Show nested fields
        if (!Array.isArray(value)) {
          Object.keys(value as Record<string, unknown>).forEach(key => {
            const nestedValue = (value as Record<string, unknown>)[key];
            console.log(`      ${key}: ${nestedValue} (${typeof nestedValue})`);
          });
        }
      } else {
        console.log(`   ${field}: ${value} (${type})`);
      }
    }
  });
  
  if (!foundAnyDuration) {
    console.log(`   ⚠️  No duration fields found in activity object!`);
  }
  
  // Check if there's a details object
  const details = activity.details as Record<string, unknown> | undefined;
  if (details) {
    console.log(`\n📊 Duration Fields in Details Object:`);
    let foundDetailsDuration = false;
    durationFields.forEach(field => {
      const value = details[field];
      if (value !== undefined && value !== null) {
        foundDetailsDuration = true;
        const type = typeof value;
        if (type === 'object' && value !== null) {
          console.log(`   details.${field}: ${JSON.stringify(value)} (${type})`);
        } else {
          console.log(`   details.${field}: ${value} (${type})`);
        }
      }
    });
    
    // Check summaryDTO
    const summaryDTO = details.summaryDTO as Record<string, unknown> | undefined;
    if (summaryDTO) {
      console.log(`\n   SummaryDTO duration fields:`);
      durationFields.forEach(field => {
        const value = summaryDTO[field];
        if (value !== undefined && value !== null) {
          console.log(`      summaryDTO.${field}: ${value} (${typeof value})`);
        }
      });
    }
    
    if (!foundDetailsDuration) {
      console.log(`   ⚠️  No duration fields found in details object!`);
    }
  } else {
    console.log(`\n📊 Details Object: Not present`);
  }
  
  // Test Python extraction
  console.log(`\n🔍 Python extract_duration() Simulation:`);
  const pythonResult = extractDurationPython(activity, details || null);
  console.log(`   Extracted Duration: ${pythonResult.durationSeconds} seconds`);
  console.log(`   Source Used: ${pythonResult.source}`);
  
  if (pythonResult.durationSeconds === 0) {
    console.log(`   ❌ FAILED: No duration extracted!`);
    console.log(`   This would result in duration_minutes = 0 in the database.`);
  } else {
    const minutes = Math.floor(pythonResult.durationSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    console.log(`   ✅ SUCCESS: Would store ${minutes} minutes (${hours}h ${remainingMinutes}m)`);
  }
  
  // Show all keys for debugging
  console.log(`\n🔑 All Activity Keys:`);
  const allKeys = Object.keys(activity);
  console.log(`   ${allKeys.join(', ')}`);
  
  // Show raw duration field structure
  if (activity.duration !== undefined) {
    console.log(`\n🔬 Raw Duration Field Structure:`);
    console.log(`   Type: ${typeof activity.duration}`);
    console.log(`   Value: ${JSON.stringify(activity.duration, null, 2)}`);
  }
}

/**
 * Main function
 */
function main() {
  let filePath: string | undefined;
  let jsonData: string;
  
  // Check if file path provided as argument
  if (process.argv.length > 2) {
    filePath = process.argv[2];
    try {
      const resolvedPath = resolve(process.cwd(), filePath);
      jsonData = readFileSync(resolvedPath, 'utf-8');
      console.log(`📁 Reading file: ${resolvedPath}`);
    } catch (error) {
      console.error(`❌ Error reading file: ${error}`);
      process.exit(1);
    }
  } else {
    // Try to read from stdin
    console.log(`📥 Reading from stdin...`);
    console.log(`   (Tip: You can also provide a file path as an argument)`);
    try {
      jsonData = readFileSync(0, 'utf-8');
    } catch (error) {
      console.error(`❌ Error reading from stdin: ${error}`);
      console.error(`\nUsage:`);
      console.error(`  npx tsx scripts/analyze-garmin-export.ts <path-to-file.json>`);
      console.error(`  OR`);
      console.error(`  cat file.json | npx tsx scripts/analyze-garmin-export.ts`);
      process.exit(1);
    }
  }
  
  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch (error) {
    console.error(`❌ Error parsing JSON: ${error}`);
    process.exit(1);
  }
  
  console.log(`\n✅ JSON parsed successfully\n`);
  
  // Handle different JSON structures
  let activities: Record<string, unknown>[] = [];
  
  if (Array.isArray(parsed)) {
    // Array of activities
    console.log(`📦 Detected: Array of ${parsed.length} items`);
    activities = parsed as Record<string, unknown>[];
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    
    // Check if it's a wrapper object with activities array
    if (Array.isArray(obj.activities)) {
      console.log(`📦 Detected: Object with 'activities' array (${obj.activities.length} items)`);
      activities = obj.activities as Record<string, unknown>[];
    } else if (obj.activityId !== undefined || obj.activityName !== undefined) {
      // Single activity object
      console.log(`📦 Detected: Single activity object`);
      activities = [obj];
    } else {
      // Unknown structure, try to analyze as single object
      console.log(`📦 Detected: Unknown object structure, analyzing as single activity`);
      activities = [obj];
    }
  } else {
    console.error(`❌ Unexpected JSON structure: ${typeof parsed}`);
    process.exit(1);
  }
  
  if (activities.length === 0) {
    console.error(`❌ No activities found in JSON`);
    process.exit(1);
  }
  
  console.log(`\n🔍 Analyzing ${activities.length} activity/activities...\n`);
  
  // Analyze each activity
  activities.forEach((activity, index) => {
    analyzeActivity(activity, index);
  });
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Summary`);
  console.log(`${'='.repeat(80)}`);
  
  const extractionResults = activities.map(activity => {
    const details = activity.details as Record<string, unknown> | undefined;
    return extractDurationPython(activity, details || null);
  });
  
  const successful = extractionResults.filter(r => r.durationSeconds > 0).length;
  const failed = extractionResults.filter(r => r.durationSeconds === 0).length;
  
  console.log(`\n✅ Successful extractions: ${successful}/${activities.length}`);
  console.log(`❌ Failed extractions: ${failed}/${activities.length}`);
  
  if (failed > 0) {
    console.log(`\n⚠️  ${failed} activity/activities would result in duration_minutes = 0`);
    console.log(`   This is the root cause of the zero duration issue!`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Check the raw duration fields in the export file`);
    console.log(`   2. Update Python extract_duration() to handle these field names`);
    console.log(`   3. Or update the Garmin API response parsing`);
  } else {
    console.log(`\n✅ All activities have extractable durations!`);
  }
  
  // Show extraction sources used
  console.log(`\n📊 Extraction Sources Used:`);
  const sources = new Map<string, number>();
  extractionResults.forEach(r => {
    sources.set(r.source, (sources.get(r.source) || 0) + 1);
  });
  sources.forEach((count, source) => {
    console.log(`   ${source}: ${count} time(s)`);
  });
}

main();

