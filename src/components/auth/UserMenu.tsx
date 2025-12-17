"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/modules/auth/authStore';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export function UserMenu() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    router.push('/');
    setIsSigningOut(false);
  };

  if (!user) return null;

  const userEmail = user.email || 'User';
  const displayEmail = userEmail.length > 20 ? `${userEmail.substring(0, 20)}...` : userEmail;

  return (
    <div className="px-3 py-2 border-t border-zinc-800 space-y-2">
      <div className="px-3 py-2 flex items-center space-x-2 text-sm">
        <User className="h-4 w-4 text-zinc-400" />
        <span className="text-zinc-400 truncate">{displayEmail}</span>
      </div>
      <Button
        onClick={handleSignOut}
        disabled={isSigningOut}
        variant="ghost"
        className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/10"
        size="sm"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {isSigningOut ? 'Signing out...' : 'Sign Out'}
      </Button>
    </div>
  );
}

