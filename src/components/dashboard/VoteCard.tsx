"use client";

import { IAgentVote } from '@/types/agents';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAgentName, VOTE_COLORS, VOTE_LABELS } from './logic/decisionLogUtils';

interface VoteCardProps {
  vote: IAgentVote;
}

export function VoteCard({ vote }: VoteCardProps) {
  return (
    <Card className={`border ${VOTE_COLORS[vote.vote]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold">
            {getAgentName(vote.agentId)}
          </CardTitle>
          <Badge
            className={`${
              vote.vote === 'RED'
                ? 'bg-red-900/50 text-red-400 border-red-900'
                : vote.vote === 'AMBER'
                ? 'bg-yellow-900/50 text-yellow-400 border-yellow-900'
                : 'bg-green-900/50 text-green-400 border-green-900'
            }`}
          >
            {VOTE_LABELS[vote.vote]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-zinc-300">{vote.reason}</p>
        
        {vote.flaggedMetrics && vote.flaggedMetrics.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Flagged Metrics:
            </p>
            <div className="space-y-1">
              {vote.flaggedMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="text-xs text-zinc-400 font-mono bg-zinc-900/50 px-2 py-1 rounded"
                >
                  {metric.metric}: {metric.value} (threshold: {metric.threshold})
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-zinc-500 mt-2">
          Confidence: {(vote.confidence * 100).toFixed(0)}%
        </div>
      </CardContent>
    </Card>
  );
}

