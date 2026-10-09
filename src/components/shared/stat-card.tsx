"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  sublabel: string;
  delta?: {
    value: string;
    direction: "UP" | "DOWN" | "STABLE";
    tone?: "positive" | "warning" | "neutral";
  };
  accentTone?: "primary" | "secondary" | "warning" | "danger" | "success" | "info";
  icon?: React.ReactNode;
  footerMeta?: string;
  className?: string;
}

const accentBorderClasses: Record<
  NonNullable<StatCardProps["accentTone"]>,
  string
> = {
  primary: "before:bg-primary",
  secondary: "before:bg-secondary",
  warning: "before:bg-warning",
  danger: "before:bg-danger",
  success: "before:bg-success",
  info: "before:bg-info",
};

const iconContainerClasses: Record<
  NonNullable<StatCardProps["accentTone"]>,
  string
> = {
  primary: "bg-primary/12 text-primary border-primary/25",
  secondary: "bg-secondary/12 text-secondary border-secondary/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  success: "bg-success/12 text-success border-success/25",
  info: "bg-info/12 text-info border-info/25",
};

export function StatCard({
  label,
  value,
  unit,
  sublabel,
  delta,
  accentTone = "primary",
  icon,
  footerMeta,
  className,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-panel transition-colors hover:border-border-strong",
        "before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:content-['']",
        accentBorderClasses[accentTone],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
              iconContainerClasses[accentTone]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-[26px]">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
        {delta && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums",
              delta.tone === "warning"
                ? "bg-warning/15 text-warning"
                : delta.tone === "neutral"
                ? "bg-surface-muted text-muted-foreground"
                : "bg-success/15 text-success"
            )}
          >
            {delta.direction === "UP" && <ArrowUpRight className="h-3 w-3" />}
            {delta.direction === "DOWN" && <ArrowDownRight className="h-3 w-3" />}
            {delta.direction === "STABLE" && <Minus className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
      </div>

      {footerMeta && (
        <div className="mt-3 border-t border-border-subtle pt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono">{footerMeta}</span>
        </div>
      )}
    </motion.div>
  );
}
