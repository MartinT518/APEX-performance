import { ISessionStream, ISessionDataPoint } from '@/types/session';
import type { IGarminActivityDetails, IGarminMetricDescriptor, IGarminMetricEntry } from '@/types/garmin';

/**
 * Adapter to transform Garmin Activity Details into APEX Session Stream.
 * 
 * Target Schema:
 * ISessionDataPoint {
 *   timestamp: number;
 *   heartRate?: number;
 *   speed?: number;
 *   cadence?: number;
 *   power?: number;
 * }
 */
export const adaptGarminToSessionStream = (activityDetails: unknown): ISessionStream => {
  const details = activityDetails as IGarminActivityDetails;
  const id = details?.activityId ? String(details.activityId) : 'unknown';
  
  const stream: ISessionStream = {
    id: id,
    source: 'garmin_health',
    sportType: 'RUNNING', // Default, should parse from activityType
    dataPoints: []
  };

  // Safe checks for data existence
  if (!details?.activityDetailMetrics) {
    console.warn('No metrics found in activity details');
    return stream;
  }

  // Garmin Metrics Indices (based on common patterns, may vary by device)
  // Typically: 
  // 0: Time offset?
  // 3: Speed?
  // 5: Distance?
  // HR is usually a specific index found via metricDescriptors
  
  const descriptors: IGarminMetricDescriptor[] = details.metricDescriptors || [];
  const hrIndex = descriptors.findIndex((d: IGarminMetricDescriptor) => d.key === 'directHeartRate');
  const speedIndex = descriptors.findIndex((d: IGarminMetricDescriptor) => d.key === 'directSpeed');
  const cadenceIndex = descriptors.findIndex((d: IGarminMetricDescriptor) => d.key === 'directRunCadence');
  const powerIndex = descriptors.findIndex((d: IGarminMetricDescriptor) => d.key === 'directPower');
  const timestampIndex = descriptors.findIndex((d: IGarminMetricDescriptor) => d.key === 'directTimestamp'); // Sometimes absent, use relative

  // Iterate over metrics
  details.activityDetailMetrics.forEach((metricEntry: IGarminMetricEntry) => {
    const values = metricEntry.metrics;
    
    const point: ISessionDataPoint = {
      timestamp: Date.now(), // Fallback if no real time
    };

    // If we have indices, map them
    if (hrIndex !== -1 && values[hrIndex] !== undefined) point.heartRate = values[hrIndex];
    if (speedIndex !== -1 && values[speedIndex] !== undefined) point.speed = values[speedIndex];
    if (cadenceIndex !== -1 && values[cadenceIndex] !== undefined) point.cadence = values[cadenceIndex];
    if (powerIndex !== -1 && values[powerIndex] !== undefined) point.power = values[powerIndex];

    // Filter out empty points
    if (point.heartRate || point.speed || point.cadence) {
      stream.dataPoints.push(point);
    }
  });

  return stream;
};
