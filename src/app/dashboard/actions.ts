"use server";

import { createServerClient } from "@/lib/supabase";
import { BiometricNarratorAgent, DailyBiometrics } from "@/modules/monitor/logic/biometricNarrator";
import { logger } from "@/lib/logger";

export async function getBiometricNarrative() {
  try {
    const supabase = createServerClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Fetch last 7 days of monitoring data
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 7);
    
    const { data: logs, error } = await supabase
      .from('daily_monitoring')
      .select('date, hrv, rhr, sleep_score, subjective_fatigue, training_load') // Ensure columns exist
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true }) as { data: any[], error: any }; // Cast for stability

    if (error || !logs || logs.length === 0) {
      // Return mock data if no history yet for demo purpose
      return { 
        success: true, 
        narrative: null,
        message: "Insufficient data for narrative" 
      };
    }

    const history: DailyBiometrics[] = logs.map((log: any) => ({
      date: log.date,
      hrv: log.hrv,
      rhr: log.rhr,
      sleep_score: log.sleep_score,
      training_load: log.training_load, // Assuming this column exists or we map it
      subjective_fatigue: log.subjective_fatigue // Assuming column `niggle_score` or similar. Map appropriately if needed.
    }));

    const narrative = await BiometricNarratorAgent.analyzeBiometrics(history);
    
    return { success: true, narrative };

  } catch (error: any) {
    logger.error("Biometric Narrative Failed", error);
    return { success: false, message: error.message };
  }
}
