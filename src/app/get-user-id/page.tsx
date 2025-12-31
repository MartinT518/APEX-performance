"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GetUserIdPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserId() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          setError(userError.message);
        } else if (!user) {
          setError('Not authenticated. Please log in first.');
        } else {
          setUserId(user.id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUserId();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
          <p className="text-slate-300 mb-4">{error}</p>
          <p className="text-slate-400 text-sm">
            Please make sure you're logged in to the application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-amber-400 mb-6">Your User ID</h1>
        
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-4">
          <code className="text-green-400 text-lg break-all">{userId}</code>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-slate-300 mb-2">To use with the import script:</p>
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
              <code className="text-slate-300 text-sm">
                npx tsx scripts/import-historical-data.ts --user-id={userId}
              </code>
            </div>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(userId || '');
              alert('User ID copied to clipboard!');
            }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Copy User ID
          </button>

          <button
            onClick={() => {
              const command = `npx tsx scripts/import-historical-data.ts --user-id=${userId}`;
              navigator.clipboard.writeText(command);
              alert('Import command copied to clipboard!');
            }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Copy Full Import Command
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700">
          <p className="text-slate-400 text-sm">
            💡 Tip: You can bookmark this page for easy access later.
          </p>
        </div>
      </div>
    </div>
  );
}
