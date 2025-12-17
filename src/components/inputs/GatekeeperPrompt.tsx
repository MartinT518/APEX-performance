"use client";

import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { NiggleSlider } from './NiggleSlider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast, ToastContainer } from '@/components/ui/toast';

interface GatekeeperPromptProps {
  children: React.ReactNode;
}

export function GatekeeperPrompt({ children }: GatekeeperPromptProps) {
  const { todayEntries, setNiggleScore } = useMonitorStore();
  const toast = useToast();
  
  // Check if niggle score has been entered today
  const hasCompletedCheckIn = todayEntries.niggleScore !== null;
  
  // If check-in is complete, render children normally
  if (hasCompletedCheckIn) {
    return <>{children}</>;
  }

  // Otherwise, show blocking dialog
  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <Dialog open={true} modal={true}>
        <DialogContent 
          className="bg-zinc-950 border-zinc-800 text-white max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Daily Chassis Audit Required
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              You must complete your daily pain assessment before viewing your workout plan.
            </DialogDescription>
          </DialogHeader>
          
          <Card className="border-zinc-800 bg-zinc-900 mt-4">
            <CardContent className="pt-6">
              <NiggleSlider 
                value={todayEntries.niggleScore ?? 0} 
                onChange={async (val) => {
                  try {
                    await setNiggleScore(val);
                    toast.success('Saved', 'Niggle score saved successfully');
                  } catch (err) {
                    toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save niggle score');
                  }
                }} 
              />
              <p className="text-xs text-zinc-500 mt-4 text-center">
                Honesty is required. This data protects your structural integrity.
              </p>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
      
      {/* Blurred/blocked content behind dialog */}
      <div className="blur-sm pointer-events-none opacity-50">
        {children}
      </div>
    </>
  );
}

