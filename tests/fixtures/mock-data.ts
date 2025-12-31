/**
 * Mock data for testing (Garmin API, Supabase, LLM responses)
 */

export const mockGarminActivityResponse = {
  activities: [
    {
      activityId: '123456789',
      activityName: 'Morning Run',
      startTimeLocal: '2025-01-15T06:00:00',
      duration: 3600,
      distance: 10000,
      averageHeartRate: 150,
      maxHeartRate: 175,
      sportType: { key: 'running' },
    },
  ],
};

export const mockGarminHealthResponse = {
  calendarDate: '2025-01-15',
  hrv: { weeklyAvg: 45 },
  restingHeartRate: 45,
  sleepSeconds: 28800,
  bodyBattery: 85,
  stress: 25,
};

export const mockSupabaseQueryResponse = {
  data: [],
  error: null,
};

export const mockLLMNarrativeResponse = {
  prescription: 'Complete a 60-minute threshold run with 3x10min intervals at Z4.',
  rationale: 'Your HRV is stable (45ms) and niggle score is low (2/10). All systems are green, allowing for planned intensity work.',
  citedInputs: ['HRV: 45ms', 'Niggle: 2/10', 'Last strength: 2 days ago'],
  confidence: 0.85,
};
