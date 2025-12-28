import { GarminConnect } from 'garmin-connect';
import type { IGarminActivity, IGarminActivityDetails } from '@/types/garmin';
import { logger } from '@/lib/logger';

export interface IGarminConfig {
  email: string;
  password: string;
}

// Utility for delays
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface ExtendedGarminConnect {
  getHeartRate?: (date: Date) => Promise<{ restingHeartRate?: number }>;
  getSleepData?: (date: Date) => PromiseLike<{
    dailySleepDTO: {
      sleepTimeSeconds?: number;
      sleepStartTimestampGMT: number;
      sleepEndTimestampGMT: number;
      sleepScores?: { overall?: { value: number } };
    };
  }>;
  getHrvData?: (date: Date) => Promise<{
    hrvSummary?: { lastNightAvg: number };
    lastNightAvg?: number;
  }>;
}

export class GarminClient {
  private client: GarminConnect;
  private maxRetries = 3;
  private baseDelayMs = 5000; // 5 seconds (increased from 2s for better rate limit handling)

  constructor(config: IGarminConfig) {
    if (!config.email || !config.password) {
      throw new Error('Garmin credentials missing');
    }
    this.client = new GarminConnect({
      username: config.email,
      password: config.password
    });
  }

  private async callWithRetry<T>(fn: () => Promise<T>, methodName: string, attempt = 1): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if ((errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests')) && attempt < this.maxRetries) {
        const currentDelay = this.baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`Rate limited during ${methodName}, retrying in ${currentDelay / 1000}s (Attempt ${attempt}/${this.maxRetries})`);
        await delay(currentDelay);
        return this.callWithRetry(fn, methodName, attempt + 1);
      }
      throw error; // Re-throw if not a rate limit or max retries reached
    }
  }

  async login(): Promise<void> {
    await this.callWithRetry(async () => {
      try {
        await this.client.login();
        logger.info('Garmin Login Successful');
      } catch (error) {
        // Don't log error details that might contain credentials
        logger.error('Garmin Login Failed');
        throw error;
      }
    }, 'login');
  }

  async getRecentActivities(limit: number = 5, offset: number = 0): Promise<IGarminActivity[]> {
    return this.callWithRetry(async () => {
      try {
        const activities = await this.client.getActivities(offset, limit);
        return activities;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests')) {
          logger.warn('Rate limited while fetching activities list');
          throw new Error('RATE_LIMITED');
        }
        logger.error('Failed to fetch activities from Garmin');
        return [];
      }
    }, 'getRecentActivities');
  }

  async getActivityDetails(activityId: number): Promise<IGarminActivityDetails | null> {
    return this.callWithRetry(async () => {
      try {
        const details = await this.client.getActivityDetails(activityId);
        return details;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check for rate limiting
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests')) {
          logger.warn(`Rate limited by Garmin when fetching activity ${activityId}`);
          throw new Error('RATE_LIMITED');
        }
        
        logger.error(`Failed to fetch Garmin activity details for ID: ${activityId}`);
        return null;
      }
    }, 'getActivityDetails');
  }

  async getWellnessData(date: string): Promise<any> {
    return this.callWithRetry(async () => {
      try {
        // Use type safe interface
        const client = this.client as unknown as ExtendedGarminConnect;
        
        // Create Date object for library methods
        const dateObj = new Date(date);

        // 1. Fetch RHR
        // Try built-in method first, or fallback if needed
        let rhr = null;
        if (client.getHeartRate) {
           const hrData = await client.getHeartRate(dateObj);
           rhr = hrData?.restingHeartRate;
        }

        // 2. Fetch HRV
        // Endpoint: /hrv-service/hrv/daily/{date}
        let hrv = null;
        try {
           // Try library method first if available (future proofing)
           if (client.getHrvData) {
              const hrvData = await client.getHrvData(dateObj);
              hrv = hrvData?.hrvSummary?.lastNightAvg || hrvData?.lastNightAvg;
           } else {
              logger.debug(`No getHrvData method available, skipping HRV for ${date}`);
           }
        } catch (err) {
            logger.warn(`Failed to fetch HRV data for ${date}`, err);
        }

        // 3. Fetch Sleep
        // Try built-in method first
        let sleepSeconds = null;
        let sleepScore = null;
        
        try {
          if (client.getSleepData) {
            const sleepData = await client.getSleepData(dateObj);
            if (sleepData) {
               sleepSeconds = sleepData.dailySleepDTO?.sleepTimeSeconds || 
                              (sleepData.dailySleepDTO?.sleepEndTimestampGMT - sleepData.dailySleepDTO?.sleepStartTimestampGMT) ||
                              null;
               sleepScore = sleepData.dailySleepDTO?.sleepScores?.overall?.value || null;
            }
          }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
             if (errMsg.includes('<!DOCTYPE') || errMsg.includes('<html')) {
                 logger.warn(`Failed to fetch sleep data for ${date}: HTML Error`);
            } else {
                 logger.warn(`Failed to fetch sleep data for ${date}`, errMsg.substring(0, 200));
            }
        }

        return {
          date,
          rhr,
          hrv,
          sleepSeconds,
          sleepScore
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
           throw new Error('RATE_LIMITED');
        }
        
         if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('<html')) {
             logger.warn(`Failed to fetch wellness data for ${date}: HTML Error`);
        } else {
             logger.warn(`Failed to fetch wellness data for ${date}`, errorMessage.substring(0, 200));
        }
        return null;
      }
    }, 'getWellnessData');
  }
}
