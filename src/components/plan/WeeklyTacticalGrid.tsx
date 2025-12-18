"use client";

import { CheckCircle2, ArrowLeftRight, XCircle } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";

interface DayStatus {
  date: string;
  dayName: string;
  status: 'executed' | 'substituted' | 'missed' | 'future' | 'today';
  workoutName?: string;
  isToday?: boolean;
}

interface WeeklyTacticalGridProps {
  days: DayStatus[];
  onDayClick?: (date: string) => void;
}

export function WeeklyTacticalGrid({ days, onDayClick }: WeeklyTacticalGridProps) {
  const getStatusIcon = (status: DayStatus['status']) => {
    switch (status) {
      case 'executed':
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case 'substituted':
        return <ArrowLeftRight className="h-5 w-5 text-yellow-400" />;
      case 'missed':
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: DayStatus['status']) => {
    switch (status) {
      case 'executed':
        return 'border-green-900 bg-green-900/10';
      case 'substituted':
        return 'border-yellow-900 bg-yellow-900/10';
      case 'missed':
        return 'border-red-900 bg-red-900/10';
      case 'today':
        return 'border-blue-900 bg-blue-900/20 border-2';
      case 'future':
        return 'border-zinc-800 bg-zinc-900/50 opacity-60';
      default:
        return 'border-zinc-800 bg-zinc-900';
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-4 text-zinc-300">Weekly Tactical Grid</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => (
          <Card
            key={day.date}
            className={`min-w-[120px] cursor-pointer transition-all ${getStatusColor(day.status)} ${
              day.isToday ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => onDayClick?.(day.date)}
          >
            <CardContent className="p-3">
              <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">
                {day.dayName}
              </div>
              <div className="flex items-center justify-center mb-2">
                {getStatusIcon(day.status)}
              </div>
              {day.workoutName && (
                <div className="text-xs text-zinc-300 text-center line-clamp-2">
                  {day.workoutName}
                </div>
              )}
              {day.status === 'future' && (
                <Tooltip content="Pending Daily Chassis Audit">
                  <div className="text-xs text-zinc-500 text-center mt-1 italic">
                    Subject to Change
                  </div>
                </Tooltip>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

