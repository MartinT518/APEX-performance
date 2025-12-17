"use client";

import { AuthGuard } from '@/components/auth/AuthGuard';
import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { GatekeeperPrompt } from '@/components/inputs/GatekeeperPrompt';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TriangleAlert, CircleCheck, Ban } from 'lucide-react';
import { useState, useEffect } from 'react';

// Mock Template
const WEEKLY_TEMPLATE = [
  { day: 'Monday', type: 'Recovery', name: 'Zone 1 Shakeout', duration: '45m', impact: true },
  { day: 'Tuesday', type: 'Quality', name: 'Threshold Intervals', duration: '75m', impact: true },
  { day: 'Wednesday', type: 'Aerobic', name: 'Zone 2 Steady', duration: '60m', impact: true },
  { day: 'Thursday', type: 'Rest', name: 'Mobility & rest', duration: '30m', impact: false },
  { day: 'Friday', type: 'Speed', name: 'Hill Repeats', duration: '50m', impact: true },
  { day: 'Saturday', type: 'Key', name: 'Long Run', duration: '120m', impact: true },
  { day: 'Sunday', type: 'Recovery', name: 'Active Recovery', duration: '40m', impact: false },
];

function PlanContent() {
  const { todayEntries } = useMonitorStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  const niggleScore = todayEntries.niggleScore || 0;
  
  // LOGIC: Structural Agent (Simplified Integration for UI)
  // In a full implementation, we'd call the actual Agent class, but here we mirror the matrix logic.
  let planStatus: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
  let substitutionMessage = "";

  if (niggleScore >= 8) {
    planStatus = 'RED';
    substitutionMessage = "SHUTDOWN: All impact activities cancelled. Refer to Medical.";
  } else if (niggleScore >= 5) {
    planStatus = 'RED'; // Functional Red (Veto)
    substitutionMessage = "SUBSTITUTION: Impact disallowed. Stationary Bike/Swim prescribed.";
  } else if (niggleScore >= 3) {
    planStatus = 'AMBER';
    substitutionMessage = "CAP: Intensity removed. Run duration capped at 45m.";
  }

  return (
    <GatekeeperPrompt>
      <div className="min-h-screen bg-black text-white p-8 font-sans">
         <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Training Plan</h1>
          <p className="text-zinc-400">Week 42 - Base Phase</p>
        </header>

      {/* Plan Status Banner */}
      <div className={`mb-8 p-4 rounded-lg border ${
          planStatus === 'RED' ? 'bg-red-900/20 border-red-900 text-red-400' :
          planStatus === 'AMBER' ? 'bg-yellow-900/20 border-yellow-900 text-yellow-400' :
          'bg-green-900/20 border-green-900 text-green-400'
      }`}>
        <div className="flex items-center gap-3">
            {planStatus === 'RED' ? <Ban className="h-6 w-6" /> :
             planStatus === 'AMBER' ? <TriangleAlert className="h-6 w-6" /> :
             <CircleCheck className="h-6 w-6" />
            }
            <div>
                <h3 className="text-lg font-bold">Execution Status: {planStatus}</h3>
                <p className="text-sm opacity-90">{
                    planStatus === 'GREEN' ? "All systems nominal. Execute as prescribed." : substitutionMessage
                }</p>
            </div>
        </div>
      </div>

        {/* Weekly View */}
      <div className="grid gap-4">
        {WEEKLY_TEMPLATE.map((workout, index) => {
            // Apply Substitution Logic Per Day
            let isModified = false;
            let modificationType = "";
            let newWorkoutName = workout.name;

            if (planStatus === 'RED' && workout.impact) {
                isModified = true;
                modificationType = "SUBSTITUTED";
                newWorkoutName = "Cross Training (Bike/Swim)";
            } else if (planStatus === 'AMBER' && workout.impact) {
                if (workout.type === 'Quality' || workout.type === 'Speed' || workout.type === 'Key') {
                    isModified = true;
                    modificationType = "DOWNGRADED";
                    newWorkoutName = "Zone 1 Recovery Run (Capped)";
                }
            }

            return (
                <Card key={index} className="bg-zinc-950 border-zinc-800 text-white">
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex gap-4 items-center">
                            <span className="text-zinc-500 font-mono w-24 uppercase text-sm tracking-wider">
                                {workout.day}
                            </span>
                            
                            <div>
                                {isModified ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="line-through text-zinc-600 decoration-zinc-500">
                                                {workout.name}
                                            </span>
                                            <span className="text-xs font-bold text-red-500 bg-red-900/20 px-2 py-0.5 rounded border border-red-900">
                                                {modificationType}
                                            </span>
                                        </div>
                                        <div className="font-bold text-blue-400 flex items-center gap-2">
                                            <span>↳</span> {newWorkoutName}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="font-bold text-lg">{workout.name}</div>
                                )}
                                <div className="text-xs text-zinc-500 mt-1">
                                    Planned: {workout.duration} • {workout.type}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        })}
      </div>
    </div>
    </GatekeeperPrompt>
  );
}

export default function PlanPage() {
  return (
    <AuthGuard>
      <PlanContent />
    </AuthGuard>
  );
}
