"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Moon } from "lucide-react";

interface ShutdownModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
  onAcknowledge: () => Promise<void>;
}

/**
 * FR-3.6 & FR-3.7: Shutdown Modal Component
 * 
 * Appears when global_status === 'SHUTDOWN'
 * Shows rest-only (no substitution options)
 * User must acknowledge rest day
 */
export function ShutdownModal({
  open,
  onClose,
  reason,
  onAcknowledge
}: ShutdownModalProps) {
  const handleAcknowledge = async () => {
    await onAcknowledge();
    onClose();
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent 
        className="bg-zinc-950 border-red-500 text-white max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />
            <DialogTitle className="text-2xl font-bold text-red-500">
              SYSTEM SHUTDOWN
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-300 text-base">
            Multiple Critical Flags Detected
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              {reason || "Multiple system failures detected. Complete rest required."}
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500 uppercase mb-2">Required Action</div>
            <div className="flex items-center gap-3">
              <Moon className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-white font-bold">Complete Rest + Mobility</div>
                <div className="text-xs text-slate-400">No training stimulus allowed</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleAcknowledge}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3"
          >
            Acknowledge Rest Day
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
