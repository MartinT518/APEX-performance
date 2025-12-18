"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AgentVote {
  id: string;
  session_id: string;
  agent_type: 'STRUCTURAL' | 'METABOLIC' | 'FUELING';
  vote: 'GREEN' | 'YELLOW' | 'RED';
  reasoning: string;
  created_at: string;
}

interface AgentPostMortemProps {
  votes: AgentVote[];
}

export function AgentPostMortem({ votes }: AgentPostMortemProps) {
  const structuralVote = votes.find(v => v.agent_type === 'STRUCTURAL');
  const metabolicVote = votes.find(v => v.agent_type === 'METABOLIC');
  const fuelingVote = votes.find(v => v.agent_type === 'FUELING');

  const getVoteColor = (vote: 'GREEN' | 'YELLOW' | 'RED' | undefined) => {
    if (!vote) return 'border-zinc-700 bg-zinc-950';
    switch (vote) {
      case 'GREEN': return 'border-green-500/30 bg-green-500/5';
      case 'YELLOW': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'RED': return 'border-red-500/30 bg-red-500/5';
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
        Agent Post-Mortem
      </h4>

      {structuralVote && (
        <Card className={`border ${getVoteColor(structuralVote.vote)}`}>
          <CardHeader>
            <CardTitle className="text-base">Structural Agent Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  structuralVote.vote === 'GREEN' ? 'bg-green-500/20 text-green-400' :
                  structuralVote.vote === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {structuralVote.vote}
                </span>
              </div>
              <p className="text-sm text-zinc-300">{structuralVote.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {metabolicVote && (
        <Card className={`border ${getVoteColor(metabolicVote.vote)}`}>
          <CardHeader>
            <CardTitle className="text-base">Metabolic Agent Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  metabolicVote.vote === 'GREEN' ? 'bg-green-500/20 text-green-400' :
                  metabolicVote.vote === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {metabolicVote.vote}
                </span>
              </div>
              <p className="text-sm text-zinc-300">{metabolicVote.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {fuelingVote && (
        <Card className={`border ${getVoteColor(fuelingVote.vote)}`}>
          <CardHeader>
            <CardTitle className="text-base">Fueling Agent Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  fuelingVote.vote === 'GREEN' ? 'bg-green-500/20 text-green-400' :
                  fuelingVote.vote === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {fuelingVote.vote}
                </span>
              </div>
              <p className="text-sm text-zinc-300">{fuelingVote.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {votes.length === 0 && (
        <p className="text-zinc-500 text-sm">No agent votes recorded for this session.</p>
      )}
    </div>
  );
}

