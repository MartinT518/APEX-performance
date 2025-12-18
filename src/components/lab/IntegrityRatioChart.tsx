"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertTriangle } from "lucide-react";

interface WeeklyData {
  week: string;
  tonnage: number;
  runningVolume: number;
}

interface IntegrityRatioChartProps {
  data: WeeklyData[];
}

export function IntegrityRatioChart({ data }: IntegrityRatioChartProps) {
  const hasRisk = data.some(d => d.runningVolume > d.tonnage);

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Integrity Ratio (Structural Agent)</CardTitle>
            <CardDescription className="text-zinc-400">
              Weekly Tonnage vs Running Volume (12 Weeks)
            </CardDescription>
          </div>
          {hasRisk && (
            <div className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-semibold">Risk Alert</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis 
              dataKey="week" 
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa' }}
            />
            <YAxis 
              yAxisId="left"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa' }}
              label={{ value: 'Tonnage (kg)', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa' }}
              label={{ value: 'Running Volume (km)', angle: 90, position: 'insideRight', fill: '#a1a1aa' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #3f3f46',
                color: '#fff'
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="tonnage" 
              fill="#3b82f6" 
              name="Weekly Tonnage (kg)"
              radius={[4, 4, 0, 0]}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="runningVolume" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Running Volume (km)"
              dot={{ fill: '#ef4444', r: 4 }}
            />
            {data.map((d, idx) => (
              d.runningVolume > d.tonnage && (
                <ReferenceLine 
                  key={`risk-${idx}`}
                  yAxisId="right"
                  y={d.runningVolume} 
                  stroke="#fbbf24"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-4">
          If the red line (Running Volume) goes above the blue bars (Tonnage) → Risk Alert: Chassis is not supporting Engine.
        </p>
      </CardContent>
    </Card>
  );
}

