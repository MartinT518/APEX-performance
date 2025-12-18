"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getScoreColor, getScoreLabel, getScoreBadgeClass } from './logic/certaintyScoreUtils';

interface CertaintyScoreDisplayProps {
  score: number;
  prevScore: number;
}

export function CertaintyScoreDisplay({ score, prevScore }: CertaintyScoreDisplayProps) {
  const trend = score > prevScore ? 'up' : score < prevScore ? 'down' : 'neutral';
  const trendChange = Math.abs(score - prevScore);
  const label = getScoreLabel(score);

  return (
    <div className="flex items-end gap-4">
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-bold font-mono ${getScoreColor(score)}`}>
            {score.toFixed(0)}
          </span>
          <span className="text-2xl text-zinc-500">%</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge className={getScoreBadgeClass(label)}>
            {label} CONFIDENCE
          </Badge>
          
          {trendChange > 0 && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              {trend === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-400" />
              ) : trend === 'down' ? (
                <TrendingDown className="h-3 w-3 text-red-400" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>
                {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
                {trendChange.toFixed(1)}% from last check
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

