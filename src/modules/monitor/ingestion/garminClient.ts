import { GarminConnect } from 'garmin-connect';
import type { IGarminActivity, IGarminActivityDetails } from '@/types/garmin';
import { logger } from '@/lib/logger';

export interface IGarminConfig {
  email: string;
  password: string;
}

export class GarminClient {
  private client: GarminConnect;

  constructor(config: IGarminConfig) {
    if (!config.email || !config.password) {
      throw new Error('Garmin credentials missing');
    }
    this.client = new GarminConnect({
      username: config.email,
      password: config.password
    });
  }

  async login(): Promise<void> {
    try {
      await this.client.login();
      logger.info('Garmin Login Successful');
    } catch (error) {
      // Don't log error details that might contain credentials
      logger.error('Garmin Login Failed');
      throw error;
    }
  }

  async getRecentActivities(limit: number = 5): Promise<IGarminActivity[]> {
    try {
      const activities = await this.client.getActivities(0, limit);
      return activities;
    } catch (error) {
      logger.error('Failed to fetch activities from Garmin');
      return [];
    }
  }

  async getActivityDetails(activityId: number): Promise<IGarminActivityDetails | null> {
    try {
      const details = await this.client.getActivityDetails(activityId);
      return details;
    } catch (error) {
      logger.error(`Failed to fetch Garmin activity details for ID: ${activityId}`);
      return null;
    }
  }
}
