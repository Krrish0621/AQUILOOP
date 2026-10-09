"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getShortZoneLocality } from "@/features/monsoonloop/components/zone-selector";
import type {
  MonsoonRiskAssessment,
  MonsoonRiskLevel,
  ResilienceZone,
  ZoneWeatherSummary,
} from "@/types";
import { cn } from "@/lib/utils";

interface RiskPanelProps {
  zone: ResilienceZone;
  assessment: MonsoonRiskAssessment;
  weatherSummary?: ZoneWeatherSummary | null;
}

const riskLevelColorMap: Record<
  MonsoonRiskLevel,
  {
    badgeTone: "danger" | "warning" | "info" | "success";
    scoreText: string;
    barColor: string;
    pillBorder: string;
  }
> = {
  CRITICAL: {
    badgeTone: "danger",
    scoreText: "text-danger",
    barColor: "bg-danger",
    pillBorder: "border-danger/40 bg-danger/10",
  },
  HIGH: {
    badgeTone: "warning",
    scoreText: "text-warning",
    barColor: "bg-warning",
    pillBorder: "border-warning/40 bg-warning/10",
  },
  MODERATE: {
    badgeTone: "info",
    scoreText: "text-info",
    barColor: "bg-info",
    pillBorder: "border-info/40 bg-info/10",
  },
  LOW: {
    badgeTone: "success",
    scoreText: "text-success",
    barColor: "bg-success",
    pillBorder: "border-success/40 bg-success/10",
  },
};

export function RiskPanel({ zone, assessment }: RiskPanelProps) {
  const levelStyle = riskLevelColorMap[assessment.riskLevel];
  const locality = getShortZoneLocality(zone.name);

  return (
    <Card className="flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <CardTitle className="text-base sm:text-lg">
                Why is this zone at risk?
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              {locality} · {assessment.headline}
            </CardDescription>
          </div>

          <StatusBadge
            tone={levelStyle.badgeTone}
            pulse={
              assessment.riskLevel === "CRITICAL" ||
              assessment.riskLevel === "HIGH"
            }
            label={`${assessment.riskLevel} · ${assessment.riskScore}/100`}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Visual Risk Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted border border-border">
          <div
            className={cn(
              "h-full transition-all duration-300",
              levelStyle.barColor
            )}
            style={{ width: `${Math.min(100, assessment.riskScore)}%` }}
          />
        </div>

        {/* Concise 3-Row Explanation: Forecast Rainfall, Configured Drainage Capacity, Inspection Status */}
        <div className="space-y-2.5">
          {assessment.contributingFactors.map((factor) => {
            const factorStyle = riskLevelColorMap[factor.severity];
            return (
              <div
                key={factor.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/45 px-3.5 py-2.5"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {factor.label}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {factor.valueLabel}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0",
                    factorStyle.pillBorder,
                    factorStyle.scoreText
                  )}
                >
                  {factor.severity}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
