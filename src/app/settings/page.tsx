"use client";

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast, ToastContainer } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

function SettingsContent() {
  const { profile, loadProfile, toggleHighRevMode, updateConfig } = usePhenotypeStore();
  const [isClient, setIsClient] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Always reload profile to ensure we have the real one from Supabase, not mock data
    if (isClient) {
      if (!profile || profile.id === 'phoenix_high_rev_01') {
        loadProfile();
      }
    }
  }, [isClient]);

  if (!isClient || !profile) return <div className="p-8 text-white">Loading Phenotype...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
       <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Phenotype Settings</h1>
        <p className="text-zinc-400">Configure your physiological parameters.</p>
      </header>
      
      <div className="max-w-xl space-y-6">
        {/* High Rev Toggle */}
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">High-Rev Physiology</CardTitle>
              <CardDescription>Enable if your steady-state HR exceeds 170bpm.</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
                <input 
                    type="checkbox" 
                    className="w-6 h-6 rounded border-zinc-700 bg-zinc-900 text-green-500 focus:ring-green-500 accent-green-500"
                    checked={profile.is_high_rev}
                    onChange={async (e) => {
                      try {
                        await toggleHighRevMode(e.target.checked);
                        toast.success('Settings Updated', 'High-Rev mode updated successfully');
                      } catch (err) {
                        toast.error('Update Failed', err instanceof Error ? err.message : 'Failed to update settings');
                      }
                    }}
                />
            </div>
          </CardHeader>
        </Card>

        {/* Max HR Input */}
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="text-base">Max Heart Rate Override</CardTitle>
            <CardDescription>The absolute ceiling for your engine. Used for Zone calcs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
                <input 
                    type="number" 
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    value={profile.config.max_hr_override}
                    onChange={async (e) => {
                      try {
                        await updateConfig({ max_hr_override: parseInt(e.target.value) || 0 });
                        toast.success('Settings Updated', 'Max HR updated successfully');
                      } catch (err) {
                        toast.error('Update Failed', err instanceof Error ? err.message : 'Failed to update settings');
                      }
                    }}
                />
                <span className="text-zinc-500">bpm</span>
            </div>
          </CardContent>
        </Card>

        {/* Threshold HR Input */}
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="text-base">Lactate Threshold HR</CardTitle>
            <CardDescription>Known Lactate Threshold from lab/field test. Optional but recommended.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
                <input 
                    type="number" 
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    value={profile.config.threshold_hr_known || ''}
                    placeholder="e.g., 179"
                    onChange={async (e) => {
                      try {
                        await updateConfig({ threshold_hr_known: e.target.value ? parseInt(e.target.value) : undefined });
                        toast.success('Settings Updated', 'Threshold HR updated successfully');
                      } catch (err) {
                        toast.error('Update Failed', err instanceof Error ? err.message : 'Failed to update settings');
                      }
                    }}
                />
                <span className="text-zinc-500">bpm</span>
            </div>
          </CardContent>
        </Card>

        {/* Required Lift Days Per Week */}
        <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="text-base">Required Lift Days Per Week</CardTitle>
            <CardDescription>Minimum strength sessions per week to maintain chassis integrity.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
                <input 
                    type="number" 
                    min="0"
                    max="7"
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    value={profile.config.lift_days_required || 0}
                    onChange={async (e) => {
                      try {
                        await updateConfig({ lift_days_required: parseInt(e.target.value) || 0 });
                        toast.success('Settings Updated', 'Lift days requirement updated successfully');
                      } catch (err) {
                        toast.error('Update Failed', err instanceof Error ? err.message : 'Failed to update settings');
                      }
                    }}
                />
                <span className="text-zinc-500">days/week</span>
            </div>
          </CardContent>
        </Card>

        {/* Structural Weaknesses */}
         <Card className="border-zinc-800 bg-zinc-950 text-white">
          <CardHeader>
            <CardTitle className="text-base">Injury History / Structural Weaknesses</CardTitle>
            <CardDescription>Known points of failure (CSIDs). Select all that apply.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {(['patellar_tendon', 'glute_med', 'achilles', 'lower_back', 'plantar_fascia', 'hip_flexor', 'it_band'] as const).map((weakness) => {
                        const isSelected = profile.config.structural_weakness.includes(weakness);
                        return (
                            <button
                                key={weakness}
                                onClick={async () => {
                                    try {
                                      const current = profile.config.structural_weakness;
                                      const updated = isSelected
                                          ? current.filter(w => w !== weakness)
                                          : [...current, weakness];
                                      await updateConfig({ structural_weakness: updated });
                                      toast.success('Settings Updated', 'Structural weaknesses updated successfully');
                                    } catch (err) {
                                      toast.error('Update Failed', err instanceof Error ? err.message : 'Failed to update settings');
                                    }
                                }}
                                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                    isSelected
                                        ? 'bg-red-900/30 text-red-500 border-red-900 hover:bg-red-900/40'
                                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                                }`}
                            >
                                {weakness.replace(/_/g, ' ')}
                            </button>
                        );
                    })}
                </div>
                {profile.config.structural_weakness.length === 0 && (
                    <p className="text-xs text-zinc-500 italic">No structural weaknesses selected.</p>
                )}
             </div>
          </CardContent>
        </Card>
      </div>
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
