"use client";

import { SessionStatusBadges } from "./SessionStatusBadges";
import { SessionDetailView } from "./SessionDetailView";
import { Activity, Dumbbell, UtensilsCrossed } from "lucide-react";

interface SessionLog {
  id: string;
  session_date: string;
  sport_type: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
  duration_minutes: number;
  source: 'garmin_health' | 'manual_upload' | 'test_mock';
  metadata: Record<string, unknown> | null;
  created_at: string;
  votes: Array<{
    id: string;
    session_id: string;
    agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
    vote: 'GREEN' | 'YELLOW' | 'RED';
    reasoning: string;
    created_at: string;
  }>;
}

interface DailyMonitoring {
  niggle_score: number | null;
  strength_session: boolean;
  strength_tier: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | null;
  tonnage: number | null;
  fueling_logged: boolean;
  fueling_carbs_per_hour: number | null;
}

interface DecisionReviewCardProps {
  session: SessionLog;
  dailyMonitoring?: DailyMonitoring | null;
  certaintyDelta?: number;
}

export function DecisionReviewCard({ session, dailyMonitoring, certaintyDelta }: DecisionReviewCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-zinc-100 mb-1">
            {formatDate(session.session_date)}
          </h3>
          <div className="flex gap-4 text-sm text-zinc-400 mb-3">
            <span>{session.sport_type}</span>
            <span>{session.duration_minutes} min</span>
            <span className="capitalize">{session.source.replace('_', ' ')}</span>
          </div>
          
          {/* Status Badges */}
          <SessionStatusBadges 
            sportType={session.sport_type}
            metadata={session.metadata}
          />
        </div>

        {/* Subjective Inputs Indicators */}
        <div className="flex gap-2 ml-4">
          {dailyMonitoring && dailyMonitoring.niggle_score !== null && (
            <div className="flex items-center gap-1 text-xs text-zinc-400" title={`Niggle: ${dailyMonitoring.niggle_score}/10`}>
              <Activity className="h-4 w-4" />
            </div>
          )}
          {dailyMonitoring?.strength_session && (
            <div className="flex items-center gap-1 text-xs text-zinc-400" title="Strength logged">
              <Dumbbell className="h-4 w-4" />
            </div>
          )}
          {dailyMonitoring?.fueling_logged && (
            <div className="flex items-center gap-1 text-xs text-zinc-400" title="Fueling logged">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {/* Session Detail View */}
      <SessionDetailView
        sessionDate={session.session_date}
        metadata={session.metadata}
        votes={session.votes}
        dailyMonitoring={dailyMonitoring || null}
        certaintyDelta={certaintyDelta}
      />
    </div>
  );
}

