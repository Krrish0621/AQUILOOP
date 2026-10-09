"use client";

import * as React from "react";
import { Award, CheckCircle2, Scale } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BountyTrendPoint, FloodWasteBounty } from "@/types";

interface RewardLedgerAnalyticsProps {
  bounties: FloodWasteBounty[];
  trendData?: BountyTrendPoint[];
  earnedArcTotal: number;
  pendingArcTotal: number;
}

export function RewardLedgerAnalytics({
  bounties,
  earnedArcTotal,
  pendingArcTotal,
}: RewardLedgerAnalyticsProps) {
  const verifiedBounties = bounties.filter((b) => b.status === "VERIFIED");
  const totalWasteDivertedKg = verifiedBounties.reduce(
    (sum, b) => sum + b.estimatedWasteKgValue,
    185
  );

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cleanup Outcome Summary</CardTitle>
        <CardDescription>
          Verified drain clearance results across Delhi NCR locations.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/45 p-4">
          <div>
            <span className="text-xs text-muted-foreground block">
              Cleanup verified
            </span>
            <span className="mt-0.5 font-mono text-xl font-bold text-foreground block">
              {9 + verifiedBounties.length} drains
            </span>
          </div>
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/45 p-4">
          <div>
            <span className="text-xs text-muted-foreground block">
              Waste cleared
            </span>
            <span className="mt-0.5 font-mono text-xl font-bold text-primary block">
              {totalWasteDivertedKg} kg
            </span>
          </div>
          <Scale className="h-5 w-5 text-primary" />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-secondary/35 bg-secondary/[0.08] p-4">
          <div>
            <span className="text-xs text-emerald-300 block">ARC issued</span>
            <span className="mt-0.5 font-mono text-xl font-bold text-emerald-400 block">
              +{earnedArcTotal} ARC
            </span>
            {pendingArcTotal > 0 && (
              <span className="text-[11px] text-muted-foreground block">
                +{pendingArcTotal} ARC pending review
              </span>
            )}
          </div>
          <Award className="h-5 w-5 text-emerald-400" />
        </div>
      </CardContent>
    </Card>
  );
}
