/**
 * Mock Garmin API responses for testing
 */

export interface MockGarminActivity {
  activityId: string;
  activityName: string;
  startTimeLocal: string;
  duration: number;
  distance?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  sportType: {
    key: string;
  };
}

export interface MockGarminHealthData {
  calendarDate: string;
  hrv?: {
    weeklyAvg: number;
  };
  restingHeartRate?: number;
  sleepSeconds?: number;
  bodyBattery?: number;
  stress?: number;
}

export const mockGarminActivities: MockGarminActivity[] = [
  {
    activityId: '123456789',
    activityName: 'Morning Run',
    startTimeLocal: '2025-01-15T06:00:00',
    duration: 3600, // 60 minutes
    distance: 10000, // 10km
    averageHeartRate: 150,
    maxHeartRate: 175,
    sportType: { key: 'running' },
  },
  {
    activityId: '123456790',
    activityName: 'Long Run',
    startTimeLocal: '2025-01-14T07:00:00',
    duration: 7200, // 120 minutes
    distance: 20000, // 20km
    averageHeartRate: 145,
    maxHeartRate: 170,
    sportType: { key: 'running' },
  },
];

export const mockGarminHealthData: MockGarminHealthData[] = [
  {
    calendarDate: '2025-01-15',
    hrv: { weeklyAvg: 45 },
    restingHeartRate: 45,
    sleepSeconds: 28800, // 8 hours
    bodyBattery: 85,
    stress: 25,
  },
  {
    calendarDate: '2025-01-14',
    hrv: { weeklyAvg: 42 },
    restingHeartRate: 46,
    sleepSeconds: 25200, // 7 hours
    bodyBattery: 80,
    stress: 30,
  },
];

export function createMockGarminClient() {
  return {
    getActivitiesByDate: async (startDate: string, endDate: string) => {
      return mockGarminActivities.filter((activity) => {
        const activityDate = activity.startTimeLocal.split('T')[0];
        return activityDate >= startDate && activityDate <= endDate;
      });
    },
    getActivity: async (activityId: string) => {
      const activity = mockGarminActivities.find((a) => a.activityId === activityId);
      if (!activity) {
        throw new Error(`Activity ${activityId} not found`);
      }
      return {
        ...activity,
        details: {
          heartRateStream: Array.from({ length: activity.duration }, () => activity.averageHeartRate || 150),
          cadenceStream: Array.from({ length: activity.duration }, () => 180),
        },
      };
    },
    getHealthData: async (startDate: string, endDate: string) => {
      return mockGarminHealthData.filter((data) => {
        return data.calendarDate >= startDate && data.calendarDate <= endDate;
      });
    },
  };
}
