"use client";

import { useState } from 'react';
import { useAuthStore } from '@/modules/auth/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SignUpForm() {
  const { signUp, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return;
    }

    if (password.length < 6) {
      return;
    }

    await signUp(email, password);
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 text-white max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <CardDescription className="text-zinc-400">
          Start tracking your training data and phenotype configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-900/20 border border-red-800 text-red-400 text-sm">
              {error}
            </div>
          )}

          {password && password !== confirmPassword && (
            <div className="p-3 rounded-md bg-yellow-900/20 border border-yellow-800 text-yellow-400 text-sm">
              Passwords do not match
            </div>
          )}

          {password && password.length < 6 && (
            <div className="p-3 rounded-md bg-yellow-900/20 border border-yellow-800 text-yellow-400 text-sm">
              Password must be at least 6 characters
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
            disabled={isLoading || password !== confirmPassword || password.length < 6}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

