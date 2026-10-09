import * as React from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  sublabel?: string;
  rows?: number;
  className?: string;
}

export function LoadingState({
  label = "Loading workspace data...",
  sublabel = "Preparing Delhi NCR field updates",
  rows = 3,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 space-y-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Activity className="h-4 w-4 animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {sublabel}
          </p>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-9 w-full animate-pulse rounded-md bg-surface-muted border border-border-subtle"
          />
        ))}
      </div>
    </div>
  );
}
