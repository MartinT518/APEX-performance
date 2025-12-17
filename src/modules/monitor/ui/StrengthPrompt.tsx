"use client";

import { useMonitorStore } from "../monitorStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function StrengthPrompt() {
  const { logStrengthSession, todayEntries } = useMonitorStore();

  const handleYes = () => {
    // For MVP, defaulting to 'strength' tier. In full version, open a dialog.
    logStrengthSession(true, 'strength');
  };

  const handleNo = () => {
    logStrengthSession(false);
  };

  if (todayEntries.strengthSession) {
    return (
      <Card className="w-full max-w-sm bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-center text-sm font-medium">
            Strength Check Complete: {todayEntries.strengthSession.performed ? "✅ Lifted" : "❌ No Lift"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Did you lift today?</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button 
          variant="outline" 
          className="flex-1 hover:bg-green-100 hover:text-green-700 hover:border-green-500"
          onClick={handleYes}
        >
          Yes
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 hover:bg-red-100 hover:text-red-700 hover:border-red-500"
          onClick={handleNo}
        >
          No
        </Button>
      </CardContent>
    </Card>
  );
}
