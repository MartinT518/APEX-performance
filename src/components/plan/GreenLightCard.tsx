"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IWorkout } from '@/types/workout';
import { renderModalityIcon, getZoneLabel } from './logic/planCardUtils';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';

interface GreenLightCardProps {
  workout: IWorkout;
  explanation?: string;
}

export function GreenLightCard({ workout, explanation }: GreenLightCardProps) {
  const profile = usePhenotypeStore().profile;
  const hrTarget = workout.constraints?.hrTarget;
  const cadenceTarget = workout.constraints?.cadenceTarget;
  const fuelingTarget = workout.constraints?.fuelingTarget;

  return (
    <Card className="border-2 border-green-900 bg-green-900/10 text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderModalityIcon(workout.type)}
            <CardTitle className="text-2xl">
              {workout.structure.mainSet} {profile?.is_high_rev ? '(High-Rev Mode)' : ''}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {explanation && (
          <p className="text-zinc-300 text-lg leading-relaxed">
            {explanation}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-zinc-500 mb-1">Duration</div>
            <div className="text-lg font-semibold">{workout.durationMinutes} min</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500 mb-1">Intensity</div>
            <div className="text-lg font-semibold">{getZoneLabel(workout.primaryZone)}</div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 space-y-2">
          {workout.type === 'RUN' && cadenceTarget && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Cadence Floor:</span>
              <span className="font-semibold">&gt;{cadenceTarget} spm</span>
            </div>
          )}
          {hrTarget && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Target HR:</span>
              <span className="font-semibold">{hrTarget.min}-{hrTarget.max} bpm</span>
            </div>
          )}
          {fuelingTarget && workout.durationMinutes > 90 && (
            <Badge className="bg-blue-600 text-white mt-2">
              Gut Training Required: {fuelingTarget}g Carbs/hr
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

