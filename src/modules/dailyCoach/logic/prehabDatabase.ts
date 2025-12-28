export interface PrehabExercise {
  name: string;
  focus: 'Calf' | 'Knee' | 'Hip' | 'Core' | 'Foot' | 'Posterior Chain';
  instructions: string;
}

export class PrehabDatabase {
  static readonly LIBRARY: Record<string, PrehabExercise[]> = {
    'patellar_tendon': [
      { name: 'Spanish Squats', focus: 'Knee', instructions: '5x45sec Iso Hold' },
      { name: 'Poliquin Step Ups', focus: 'Knee', instructions: '3x15 ea' }
    ],
    'achilles': [
      { name: 'Soleus Iso Hold', focus: 'Calf', instructions: '5x45sec heavy' },
      { name: 'Bent Knee Calf Raise', focus: 'Calf', instructions: '3x15 ea' }
    ],
    'hip_flexor': [
      { name: 'Psoas March', focus: 'Hip', instructions: '3x12 ea (banded)' },
      { name: 'Copenhagen Plank', focus: 'Hip', instructions: '3x30sec ea' }
    ],
    'plantar_fascia': [
      { name: 'Big Toe Iso Extension', focus: 'Foot', instructions: '5x30sec' },
      { name: 'Short Foot Modeling', focus: 'Foot', instructions: '20 reps' }
    ],
    'glute_med': [
      { name: 'Clamshells', focus: 'Hip', instructions: '3x20 ea' },
      { name: 'Monster Walk', focus: 'Hip', instructions: '2x15 steps' }
    ],
    'general': [
      { name: 'World’s Greatest Stretch', focus: 'Core', instructions: '5 min flow' },
      { name: 'Single Leg Balance', focus: 'Foot', instructions: '60sec eyes closed' }
    ]
  };

  /**
   * Returns specific prehab exercises based on structural weakness or niggle location.
   */
  static getProtocol(input: { weakness?: string; niggleLocation?: string }): PrehabExercise[] {
      const target = input.niggleLocation || input.weakness || 'general';
      const key = this.normalizeKey(target);
      return this.LIBRARY[key] || this.LIBRARY['general'];
  }

  private static normalizeKey(input: string): string {
      const lower = input.toLowerCase();
      if (lower.includes('knee') || lower.includes('patella')) return 'patellar_tendon';
      if (lower.includes('calf') || lower.includes('achilles')) return 'achilles';
      if (lower.includes('hip') || lower.includes('flexor')) return 'hip_flexor';
      if (lower.includes('foot') || lower.includes('plantar')) return 'plantar_fascia';
      if (lower.includes('glute')) return 'glute_med';
      return 'general';
  }
}
