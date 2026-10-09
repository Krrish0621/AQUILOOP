"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Clock, CloudLightning, ShieldCheck } from "lucide-react";
import { MONSOONLOOP_TIMELINE_STEPS } from "@/lib/constants/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import type { MonsoonPhase } from "@/types";
import { cn } from "@/lib/utils";

interface MonsoonLoopTimelineProps {
  selectedStage: MonsoonPhase;
  onSelectStage: (stage: MonsoonPhase) => void;
  activeZoneCode: string;
  activeRiskScore: number;
  completedMissionsCount: number;
  drainsClearedCount: number;
  waterInterceptedLiters: number;
}

const COMPACT_PHASES: MonsoonPhase[] = [
  "PREPARE_24H",
  "ACTION_12H",
  "URGENT_6H",
  "EVENT_0H",
];

export function MonsoonLoopTimeline({
  selectedStage,
  onSelectStage,
  activeZoneCode,
  activeRiskScore,
  completedMissionsCount,
  drainsClearedCount,
  waterInterceptedLiters,
}: MonsoonLoopTimelineProps) {
  const [showAllStages, setShowAllStages] = React.useState(false);

  const selectedIndex = MONSOONLOOP_TIMELINE_STEPS.findIndex(
    (s) => s.phase === selectedStage
  );
  const currentStep =
    MONSOONLOOP_TIMELINE_STEPS[selectedIndex] ?? MONSOONLOOP_TIMELINE_STEPS[2];

  const isEventStage = selectedStage === "EVENT_0H";
  const isVerifyOrImpactStage =
    selectedStage === "VERIFY_6H" || selectedStage === "IMPACT_24H";

  const visibleSteps = React.useMemo(() => {
    if (showAllStages) return MONSOONLOOP_TIMELINE_STEPS;
    // Always include primary 4 stages + currently selected stage if outside the 4
    return MONSOONLOOP_TIMELINE_STEPS.filter(
      (s) => COMPACT_PHASES.includes(s.phase) || s.phase === selectedStage
    );
  }, [showAllStages, selectedStage]);

  return (
    <section
      aria-label="Rainfall Countdown Timeline"
      className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-panel space-y-3.5"
    >
      {/* Compact Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Storm Timeline
          </h2>
          <StatusBadge
            tone={
              isEventStage
                ? "danger"
                : isVerifyOrImpactStage
                ? "success"
                : selectedStage === "URGENT_6H" || selectedStage === "NOWCAST_3H"
                ? "warning"
                : "primary"
            }
            pulse={isEventStage || selectedStage === "ACTION_12H"}
            label={`${currentStep.horizon} → ${currentStep.label.toUpperCase()}`}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAllStages((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{showAllStages ? "Compact Timeline" : "All 8 Stages"}</span>
          {showAllStages ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Streamlined Stage Selector Pills */}
      <div
        className={cn(
          "grid gap-2",
          showAllStages
            ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
            : "grid-cols-2 sm:grid-cols-4"
        )}
        role="radiogroup"
        aria-label="Storm Timeline Stages"
      >
        {visibleSteps.map((step) => {
          const isSelected = step.phase === selectedStage;
          const isEvent = step.phase === "EVENT_0H";
          const isPost =
            step.phase === "VERIFY_6H" || step.phase === "IMPACT_24H";

          return (
            <button
              key={step.phase}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectStage(step.phase)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-all",
                isSelected
                  ? isEvent
                    ? "border-danger bg-danger/15 text-foreground shadow-sm"
                    : isPost
                    ? "border-success bg-success/15 text-foreground shadow-sm"
                    : "border-primary bg-primary/15 text-foreground shadow-sm"
                  : "border-border bg-surface-muted/50 text-muted-foreground hover:border-border-strong hover:text-foreground"
              )}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-primary">
                    {step.horizon}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {step.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {step.sublabel}
                </p>
              </div>

              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  isSelected
                    ? isEvent
                      ? "bg-danger animate-ping"
                      : isPost
                      ? "bg-success"
                      : "bg-primary"
                    : "bg-border-strong"
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Concise Stage Context Line */}
      {isEventStage ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-danger font-medium">
            <CloudLightning className="h-4 w-4" />
            <span>Active Rainfall Peak over {activeZoneCode} (32 mm/hr)</span>
          </div>
          <span className="font-mono text-danger font-semibold">
            Risk {activeRiskScore}/100
          </span>
        </div>
      ) : isVerifyOrImpactStage ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/10 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-success font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>
              Post-Rain Outcome: {completedMissionsCount} tasks verified · {drainsClearedCount} drains cleared · ~{Math.round(waterInterceptedLiters / 1000)} kL water intercepted
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Focus ({currentStep.horizon}):</strong>{" "}
          {currentStep.operationalFocus}
        </p>
      )}
    </section>
  );
}
