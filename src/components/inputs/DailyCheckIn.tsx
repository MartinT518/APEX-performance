"use client";

import { useMonitorStore, TonnageTier } from '@/modules/monitor/monitorStore';
import { NiggleSlider } from './NiggleSlider';
import { StrengthTierDialog } from './StrengthTierDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '@/components/ui/toast';

const TIER_LABELS: Record<TonnageTier, { label: string; description: string }> = {
  maintenance: { label: 'Mobility / Low', description: 'Light maintenance work' },
  hypertrophy: { label: 'Hypertrophy / Medium', description: 'Moderate volume training' },
  strength: { label: 'Strength / High', description: 'Heavy compound lifts' },
  power: { label: 'Power / High', description: 'Explosive movements' },
};

export function DailyCheckIn() {
  const { todayEntries, setNiggleScore, logStrengthSession } = useMonitorStore();
  const [isClient, setIsClient] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  const currentNiggle = todayEntries.niggleScore ?? 0;
  const strength = todayEntries.strengthSession;

  const handleStrengthToggle = async () => {
    try {
      if (strength?.performed) {
        // If already performed, toggle off
        await logStrengthSession(false);
        toast.success('Saved', 'Strength session cleared');
      } else {
        // If not performed, show dialog to select tier
        setShowTierDialog(true);
      }
    } catch (err) {
      toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save strength session');
    }
  };

  const handleTierSelect = async (tier: TonnageTier) => {
    try {
      await logStrengthSession(true, tier);
      toast.success('Saved', 'Strength session logged successfully');
      setShowTierDialog(false);
    } catch (err) {
      toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save strength session');
    }
  };

  const getTierLabel = () => {
    if (!strength?.performed || !strength?.tonnageTier) return 'NO SESSION';
    const tierInfo = TIER_LABELS[strength.tonnageTier as TonnageTier];
    return tierInfo ? tierInfo.label.toUpperCase() : 'COMPLETED';
  };

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <Card className="border-t-4 border-t-blue-500 bg-zinc-950 text-white">
        <CardHeader>
          <CardTitle>Morning Chassis Audit</CardTitle>
          <CardDescription>
            Daily structural verification. Honesty required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Niggle Slider */}
          <div className="space-y-2">
              <NiggleSlider 
                  value={currentNiggle} 
                  onChange={async (val) => {
                    try {
                      await setNiggleScore(val);
                      toast.success('Saved', 'Niggle score saved successfully');
                    } catch (err) {
                      toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save niggle score');
                    }
                  }} 
              />
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Strength Toggle */}
          <div className="flex items-center justify-between">
              <div>
                  <div className="font-medium">Strength Session?</div>
                  <div className="text-xs text-zinc-500">Did you lift yesterday/today?</div>
                  {strength?.performed && strength?.tonnageTier && (
                    <div className="text-xs text-zinc-400 mt-1">
                      Tier: {TIER_LABELS[strength.tonnageTier as TonnageTier]?.label}
                    </div>
                  )}
              </div>
              <div className="flex items-center space-x-2">
                  <button
                      onClick={handleStrengthToggle}
                      className={`
                          px-4 py-2 rounded-md font-bold text-sm transition-all
                          ${strength?.performed 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }
                      `}
                  >
                      {getTierLabel()}
                  </button>
              </div>
          </div>

        </CardContent>
      </Card>

      {/* Intensity Tier Selection Dialog */}
      <StrengthTierDialog 
        open={showTierDialog} 
        onOpenChange={setShowTierDialog}
        onSelect={handleTierSelect}
      />
    </>
  );
}
