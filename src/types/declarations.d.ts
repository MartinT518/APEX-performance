import type { IGarminActivity, IGarminActivityDetails } from './garmin';

declare module 'garmin-connect' {
  export class GarminConnect {
    constructor(credentials: { username: string; password: string });
    login(): Promise<void>;
    getActivities(start: number, limit: number): Promise<IGarminActivity[]>;
    getActivityDetails(activityId: number | string): Promise<IGarminActivityDetails>;
  }
}
