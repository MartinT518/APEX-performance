"use client";

import { IAgentVote } from '@/types/agents';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { useState } from 'react';
import { VoteCard } from './VoteCard';

interface DecisionLogProps {
  votes: IAgentVote[];
  reasoning?: string;
}

export function DecisionLog({ votes, reasoning }: DecisionLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!votes || votes.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <Info className="h-4 w-4 mr-2" />
          Why this plan?
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Agent Decision Log
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {reasoning && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-300">Coach Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">{reasoning}</p>
              </CardContent>
            </Card>
          )}

          {votes.map((vote) => (
            <VoteCard key={vote.agentId} vote={vote} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

