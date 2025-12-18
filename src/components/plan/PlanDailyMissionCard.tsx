"use client";

import { Card, CardContent } from "@/components/ui/card";
import { IWorkout } from '@/types/workout';
import { GreenLightCard } from './GreenLightCard';
import { SubstitutionCard } from './SubstitutionCard';

interface PlanDailyMissionCardProps {
  workout: IWorkout | null;
  isAdapted?: boolean;
  explanation?: string;
  allAgentsGreen?: boolean;
}

export function PlanDailyMissionCard({ 
  workout, 
  isAdapted, 
  explanation,
  allAgentsGreen = false 
}: PlanDailyMissionCardProps) {
  if (!workout) {
    return (
      <Card className="border-zinc-800 bg-zinc-950 text-white">
        <CardContent className="p-6">
          <p className="text-zinc-400">No workout planned for today.</p>
        </CardContent>
      </Card>
    );
  }

  if (allAgentsGreen && !isAdapted) {
    return <GreenLightCard workout={workout} explanation={explanation} />;
  }

  return <SubstitutionCard workout={workout} isAdapted={isAdapted} explanation={explanation} />;
}

