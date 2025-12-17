"use client";

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

interface DecisionReviewCardProps {
  session: SessionLog;
}

export function DecisionReviewCard({ session }: DecisionReviewCardProps) {
  const getVoteColor = (vote: 'GREEN' | 'YELLOW' | 'RED') => {
    switch (vote) {
      case 'GREEN': return 'text-green-500 bg-green-500/10';
      case 'YELLOW': return 'text-yellow-500 bg-yellow-500/10';
      case 'RED': return 'text-red-500 bg-red-500/10';
    }
  };

  const getAgentLabel = (type: string) => {
    switch (type) {
      case 'STRUCTURAL': return 'Structural';
      case 'METABOLIC': return 'Metabolic';
      case 'FUELING': return 'Fueling';
      default: return type;
    }
  };

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
        <div>
          <h3 className="text-xl font-semibold text-zinc-100 mb-1">
            {formatDate(session.session_date)}
          </h3>
          <div className="flex gap-4 text-sm text-zinc-400">
            <span>{session.sport_type}</span>
            <span>{session.duration_minutes} min</span>
            <span className="capitalize">{session.source.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="text-sm text-zinc-500">
          {session.votes.length} agent vote{session.votes.length !== 1 ? 's' : ''}
        </div>
      </div>

      {session.votes.length > 0 ? (
        <div className="space-y-3 mt-4">
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Agent Votes
          </h4>
          {session.votes.map((vote) => (
            <div
              key={vote.id}
              className={`p-3 rounded border ${getVoteColor(vote.vote)} border-current/20`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{getAgentLabel(vote.agent_type)} Agent</span>
                <span className="text-xs font-semibold">{vote.vote}</span>
              </div>
              <p className="text-sm text-zinc-300 mt-1">{vote.reasoning}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 text-sm mt-4">No agent votes recorded for this session.</p>
      )}

      {session.metadata && Object.keys(session.metadata).length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-300">
            View Metadata
          </summary>
          <pre className="mt-2 p-3 bg-zinc-950 rounded text-xs text-zinc-400 overflow-auto">
            {JSON.stringify(session.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

