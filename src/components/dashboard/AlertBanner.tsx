"use client";

import { AlertTriangle } from 'lucide-react';

interface AlertBannerProps {
  type: 'warning' | 'error';
  title: string;
  message: string;
}

export function AlertBanner({ type, title, message }: AlertBannerProps) {
  const colors = type === 'warning' 
    ? { bg: 'bg-yellow-900/20', border: 'border-yellow-900', text: 'text-yellow-400' }
    : { bg: 'bg-orange-900/20', border: 'border-orange-900', text: 'text-orange-400' };

  return (
    <div className={`mb-8 p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 ${colors.text} mt-0.5`} />
        <div className="flex-1">
          <h3 className={`font-bold ${colors.text} mb-1`}>{title}</h3>
          <p className="text-sm text-zinc-300">{message}</p>
        </div>
      </div>
    </div>
  );
}

