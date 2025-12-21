"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { loadLabData } from './logic/dataLoader';
import { logger } from '@/lib/logger';
import { calculateValuation } from '@/modules/analyze/valuationEngine';
import { loadSessionsWithVotes } from '../history/logic/sessionLoader';
import { sessionWithVotesToPrototype } from '@/types/prototype';
import { supabase } from '@/lib/supabase';

import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Flame, 
  Activity, 
  ArrowUpRight 
} from 'lucide-react';
import type { GutIndexData } from './logic/dataLoader';

function LabContent() {
  const [integrityData, setIntegrityData] = useState<number[]>([]);
  const [decouplingData, setDecouplingData] = useState<number[]>([]);
  const [longrunEfficiencyData, setLongrunEfficiencyData] = useState<number[]>([]);
  const [gutData, setGutData] = useState<GutIndexData[]>([]);
  const [adherenceScore, setAdherenceScore] = useState<number>(0);
  const [coachVerdict, setCoachVerdict] = useState<string>('');
  const [verdictText, setVerdictText] = useState<string>('');
  const [integrityRatio, setIntegrityRatio] = useState<number>(0);
  const [vetoCount, setVetoCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const labData = await loadLabData();
      const { data: authSession } = await supabase.auth.getSession();
      const userId = authSession?.session?.user?.id;
      
      let currentIntegrityValues: number[] = [];
      
      if (userId) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        
        const sessionsWithVotes = await loadSessionsWithVotes(
          userId,
          { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
          'ALL'
        );
        
        const prototypeSessions = sessionsWithVotes.map(s => 
          sessionWithVotesToPrototype(s, s.dailyMonitoring || null)
        );
        
        const valuation = calculateValuation(prototypeSessions);
        setAdherenceScore(valuation.adherenceScore);
        setCoachVerdict(valuation.coachVerdict);
        setVerdictText(valuation.verdictText);
        setIntegrityRatio(valuation.integrityRatio);
        setVetoCount(valuation.vetoCount);
        
        // Baseline integrity from current valuation
        const integrityRatioPercent = Math.min(150, (valuation.integrityRatio / 0.8) * 100);
        for (let i = 0; i < 10; i++) {
          const variation = (Math.random() - 0.5) * 5;
          currentIntegrityValues.push(Math.max(20, Math.min(150, integrityRatioPercent + variation)));
        }
      }

      // Merge with actual Lab Data if available
      if (labData.integrityData && labData.integrityData.length > 0) {
        const actualValues = labData.integrityData.map(week => {
          const ratio = week.runningVolume > 0 ? (week.tonnage / 1000) / (week.runningVolume / 10) : 0;
          return Math.round(Math.min(150, (ratio / 0.8) * 100));
        });
        
        const startIndex = Math.max(0, 10 - actualValues.length);
        for (let i = 0; i < actualValues.length && (startIndex + i) < 10; i++) {
          if (actualValues[i] > 0) currentIntegrityValues[startIndex + i] = actualValues[i];
        }
      }
      
      setIntegrityData(currentIntegrityValues.length > 0 ? currentIntegrityValues : Array(10).fill(0));
      setGutData(labData.gutIndexData || []);

      if (labData.decouplingData && labData.decouplingData.length > 0) {
        const decVals = labData.decouplingData.slice(-7).map(d => d.decoupling);
        while (decVals.length < 7) decVals.unshift(0);
        setDecouplingData(decVals);
      } else {
        setDecouplingData(Array(7).fill(0));
      }

      if (labData.longrunEfficiencyData && labData.longrunEfficiencyData.length > 0) {
        const maxEff = Math.max(...labData.longrunEfficiencyData.map(d => d.efficiency), 1);
        const effVals = labData.longrunEfficiencyData.slice(-10).map(d => 
          Math.round(Math.min(100, (d.efficiency / maxEff) * 100))
        );
        while (effVals.length < 10) effVals.unshift(0);
        setLongrunEfficiencyData(effVals);
      } else {
        setLongrunEfficiencyData(Array(10).fill(0));
      }
      
    } catch (err) {
      logger.error('Failed to load lab data', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const gutCheckScore = gutData.filter(d => d.isSuccessful).length;
  const showSafetyWarning = integrityRatio < 1.0;

  return (
    <div className="space-y-6 pb-24 p-4 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">Campaign War Room</h1>
          <p className="text-xs text-slate-500 font-mono">Analysis Unit C-1 // Target: 2:29:59</p>
        </div>
        <div className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800 text-[10px] text-emerald-500 font-bold flex items-center gap-1.5 shadow-lg">
          <Activity className="w-3 h-3" /> AGENT C: ACTIVE
        </div>
      </header>

      {/* 1. ROAD TO 2:30 VALUATION MODULE */}
      <div className={`relative overflow-hidden rounded-2xl border-2 p-6 transition-all shadow-2xl ${
        coachVerdict === 'ON TRACK' ? 'bg-emerald-500/10 border-emerald-500/50' : 
        coachVerdict === 'POSITIVE DEVIATION' ? 'bg-amber-500/10 border-amber-500/50' :
        'bg-red-500/10 border-red-500/50'
      }`}>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          {coachVerdict === 'ON TRACK' ? <ShieldCheck className="w-32 h-32" /> : <AlertTriangle className="w-32 h-32" />}
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className={`text-4xl font-black tracking-tighter ${
              coachVerdict === 'ON TRACK' ? 'text-emerald-400' : 
              coachVerdict === 'POSITIVE DEVIATION' ? 'text-amber-400' : 
              'text-red-400'
            }`}>
              {coachVerdict}
            </h3>
            <p className="text-slate-200 font-medium text-lg max-w-md italic leading-tight">
              "{verdictText}"
            </p>
            {coachVerdict === 'POSITIVE DEVIATION' && (
              <div className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-1 rounded inline-block font-mono border border-amber-500/30">
                STRATAGEM: VETO OVERRIDE ACTIVE ({vetoCount} VETOES)
              </div>
            )}
          </div>

          <div className="w-full md:w-64 space-y-3">
             <div className="flex justify-between items-end">
                <span className="text-xs text-slate-400 font-bold uppercase">Campaign Adherence</span>
                <span className="text-3xl font-black text-white font-mono">{adherenceScore.toFixed(0)}%</span>
             </div>
             <div className="h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    adherenceScore > 90 ? 'bg-emerald-500' : adherenceScore > 80 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${adherenceScore}%` }}
                />
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 2. CHASSIS INTEGRITY & DECOUPLING CLUSTER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* INTEGRITY RATIO UPGRADE */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Chassis Integrity Module
            </h3>
            <div className="text-right">
              <span className={`font-mono text-2xl font-black ${showSafetyWarning ? 'text-red-500' : 'text-emerald-500'}`}>
                {integrityRatio.toFixed(2)}
              </span>
              <div className="text-[8px] text-slate-600 font-bold uppercase">Integrity Ratio</div>
            </div>
          </div>
          
          <div className="h-40 flex items-end justify-between gap-1.5 relative px-2">
            {/* Safety Threshold Line at Ratio 1.0 (relative to 1.5 max display) */}
            <div className="absolute w-full h-[1px] bg-red-500/40 border-t border-dashed border-red-500/50 z-10 pointer-events-none" style={{ bottom: '66.6%' }}>
               <div className="absolute right-0 -top-3.5 text-[7px] text-red-500 font-black uppercase tracking-widest bg-slate-900/80 px-1 rounded">
                 Safety Threshold (1.0)
               </div>
            </div>
            
            {integrityData.map((val, i) => {
              // Map percentage (0-150) to display height
              const heightPercent = (val / 150) * 100;
              const isBelowThreshold = (val / 150 * 1.5) < 1.0; 
              
              return (
                <div key={i} className="flex-1 bg-slate-800/30 rounded-t-lg relative group h-full">
                  <div 
                    className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-700 ${
                      isBelowThreshold ? 'bg-gradient-to-t from-red-600/40 to-red-400/20' : 'bg-gradient-to-t from-emerald-600/40 to-emerald-400/20'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded font-mono border border-slate-700 z-30">
                    {(val / 150 * 1.5).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
          
          {showSafetyWarning && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-4 items-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <p className="text-[10px] text-red-400 font-black leading-tight uppercase tracking-tight">
                  Structural Deficit Detected
                </p>
                <p className="text-[9px] text-red-500/80 font-bold uppercase leading-none mt-1">
                  Increase Tonnage or Cap Mileage immediately.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 4. DECOUPLING TREND ANALYSIS */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center text-xs font-black text-slate-500 uppercase tracking-widest">
             <h3 className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-blue-500" /> Decoupling Analysis</h3>
             <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
               {decouplingData.length > 1 ? (() => {
                 const y = decouplingData;
                 const first = y[0];
                 const last = y[y.length - 1];
                 const slope = (last - first) / Math.max(1, y.length - 1);
                 const isImproving = slope <= 0;
                 
                 return (
                   <>
                     <ArrowUpRight className={`w-3 h-3 transition-transform ${isImproving ? 'rotate-90 text-emerald-400' : 'text-red-400'}`} />
                     <span className="font-mono text-[10px]">{(slope).toFixed(2)}% / RUN</span>
                   </>
                 );
               })() : <span className="text-[9px]">CALIBRATING...</span>}
             </div>
          </div>
          
          <div className="h-32 flex items-end gap-2 pt-4 relative">
            {/* SVG Trend Line Overlay */}
            {decouplingData.length > 1 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible" preserveAspectRatio="none">
                {(() => {
                  const y = decouplingData;
                  const maxVal = Math.max(...y, 10);
                  const step = 100 / (y.length - 1);
                  const points = y.map((v, i) => ({
                    x: i * step,
                    y: 100 - (v / maxVal * 100)
                  }));
                  
                  // Linear Regression for Trend Line
                  const n = y.length;
                  const sumX = points.reduce((acc, p) => acc + p.x, 0);
                  const sumY = points.reduce((acc, p) => acc + p.y, 0);
                  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
                  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);
                  
                  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
                  const b = (sumY - m * sumX) / n;
                  
                  const x1 = 0;
                  const y1 = b;
                  const x2 = 100;
                  const y2 = m * 100 + b;
                  
                  return (
                    <line 
                      x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                      stroke="#60a5fa" 
                      strokeWidth="2" 
                      strokeDasharray="4 2"
                      className="opacity-60"
                    />
                  );
                })()}
              </svg>
            )}

            {decouplingData.map((val, i) => (
              <div key={i} className="flex-1 bg-slate-800/20 rounded-t-md relative group h-full">
                <div 
                  className="absolute bottom-0 w-full bg-blue-500/40 rounded-t-md transition-all duration-1000" 
                  style={{ height: `${Math.min(100, val * 8)}%` }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded font-mono border border-slate-700 z-30">
                  {val.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-600 font-black flex justify-between uppercase tracking-tighter">
             <span>Efficiency Trend Analysis</span>
             <span className="text-blue-500/80">Metabolic Stability Output</span>
          </div>
        </div>
      </div>

      {/* 3. THE GUT CHECK HEATMAP & TACTICAL OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center text-xs font-black text-slate-500 uppercase tracking-widest">
            <h3 className="flex items-center gap-2"><Flame className="w-3.5 h-3.5 text-orange-500" /> Gut Efficiency Heatmap</h3>
            <div className="font-mono text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">
               SCORE: <span className={gutCheckScore >= 8 ? 'text-emerald-400' : 'text-orange-400'}>{gutCheckScore}</span>/12
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => {
              const data = gutData[i];
              return (
                <div 
                  key={i} 
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all duration-500 relative group ${
                    !data ? 'bg-slate-800/10 border-slate-700/20' :
                    !data.hasData ? 'bg-slate-800/40 border-slate-500/50' :
                    data.isSuccessful ? 'bg-emerald-500/20 border-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]' :
                    'bg-red-500/20 border-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]'
                  }`}
                >
                  {data ? (
                    <>
                      <div className={`text-[10px] font-black font-mono ${
                        !data.hasData ? 'text-slate-500' :
                        data.isSuccessful ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {data.hasData ? data.carbsPerHour : '?'}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded font-mono border border-slate-700 z-30 whitespace-nowrap">
                        {data.date}: {data.hasData ? `${data.carbsPerHour}g/hr | GI: ${data.giDistress}` : 'Audit Missing'}
                      </div>
                    </>
                  ) : (
                    <div className="w-1 h-1 bg-slate-700/50 rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 font-bold italic mt-2 uppercase tracking-tighter">
            *Critical Success: {'>'}80g Carbs/hr + None/Minimal GI Distress (Scale 1-3).
          </p>
        </div>

        {/* 5. TACTICAL OVERVIEW as Campaign Stats */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between backdrop-blur-md shadow-xl">
           <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Activity className="w-3.5 h-3.5 text-white" /> Campaign Tactical Specs
           </h3>
           <div className="space-y-5">
              <div className="flex justify-between items-end border-b border-slate-800/50 pb-3">
                 <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Banked Long Runs</span>
                    <div className="text-sm font-mono text-slate-400">Targeting 20 Units</div>
                 </div>
                 <span className="text-2xl font-black text-white font-mono">{longrunEfficiencyData.length}<span className="text-slate-600 text-sm">/20</span></span>
              </div>
              <div className="flex justify-between items-end border-b border-slate-800/50 pb-3">
                 <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Efficiency</span>
                    <div className="text-sm font-mono text-slate-400">Engine Output Factor</div>
                 </div>
                 <span className="text-2xl font-black text-emerald-400 font-mono">
                   {((longrunEfficiencyData.reduce((acc, curr) => acc + curr, 0) / Math.max(1, longrunEfficiencyData.length)) * 1.2).toFixed(2)}
                 </span>
              </div>
              <div className="flex justify-between items-center">
                 <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Campaign Phase</span>
                    <div className="text-sm font-mono text-slate-400">Completion Velocity</div>
                 </div>
                 <div className="text-right">
                    <span className="text-2xl font-black text-blue-400 font-mono">72%</span>
                    <div className="text-[8px] text-blue-500/60 font-black uppercase">On Schedule</div>
                 </div>
              </div>
           </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function LabPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <LabContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
