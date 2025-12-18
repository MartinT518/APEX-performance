"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';
import { Activity, ShieldAlert, Save, Info } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useToast, ToastContainer } from '@/components/ui/toast';

const injuries = ["Patellar Tendon", "Achilles Tendon", "IT Band", "Plantar Fascia", "Glute/Hamstring", "Lower Back"];

// Map injury names to database enum values
const injuryMap: Record<string, 'patellar_tendon' | 'achilles' | 'it_band' | 'plantar_fascia' | 'glute_med' | 'lower_back'> = {
  "Patellar Tendon": 'patellar_tendon',
  "Achilles Tendon": 'achilles',
  "IT Band": 'it_band',
  "Plantar Fascia": 'plantar_fascia',
  "Glute/Hamstring": 'glute_med',
  "Lower Back": 'lower_back'
};

const reverseInjuryMap: Record<string, string> = {
  'patellar_tendon': "Patellar Tendon",
  'achilles': "Achilles Tendon",
  'it_band': "IT Band",
  'plantar_fascia': "Plantar Fascia",
  'glute_med': "Glute/Hamstring",
  'lower_back': "Lower Back"
};

function SettingsContent() {
  const { profile, loadProfile, updateConfig, toggleHighRevMode } = usePhenotypeStore();
  const [isHighRev, setIsHighRev] = useState(false);
  const [maxHeartRate, setMaxHeartRate] = useState(185);
  const [thresholdHeartRate, setThresholdHeartRate] = useState<number | null>(null);
  const [injuryHistory, setInjuryHistory] = useState<string[]>([]);
  const [liftFrequency, setLiftFrequency] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Load profile once on mount - don't include profile in deps to avoid infinite loop
  useEffect(() => {
    let cancelled = false;
    
    loadProfile().then(() => {
      if (cancelled) return;
      
      // Access profile directly from store to avoid dependency on reactive value
      const currentProfile = usePhenotypeStore.getState().profile;
      if (currentProfile) {
        setIsHighRev(currentProfile.is_high_rev);
        setMaxHeartRate(currentProfile.config.max_hr_override);
        setThresholdHeartRate(currentProfile.config.threshold_hr_known || null);
        setLiftFrequency(currentProfile.config.lift_days_required);
        
        // Convert database enum values to display names
        const displayInjuries = (currentProfile.config.structural_weakness || []).map(
          (weakness: string) => reverseInjuryMap[weakness] || weakness
        );
        setInjuryHistory(displayInjuries);
      }
      setIsLoading(false);
    });
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - loadProfile is stable, profile would cause infinite loop

  const toggleInjury = (injury: string) => {
    setInjuryHistory(prev => prev.includes(injury) ? prev.filter(i => i !== injury) : [...prev, injury]);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      // Update high-rev mode if changed
      if (isHighRev !== profile?.is_high_rev) {
        await toggleHighRevMode(isHighRev);
      }

      // Convert injury display names back to database enum values
      const dbInjuries = injuryHistory.map(injury => injuryMap[injury]).filter(Boolean) as string[];

      // Update config
      await updateConfig({
        max_hr_override: maxHeartRate,
        threshold_hr_known: thresholdHeartRate || undefined,
        structural_weakness: dbInjuries,
        lift_days_required: liftFrequency
      });

      toast.success('Saved', 'Phenotype configuration updated successfully');
    } catch (err) {
      logger.error('Failed to save phenotype', err);
      toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="space-y-6 pb-24 p-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 p-4 animate-in fade-in duration-300">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Phenotype Configuration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Define your biological truth. This data overrides standard algorithms.
        </p>
      </header>

      <section className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-400 w-5 h-5" />
            <h2 className="font-semibold text-lg">High-Rev Mode</h2>
          </div>
          <button 
            onClick={() => setIsHighRev(!isHighRev)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isHighRev ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isHighRev ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {isHighRev ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 flex gap-3">
            <Info className="text-emerald-400 w-10 h-10 shrink-0" />
            <p className="text-xs text-emerald-100">
              <strong>Phoenix Protocol Active:</strong> Standard anaerobic warnings are disabled. 
              System will validate sustained high HR ({'>'}90% Max) as "Threshold" rather than "Error."
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-400">
              Enable this if your marathon heart rate averages {'>'}175 bpm.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">TRUE MAX HEART RATE (BPM)</label>
            <div className="relative">
              <input 
                type="number" 
                value={maxHeartRate}
                onChange={(e) => setMaxHeartRate(parseInt(e.target.value) || 185)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="absolute right-3 top-4 text-xs text-slate-500">Override 220-Age</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">LACTATE THRESHOLD HR (BPM)</label>
            <input 
              type="number" 
              value={thresholdHeartRate || ''}
              onChange={(e) => setThresholdHeartRate(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      </section>

      <section className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="text-amber-400 w-5 h-5" />
          <h2 className="font-semibold text-lg">Chassis Configuration</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">MANDATORY STRENGTH SESSIONS (PER WEEK)</label>
            <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-700">
              <button 
                onClick={() => setLiftFrequency(Math.max(0, liftFrequency - 1))} 
                className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded text-xl hover:bg-slate-700 transition-colors"
              >
                -
              </button>
              <span className="flex-1 text-center font-mono text-lg">{liftFrequency}</span>
              <button 
                onClick={() => setLiftFrequency(liftFrequency + 1)} 
                className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded text-xl hover:bg-slate-700 transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">*Falling below this triggers an Agent A Veto on intensity.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">STRUCTURAL WEAKNESSES (INJURY HISTORY)</label>
            <div className="flex flex-wrap gap-2">
              {injuries.map((injury) => (
                <button
                  key={injury}
                  onClick={() => toggleInjury(injury)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    injuryHistory.includes(injury)
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-slate-800 text-slate-400 border border-transparent hover:border-slate-600'
                  }`}
                >
                  {injury}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <button 
        onClick={handleSave} 
        disabled={isLoading}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
      >
        <Save className="w-5 h-5" />
        LOCK PHENOTYPE
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <SettingsContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
