"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChartBar, Calendar, Settings, Activity, History } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuthStore } from '@/modules/auth/authStore';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const routes = [
    {
      label: 'Dashboard',
      icon: ChartBar,
      href: '/dashboard',
      color: 'text-sky-500',
    },
    {
      label: 'Training Plan',
      icon: Calendar,
      href: '/plan',
      color: 'text-violet-500',
    },
    {
      label: 'History',
      icon: History,
      href: '/history',
      color: 'text-amber-500',
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/settings',
      color: 'text-zinc-400',
    },
  ];

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-zinc-900 border-r border-zinc-800 text-white w-64 fixed left-0 top-0 bottom-0 z-50">
      <div className="px-3 py-2 flex-1">
        <Link href="/dashboard" className="flex items-center pl-3 mb-14">
          <Activity className="h-8 w-8 mr-4 text-green-500" />
          <h1 className="text-2xl font-bold">
            APEX
          </h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      {user && <UserMenu />}
      <div className="px-3 py-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            v1.0.0 Alpha
          </p>
      </div>
    </div>
  );
}
