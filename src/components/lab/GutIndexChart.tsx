"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

interface GutIndexData {
  date: string;
  successfulSessions: number;
}

interface GutIndexChartProps {
  data: GutIndexData[];
  marathonReadinessMinimum?: number;
}

export function GutIndexChart({ data, marathonReadinessMinimum = 10 }: GutIndexChartProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Gut Index (Fueling Agent)</CardTitle>
        <CardDescription className="text-zinc-400">
          Rolling count of successful &gt;60g/hr sessions
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
              label={{ value: 'Successful Sessions', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #3f3f46',
                color: '#fff'
              }}
            />
            <Legend />
            <ReferenceLine 
              y={marathonReadinessMinimum} 
              stroke="#fbbf24" 
              strokeDasharray="5 5"
              label={{ value: 'Marathon Readiness Minimum', position: 'top', fill: '#fbbf24' }}
            />
            <Line 
              type="monotone" 
              dataKey="successfulSessions" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="Successful &gt;60g/hr Sessions"
              dot={{ fill: '#8b5cf6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-4">
          Threshold line indicates minimum sessions required for marathon readiness.
        </p>
      </CardContent>
    </Card>
  );
}

