"use client";

import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  onRunAnalysis: () => void;
  isLoading: boolean;
}

export function DashboardHeader({ onRunAnalysis, isLoading }: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">APEX Dashboard</h1>
        <p className="text-zinc-400">Bio-Mechanical Integrity System</p>
      </div>
      <div className="flex gap-4">
        <Button 
          onClick={onRunAnalysis} 
          disabled={isLoading}
          variant="outline"
          className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
        >
          {isLoading ? "Analyzing..." : "Run Coach Analysis"}
        </Button>
        <a href="/settings" className="text-zinc-500 hover:text-white transition-colors underline underline-offset-4 flex items-center">
          Configure Phenotype
        </a>
      </div>
    </header>
  );
}

