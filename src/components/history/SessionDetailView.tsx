"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";
import { AgentPostMortem } from "./AgentPostMortem";
import { BlueprintImpact } from "./BlueprintImpact";
import { usePhenotypeStore } from "@/modules/monitor/phenotypeStore";

interface SessionMetadata {
  dataSource?: 'GARMIN' | 'SIMULATION' | 'NONE';
  diagnostics?: {
    status: 'VALID' | 'SUSPECT' | 'DISCARD';
    validPointCount: number;
    originalPointCount: number;
  };
  cadenceLockDetected?: boolean;
}

interface DailyMonitoring {
  niggle_score: number | null;
  strength_session: boolean;
  strength_tier: 'Mobility' | 'Hypertrophy' | 'Strength' | 'Power' | null;
  tonnage: number | null;
  fueling_logged: boolean;
  fueling_carbs_per_hour: number | null;
}

interface AgentVote {
  id: string;
  session_id: string;
  agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
  vote: 'GREEN' | 'YELLOW' | 'RED';
  reasoning: string;
  created_at: string;
}

interface SessionDetailViewProps {
  sessionDate: string;
  metadata: Record<string, unknown> | null;
  votes: AgentVote[];
  dailyMonitoring: DailyMonitoring | null;
  certaintyDelta?: number;
}

export function SessionDetailView({
  sessionDate,
  metadata,
  votes,
  dailyMonitoring,
  certaintyDelta
}: SessionDetailViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { profile } = usePhenotypeStore();
  const sessionMeta = metadata as SessionMetadata | null;

  const integrityStatus = sessionMeta?.diagnostics?.status === 'SUSPECT' || 
                          sessionMeta?.diagnostics?.status === 'DISCARD' ||
                          sessionMeta?.cadenceLockDetected ? 'SUSPECT' : 'VALID';

  const cadenceLockPercent = sessionMeta?.diagnostics 
    ? ((sessionMeta.diagnostics.originalPointCount - sessionMeta.diagnostics.validPointCount) / 
       sessionMeta.diagnostics.originalPointCount * 100).toFixed(1)
    : '0';

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <span>{isExpanded ? 'Hide' : 'Show'} Session Details</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Truth Header */}
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Data Validation (Phenotype Context)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-300">
                Data validated against {profile?.is_high_rev ? 'High-Rev' : 'Standard'} Phenotype
                {profile?.config.max_hr_override && ` (Max HR ${profile.config.max_hr_override})`}.
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={integrityStatus === 'VALID' ? 'bg-blue-600' : 'bg-orange-600'}>
                    {integrityStatus}
                  </Badge>
                  <span className="text-xs text-zinc-400">
                    {cadenceLockPercent}% Cadence Lock detected
                  </span>
                </div>
                {profile?.is_high_rev && (
                  <p className="text-xs text-zinc-500">
                    High-Rev Filter: {integrityStatus === 'VALID' ? 'PASS' : 'FLAG'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agent Post-Mortem */}
          <AgentPostMortem votes={votes} />

          {/* Hidden Variables Log */}
          {dailyMonitoring && (
            <Card className="border-zinc-800 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-base">Hidden Variables Log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dailyMonitoring.niggle_score !== null && (
                  <div className="text-sm">
                    <span className="text-zinc-400">Pain Log: </span>
                    <span className="text-zinc-100 font-semibold">
                      {dailyMonitoring.niggle_score}/10
                    </span>
                    <span className="text-zinc-500 ml-2">
                      (recorded before session)
                    </span>
                  </div>
                )}
                {dailyMonitoring.strength_session && dailyMonitoring.strength_tier && (
                  <div className="text-sm">
                    <span className="text-zinc-400">Strength Log: </span>
                    <span className="text-zinc-100 font-semibold">
                      {dailyMonitoring.strength_tier}
                    </span>
                    {dailyMonitoring.tonnage && (
                      <span className="text-zinc-500 ml-2">
                        ({dailyMonitoring.tonnage}kg Volume)
                      </span>
                    )}
                  </div>
                )}
                {dailyMonitoring.fueling_logged && dailyMonitoring.fueling_carbs_per_hour && (
                  <div className="text-sm">
                    <span className="text-zinc-400">Fueling: </span>
                    <span className="text-zinc-100 font-semibold">
                      {dailyMonitoring.fueling_carbs_per_hour}g Carbs/hr
                    </span>
                  </div>
                )}
                {!dailyMonitoring.niggle_score && !dailyMonitoring.strength_session && !dailyMonitoring.fueling_logged && (
                  <p className="text-xs text-zinc-500">No manual inputs recorded for this session.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Blueprint Impact */}
          <BlueprintImpact 
            certaintyDelta={certaintyDelta}
            baselineUpdate={undefined} // TODO: Calculate from analyzeStore if needed
          />
        </div>
      )}
    </div>
  );
}

