"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAnalyzeStore } from '@/modules/analyze/analyzeStore';
import { useEffect, useState } from 'react';
import { CertaintyScoreDisplay } from './CertaintyScoreDisplay';
import { CertaintyProgressBar } from './CertaintyProgressBar';

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

  const score = currentScore ?? (baselines.confidenceScore === 'HIGH' ? 85 : baselines.confidenceScore === 'MEDIUM' ? 65 : 45);
  const prevScore = previousScore ?? score;

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="text-base">Goal Certainty Score</CardTitle>
        <CardDescription>
          Probability of achieving your target based on current trajectory
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CertaintyScoreDisplay score={score} prevScore={prevScore} />
        <CertaintyProgressBar score={score} />
        {explanation && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-400">{explanation}</p>
          </div>
        )}
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

