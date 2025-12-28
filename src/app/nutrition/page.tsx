"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';
import { NutritionEngine } from '@/modules/analyze/nutritionEngine';
import { 
  Beef, 
  Target, 
  TrendingDown, 
  Scale, 
  ChevronRight,
  UtensilsCrossed,
  Flame
} from 'lucide-react';

function FuelingStationContent() {
  const profile = usePhenotypeStore(state => state.profile);
  const [currentWeight, setCurrentWeight] = useState(profile?.weight || 82);
  const [dailyTarget, setDailyTarget] = useState<any>(null);
  const [targetWeightRange, setTargetWeightRange] = useState({ min: 0, max: 0 });

  useEffect(() => {
    if (profile) {
      const range = NutritionEngine.getTargetWeightRange(profile.height || 180);
      setTargetWeightRange(range);
      
      const target = NutritionEngine.getDailyTarget(
        currentWeight,
        range.max,
        false // assume active day
      );
      setDailyTarget(target);
    }
  }, [profile, currentWeight]);

  if (!dailyTarget) return null;

  return (
    <div className="space-y-6 pb-24 p-4 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">Fueling Station</h1>
          <p className="text-xs text-slate-500 font-mono">Performance Nutrition Unit // Macro Management</p>
        </div>
        <div className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800 text-[10px] text-orange-500 font-bold flex items-center gap-1.5">
          <Flame className="w-3 h-3" /> NUTRITION_AGENT: ACTIVE
        </div>
      </header>

      {/* 1. M_PHASE WEIGHT TRAJECTORY */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-blue-500" /> Weight-to-Goal Trajectory
          </h3>
          <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase">
            Racing BMI Optimizer
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Current Weight</span>
            <span className="text-3xl font-black text-white font-mono">{currentWeight?.toFixed(1)}kg</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <ChevronRight className="w-6 h-6 text-slate-700 md:rotate-0 rotate-90" />
            <div className="text-[8px] text-slate-700 font-black uppercase mt-1">Strategic Deficit</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <span className="text-[9px] text-emerald-500 uppercase font-bold tracking-widest">Race Weight Target</span>
            <span className="text-3xl font-black text-emerald-400 font-mono">{targetWeightRange.max.toFixed(1)}kg</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
            <span>Optimization Progress</span>
            <span>{Math.max(0, 100 - (currentWeight - targetWeightRange.max) * 5).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
             <div 
               className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000"
               style={{ width: `${Math.max(5, 100 - (currentWeight - targetWeightRange.max) * 5)}%` }}
             />
          </div>
        </div>
      </div>

      {/* 2. DAILY MACRO TARGETS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-xl">
          <div className="flex justify-between items-center text-xs font-black text-slate-500 uppercase tracking-widest">
            <h3 className="flex items-center gap-2"><UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" /> Today's Fueling Target</h3>
            <span className="text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 text-[10px]">
              {dailyTarget.macroFocus}
            </span>
          </div>
          
          <div className="flex items-baseline gap-2">
             <span className="text-5xl font-black text-white tracking-tighter italic">{dailyTarget.caloricIntake}</span>
             <span className="text-slate-500 font-black italic uppercase text-sm">kCal / Day</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-orange-500/50 pl-4 py-1 italic">
            "{dailyTarget.reasoning}"
          </p>
        </div>

        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
           <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Beef className="w-3.5 h-3.5 text-red-500" /> Optimized Macro Split
           </h3>

           <div className="space-y-4">
              <div className="space-y-1.5">
                 <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Protein (Shielding)</span>
                    <span>2.0g/kg</span>
                 </div>
                 <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-[80%] rounded-full" />
                 </div>
              </div>
              <div className="space-y-1.5">
                 <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Carbs (Glycogen)</span>
                    <span>{dailyTarget.macroFocus === 'HIGH_PROTEIN_LOW_CARB' ? '3.0g/kg' : '6.0g/kg'}</span>
                 </div>
                 <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full bg-orange-500 rounded-full ${dailyTarget.macroFocus === 'HIGH_PROTEIN_LOW_CARB' ? 'w-[40%]' : 'w-[75%]'}`} />
                 </div>
              </div>
              <div className="space-y-1.5">
                 <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Fats (Hormonal)</span>
                    <span>0.8g/kg</span>
                 </div>
                 <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[25%] rounded-full" />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default function FuelingStationPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <FuelingStationContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
