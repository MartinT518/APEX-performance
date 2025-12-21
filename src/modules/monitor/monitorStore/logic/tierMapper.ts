import type { TonnageTier } from '../monitorStore';

export type DatabaseStrengthTier = 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | 'Explosive';

/**
 * Maps TonnageTier to database enum
 */
export function tonnageTierToDb(tier: TonnageTier): DatabaseStrengthTier {
  const mapping: Record<TonnageTier, DatabaseStrengthTier> = {
    'maintenance': 'Mobility',
    'hypertrophy': 'Hypertrophy',
    'strength': 'Strength',
    'power': 'Power',
    'explosive': 'Explosive',
  };
  return mapping[tier];
}

/**
 * Maps database enum to TonnageTier
 */
export function dbToTonnageTier(tier: DatabaseStrengthTier): TonnageTier {
  const mapping: Record<DatabaseStrengthTier, TonnageTier> = {
    'Mobility': 'maintenance',
    'Hypertrophy': 'hypertrophy',
    'Strength': 'strength',
    'Power': 'power',
    'Explosive': 'explosive',
  };
  return mapping[tier];
}

