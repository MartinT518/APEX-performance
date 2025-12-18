"use client";

import { Activity } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';

export function TopNav() {
  const { user } = useAuthStore();
  
  // Get user initial for avatar
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'M';

  return (
    <nav className="p-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-900 md:hidden">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <Activity className="text-slate-950 w-5 h-5" />
        </div>
        <span className="font-bold tracking-tight text-lg">COACH</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
          {userInitial}
        </div>
      </div>
    </nav>
  );
}

