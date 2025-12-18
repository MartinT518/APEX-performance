/**
 * Tests for Garmin sync functionality
 * MAKER Protocol: Test-first approach with edge case coverage
 */

import { splitDateRangeIntoChunks } from '../src/app/history/logic/dateChunker';

// Test helper function
function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => void, expectedError: string): void {
  try {
    fn();
    throw new Error(`Expected function to throw error containing "${expectedError}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes(expectedError)) {
      throw new Error(`Expected error to contain "${expectedError}", but got: ${errorMessage}`);
    }
  }
}

// Test suite
function testDateChunking() {
  console.log('\n=== Testing Garmin Sync - Date Chunking ===');
  
  // Test 1: 30-day range into 5 chunks
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-12-18');
    assertTrue(chunks.length === 5, `Expected 5 chunks, got ${chunks.length}`);
    assertEqual(chunks[0], { start: '2025-11-18', end: '2025-11-24' }, 'Chunk 1 mismatch');
    assertEqual(chunks[1], { start: '2025-11-25', end: '2025-12-01' }, 'Chunk 2 mismatch');
    assertEqual(chunks[2], { start: '2025-12-02', end: '2025-12-08' }, 'Chunk 3 mismatch');
    assertEqual(chunks[3], { start: '2025-12-09', end: '2025-12-15' }, 'Chunk 4 mismatch');
    assertEqual(chunks[4], { start: '2025-12-16', end: '2025-12-18' }, 'Chunk 5 mismatch');
    console.log('✓ Test 1: 30-day range into 5 chunks');
  } catch (error) {
    console.error('✗ Test 1 failed:', error);
    throw error;
  }

  // Test 2: Range less than 7 days
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-20');
    assertTrue(chunks.length === 1, `Expected 1 chunk, got ${chunks.length}`);
    assertEqual(chunks[0], { start: '2025-11-18', end: '2025-11-20' }, 'Single chunk mismatch');
    console.log('✓ Test 2: Range less than 7 days');
  } catch (error) {
    console.error('✗ Test 2 failed:', error);
    throw error;
  }

  // Test 3: Exactly 7 days
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-24');
    assertTrue(chunks.length === 1, `Expected 1 chunk, got ${chunks.length}`);
    assertEqual(chunks[0], { start: '2025-11-18', end: '2025-11-24' }, '7-day chunk mismatch');
    console.log('✓ Test 3: Exactly 7 days');
  } catch (error) {
    console.error('✗ Test 3 failed:', error);
    throw error;
  }

  // Test 4: Exactly 8 days (2 chunks)
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-25');
    assertTrue(chunks.length === 2, `Expected 2 chunks, got ${chunks.length}`);
    assertEqual(chunks[0], { start: '2025-11-18', end: '2025-11-24' }, 'First chunk mismatch');
    assertEqual(chunks[1], { start: '2025-11-25', end: '2025-11-25' }, 'Second chunk mismatch');
    console.log('✓ Test 4: Exactly 8 days (2 chunks)');
  } catch (error) {
    console.error('✗ Test 4 failed:', error);
    throw error;
  }

  // Test 5: Single day range
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-11-18');
    assertTrue(chunks.length === 1, `Expected 1 chunk, got ${chunks.length}`);
    assertEqual(chunks[0], { start: '2025-11-18', end: '2025-11-18' }, 'Single day chunk mismatch');
    console.log('✓ Test 5: Single day range');
  } catch (error) {
    console.error('✗ Test 5 failed:', error);
    throw error;
  }

  // Test 6: Month boundaries
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-28', '2025-12-05');
    assertTrue(chunks.length === 2, `Expected 2 chunks, got ${chunks.length}`);
    assertTrue(chunks[0].start === '2025-11-28', 'Month boundary start mismatch');
    assertTrue(chunks[0].end === '2025-12-04', 'Month boundary end mismatch');
    assertTrue(chunks[1].start === '2025-12-05', 'Second chunk start mismatch');
    assertTrue(chunks[1].end === '2025-12-05', 'Second chunk end mismatch');
    console.log('✓ Test 6: Month boundaries');
  } catch (error) {
    console.error('✗ Test 6 failed:', error);
    throw error;
  }

  // Test 7: Invalid start date
  try {
    assertThrows(() => {
      splitDateRangeIntoChunks('invalid-date', '2025-12-18');
    }, 'Invalid date format');
    console.log('✓ Test 7: Invalid start date throws error');
  } catch (error) {
    console.error('✗ Test 7 failed:', error);
    throw error;
  }

  // Test 8: Invalid end date
  try {
    assertThrows(() => {
      splitDateRangeIntoChunks('2025-11-18', 'invalid-date');
    }, 'Invalid date format');
    console.log('✓ Test 8: Invalid end date throws error');
  } catch (error) {
    console.error('✗ Test 8 failed:', error);
    throw error;
  }

  // Test 9: Start date after end date
  try {
    assertThrows(() => {
      splitDateRangeIntoChunks('2025-12-18', '2025-11-18');
    }, 'Start date must be before');
    console.log('✓ Test 9: Start date after end date throws error');
  } catch (error) {
    console.error('✗ Test 9 failed:', error);
    throw error;
  }

  // Test 10: Year boundaries
  try {
    const chunks = splitDateRangeIntoChunks('2024-12-28', '2025-01-05');
    assertTrue(chunks.length === 2, `Expected 2 chunks, got ${chunks.length}`);
    assertTrue(chunks[0].start === '2024-12-28', 'Year boundary start mismatch');
    assertTrue(chunks[0].end === '2025-01-03', 'Year boundary end mismatch');
    assertTrue(chunks[1].start === '2025-01-04', 'Second chunk start mismatch');
    assertTrue(chunks[1].end === '2025-01-05', 'Second chunk end mismatch');
    console.log('✓ Test 10: Year boundaries');
  } catch (error) {
    console.error('✗ Test 10 failed:', error);
    throw error;
  }

  // Test 11: Chunks are consecutive with no gaps
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-12-18');
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = new Date(chunks[i - 1].end);
      const currStart = new Date(chunks[i].start);
      prevEnd.setDate(prevEnd.getDate() + 1);
      assertTrue(prevEnd.getTime() === currStart.getTime(), `Gap detected between chunk ${i - 1} and ${i}`);
    }
    console.log('✓ Test 11: Chunks are consecutive with no gaps');
  } catch (error) {
    console.error('✗ Test 11 failed:', error);
    throw error;
  }

  // Test 12: Last chunk does not exceed end date
  try {
    const chunks = splitDateRangeIntoChunks('2025-11-18', '2025-12-18');
    const lastChunk = chunks[chunks.length - 1];
    const endDate = new Date('2025-12-18');
    const lastChunkEnd = new Date(lastChunk.end);
    assertTrue(lastChunkEnd.getTime() <= endDate.getTime(), 'Last chunk exceeds end date');
    console.log('✓ Test 12: Last chunk does not exceed end date');
  } catch (error) {
    console.error('✗ Test 12 failed:', error);
    throw error;
  }

  console.log('\n✅ All date chunking tests passed!');
}

// Run tests
if (require.main === module) {
  try {
    testDateChunking();
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

export { testDateChunking };


