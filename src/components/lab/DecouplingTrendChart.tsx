"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface DecouplingData {
  date: string;
  decoupling: number;
}

interface DecouplingTrendChartProps {
  data: DecouplingData[];
}

export function DecouplingTrendChart({ data }: DecouplingTrendChartProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Decoupling Trend (Metabolic Agent)</CardTitle>
        <CardDescription className="text-zinc-400">
          Aerobic Decoupling (Pw:Hr) over time at Zone 2 intensity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis 
              dataKey="date" 
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa' }}
            />
            <YAxis 
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa' }}
              label={{ value: 'Decoupling %', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #3f3f46',
                color: '#fff'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="decoupling" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Aerobic Decoupling %"
              dot={{ fill: '#10b981', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-4">
          Goal: Watch the line flatten (proving the High-Rev engine is efficient, not just fast).
        </p>
      </CardContent>
    </Card>
  );
}

