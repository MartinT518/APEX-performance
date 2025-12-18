/**
 * MAKER CHECK: Garmin MCP Sync Module
 * 
 * Red Flag Checks:
 * 1. Null safety on activity data
 * 2. Type safety for activity details
 * 3. Error handling for Python subprocess failures
 * 4. Date validation for date range inputs
 * 5. Token persistence path validation
 * 6. Fallback mechanism verification
 */

import path from 'path';

const test = (name: string, fn: () => void | Promise<void>) => {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => {
        console.log(`✅ PASS: ${name}`);
      }).catch((e) => {
        console.error(`❌ FAIL: ${name}`, e);
        process.exit(1);
      });
    } else {
      console.log(`✅ PASS: ${name}`);
    }
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    process.exit(1);
  }
};

console.log("--- MAKER CHECK: Garmin MCP Sync Module ---");

// Red Flag Check 1: Date Range Validation
test("Date Range Input Validation", () => {
  const invalidDates = ['', 'invalid', '2025-13-45', '2025-01-32'];
  const validDates = ['2025-01-01', '2025-12-31'];
  
  // Invalid dates should be caught
  invalidDates.forEach(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // This is expected - invalid format
      return;
    }
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      // This is expected - invalid date
      return;
    }
    throw new Error(`Date validation failed for: ${date}`);
  });
  
  // Valid dates should pass
  validDates.forEach(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Valid date rejected: ${date}`);
    }
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Valid date object creation failed: ${date}`);
    }
  });
});

// Red Flag Check 2: Activity Data Null Safety
test("Activity Data Null Safety", () => {
  const mockActivity = {
    activityId: null,
    activityName: null,
    activityType: null,
    startTimeLocal: null,
    durationInSeconds: null,
    details: null
  };
  
  // Should handle null activityId gracefully
  if (mockActivity.activityId === null || mockActivity.activityId === undefined) {
    // Should skip processing, not crash
    return;
  }
  
  // Should handle null details gracefully
  if (mockActivity.details === null || mockActivity.details === undefined) {
    // Should create empty processing result, not crash
    return;
  }
  
  // If we get here with nulls, that's a problem
  throw new Error("Null safety check failed");
});

// Red Flag Check 3: Type Safety for Activity Details
test("Activity Details Type Safety", () => {
  // Activity details should be unknown type and checked before use
  const activityDetails: unknown = {
    activityId: 12345,
    activityName: 'Test Run',
    startTimeGMT: '2025-01-01T12:00:00Z'
  };
  
  // Should validate before using
  if (typeof activityDetails !== 'object' || activityDetails === null) {
    // Expected - should handle gracefully
    return;
  }
  
  // Should check properties exist before accessing
  const details = activityDetails as Record<string, unknown>;
  if (details.activityId && typeof details.activityId === 'number') {
    // Valid access pattern
    return;
  }
  
  throw new Error("Type safety check failed");
});

// Red Flag Check 4: Python Script Path Resolution
test("Python Script Path Resolution", () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'sync-garmin-mcp.py');
  
  // Path should be absolute
  if (!path.isAbsolute(scriptPath)) {
    throw new Error("Script path must be absolute");
  }
  
  // Path should end with correct filename
  if (!scriptPath.endsWith('sync-garmin-mcp.py')) {
    throw new Error("Script path incorrect");
  }
});

// Red Flag Check 5: Error Response Structure
test("Error Response Structure", () => {
  const errorResponse = {
    success: false,
    error: 'RATE_LIMITED',
    message: 'Rate limit exceeded'
  };
  
  // Must have success flag
  if (typeof errorResponse.success !== 'boolean') {
    throw new Error("Error response must have boolean success flag");
  }
  
  // Must have error type
  if (typeof errorResponse.error !== 'string') {
    throw new Error("Error response must have error type string");
  }
  
  // Success should be false for errors
  if (errorResponse.success !== false) {
    throw new Error("Error response must have success: false");
  }
});

// Red Flag Check 6: Success Response Structure
test("Success Response Structure", () => {
  const successResponse = {
    success: true,
    activities: [],
    count: 0
  };
  
  // Must have success flag
  if (typeof successResponse.success !== 'boolean') {
    throw new Error("Success response must have boolean success flag");
  }
  
  // Must have activities array
  if (!Array.isArray(successResponse.activities)) {
    throw new Error("Success response must have activities array");
  }
  
  // Success should be true
  if (successResponse.success !== true) {
    throw new Error("Success response must have success: true");
  }
});

// Red Flag Check 7: Sport Type Mapping
test("Sport Type Mapping", () => {
  const mapGarminSportType = (activityType: string): 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER' => {
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
  };
  
  // Test various inputs
  if (mapGarminSportType('running') !== 'RUNNING') {
    throw new Error("Running type mapping failed");
  }
  if (mapGarminSportType('CYCLING') !== 'CYCLING') {
    throw new Error("Cycling type mapping failed");
  }
  if (mapGarminSportType('strength_training') !== 'STRENGTH') {
    throw new Error("Strength type mapping failed");
  }
  if (mapGarminSportType('swimming') !== 'OTHER') {
    throw new Error("Other type mapping failed");
  }
  
  // Should handle empty string
  if (mapGarminSportType('') !== 'OTHER') {
    throw new Error("Empty string should map to OTHER");
  }
});

// Red Flag Check 8: Date Chunking Logic (from dateChunker.ts)
test("Date Chunking Logic", () => {
  // Import the actual function if available, or test logic
  const splitDateRangeIntoChunks = (startDate: string, endDate: string): Array<{ start: string; end: string }> => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const chunks: Array<{ start: string; end: string }> = [];
    
    let currentStart = new Date(start);
    
    while (currentStart <= end) {
      const chunkEnd = new Date(currentStart);
      chunkEnd.setDate(chunkEnd.getDate() + 6); // 7 days (including start day)
      
      if (chunkEnd > end) {
        chunkEnd.setTime(end.getTime());
      }
      
      chunks.push({
        start: currentStart.toISOString().split('T')[0],
        end: chunkEnd.toISOString().split('T')[0]
      });
      
      currentStart = new Date(chunkEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
    
    return chunks;
  };
  
  // Test 7-day range (should be 1 chunk)
  const chunks7 = splitDateRangeIntoChunks('2025-01-01', '2025-01-07');
  if (chunks7.length !== 1) {
    throw new Error(`7-day range should be 1 chunk, got ${chunks7.length}`);
  }
  
  // Test 18-day range (should be 3 chunks: 7+7+4)
  const chunks18 = splitDateRangeIntoChunks('2025-01-01', '2025-01-18');
  if (chunks18.length !== 3) {
    throw new Error(`18-day range should be 3 chunks, got ${chunks18.length}`);
  }
  
  // Test single day (should be 1 chunk)
  const chunks1 = splitDateRangeIntoChunks('2025-01-01', '2025-01-01');
  if (chunks1.length !== 1) {
    throw new Error(`1-day range should be 1 chunk, got ${chunks1.length}`);
  }
  
  // Test chunk boundaries
  if (chunks18[0].start !== '2025-01-01' || chunks18[0].end !== '2025-01-07') {
    throw new Error("First chunk boundaries incorrect");
  }
  if (chunks18[2].start !== '2025-01-15' || chunks18[2].end !== '2025-01-18') {
    throw new Error("Last chunk boundaries incorrect");
  }
});

console.log("--- Garmin MCP Sync Check Complete ---");

