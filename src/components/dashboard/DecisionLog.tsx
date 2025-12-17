"use client";

import { IAgentVote } from '@/types/agents';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { useState } from 'react';

interface DecisionLogProps {
  votes: IAgentVote[];
  reasoning?: string;
}

const VOTE_COLORS = {
  RED: 'bg-red-900/20 border-red-900 text-red-400',
  AMBER: 'bg-yellow-900/20 border-yellow-900 text-yellow-400',
  GREEN: 'bg-green-900/20 border-green-900 text-green-400',
};

const VOTE_LABELS = {
  RED: 'VETO',
  AMBER: 'CAUTION',
  GREEN: 'GO',
};

export function DecisionLog({ votes, reasoning }: DecisionLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!votes || votes.length === 0) {
    return null;
  }

  const getAgentName = (agentId: string): string => {
    const names: Record<string, string> = {
      structural_agent: 'Structural Agent',
      metabolic_agent: 'Metabolic Agent',
      fueling_agent: 'Fueling Agent',
    };
    return names[agentId] || agentId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <Info className="h-4 w-4 mr-2" />
          Why this plan?
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Agent Decision Log
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Overall Reasoning */}
          {reasoning && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-300">Coach Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">{reasoning}</p>
              </CardContent>
            </Card>
          )}

          {/* Agent Votes */}
          {votes.map((vote) => (
            <Card
              key={vote.agentId}
              className={`border ${VOTE_COLORS[vote.vote]}`}
            >
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
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

