"use client";

import { TonnageTier } from '@/modules/monitor/monitorStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TIER_LABELS: Record<TonnageTier, { label: string; description: string; color: string }> = {
  maintenance: { label: 'Mobility / Low', description: 'Light maintenance work', color: 'bg-green-600' },
  hypertrophy: { label: 'Hypertrophy / Medium', description: 'Moderate volume training', color: 'bg-yellow-600' },
  strength: { label: 'Strength / High', description: 'Heavy compound lifts', color: 'bg-orange-600' },
  power: { label: 'Power / High', description: 'Explosive movements', color: 'bg-red-600' },
};

interface StrengthTierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tier: TonnageTier) => void;
}

export function StrengthTierDialog({ open, onOpenChange, onSelect }: StrengthTierDialogProps) {
  const handleTierSelect = (tier: TonnageTier) => {
    onSelect(tier);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Select Intensity Tier
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            What type of strength work did you perform?
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-3 mt-4">
          {(Object.keys(TIER_LABELS) as TonnageTier[]).map((tier) => {
            const tierInfo = TIER_LABELS[tier];
            return (
              <Button
                key={tier}
                onClick={() => handleTierSelect(tier)}
                className={`${tierInfo.color} hover:opacity-90 text-white font-bold justify-start h-auto py-4 px-4`}
              >
                <div className="text-left">
                  <div className="font-bold">{tierInfo.label}</div>
                  <div className="text-xs opacity-90">{tierInfo.description}</div>
                </div>
              </Button>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

