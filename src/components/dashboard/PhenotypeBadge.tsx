"use client";

"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';

export function PhenotypeBadge() {
  const profile = usePhenotypeStore().profile;

  if (!profile?.is_high_rev) {
    return null;
  }

  const maxHR = profile.config.max_hr_override || 'N/A';
  const tooltipContent = `High-Rev Protocol Active\nMax HR Override: ${maxHR}bpm. Standard Anaerobic warnings disabled.`;

  return (
    <Tooltip content={tooltipContent}>
      <Badge className="bg-purple-600 hover:bg-purple-700 text-white cursor-help">
        High-Rev Mode: ON
      </Badge>
    </Tooltip>
  );
}

