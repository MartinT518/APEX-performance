"use client";

import { DailyCheckIn } from '@/components/inputs/DailyCheckIn';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMonitorStore } from '@/modules/monitor/monitorStore';

interface GatekeeperInputsProps {
  onNiggleChange?: (score: number) => void;
}

export function GatekeeperInputs({ onNiggleChange }: GatekeeperInputsProps) {
  const { todayEntries } = useMonitorStore();
  const niggleScore = todayEntries.niggleScore || 0;

  return (
    <div className="space-y-4">
      {/* Pre-Workout: Chassis Check */}
      <Card className="border-zinc-800 bg-zinc-950 text-white">
        <CardHeader>
          <CardTitle>Pre-Workout: Chassis Check</CardTitle>
          <CardDescription>
            Persistent input - workout plan updates in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyCheckIn />
        </CardContent>
      </Card>

      {/* Post-Workout: Strength Logger */}
      <Card className="border-zinc-800 bg-zinc-950 text-white">
        <CardHeader>
          <CardTitle>Post-Workout: Strength Logger</CardTitle>
          <CardDescription>
            Did you lift today? (Resets Chassis Integrity decay timer)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400 mb-2">
            If "No" for &gt;5 days, tomorrow's plan automatically downgrades intensity (Agent A Veto).
          </p>
          {/* Strength logging is handled by DailyCheckIn component */}
        </CardContent>
      </Card>
    </div>
  );
}

