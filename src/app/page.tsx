"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/modules/auth/authStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { useState } from 'react';

export default function Home() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    if (isInitialized && user) {
      router.push('/dashboard');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">APEX Performance</h1>
          <p className="text-zinc-400">Bio-Mechanical Reasoning Engine for High-Rev Athletes</p>
        </div>

        <div className="flex justify-center gap-8 mb-8">
          <button
            onClick={() => setShowSignUp(false)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              !showSignUp
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setShowSignUp(true)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              showSignUp
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="flex justify-center">
          {showSignUp ? <SignUpForm /> : <LoginForm />}
        </div>
      </div>
    </div>
  );
}
