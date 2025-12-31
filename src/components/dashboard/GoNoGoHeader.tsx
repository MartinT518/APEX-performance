"use client";

import { IAnalysisResult } from '@/types/analysis';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatGoalTimeDisplay } from '@/modules/analyze/utils/goalTime';

interface GoNoGoHeaderProps {
  result: IAnalysisResult | null;
  previousCertainty?: number; // For trend calculation
  goalTime?: string; // Goal marathon time (e.g., "2:20:00")
}

export function GoNoGoHeader({ result, previousCertainty, goalTime = '2:30:00' }: GoNoGoHeaderProps) {
  if (!result || !result.decision) {
    return null;
  }

  const decision = result.decision;
  const certainty = result.simulation?.successProbability || 0;
  const goalDisplay = formatGoalTimeDisplay(goalTime);
  
  // Determine status from decision action
  let status: 'GO' | 'ADAPTED' | 'SHUTDOWN' = 'GO';
  let statusColor = 'text-green-400';
  let statusBg = 'bg-green-900/20';
  let statusBorder = 'border-green-900';

  if (decision.action === 'SKIPPED') {
    status = 'SHUTDOWN';
    statusColor = 'text-red-400';
    statusBg = 'bg-red-900/20';
    statusBorder = 'border-red-900';
  } else if (decision.action === 'MODIFIED') {
    status = 'ADAPTED';
    statusColor = 'text-yellow-400';
    statusBg = 'bg-yellow-900/20';
    statusBorder = 'border-yellow-900';
  }

  // Calculate trend
  let trendIcon = <Minus className="h-4 w-4 text-zinc-500" />;
  let trendText = '';
  if (previousCertainty !== undefined) {
    const diff = certainty - previousCertainty;
    if (diff > 0.5) {
      trendIcon = <ArrowUp className="h-4 w-4 text-green-400" />;
      trendText = `+${diff.toFixed(1)}%`;
    } else if (diff < -0.5) {
      trendIcon = <ArrowDown className="h-4 w-4 text-red-400" />;
      trendText = `${diff.toFixed(1)}%`;
    } else {
      trendText = '0%';
    }
  }

  return (
    <div className={`mb-6 p-6 rounded-lg border ${statusBg} ${statusBorder} border-2`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-2xl font-bold ${statusColor}`}>
              STATUS: {status}
            </span>
          </div>
          <p className="text-zinc-300 text-lg leading-relaxed">
            {decision.reasoning || "All systems nominal."}
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-1 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-white">
              {certainty.toFixed(0)}%
            </span>
            {trendIcon}
          </div>
          <div className="text-sm text-zinc-400">
            Probability of {goalDisplay}
          </div>
          {trendText && (
            <div className="text-xs text-zinc-500">
              {trendText} from yesterday
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

