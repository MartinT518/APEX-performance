/**
 * Utility to split date ranges into 7-day chunks for Garmin sync
 * Follows MAKER decomposition principle: single responsibility
 */

export interface DateChunk {
  start: string;
  end: string;
}

/**
 * Splits a date range into 7-day chunks
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of date chunks, each covering up to 7 days
 * 
 * Example:
 * Input: 2025-11-18 to 2025-12-18
 * Output: [
 *   { start: '2025-11-18', end: '2025-11-24' },
 *   { start: '2025-11-25', end: '2025-12-01' },
 *   ...
 * ]
 */
export function splitDateRangeIntoChunks(startDate: string, endDate: string): DateChunk[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  
  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }
  
  const chunks: DateChunk[] = [];
  let currentStart = new Date(start);
  
  while (currentStart <= end) {
    const chunkEnd = new Date(currentStart);
    chunkEnd.setDate(chunkEnd.getDate() + 6); // 7 days (including start day)
    
    // Don't go past the end date
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }
    
    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: chunkEnd.toISOString().split('T')[0]
    });
    
    // Move to next chunk (start from day after current chunk end)
    currentStart = new Date(chunkEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

