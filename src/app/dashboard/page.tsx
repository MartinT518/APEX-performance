"use client";

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ChassisGauge } from '@/components/dashboard/ChassisGauge';
import { TonnageChart } from '@/components/dashboard/TonnageChart';
import { CertaintyScore } from '@/components/dashboard/CertaintyScore';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { AnalysisResultCard } from '@/components/dashboard/AnalysisResultCard';
import { AgentStatusGrid } from '@/components/dashboard/AgentStatusGrid';
import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { useAnalyzeStore } from '@/modules/analyze/analyzeStore';
import { DailyCheckIn } from '@/components/inputs/DailyCheckIn';
import { FuelingLog } from '@/components/inputs/FuelingLog';
import { checkAuditNecessity } from '@/modules/monitor/logic/auditManager';
import { IAnalysisResult } from '@/types/analysis';
import { runCoachAnalysis } from '../actions';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { logger } from '@/lib/logger';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

function DashboardContent() {
  const { todayEntries, loadTodayMonitoring } = useMonitorStore();
  const { baselines, loadBaselines } = useAnalyzeStore();
  const [isClient, setIsClient] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<IAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cadenceLockDetected, setCadenceLockDetected] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setIsClient(true);
    loadTodayMonitoring();
    loadBaselines();
  }, [loadTodayMonitoring, loadBaselines]);

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setAnalysisResult(null); // Clear previous results
    try {
      const result = await runCoachAnalysis();
      if (result.success) {
        setAnalysisResult(result);
        toast.success('Analysis Complete', 'Coach analysis completed successfully');
      } else {
        toast.error('Analysis Failed', result.message || 'Please complete daily logs and try again');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
      logger.error('Unexpected error during analysis', e);
      toast.error('Analysis Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isClient) return null;

  const auditCheck = checkAuditNecessity(0);
  const hasFuelingBlindspot = auditCheck.requiresAudit && auditCheck.auditType === 'FUELING';

  const mockChartData = [
    { day: 'Mon', runVolume: 5, strengthLoad: 4000 },
    { day: 'Tue', runVolume: 10, strengthLoad: 0 },
    { day: 'Wed', runVolume: 8, strengthLoad: 3500 },
    { day: 'Thu', runVolume: 0, strengthLoad: 5000 },
    { day: 'Fri', runVolume: 15, strengthLoad: 0 },
    { day: 'Sat', runVolume: 20, strengthLoad: 0 },
    { day: 'Sun', runVolume: 10, strengthLoad: 0 },
  ];

  const nigglePenalty = (todayEntries.niggleScore || 0) * 10;
  const healthScore = Math.max(0, 100 - nigglePenalty);

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <DashboardHeader onRunAnalysis={handleRunAnalysis} isLoading={isLoading} />

      {hasFuelingBlindspot && (
        <AlertBanner
          type="warning"
          title="Fueling Blindspot Warning"
          message={auditCheck.message || 'Long run detected (>90min) but fueling data not logged. Please complete fueling audit.'}
        />
      )}

      {cadenceLockDetected && (
        <AlertBanner
          type="error"
          title="HR Data Invalidated (Cadence Lock)"
          message="Heart rate data matches cadence for extended period. Analyzing via Pace/Power instead."
        />
      )}

      {analysisResult && <AnalysisResultCard result={analysisResult} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <section>
          <ChassisGauge 
            score={healthScore} 
            tonnage={baselines.tonnage7Day || 0}
            cadenceStability={95} 
          />
        </section>

        <section>
          <CertaintyScore 
            currentScore={analysisResult?.simulation?.successProbability}
            explanation={analysisResult?.simulation?.confidenceScore ? `Confidence: ${analysisResult.simulation.confidenceScore}` : undefined}
          />
        </section>

        <section className="col-span-1 md:col-span-2">
          <TonnageChart 
            data={mockChartData} 
            maintenanceLine={3000} 
          />
        </section>

        <section className="col-span-1 md:col-span-1 border-r border-zinc-800 pr-0 md:pr-6">
          <h2 className="text-xl font-bold mb-4 text-zinc-300">Daily Inputs</h2>
          <DailyCheckIn />
          <FuelingLog />
        </section>

        <AgentStatusGrid />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <DashboardContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}
