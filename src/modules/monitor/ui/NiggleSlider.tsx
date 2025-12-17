"use client";

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMonitorStore } from "../monitorStore";

interface NiggleSliderProps {
  onValueChange?: (value: number) => void;
}

export function NiggleSlider({ onValueChange }: NiggleSliderProps) {
  const { setNiggleScore, todayEntries } = useMonitorStore();
  const [value, setValue] = React.useState([todayEntries.niggleScore ?? 0]);

  const handleValueChange = (newValue: number[]) => {
    setValue(newValue);
    setNiggleScore(newValue[0]);
    if (onValueChange) onValueChange(newValue[0]);
  };

  // Color logic: Green < 4, Red >= 4
  const isHighRisk = value[0] > 3;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Daily Chassis Check</span>
          <span className={cn(
            "text-2xl font-bold",
            isHighRisk ? "text-red-500" : "text-green-500"
          )}>
            {value[0]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Niggle / Pain Rating (0-10)</Label>
          <Slider
            defaultValue={[0]}
            max={10}
            step={1}
            value={value}
            onValueChange={handleValueChange}
            className={cn(
              "[&>.relative>.absolute]:bg-primary", // Track color override if needed
            )}
          />
          <p className="text-xs text-muted-foreground">
            {isHighRisk 
              ? "Caution: High mechanical risk detected." 
              : "System optimized for high load."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
