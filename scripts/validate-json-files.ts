/**
 * Validates JSON files for historical data import
 * Checks structure, field names, data types, and compatibility
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface ValidationResult {
  file: string;
  valid: boolean;
  recordCount: number;
  errors: string[];
  warnings: string[];
  sampleRecord?: any;
}

function validateHealthData(filePath: string): ValidationResult {
  const result: ValidationResult = {
    file: path.basename(filePath),
    valid: true,
    recordCount: 0,
    errors: [],
    warnings: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      result.valid = false;
      result.errors.push('File is not a JSON array');
      return result;
    }

    result.recordCount = data.length;

    // Expected fields (snake_case)
    const expectedFields = [
      'date', 'hrv', 'hrv_method', 'resting_hr', 'sleep_duration',
      'sleep_score', 'rem_percent', 'deep_percent', 'light_percent',
      'bedtime', 'wake_time', 'body_battery', 'training_readiness', 'stress_score'
    ];

    // Check first few records
    const sampleSize = Math.min(10, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = data[i];
      if (!record) continue;

      // Check for required field
      if (!record.date) {
        result.errors.push(`Record ${i}: Missing 'date' field`);
        result.valid = false;
      }

      // Check field names match expected format
      const recordFields = Object.keys(record);
      const unexpectedFields = recordFields.filter(f => !expectedFields.includes(f));
      if (unexpectedFields.length > 0 && i === 0) {
        result.warnings.push(`Unexpected fields found: ${unexpectedFields.join(', ')}`);
      }

      // Check for Title Case fields (old format)
      const titleCaseFields = recordFields.filter(f => /^[A-Z]/.test(f));
      if (titleCaseFields.length > 0) {
        result.errors.push(`Record ${i}: Found Title Case fields (expected snake_case): ${titleCaseFields.join(', ')}`);
        result.valid = false;
      }
    }

    // Store sample record
    if (data.length > 0) {
      result.sampleRecord = data[0];
    }

  } catch (error: any) {
    result.valid = false;
    result.errors.push(`Parse error: ${error.message}`);
  }

  return result;
}

function validateActivityData(filePath: string): ValidationResult {
  const result: ValidationResult = {
    file: path.basename(filePath),
    valid: true,
    recordCount: 0,
    errors: [],
    warnings: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      result.valid = false;
      result.errors.push('File is not a JSON array');
      return result;
    }

    result.recordCount = data.length;

    // Expected fields (snake_case)
    const expectedFields = [
      'activity_id', 'start_time', 'sport_type', 'duration', 'distance_km',
      'elevation_gain', 'elevation_loss', 'avg_hr', 'max_hr', 'hr_source',
      'avg_pace', 'max_pace', 'cadence', 'power', 'calories',
      'training_effect', 'device'
    ];

    // Check first few records
    const sampleSize = Math.min(10, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = data[i];
      if (!record) continue;

      // Check for required fields
      if (!record.activity_id) {
        result.errors.push(`Record ${i}: Missing 'activity_id' field`);
        result.valid = false;
      }
      if (!record.start_time) {
        result.errors.push(`Record ${i}: Missing 'start_time' field`);
        result.valid = false;
      }

      // Check field names match expected format
      const recordFields = Object.keys(record);
      const unexpectedFields = recordFields.filter(f => !expectedFields.includes(f));
      if (unexpectedFields.length > 0 && i === 0) {
        result.warnings.push(`Unexpected fields found: ${unexpectedFields.join(', ')}`);
      }

      // Check for Title Case fields (old format)
      const titleCaseFields = recordFields.filter(f => /^[A-Z]/.test(f) && !f.includes('_'));
      if (titleCaseFields.length > 0) {
        result.errors.push(`Record ${i}: Found Title Case fields (expected snake_case): ${titleCaseFields.join(', ')}`);
        result.valid = false;
      }

      // Validate date format
      if (record.start_time) {
        const date = new Date(record.start_time);
        if (isNaN(date.getTime())) {
          result.errors.push(`Record ${i}: Invalid start_time format: ${record.start_time}`);
          result.valid = false;
        }
      }
    }

    // Store sample record
    if (data.length > 0) {
      result.sampleRecord = data[0];
    }

  } catch (error: any) {
    result.valid = false;
    result.errors.push(`Parse error: ${error.message}`);
  }

  return result;
}

function validateActivityDetails(filePath: string): ValidationResult {
  const result: ValidationResult = {
    file: path.basename(filePath),
    valid: true,
    recordCount: 0,
    errors: [],
    warnings: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (typeof data !== 'object' || Array.isArray(data)) {
      result.valid = false;
      result.errors.push('File should be a JSON object (keyed by activity_id)');
      return result;
    }

    result.recordCount = Object.keys(data).length;

    // Check first few entries
    const entries = Object.entries(data);
    const sampleSize = Math.min(5, entries.length);

    for (let i = 0; i < sampleSize; i++) {
      const [activityId, activityData] = entries[i] as [string, any];
      
      // Check if it has summaryDTO or summary
      if (!activityData.summaryDTO && !activityData.summary && typeof activityData !== 'object') {
        result.warnings.push(`Activity ${activityId}: No summaryDTO or summary found, may need flat structure`);
      }

      // Check for biomechanical metrics
      const summary = activityData?.summaryDTO || activityData?.summary || activityData;
      const hasBiomechanical = summary?.groundContactTime || summary?.strideLength || summary?.verticalOscillation;
      if (!hasBiomechanical && i === 0) {
        result.warnings.push('No biomechanical metrics found in sample records');
      }
    }

    // Store sample entry
    if (entries.length > 0) {
      const [firstId, firstData] = entries[0] as [string, any];
      result.sampleRecord = { activityId: firstId, hasSummaryDTO: !!firstData.summaryDTO, hasSummary: !!firstData.summary };
    }

  } catch (error: any) {
    result.valid = false;
    result.errors.push(`Parse error: ${error.message}`);
  }

  return result;
}

async function main() {
  console.log('🔍 Validating JSON files for historical data import...\n');

  const dataDir = path.resolve(process.cwd(), 'data');
  const healthPath = path.join(dataDir, 'garmin_export_health_daily.json');
  const activityPath = path.join(dataDir, 'garmin_export_activities.json');
  const activityDetailsPath = path.join(dataDir, 'garmin_export_activity_details.json');

  const results: ValidationResult[] = [];

  // Validate health data
  if (fs.existsSync(healthPath)) {
    console.log('📊 Validating health data...');
    const healthResult = validateHealthData(healthPath);
    results.push(healthResult);
  } else {
    console.log('⚠️  Health data file not found');
  }

  // Validate activity data
  if (fs.existsSync(activityPath)) {
    console.log('🏃 Validating activity data...');
    const activityResult = validateActivityData(activityPath);
    results.push(activityResult);
  } else {
    console.log('⚠️  Activity data file not found');
  }

  // Validate activity details
  if (fs.existsSync(activityDetailsPath)) {
    console.log('📈 Validating activity details...');
    const detailsResult = validateActivityDetails(activityDetailsPath);
    results.push(detailsResult);
  } else {
    console.log('⚠️  Activity details file not found (optional)');
  }

  // Print results
  console.log('\n' + '='.repeat(60) + '\n');
  
  let allValid = true;
  for (const result of results) {
    const status = result.valid ? '✅' : '❌';
    console.log(`${status} ${result.file}`);
    console.log(`   Records: ${result.recordCount.toLocaleString()}`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach(err => console.log(`     - ${err}`));
      if (result.errors.length > 5) {
        console.log(`     ... and ${result.errors.length - 5} more`);
      }
      allValid = false;
    }
    
    if (result.warnings.length > 0) {
      console.log(`   Warnings: ${result.warnings.length}`);
      result.warnings.slice(0, 3).forEach(warn => console.log(`     ⚠️  ${warn}`));
    }
    
    if (result.sampleRecord) {
      console.log(`   Sample: ${JSON.stringify(result.sampleRecord, null, 2).split('\n').slice(0, 3).join('\n')}...`);
    }
    
    console.log('');
  }

  console.log('='.repeat(60) + '\n');

  if (allValid) {
    console.log('✅ All files are valid and compatible with the import script!');
    console.log('\nYou can now run the import:');
    console.log('  npx tsx scripts/import-historical-data.ts --user-id=<your-user-id>\n');
    process.exit(0);
  } else {
    console.log('❌ Some files have errors. Please fix them before importing.\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { validateHealthData, validateActivityData, validateActivityDetails };
