"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IWorkout } from '@/types/workout';
import { AlertTriangle } from 'lucide-react';
import { renderModalityIcon, getZoneLabel } from './logic/planCardUtils';

interface SubstitutionCardProps {
  workout: IWorkout;
  isAdapted?: boolean;
  explanation?: string;
}

export function SubstitutionCard({ workout, isAdapted, explanation }: SubstitutionCardProps) {
  return (
    <Card className={`border-2 ${isAdapted ? 'border-yellow-900 bg-yellow-900/10' : 'border-zinc-800 bg-zinc-950'} text-white`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderModalityIcon(workout.type)}
            <CardTitle className="text-2xl">{workout.structure.mainSet}</CardTitle>
          </div>
          {isAdapted && (
            <Badge className="bg-yellow-600 text-white flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              ADAPTED PLAN
            </Badge>
          )}
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

        {workout.constraints && (
          <div className="pt-4 border-t border-zinc-800 space-y-2">
            {workout.constraints.hrTarget && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Match Threshold HR:</span>
                <span className="font-semibold">{workout.constraints.hrTarget.min}-{workout.constraints.hrTarget.max} bpm on the bike</span>
              </div>
            )}
            {workout.type === 'BIKE' && (
              <div className="flex items-center gap-2 text-sm text-red-400 font-semibold">
                No-Impact: Zero running steps allowed
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

