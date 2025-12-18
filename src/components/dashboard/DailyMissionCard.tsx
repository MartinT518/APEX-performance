"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IWorkout } from '@/types/workout';
import { AlertTriangle, Bike, Footprints, Dumbbell } from 'lucide-react';

interface DailyMissionCardProps {
  workout: IWorkout | null;
  isAdapted?: boolean;
  explanation?: string;
}

export function DailyMissionCard({ workout, isAdapted, explanation }: DailyMissionCardProps) {
  if (!workout) {
    return (
      <Card className="border-zinc-800 bg-zinc-950 text-white">
        <CardContent className="p-6">
          <p className="text-zinc-400">No workout planned for today.</p>
        </CardContent>
      </Card>
    );
  }

  const getModalityIcon = () => {
    switch (workout.type) {
      case 'RUN':
        return <Footprints className="h-6 w-6" />;
      case 'BIKE':
        return <Bike className="h-6 w-6" />;
      case 'STRENGTH':
        return <Dumbbell className="h-6 w-6" />;
      default:
        return <Footprints className="h-6 w-6" />;
    }
  };

  const getZoneLabel = (zone: string) => {
    const labels: Record<string, string> = {
      'Z1_RECOVERY': 'Recovery',
      'Z2_ENDURANCE': 'Endurance',
      'Z3_TEMPO': 'Tempo',
      'Z4_THRESHOLD': 'Threshold',
      'Z5_VO2MAX': 'VO2 Max'
    };
    return labels[zone] || zone;
  };

  return (
    <Card className={`border-2 ${isAdapted ? 'border-yellow-900 bg-yellow-900/10' : 'border-zinc-800 bg-zinc-950'} text-white`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getModalityIcon()}
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
            {workout.constraints.cadenceTarget && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Cadence Target:</span>
                <span className="font-semibold">&gt;{workout.constraints.cadenceTarget} spm</span>
              </div>
            )}
            {workout.constraints.hrTarget && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">HR Target:</span>
                <span className="font-semibold">{workout.constraints.hrTarget.min}-{workout.constraints.hrTarget.max} bpm</span>
              </div>
            )}
            {workout.constraints.fuelingTarget && workout.durationMinutes > 90 && (
              <Badge className="bg-blue-600 text-white mt-2">
                Gut Training Required: {workout.constraints.fuelingTarget}g Carbs/hr
              </Badge>
            )}
          </div>
        )}

        {workout.notes && (
          <div className="pt-2 text-sm text-zinc-400 italic">
            {workout.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

