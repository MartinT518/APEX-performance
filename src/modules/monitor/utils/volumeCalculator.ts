/**
 * Volume Calculator Utility
 * 
 * Calculates distance from session data using multiple fallback strategies:
 * 1. distanceKm from metadata (preferred)
 * 2. distanceInMeters from metadata (convert to km)
 * 3. Calculate from pace (averagePace in seconds per km)
 * 4. Parse pace string (e.g., "5:00/km")
 * 5. Fallback to rough estimate (minutes/5) with warning
 */

import { logger } from '@/lib/logger';

interface SessionMetadata {
  distanceKm?: number;
  distanceInMeters?: number;
  averagePace?: number; // seconds per km
  avgPace?: string; // e.g., "5:00/km"
}

interface SessionWithMetadata {
  id?: string | number;
  duration_minutes?: number | null;
  metadata?: SessionMetadata | null;
}

/**
 * Calculates distance in km from session data
 * Uses multiple fallback strategies to get the most accurate distance
 */
export function calculateDistanceFromSession(session: SessionWithMetadata): number {
  // Priority 1: Use distanceKm from metadata
  if (session.metadata?.distanceKm && typeof session.metadata.distanceKm === 'number') {
    return session.metadata.distanceKm;
  }
  
  // Priority 2: Use distanceInMeters
  if (session.metadata?.distanceInMeters && typeof session.metadata.distanceInMeters === 'number') {
    return session.metadata.distanceInMeters / 1000;
  }
  
  // Priority 3: Calculate from pace (averagePace in seconds per km)
  const paceSeconds = session.metadata?.averagePace;
  if (paceSeconds && typeof paceSeconds === 'number' && paceSeconds > 0 && session.duration_minutes) {
    const durationSeconds = session.duration_minutes * 60;
    const distance = durationSeconds / paceSeconds;
    if (distance > 0 && distance < 1000) { // Sanity check: reasonable distance
      return distance;
    }
  }
  
  // Priority 4: Parse pace string (e.g., "5:00/km")
  const paceStr = session.metadata?.avgPace;
  if (paceStr && typeof paceStr === 'string' && session.duration_minutes) {
    try {
      // Handle formats like "5:00/km" or "5:00"
      const pacePart = paceStr.split('/')[0].trim();
      const [min, sec] = pacePart.split(':').map(Number);
      if (!isNaN(min) && !isNaN(sec) && min >= 0 && sec >= 0 && sec < 60) {
        const paceSecondsPerKm = (min * 60) + sec;
        if (paceSecondsPerKm > 0) {
          const durationSeconds = session.duration_minutes * 60;
          const distance = durationSeconds / paceSecondsPerKm;
          if (distance > 0 && distance < 1000) { // Sanity check
            return distance;
          }
        }
      }
    } catch (e) {
      // Invalid pace string format, continue to fallback
    }
  }
  
  // Fallback: rough estimate (log warning)
  if (session.id) {
    logger.warn('Using fallback distance estimate (minutes/5) for session', { sessionId: session.id });
  }
  return (session.duration_minutes || 0) / 5;
}
