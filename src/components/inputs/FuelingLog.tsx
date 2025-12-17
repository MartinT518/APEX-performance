"use client";

import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '@/components/ui/toast';

export function FuelingLog() {
  const { todayEntries, logFueling } = useMonitorStore();
  const [isClient, setIsClient] = useState(false);
  const toast = useToast();
  
  // Local state for the form before submission (or direct binding)
  // Direct binding is fine for this prototype
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  const currentFueling = todayEntries.fuelingLog || { carbsPerHour: 0, giDistress: 0 };

  const handleGiChange = async (val: number) => {
    try {
      await logFueling(currentFueling.carbsPerHour, val);
      toast.success('Saved', 'GI distress saved successfully');
    } catch (err) {
      toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save GI distress');
    }
  };

  const handleCarbsChange = async (val: number) => {
    try {
      await logFueling(val, currentFueling.giDistress);
      toast.success('Saved', 'Carbs per hour saved successfully');
    } catch (err) {
      toast.error('Save Failed', err instanceof Error ? err.message : 'Failed to save carbs per hour');
    }
  };

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <Card className="border-t-4 border-t-orange-500 bg-zinc-950 text-white mt-6">
      <CardHeader>
        <CardTitle>Fueling Audit</CardTitle>
        <CardDescription>
          Required for sessions {'>'} 90min.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Carbs Per Hour */}
        <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Intake Efficiency
            </label>
            <div className="flex items-center space-x-4">
                <input 
                    type="number" 
                    className="flex h-12 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-xl font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                    value={currentFueling.carbsPerHour || ''}
                    onChange={(e) => handleCarbsChange(parseInt(e.target.value) || 0)}
                />
                <span className="text-zinc-500 font-bold">g/hr</span>
            </div>
            <p className="text-xs text-zinc-600">Target: 60-90g/hr for high output.</p>
        </div>

        {/* GI Distress Selector */}
        <div className="space-y-2">
             <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                    GI Distress
                </label>
                <span className={`text-xl font-bold font-mono ${currentFueling.giDistress > 5 ? 'text-red-500' : 'text-green-500'}`}>
                    {currentFueling.giDistress}/10
                </span>
            </div>
            <div className="grid grid-cols-11 gap-1">
                {[0,1,2,3,4,5,6,7,8,9,10].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleGiChange(num)}
                        className={`
                            h-10 rounded-md font-bold text-sm transition-all
                            ${currentFueling.giDistress === num 
                                ? 'bg-orange-600 text-white scale-110 shadow-lg shadow-orange-900/50' 
                                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
                            }
                        `}
                    >
                        {num}
                    </button>
                ))}
            </div>
             <p className="text-xs text-zinc-600">0 = Iron Stomach, 10 = DNF/Vomiting.</p>
        </div>

      </CardContent>
    </Card>
    </>
  );
}
