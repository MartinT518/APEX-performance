export type FilterStatus = 'VALID' | 'DISCARD' | 'SUSPECT';

export interface ISessionDataPoint {
  timestamp: number; // Unix timestamp
  heartRate?: number;
  cadence?: number;
  speed?: number; // m/s
  power?: number; // Watts
  altitude?: number; // Meters
}

export interface ISessionStream {
  id: string;
  source: 'garmin_health' | 'manual_upload' | 'test_mock';
  dataPoints: ISessionDataPoint[];
  sportType: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
}

export interface IFilterDiagnostics {
  status: FilterStatus;
  reason?: string;
  flaggedIndices: number[]; // Indices of data points that failed validation
  originalPointCount: number;
  validPointCount: number;
}
