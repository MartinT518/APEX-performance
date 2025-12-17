"use client";

import { Badge } from '@/components/ui/badge';
import { DecisionLog } from './DecisionLog';
import type { IAnalysisResult } from '@/types/analysis';

interface AnalysisResultCardProps {
  result: IAnalysisResult;
}

export function AnalysisResultCard({ result }: AnalysisResultCardProps) {
  return (
    <div className={`mb-8 p-4 rounded-lg border ${result.success ? 'bg-blue-900/20 border-blue-900' : 'bg-red-900/20 border-red-900'}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold">Analysis Result</h3>
        <div className="flex gap-2">
          {result.decision && (
            <DecisionLog 
              votes={result.decision.votes || []} 
              reasoning={result.decision.reasoning}
            />
          )}
          {result.metadata && (
            <Badge 
              variant={result.metadata.dataSource === 'GARMIN' ? 'default' : 'secondary'}
              className={result.metadata.dataSource === 'GARMIN' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}
            >
              Source: {result.metadata.dataSource}
            </Badge>
          )}
        </div>
      </div>
      
      {result.metadata && (
        <div className="mb-2 text-xs text-zinc-400 font-mono">
          Activity: {result.metadata.activityName || 'N/A'} <br/>
          Synced: {result.metadata.timestamp ? new Date(result.metadata.timestamp).toLocaleTimeString() : 'N/A'}
        </div>
      )}

      <pre className="text-xs overflow-auto max-h-40">
        {JSON.stringify(result.decision, null, 2)}
      </pre>
    </div>
  );
}

