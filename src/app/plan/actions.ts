"use server";

import { createServerClient } from "@/lib/supabase";
import { EliteBlueprintGenerator } from "@/modules/analyze/blueprintGenerator";
import { logger } from "@/lib/logger";
import { getCurrentPhase } from "@/modules/analyze/blueprintEngine";

export async function generateEliteWeek(goalTime: string = "2:59:59") {
  try {
    const supabase = createServerClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Fetch user phenotype
    const { data: profile } = await supabase
      .from('phenotype_profiles')
      .select('max_hr, threshold_hr, weight_kg') // Ensure these columns exist in your DB, mapped securely
      .eq('user_id', userId)
      .single() as { data: any, error: any };

    // Fetch recent adherence (mock or calc)
    // For now using mock 85% if not calculated real-time
    const recentAdherence = 85; 

    // Determine phase
    const currentPhaseDef = getCurrentPhase(new Date());
    // Map phase name to Enum 'BASE' | 'POWER' | 'SPECIFIC' | 'TAPER'
    let currentPhase: 'BASE' | 'POWER' | 'SPECIFIC' | 'TAPER' = 'BASE';
    if (currentPhaseDef.phaseNumber === 2) currentPhase = 'POWER';
    if (currentPhaseDef.phaseNumber === 3) currentPhase = 'SPECIFIC';
    if (currentPhaseDef.phaseNumber === 4) currentPhase = 'TAPER';

    const blueprint = await EliteBlueprintGenerator.generateWeeklyBlueprint({
      goalTime,
      currentPhase,
      phenotype: {
        maxHR: profile?.max_hr || 190,
        thresholdHR: profile?.threshold_hr || 170,
        weightKg: profile?.weight_kg || 70
      },
      recentAdherence
    });

    return { success: true, blueprint };

  } catch (error: any) {
    logger.error("Elite Blueprint Generation Failed", error);
    return { success: false, message: error.message };
  }
}
