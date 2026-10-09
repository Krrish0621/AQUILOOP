import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  label: string;
  value: number;
  max?: number;
  valueDisplay?: string;
  sublabel?: string;
  tone?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
  className?: string;
}

const toneBarClasses: Record<
  NonNullable<ProgressIndicatorProps["tone"]>,
  string
> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function ProgressIndicator({
  label,
  value,
  max = 100,
  valueDisplay,
  sublabel,
  tone = "primary",
  size = "md",
  className,
}: ProgressIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground/90 truncate">{label}</span>
        <span className="font-mono tabular-nums text-xs font-semibold text-foreground shrink-0">
          {valueDisplay ?? `${percentage}%`}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn(size === "sm" ? "h-1.5" : "h-2")}
        indicatorClassName={toneBarClasses[tone]}
        aria-label={label}
      />
      {sublabel && (
        <p className="text-[11px] text-muted-foreground leading-tight">
          {sublabel}
        </p>
      )}
    </div>
  );
}
