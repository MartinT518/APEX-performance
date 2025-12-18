"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from 'react';
import { IAgentVote } from '@/types/agents';

interface MetabolicGaugeProps {
  vote: IAgentVote | null;
  hrvStatus?: string;
  aerobicDecoupling?: number;
  phenotypeMode?: string;
}

export function MetabolicGauge({ vote, hrvStatus, aerobicDecoupling, phenotypeMode }: MetabolicGaugeProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate normalized score from vote
  let score = 100;
  let fill = "#22c55e"; // Green
  
  if (vote) {
    if (vote.vote === 'RED') {
      score = 30;
      fill = "#ef4444"; // Red
    } else if (vote.vote === 'AMBER') {
      score = 65;
      fill = "#f59e0b"; // Amber
    } else {
      score = 100;
      fill = "#22c55e"; // Green
    }
  }

  const data = [
    {
      name: 'Metabolic',
      value: score,
      fill: fill
    }
  ];

  return (
    <Card 
      className="w-full max-w-sm border-zinc-800 bg-zinc-950 text-white cursor-pointer"
      onClick={() => setShowDetails(!showDetails)}
    >
      <CardHeader className="items-center pb-0">
        <CardTitle>Metabolic State</CardTitle>
        <CardDescription>Engine Health Score</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <div className="mx-auto aspect-square max-h-[250px] relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="80%" 
              outerRadius="100%" 
              barSize={15} 
              data={data} 
              startAngle={180} 
              endAngle={0}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={10}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-10">
            <span className="text-4xl font-bold" style={{ color: fill }}>{score}%</span>
            <span className="text-xs text-zinc-400 mt-1">Engine Status</span>
          </div>
        </div>
        
        {showDetails && (
          <div className="mt-4 p-3 bg-zinc-900 rounded border border-zinc-700 text-sm space-y-1">
            <div className="text-zinc-300">
              <span className="text-zinc-500">HRV Status:</span> {hrvStatus || 'N/A'}
            </div>
            <div className="text-zinc-300">
              <span className="text-zinc-500">Aerobic Decoupling:</span> {aerobicDecoupling !== undefined ? `${aerobicDecoupling.toFixed(1)}%` : 'N/A'}
            </div>
            <div className="text-zinc-300">
              <span className="text-zinc-500">Phenotype Mode:</span> {phenotypeMode || 'N/A'}
            </div>
            {vote && (
              <div className="text-zinc-300 mt-2 pt-2 border-t border-zinc-700">
                <span className="text-zinc-500">Agent Vote:</span> {vote.vote} - {vote.reason}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

