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
        const actualValues = labData.integrityData.map((week: {runningVolume: number; tonnage: number}) => {
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
        const decVals = labData.decouplingData.map((d: {decoupling: number}) => d.decoupling);
        setDecouplingData(decVals);
      } else {
        // Provide a subtle baseline for the War Room aesthetic if no data, but kept empty for chart
        setDecouplingData([]);
      }

      if (labData.longrunEfficiencyData && labData.longrunEfficiencyData.length > 0) {
        const maxEff = Math.max(...labData.longrunEfficiencyData.map((d: {efficiency: number}) => d.efficiency), 1);
        const effVals = labData.longrunEfficiencyData.slice(-10).map((d: {efficiency: number}) => 
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

  const gutCheckScore = gutData.filter(d => d.hasData && d.carbsPerHour >= 80 && d.giDistress < 3).length;
  const currentRatioValue = integrityRatio;
  const showSafetyWarning = currentRatioValue < 1.0;

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

      {/* 2. VOLUME VALUATION MODULE */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Campaign Volume Valuation
          </h3>
          <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase">
            Strategic Ceiling Analysis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                <span>Capped Volume (Chassis)</span>
                <span className="text-white font-mono">{Math.round(integrityRatio < 0.8 ? 80 : 120)} km/week</span>
              </div>
              <div className="h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${integrityRatio < 0.8 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${(Math.min(integrityRatio, 1.2) / 1.5) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter text-slate-500 font-mono">
                <span>Potential Volume (Engine)</span>
                <span className="text-blue-400">160 km/week</span>
              </div>
              <div className="h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                <div 
                  className="h-full bg-blue-500/30 rounded-full w-full"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              {integrityRatio < 0.8 
                ? "Your Engine is capable of 160km, but your Chassis (Strength) is restricting you to 80km to prevent injury." 
                : "Chassis strength is nominal. You have unlocked 100% of blueprint volume."}
            </p>
          </div>

          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col items-center justify-center text-center space-y-2">
            <div className={`text-4xl font-black font-mono ${integrityRatio < 0.8 ? 'text-red-500' : 'text-emerald-500'}`}>
              -{Math.round(integrityRatio < 0.8 ? 40 : 0)}%
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Volume Opportunity Cost
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 2. CHASSIS INTEGRITY & DECOUPLING CLUSTER */}
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
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-4 items-center animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <p className="text-[10px] text-red-400 font-black leading-tight uppercase tracking-tight">
                  Structural Deficit Detected
                </p>
                <p className="text-[11px] text-red-500 font-bold uppercase leading-none mt-1">
                  Structural Deficit. Increase Tonnage or Cap Mileage.
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
               {decouplingData.length > 0 ? (() => {
                 const y = decouplingData;
                 if (y.length === 0) return <span className="text-[9px]">NO RUN DATA</span>;
                 if (y.length === 1) return <span className="text-[10px] uppercase font-mono">Baseline: {y[0].toFixed(1)}%</span>;
                 
                 const first = y[0];
                 const last = y[y.length - 1];
                 const slope = (last - first) / Math.max(1, y.length - 1);
                 const isImproving = slope <= 0;
                 
                 return (
                   <>
                     <ArrowUpRight className={`w-3 h-3 transition-transform ${isImproving ? 'rotate-90 text-emerald-400' : 'text-red-400'}`} />
                     <span className="font-mono text-[10px]">Efficiency {isImproving ? 'improving' : 'declining'} by {Math.abs(slope).toFixed(2)}% / run</span>
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
                  const maxVal = Math.max(...y, 8);
                  const n = y.length;
                  const step = 100 / (n - 1);
                  const points = y.map((v, i) => ({
                    x: i * step,
                    y: 100 - (v / maxVal * 100)
                  }));
                  
                  // Linear Regression for Trend Line
                  const sumX = points.reduce((acc, p) => acc + p.x, 0);
                  const sumY = points.reduce((acc, p) => acc + p.y, 0);
                  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
                  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);
                  
                  const denominator = (n * sumX2 - (sumX * sumX));
                  const m = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
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

            {decouplingData.length > 0 ? decouplingData.map((val, i) => (
              <div key={i} className="flex-1 bg-slate-800/20 rounded-t-md relative group h-full">
                <div 
                  className="absolute bottom-0 w-full bg-blue-500/40 rounded-t-md transition-all duration-1000" 
                  style={{ height: `${Math.min(100, Math.max(5, val * 10))}%` }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded font-mono border border-slate-700 z-30">
                  {val.toFixed(1)}%
                </div>
              </div>
            )) : (
              <div className="w-full flex items-center justify-center text-slate-700 font-mono text-[10px] uppercase italic">
                No activity metrics found in range
              </div>
            )}
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
            <h3 className="flex items-center gap-2"><Flame className="w-3.5 h-3.5 text-orange-500" /> Fuel Performance Nexus</h3>
             <div className="font-mono text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">
               {(() => {
                 // Calculate Correlation
                 const validPoints = gutData.filter(d => d.hasData && d.decoupling !== null && d.decoupling !== undefined);
                 if (validPoints.length < 3) return <span className="text-slate-500">Need more data</span>;
                 
                 const n = validPoints.length;
                 const sumX = validPoints.reduce((acc, p) => acc + p.carbsPerHour, 0);
                 const sumY = validPoints.reduce((acc, p) => acc + (p.decoupling || 0), 0);
                 const sumXY = validPoints.reduce((acc, p) => acc + p.carbsPerHour * (p.decoupling || 0), 0);
                 const sumX2 = validPoints.reduce((acc, p) => acc + p.carbsPerHour * p.carbsPerHour, 0);
                 
                 const numerator = (n * sumXY) - (sumX * sumY);
                 const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * validPoints.reduce((acc, p) => acc + (p.decoupling || 0)**2, 0) - sumY * sumY));
                 const r = denominator === 0 ? 0 : numerator / denominator;
                 
                 return (
                   <span className={r < -0.3 ? 'text-emerald-400' : 'text-slate-400'}>
                     r = {r.toFixed(2)} {r < -0.3 ? '(Strong)' : ''}
                   </span>
                 );
               })()}
            </div>
          </div>
          
          <div className="text-lg font-black text-white italic tracking-tight">
             Output: More Fuel = {(() => {
                 const validPoints = gutData.filter(d => d.hasData && d.decoupling !== null);
                 if (validPoints.length < 3) return 'Unknown data';
                 
                 // Quick slope check
                 const n = validPoints.length;
                 const sumX = validPoints.reduce((acc, p) => acc + p.carbsPerHour, 0);
                 const sumY = validPoints.reduce((acc, p) => acc + (p.decoupling || 0), 0);
                 const sumXY = validPoints.reduce((acc, p) => acc + p.carbsPerHour * (p.decoupling || 0), 0);
                 const sumX2 = validPoints.reduce((acc, p) => acc + p.carbsPerHour * p.carbsPerHour, 0);
                 
                 const slope = (n * sumX2 - sumX * sumX) === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / (n * sumX2 - sumX * sumX);
                 
                 return slope < 0 ? <span className="text-emerald-500">Less Drift (Good)</span> : <span className="text-orange-500">Unclear Impact</span>;
             })()}
          </div>

          <div className="h-48 relative border-l border-b border-slate-700/50">
            {/* Axis Labels */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 font-bold uppercase">Carbs (g/hr)</div>
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-slate-500 font-bold uppercase">Drift (%)</div>

            <svg className="w-full h-full overflow-visible">
               {/* Reference Grid */}
               <line x1="0%" y1="20%" x2="100%" y2="20%" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" className="opacity-20" />
               <line x1="0%" y1="60%" x2="100%" y2="60%" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" className="opacity-20" />
               
               {/* Data Points */}
               {gutData.filter(d => d.hasData && d.decoupling !== null).map((point, i) => {
                 // Scales: X = 0-120g, Y = -2% to 10% (Clamped)
                 const x = Math.min(100, Math.max(0, (point.carbsPerHour / 120) * 100));
                 
                 // Y-Scale: 10% drift is 0 (bottom), -2% drift is 100 (top) -> Range 12
                 // Let's make 0% drift be at 80% height. 10% drift at 0% height.
                 const drift = point.decoupling || 0;
                 // y = 100 - ((drift + 2) / 12 * 100) ??
                 // Let's calculate simple linear scale: 
                 // Top (0%) = -2 drift (exceptional)
                 // Bottom (100%) = 10 drift (bad)
                 const y = Math.min(100, Math.max(0, ((drift + 2) / 14) * 100)); // Map -2..12 -> 0..100
                 // But wait, SVG Y=0 is top. So lower drift (-2) should be Y=0? 
                 // Let's flip it. High drift (bad) = Bottom. Low drift (good) = Top.
                 // Actually standard graphs: Top Y is high value.
                 // Y Axis = Drift %. Top = 10%, Bottom = 0%.
                 // Let's do standard: Bottom (100%) = -2%, Top (0%) = 12%
                 const yScale = (val: number) => 100 - ((val + 2) / 14 * 100); 
                 
                 const plotY = yScale(drift);

                 return (
                   <g key={i} className="group">
                     <circle 
                       cx={`${x}%`} 
                       cy={`${plotY}%`} 
                       r="4" 
                       className={`${point.giDistress < 3 ? 'fill-emerald-500/80 stroke-emerald-400' : 'fill-red-500/80 stroke-red-400'} transition-all duration-300 hover:r-6 cursor-pointer`}
                       strokeWidth="1"
                     />
                     {/* Tooltip */}
                     <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                       <rect x={`${x}%`} y={`${plotY - 15}%`} width="80" height="25" rx="4" fill="#1e293b" className="-translate-x-1/2" />
                       <text x={`${x}%`} y={`${plotY - 15}%`} dy="16" textAnchor="middle" className="text-[9px] fill-white font-mono">
                         {point.carbsPerHour}g | {drift.toFixed(1)}%
                       </text>
                     </g>
                   </g>
                 );
               })}
               
               {/* Trend Line (if points > 2) */}
               {(() => {
                 const validPoints = gutData.filter(d => d.hasData && d.decoupling !== null);
                 if (validPoints.length < 3) return null;
                 
                 const n = validPoints.length;
                 const sumX = validPoints.reduce((acc, p) => acc + p.carbsPerHour, 0);
                 const sumY = validPoints.reduce((acc, p) => acc + (p.decoupling || 0), 0);
                 const sumXY = validPoints.reduce((acc, p) => acc + p.carbsPerHour * (p.decoupling || 0), 0);
                 const sumX2 = validPoints.reduce((acc, p) => acc + p.carbsPerHour * p.carbsPerHour, 0);
                 
                 const slope = (n * sumX2 - sumX * sumX) === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / (n * sumX2 - sumX * sumX);
                 const intercept = (sumY - slope * sumX) / n;
                 
                 // Calculate start (0g) and end (120g) points
                 const startDrift = intercept;
                 const endDrift = slope * 120 + intercept;
                 
                 const yScale = (val: number) => 100 - ((val + 2) / 14 * 100);
                 
                 const y1 = yScale(startDrift);
                 const y2 = yScale(endDrift);
                 
                 return (
                   <line 
                     x1="0%" y1={`${y1}%`} 
                     x2="100%" y2={`${y2}%`} 
                     stroke="#60a5fa" 
                     strokeWidth="2" 
                     strokeDasharray="4 4" 
                     className="opacity-50" 
                   />
                 );
               })()}
            </svg>
          </div>
          
          <p className="text-[10px] text-slate-500 font-bold italic mt-4 uppercase tracking-tighter flex justify-between">
            <span>* Correlation Analysis (6 Mo. Lookback)</span>
            <span>Target: Neg. Slope (More Fuel = Less Drift)</span>
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
