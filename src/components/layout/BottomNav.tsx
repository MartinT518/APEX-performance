"use client";

import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  History, 
  FlaskConical, 
  Settings 
} from 'lucide-react';

const tabs = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Mission', path: '/dashboard' },
  { id: 'plan', icon: Calendar, label: 'Plan', path: '/plan' },
  { id: 'history', icon: History, label: 'Log', path: '/history' },
  { id: 'lab', icon: FlaskConical, label: 'Lab', path: '/lab' },
  { id: 'settings', icon: Settings, label: 'Config', path: '/settings' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-900 max-w-md mx-auto z-50 md:hidden">
      <div className="flex justify-around p-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button 
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                active ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

