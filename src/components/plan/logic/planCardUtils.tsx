"use client";

import { Footprints, Bike, Dumbbell } from 'lucide-react';
import { WorkoutType } from '@/types/workout';
import type { ReactElement } from 'react';

export function renderModalityIcon(type: WorkoutType): ReactElement {
  const className = "h-6 w-6";
  switch (type) {
    case 'RUN':
      return <Footprints className={className} />;
    case 'BIKE':
      return <Bike className={className} />;
    case 'STRENGTH':
      return <Dumbbell className={className} />;
    default:
      return <Footprints className={className} />;
  }
}

export function getZoneLabel(zone: string): string {
  const labels: Record<string, string> = {
    'Z1_RECOVERY': 'Recovery',
    'Z2_ENDURANCE': 'Endurance',
    'Z3_TEMPO': 'Tempo',
    'Z4_THRESHOLD': 'Threshold',
    'Z5_VO2MAX': 'VO2 Max'
  };
  return labels[zone] || zone;
}

