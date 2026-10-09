"use client";

import * as React from "react";
import { CheckCircle2, Droplets, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  MissionAssignment,
  MonsoonPhase,
  ResilienceZone,
  SimulationResult,
} from "@/types";

interface RainBankPanelProps {
  zone: ResilienceZone;
  stage: MonsoonPhase;
  simulationResult: SimulationResult;
  zoneMissions: MissionAssignment[];
}

export function RainBankPanel({
  zone,
  simulationResult,
  zoneMissions,
}: RainBankPanelProps) {
  const verifiedCount = zoneMissions.filter(
    (m) => m.status === "VERIFIED"
  ).length;
  const submittedCount = zoneMissions.filter(
    (m) => m.status === "SUBMITTED" || m.status === "VERIFIED"
  ).length;

  return (
    <Card className="border-secondary/35">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">
          Task Result
        </CardTitle>
        <CardDescription>
          Completed tasks, verification status, and estimated water benefit in {zone.name}.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-muted/45 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tasks Completed</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="font-mono text-xl font-bold text-foreground">
            {submittedCount} / {zoneMissions.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/45 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Verification Status</span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="font-mono text-xl font-bold text-emerald-400">
            {verifiedCount > 0 ? `${verifiedCount} Verified` : "Pending Review"}
          </p>
        </div>

        <div className="rounded-xl border border-secondary/35 bg-secondary/[0.07] p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>Estimated Water Benefit</span>
            <Droplets className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="font-mono text-xl font-bold text-emerald-400">
            {Math.round(
              simulationResult.estimatedRechargePotentialLiters / 1000
            ).toLocaleString()}{" "}
            kL
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
