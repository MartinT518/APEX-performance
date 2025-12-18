"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Shield, AlertCircle } from "lucide-react";

interface SessionMetadata {
  dataSource?: 'GARMIN' | 'SIMULATION' | 'NONE';
  diagnostics?: {
    status: 'VALID' | 'SUSPECT' | 'DISCARD';
    validPointCount: number;
    originalPointCount: number;
  };
  cadenceLockDetected?: boolean;
  substituted?: boolean;
  structuralLoad?: number;
}

interface SessionStatusBadgesProps {
  sportType: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
  metadata: Record<string, unknown> | null;
  expectedSportType?: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
}

export function SessionStatusBadges({ sportType, metadata, expectedSportType }: SessionStatusBadgesProps) {
  const sessionMeta = metadata as SessionMetadata | null;
  
  // Determine execution status
  const getExecutionStatus = (): 'EXEC' | 'SUB' | 'FAIL' => {
    if (sessionMeta?.substituted) return 'SUB';
    if (expectedSportType && sportType !== expectedSportType && sportType !== 'STRENGTH') return 'SUB';
    if (sessionMeta?.dataSource === 'GARMIN' || sessionMeta?.dataSource === 'SIMULATION') {
      return 'EXEC';
    }
    return 'FAIL';
  };

  // Determine integrity status
  const getIntegrityStatus = (): 'VALID' | 'SUSPECT' => {
    if (sessionMeta?.diagnostics?.status === 'SUSPECT' || sessionMeta?.diagnostics?.status === 'DISCARD') {
      return 'SUSPECT';
    }
    if (sessionMeta?.cadenceLockDetected) {
      return 'SUSPECT';
    }
    return 'VALID';
  };

  const executionStatus = getExecutionStatus();
  const integrityStatus = getIntegrityStatus();

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Execution Status */}
      {executionStatus === 'EXEC' && (
        <Badge className="bg-green-600 text-white flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          EXEC
        </Badge>
      )}
      {executionStatus === 'SUB' && (
        <Badge className="bg-yellow-600 text-white flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          SUB
        </Badge>
      )}
      {executionStatus === 'FAIL' && (
        <Badge className="bg-red-600 text-white flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          FAIL
        </Badge>
      )}

      {/* Integrity Flag */}
      {integrityStatus === 'VALID' && (
        <Badge className="bg-blue-600 text-white flex items-center gap-1">
          <Shield className="h-3 w-3" />
          VALID
        </Badge>
      )}
      {integrityStatus === 'SUSPECT' && (
        <Badge className="bg-orange-600 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          SUSPECT
        </Badge>
      )}

      {/* Chassis Impact */}
      {sessionMeta?.structuralLoad !== undefined && (
        <Badge className="bg-zinc-700 text-white">
          Load: {Math.round(sessionMeta.structuralLoad)}
        </Badge>
      )}
    </div>
  );
}

