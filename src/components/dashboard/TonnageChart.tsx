"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TonnageChartProps {
  data: {
    day: string;
    runVolume: number; // km
    strengthLoad: number; // kg
  }[]; // Last 7 days
  maintenanceLine: number; // Tonnage Requirement
}

export function TonnageChart({ data, maintenanceLine }: TonnageChartProps) {
  return (
    <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle>Volume vs. Structure</CardTitle>
        <CardDescription>Run Volume (km) vs Tonnage Maintenance (kg)</CardDescription>
      </CardHeader>
      <CardContent>
         <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                    contentStyle={{ backgroundColor: "#18181b", border: "none" }}
                    labelStyle={{ color: "#e4e4e7" }}
                />
                <Bar yAxisId="left" dataKey="runVolume" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Run (km)" />
                {/* Visualizing Tonnage as a Reference Line for "Maintenance" or separate bars? 
                    The Prompt says "Candlestick", which implies OHLC, but sticking to 
                    "Relationship between Strength Tonnage and Run Volume".
                    A Reference Line for Maintenance + Scatter/Line for actual might work.
                */}
                <ReferenceLine yAxisId="right" y={maintenanceLine} label="Maint." stroke="#ef4444" strokeDasharray="3 3" />
                <Bar yAxisId="right" dataKey="strengthLoad" fill="#22c55e" radius={[4, 4, 0, 0]} name="Lift (kg)" opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
         </div>
      </CardContent>
    </Card>
  );
}
