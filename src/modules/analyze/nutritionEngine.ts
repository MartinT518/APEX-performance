import { IPhenotypeProfile } from '@/types/phenotype';

export interface NutritionPlan {
  dailyCalories: number;
  macros: {
    carbs: number;
    protein: number;
    fat: number;
  };
  contextual: {
    preWorkout: string;
    intraWorkout: string;
    postWorkout: string;
  };
}

export class NutritionEngine {
  /**
   * Calculates nutritional needs based on Athlete Phenotype and Today's Training Demand.
   */
  static calculateNutrition(
    profile: IPhenotypeProfile, 
    workoutDurationMin: number, 
    workoutIntensity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'
  ): NutritionPlan {
    const weight = profile.weight || 70; // 'weight' from ID 0feee956
    const bmr = 22 * weight; 
    
    // Activity Factor
    let activityFactor = 1.2; 
    let trainingBurn = 0;

    // Estimate training burn (METs approx)
    let mets = 6;
    if (workoutIntensity === 'LOW') mets = 6;
    if (workoutIntensity === 'MODERATE') mets = 8;
    if (workoutIntensity === 'HIGH') mets = 10;
    if (workoutIntensity === 'SEVERE') mets = 12;

    trainingBurn = (mets * 3.5 * weight / 200) * workoutDurationMin;

    const totalCalories = Math.round(bmr * activityFactor + trainingBurn);

    // Macros 
    // High-Rev Phenotype needs more carbs vs Fat-Max
    const isHighRev = profile.is_high_rev; // 'is_high_rev' instead of 'phenotype' check
    
    let carbRatio = isHighRev ? 0.6 : 0.45;
    let proteinRatio = 0.25; // 1.6-2.0g/kg target roughly
    let fatRatio = 1 - (carbRatio + proteinRatio);
    
    // Adjust for intensity (Glycogen demand)
    if (workoutIntensity === 'HIGH' || workoutIntensity === 'SEVERE') {
        carbRatio += 0.1;
        fatRatio -= 0.1;
    }

    const carbs = Math.round((totalCalories * carbRatio) / 4);
    const protein = Math.round((totalCalories * proteinRatio) / 4);
    const fat = Math.round((totalCalories * fatRatio) / 9);

    // Contextual Advice
    let pre = "Standard balanced meal 3h prior.";
    let intra = "Water + Electrolytes.";
    let post = "20g Protein + 40g Carbs within 30min.";

    if (workoutDurationMin > 60) {
        intra = "30-60g Carbs/hr + Electrolytes.";
    }
    if (workoutDurationMin > 90) {
        intra = "60-90g Carbs/hr (Glucose/Fructose mix).";
    }
    if (workoutIntensity === 'LOW' && !isHighRev && workoutDurationMin < 60) {
        pre = "Fasted option available (Coffee/Water).";
    }

    return {
      dailyCalories: totalCalories,
      macros: {
        carbs,
        protein,
        fat
      },
      contextual: {
        preWorkout: pre,
        intraWorkout: intra,
        postWorkout: post
      }
    };
  }
}
