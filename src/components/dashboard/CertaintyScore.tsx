"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAnalyzeStore } from '@/modules/analyze/analyzeStore';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CertaintyScoreProps {
  currentScore?: number;
  previousScore?: number;
  explanation?: string;
}

export function CertaintyScore({ currentScore, previousScore, explanation }: CertaintyScoreProps) {
  const { baselines } = useAnalyzeStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // Use provided score or fallback to baseline confidence score
  const score = currentScore ?? (baselines.confidenceScore === 'HIGH' ? 85 : baselines.confidenceScore === 'MEDIUM' ? 65 : 45);
  const prevScore = previousScore ?? score;
  const trend = score > prevScore ? 'up' : score < prevScore ? 'down' : 'neutral';
  const trendChange = Math.abs(score - prevScore);

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-400';
    if (s >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'HIGH';
    if (s >= 50) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="text-base">Goal Certainty Score</CardTitle>
        <CardDescription>
          Probability of achieving your target based on current trajectory
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold font-mono ${getScoreColor(score)}`}>
                {score.toFixed(0)}
              </span>
              <span className="text-2xl text-zinc-500">%</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                className={`${
                  getScoreLabel(score) === 'HIGH'
                    ? 'bg-green-900/30 text-green-400 border-green-900'
                    : getScoreLabel(score) === 'MEDIUM'
                    ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900'
                    : 'bg-red-900/30 text-red-400 border-red-900'
                }`}
              >
                {getScoreLabel(score)} CONFIDENCE
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

        {/* Progress Bar */}
        <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              score >= 80
                ? 'bg-green-500'
                : score >= 50
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>

        {/* Explanation */}
        {explanation && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-400">{explanation}</p>
          </div>
        )}

        {/* Trend Visualization (Simple) */}
        {prevScore !== score && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Previous: {prevScore.toFixed(0)}%</span>
              <span>Current: {score.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

