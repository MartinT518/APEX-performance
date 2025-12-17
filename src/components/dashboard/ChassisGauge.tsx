"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ChassisGaugeProps {
  score: number; // 0-100
  tonnage: number;
  cadenceStability: number;
}

export function ChassisGauge({ score, tonnage, cadenceStability }: ChassisGaugeProps) {
  // Determine color based on score (Red < 50, Amber < 80, Green > 80)
  let fill = "#22c55e"; // Green
  if (score < 50) fill = "#ef4444"; // Red
  else if (score < 80) fill = "#f59e0b"; // Amber

  const data = [
    {
      name: 'Integrity',
      value: score,
      fill: fill
    }
  ];

  return (
    <Card className="w-full max-w-sm border-zinc-800 bg-zinc-950 text-white">
      <CardHeader className="items-center pb-0">
        <CardTitle>Chassis Integrity</CardTitle>
        <CardDescription>Structural Health Score</CardDescription>
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
              <span className="text-xs text-zinc-400 mt-1">SIS Scored</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
