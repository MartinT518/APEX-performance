import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { GarminClient } from '../../monitor/ingestion/garminClient';
import type { IPhenotypeProfile } from '@/types/phenotype';
import { logger } from '@/lib/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load env for server-side usage
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Initializes DailyCoach: loads profile and Garmin client
 */
export async function initializeDailyCoach(): Promise<{
  profile: IPhenotypeProfile | null;
  garminClient: GarminClient | null;
}> {
  logger.info(">> Step 1: Initialization");
  
  // 1. Load Profile
  const phenotypeStore = usePhenotypeStore.getState();
  if (!phenotypeStore.profile) {
    await phenotypeStore.loadProfile();
  }

  // 2. Init Garmin Client (Best Effort)
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  
  let garminClient: GarminClient | null = null;
  
  if (email && password) {
    try {
      garminClient = new GarminClient({ email, password });
      await garminClient.login();
      logger.info("✅ Garmin Client Initialized & Logged In");
    } catch (err) {
      // Don't log error details that might contain credentials
      logger.warn("⚠️ Garmin Login Failed (Running in Offline Mode)");
      garminClient = null;
    }
  } else {
    logger.info("ℹ️ No Garmin Credentials found. Running in Simulation Mode.");
  }

  return {
    profile: usePhenotypeStore.getState().profile,
    garminClient,
  };
}

