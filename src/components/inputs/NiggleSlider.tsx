"use client";

import { cn } from "@/lib/utils"; // Assuming shadcn util exists, fallback if not
import { useState } from "react";

interface NiggleSliderProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export function NiggleSlider({ value, onChange, className }: NiggleSliderProps) {
  // Color logic
  const getColor = (v: number) => {
    if (v <= 3) return "text-green-500";
    if (v <= 6) return "text-yellow-500";
    return "text-red-500";
  };

  const getLabel = (v: number) => {
     if (v === 0) return "Clean";
     if (v <= 3) return "Niggle";
     if (v <= 6) return "Pain";
     if (v <= 8) return "Injury";
     return "Broken";
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="flex justify-between items-end">
        <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Pain / Niggle Score
        </label>
        <div className="text-right">
             <span className={cn("text-3xl font-bold font-mono transition-colors", getColor(value))}>
                {value}
             </span>
             <span className="text-xs text-zinc-500 ml-2 block">{getLabel(value)}</span>
        </div>
      </div>
      
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
        style={{
            background: `linear-gradient(to right, #22c55e 0%, #eab308 50%, #ef4444 100%)`
        }}
      />
      <div className="flex justify-between text-xs text-zinc-600 px-1">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
