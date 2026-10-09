"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ResilienceZone,
  SimulationInputs,
  SimulationResult,
} from "@/types";
import { cn } from "@/lib/utils";

interface WhatIfSimulatorProps {
  zone: ResilienceZone;
  inputs: SimulationInputs;
  result: SimulationResult;
  onChangeInputs: (next: SimulationInputs) => void;
  onResetInputs: () => void;
}

export function WhatIfSimulator({
  zone,
  inputs,
  result,
  onChangeInputs,
  onResetInputs,
}: WhatIfSimulatorProps) {
  const updateField = <K extends keyof SimulationInputs>(
    key: K,
    value: SimulationInputs[K]
  ) => {
    onChangeInputs({
      ...inputs,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          Adjust rainfall or drain clearance
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetInputs}
          className="h-7 px-2 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </Button>
      </div>

      {/* 3 Simple Controls: Rainfall, Drain blockage, Cleared drains */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-muted/45 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="sim-rain" className="font-medium text-foreground">
              Rainfall
            </label>
            <span className="font-mono font-bold text-primary">
              {inputs.rainfallIntensityMmHr} mm/hr
            </span>
          </div>
          <input
            id="sim-rain"
            type="range"
            min={8}
            max={55}
            step={1}
            value={inputs.rainfallIntensityMmHr}
            onChange={(e) =>
              updateField("rainfallIntensityMmHr", Number(e.target.value))
            }
            className="w-full accent-[hsl(var(--primary))] cursor-pointer"
          />
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/45 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="sim-blockage"
              className="font-medium text-foreground"
            >
              Drain Blockage
            </label>
            <span className="font-mono font-bold text-warning">
              {inputs.drainBlockagePercent}%
            </span>
          </div>
          <input
            id="sim-blockage"
            type="range"
            min={10}
            max={90}
            step={5}
            value={inputs.drainBlockagePercent}
            onChange={(e) =>
              updateField("drainBlockagePercent", Number(e.target.value))
            }
            className="w-full accent-[hsl(var(--warning))] cursor-pointer"
          />
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/45 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="sim-cleared-drains"
              className="font-medium text-foreground"
            >
              Cleared Drains
            </label>
            <span className="font-mono font-bold text-emerald-400">
              {inputs.clearedDrainsCount} / {zone.totalDrainsCount}
            </span>
          </div>
          <input
            id="sim-cleared-drains"
            type="range"
            min={0}
            max={zone.totalDrainsCount}
            step={1}
            value={inputs.clearedDrainsCount}
            onChange={(e) =>
              updateField("clearedDrainsCount", Number(e.target.value))
            }
            className="w-full accent-[hsl(var(--secondary))] cursor-pointer"
          />
        </div>
      </div>

      {/* 3 Simple Scenario Outputs: Risk, Estimated runoff, Estimated water benefit */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/70 p-3">
          <span className="text-xs text-muted-foreground block">Risk</span>
          <span
            className={cn(
              "mt-0.5 font-mono text-base font-bold block",
              result.riskLevel === "CRITICAL"
                ? "text-danger"
                : result.riskLevel === "HIGH"
                ? "text-warning"
                : "text-emerald-400"
            )}
          >
            {result.riskScore}/100 ({result.riskLevel})
          </span>
        </div>

        <div className="rounded-xl border border-border bg-background/70 p-3">
          <span className="text-xs text-muted-foreground block">
            Estimated Runoff
          </span>
          <span className="mt-0.5 font-mono text-base font-bold text-foreground block">
            {Math.round(result.estimatedRunoffLiters / 1000).toLocaleString()} kL
          </span>
        </div>

        <div className="rounded-xl border border-border bg-background/70 p-3">
          <span className="text-xs text-muted-foreground block">
            Estimated Water Benefit
          </span>
          <span className="mt-0.5 font-mono text-base font-bold text-emerald-400 block">
            {Math.round(
              result.estimatedRechargePotentialLiters / 1000
            ).toLocaleString()}{" "}
            kL
          </span>
        </div>
      </div>
    </div>
  );
}
