import { GarminConnect } from 'garmin-connect';
import type { IGarminActivity, IGarminActivityDetails } from '@/types/garmin';
import { logger } from '@/lib/logger';

export interface IGarminConfig {
  email: string;
  password: string;
}

// Utility for delays
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
    } catch (error: any) {
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
}
