"use client";

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MacroContextBarProps {
  certaintyScore: number; // 0-100
  previousCertainty?: number;
  phase?: string;
  phaseFocus?: string;
  trendData?: Array<{ date: string; score: number }>; // For sparkline
}

export function MacroContextBar({ 
  certaintyScore, 
  previousCertainty, 
  phase = "Phase 2: Metabolic Hybrid Block",
  phaseFocus = "Focus: Lactate Clearance & Chassis Hardening",
  trendData 
}: MacroContextBarProps) {
  // Calculate trend
  let trendIcon = <Minus className="h-4 w-4 text-zinc-500" />;
  let trendText = '';
  if (previousCertainty !== undefined) {
    const diff = certaintyScore - previousCertainty;
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

  // Generate sparkline data if not provided
  const sparklineData = trendData || Array.from({ length: 7 }, (_, i) => ({
    date: i,
    score: certaintyScore + (Math.random() - 0.5) * 5
  }));

  return (
    <div className="mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        {/* Certainty Score */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">
              {certaintyScore.toFixed(0)}%
            </span>
            {trendIcon}
            {trendText && (
              <span className="text-sm text-zinc-400">{trendText}</span>
            )}
          </div>
          <div className="text-sm text-zinc-400">
            Probability of Sub-2:30
          </div>
          
          {/* Sparkline */}
          <div className="w-24 h-8 ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phase Indicator */}
        <div className="text-right">
          <div className="text-lg font-semibold text-white">{phase}</div>
          <div className="text-sm text-zinc-400">{phaseFocus}</div>
        </div>
      </div>
    </div>
  );
}

