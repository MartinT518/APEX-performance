"use client";

import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';
import { Badge } from "@/components/ui/badge";

export function PhenotypeFooter() {
  const profile = usePhenotypeStore().profile;

  if (!profile?.is_high_rev) {
    return null;
  }

  const maxHR = profile.config.max_hr_override || 'N/A';

  return (
    <div className="mt-8 pt-6 border-t border-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <Badge className="bg-purple-600 text-white mb-2">
            High-Rev Protocol Active
          </Badge>
          <p className="text-sm text-zinc-400">
            Ignoring standard Anaerobic warnings. Validating data against user max ({maxHR} bpm).
          </p>
        </div>
      </div>
    </div>
  );
}

