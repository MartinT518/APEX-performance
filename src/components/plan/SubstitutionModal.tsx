"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Bike, Footprints, Moon } from "lucide-react";
import { IWorkout } from "@/types/workout";

interface SubstitutionModalProps {
  open: boolean;
  onClose: () => void;
  niggleScore: number;
  onSelectOption: (option: 'BIKE' | 'BFR' | 'REST') => Promise<void>;
  originalWorkout?: IWorkout | null;
}

export function SubstitutionModal({
  open,
  onClose,
  niggleScore,
  onSelectOption,
  originalWorkout
}: SubstitutionModalProps) {
  const handleSelect = async (option: 'BIKE' | 'BFR' | 'REST') => {
    await onSelectOption(option);
    onClose();
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent 
        className="bg-zinc-950 border-zinc-800 text-white max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <DialogTitle className="text-2xl font-bold text-red-500">
              STRUCTURAL AGENT VETO
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-300 text-base">
            Acute Pain detected ({niggleScore}/10). Mechanical load prohibited.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <Card className="border-red-900/50 bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-base text-red-400">REASON</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300">
                The Structural Agent has detected pain levels that exceed the safety threshold.
                Running or high-impact activities are prohibited to prevent injury escalation.
                We must preserve the Metabolic Engine while deloading the Chassis.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
              Select Intervention Option:
            </h3>

            {/* Option A: Cycling Intervals */}
            <Card 
              className="border-zinc-700 bg-zinc-900 hover:border-green-500/50 cursor-pointer transition-colors"
              onClick={() => handleSelect('BIKE')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Bike className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">Option A: 60min Indoor Cycling Intervals</span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      Match Heart Rate intensity from original workout. Zero impact on chassis.
                      {originalWorkout?.constraints?.hrTarget && (
                        <span className="block mt-1">
                          Target HR: {originalWorkout.constraints.hrTarget.min}-{originalWorkout.constraints.hrTarget.max} bpm
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Option B: BFR Walk */}
            <Card 
              className="border-zinc-700 bg-zinc-900 hover:border-yellow-500/50 cursor-pointer transition-colors"
              onClick={() => handleSelect('BFR')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Footprints className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">Option B: 45min BFR Walk</span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      Blood Flow Restriction walking. Minimal impact, maintains metabolic stimulus.
                      Low-intensity active recovery.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Option C: Complete Rest */}
            <Card 
              className="border-zinc-700 bg-zinc-900 hover:border-red-500/50 cursor-pointer transition-colors"
              onClick={() => handleSelect('REST')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Moon className="h-8 w-8 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">Option C: Complete Rest</span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      Full system shutdown. No training stimulus. Use only if pain is severe (7+/10).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 text-center">
              You must select an option to proceed. The plan will be dynamically rewritten based on your choice.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

