import * as React from "react";
import type { RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

interface RiskIndicatorProps {
  level: RiskLevel;
  score?: number;
  showSegments?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const RISK_META: Record<
  RiskLevel,
  {
    label: string;
    activeBars: number;
    textClass: string;
    barClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  LOW: {
    label: "Low Risk",
    activeBars: 1,
    textClass: "text-success",
    barClass: "bg-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/30",
  },
  MODERATE: {
    label: "Moderate Risk",
    activeBars: 2,
    textClass: "text-info",
    barClass: "bg-info",
    bgClass: "bg-info/10",
    borderClass: "border-info/30",
  },
  ELEVATED: {
    label: "Elevated Risk",
    activeBars: 3,
    textClass: "text-warning",
    barClass: "bg-warning",
    bgClass: "bg-warning/12",
    borderClass: "border-warning/35",
  },
  HIGH: {
    label: "High Vulnerability",
    activeBars: 4,
    textClass: "text-warning",
    barClass: "bg-warning",
    bgClass: "bg-warning/15",
    borderClass: "border-warning/45",
  },
  URGENT: {
    label: "Urgent Action Risk",
    activeBars: 5,
    textClass: "text-danger",
    barClass: "bg-danger",
    bgClass: "bg-danger/15",
    borderClass: "border-danger/40",
  },
};

export function RiskIndicator({
  level,
  score,
  showSegments = true,
  size = "md",
  className,
}: RiskIndicatorProps) {
  const meta = RISK_META[level];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded border px-2 py-0.5",
        meta.bgClass,
        meta.borderClass,
        size === "sm" ? "text-[10px]" : "text-xs",
        className
      )}
      role="status"
      aria-label={`Risk level: ${meta.label}${
        score !== undefined ? `, score ${score} out of 100` : ""
      }`}
    >
      {showSegments && (
        <div className="flex items-end gap-0.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((bar) => (
            <span
              key={bar}
              className={cn(
                "w-1 rounded-[1px] transition-colors",
                bar === 1 && "h-1.5",
                bar === 2 && "h-2",
                bar === 3 && "h-2.5",
                bar === 4 && "h-3",
                bar === 5 && "h-3.5",
                bar <= meta.activeBars
                  ? meta.barClass
                  : "bg-surface-interactive"
              )}
            />
          ))}
        </div>
      )}
      <span className={cn("font-mono font-semibold uppercase tracking-wider", meta.textClass)}>
        {meta.label}
      </span>
      {score !== undefined && (
        <span className="font-mono text-[11px] tabular-nums text-foreground/85 border-l border-border pl-1.5">
          {score}/100
        </span>
      )}
    </div>
  );
}
