"use client";

import { getProgressBarColor } from './logic/certaintyScoreUtils';

interface CertaintyProgressBarProps {
  score: number;
}

export function CertaintyProgressBar({ score }: CertaintyProgressBarProps) {
  return (
    <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ${getProgressBarColor(score)}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

