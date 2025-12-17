/**
 * Garmin Connect API Type Definitions
 * Based on Garmin Connect API structure
 */

export interface IGarminMetricDescriptor {
  key: string;
  unit?: string;
  name?: string;
}

export interface IGarminMetricEntry {
  metrics: number[];
  [key: string]: unknown;
}

export interface IGarminActivityDetails {
  activityId?: string | number;
  activityType?: string;
  activityDetailMetrics?: IGarminMetricEntry[];
  metricDescriptors?: IGarminMetricDescriptor[];
  [key: string]: unknown;
}

export interface IGarminActivity {
  activityId: number | string;
  activityName: string;
  activityType?: string;
  startTimeGMT?: string;
  [key: string]: unknown;
}

