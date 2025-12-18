"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface BlueprintImpactProps {
  certaintyDelta?: number;
  baselineUpdate?: {
    metric: string;
    value: number;
    change: number;
  };
}

export function BlueprintImpact({ certaintyDelta, baselineUpdate }: BlueprintImpactProps) {
  if (!certaintyDelta && !baselineUpdate) {
    return null;
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950">
      <CardHeader>
        <CardTitle className="text-base">Impact on Blueprint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {certaintyDelta !== undefined && (
          <div className="flex items-center gap-2">
            {certaintyDelta >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-zinc-300">
              This session {certaintyDelta >= 0 ? 'increased' : 'decreased'} Blueprint Certainty by{' '}
              <span className={`font-semibold ${certaintyDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {certaintyDelta >= 0 ? '+' : ''}{certaintyDelta.toFixed(1)}%
              </span>
            </span>
          </div>
        )}

        {baselineUpdate && (
          <div className="text-sm text-zinc-300">
            New 28-day {baselineUpdate.metric} Baseline established:{' '}
            <span className="font-semibold text-zinc-100">
              {baselineUpdate.value}
            </span>
            {baselineUpdate.change !== 0 && (
              <span className={`ml-1 ${baselineUpdate.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({baselineUpdate.change >= 0 ? '+' : ''}{baselineUpdate.change})
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

