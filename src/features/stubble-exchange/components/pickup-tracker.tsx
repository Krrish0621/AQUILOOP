"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock, Truck } from "lucide-react";
import type { PickupStatus, StubbleListingStatus } from "@/types";
import { cn } from "@/lib/utils";

interface PickupTrackerProps {
  status: PickupStatus | StubbleListingStatus;
  compact?: boolean;
}

const PICKUP_STEPS: {
  key: PickupStatus;
  label: string;
  shortLabel: string;
}[] = [
  { key: "ACCEPTED", label: "Accepted", shortLabel: "Accepted" },
  { key: "SCHEDULED", label: "Scheduled", shortLabel: "Scheduled" },
  { key: "IN_TRANSIT", label: "In Transit", shortLabel: "In Transit" },
  { key: "PICKED_UP", label: "Picked Up", shortLabel: "Picked Up" },
  {
    key: "PENDING_VERIFICATION",
    label: "Pending Verification",
    shortLabel: "Verify",
  },
  { key: "VERIFIED", label: "Verified", shortLabel: "Verified" },
];

export function PickupTracker({ status, compact = false }: PickupTrackerProps) {
  if (status === "OPEN") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
        <span>Open on Marketplace — awaiting buyer acceptance</span>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          Verification Rejected — awaiting updated pickup proof to resubmit
        </span>
      </div>
    );
  }

  const activeIdx = PICKUP_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <Truck className="h-3.5 w-3.5 text-secondary" />
          Pickup Progress
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase text-emerald-400">
          {PICKUP_STEPS[activeIdx]?.label ?? status}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-1.5",
          compact ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-6"
        )}
      >
        {PICKUP_STEPS.map((step, index) => {
          const isCompleted = index < activeIdx || status === "VERIFIED";
          const isCurrent = index === activeIdx && status !== "VERIFIED";

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2 py-1.5 text-[10px] transition-colors",
                isCompleted
                  ? "border-success/40 bg-success/12 text-success font-semibold"
                  : isCurrent
                  ? "border-primary/50 bg-primary/15 text-primary font-semibold"
                  : "border-border bg-surface-muted/40 text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
              ) : (
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    isCurrent ? "bg-primary animate-pulse" : "bg-border-strong"
                  )}
                />
              )}
              <span className="truncate">
                {compact ? step.shortLabel : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
