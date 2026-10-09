import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  badge,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        {eyebrow && (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="max-w-2xl text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
