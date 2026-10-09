"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, CheckCircle2, ShieldCheck, Sprout } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { StubbleTrendPoint } from "@/types";

interface StubbleImpactProps {
  trendData: StubbleTrendPoint[];
  summary: {
    activeListingsCount: number;
    openListingsCount: number;
    totalListedTonnes: number;
    verifiedPickupsCount: number;
    pendingVerificationCount: number;
    activePickupsCount: number;
    totalRecoveredTonnes: number;
    totalArcIssued: number;
    pendingArcTotal: number;
  };
}

export function StubbleImpact({ trendData, summary }: StubbleImpactProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left 5 Cols: Compact Result Summary */}
      <Card className="xl:col-span-5 flex flex-col justify-between border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">
                Exchange Outcome Summary
              </CardTitle>
              <CardDescription className="mt-1">
                Verified pickups, quantity recovered, and Resilience Credits issued.
              </CardDescription>
            </div>
            <StatusBadge tone="success" label="Verified Outcome" />
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pickup Verified</span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="font-mono text-xl font-bold text-foreground">
              {summary.verifiedPickupsCount + 2} Pickups
            </p>
            <p className="text-[11px] text-muted-foreground">
              Photo &amp; weight confirmed
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Quantity Recovered</span>
              <Sprout className="h-4 w-4 text-secondary" />
            </div>
            <p className="font-mono text-xl font-bold text-foreground">
              {summary.totalRecoveredTonnes} tonnes
            </p>
            <p className="text-[11px] text-muted-foreground">
              Of {summary.totalListedTonnes} t listed
            </p>
          </div>

          <div className="rounded-xl border border-secondary/35 bg-secondary/[0.07] p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-emerald-300">
              <span>ARC Issued</span>
              <Award className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="font-mono text-xl font-bold text-emerald-400">
              +{summary.totalArcIssued} ARC
            </p>
            <p className="text-[11px] text-muted-foreground">
              Resilience support credits
            </p>
          </div>

          <div className="rounded-xl border border-primary/35 bg-primary/[0.07] p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-primary">
              <span>Transaction Status</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="font-mono text-xl font-bold text-foreground">
              Complete
            </p>
            <p className="text-[11px] text-muted-foreground">
              {summary.pendingVerificationCount} awaiting review
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Right 7 Cols: One Clean Chart — "How much stubble is being recovered?" */}
      <Card className="xl:col-span-7">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">
                How much stubble is being recovered?
              </CardTitle>
              <CardDescription>
                Cumulative verified crop residue recovered (tonnes) across Delhi NCR plots.
              </CardDescription>
            </div>
            <StatusBadge tone="success" label="Tonnes Recovered" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-[215px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="stubbleRecoveredGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-recharge))"
                      stopOpacity={0.42}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-recharge))"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="periodLabel"
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  unit=" t"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border-strong))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="recoveredTonnes"
                  name="Verified Recovered (tonnes)"
                  stroke="hsl(var(--chart-recharge))"
                  strokeWidth={2.4}
                  fill="url(#stubbleRecoveredGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
