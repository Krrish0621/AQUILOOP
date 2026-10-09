import * as React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * AQUILOOP Brand Identity Mark
 * Represents continuous hydrological circulation: Rain -> Action -> Recharge.
 */
export function BrandLogo({ collapsed = false, className }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-surface-elevated shadow-glow">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="h-5 w-5 text-primary"
          aria-hidden="true"
        >
          {/* Outer continuous resilience loop */}
          <path
            d="M16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28C22.6274 28 28 22.6274 28 16"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Secondary aquifer recharge arc */}
          <path
            d="M28 16C28 11.2 25.1 7.05 20.9 5.1"
            stroke="hsl(var(--secondary))"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
          {/* Central hydrological droplet / node */}
          <path
            d="M16 9.5C16 9.5 11.5 14.6 11.5 17.8C11.5 20.2853 13.5147 22.3 16 22.3C18.4853 22.3 20.5 20.2853 20.5 17.8C20.5 14.6 16 9.5 16 9.5Z"
            fill="hsl(var(--primary) / 0.22)"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="18" r="1.6" fill="hsl(var(--secondary))" />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold tracking-[0.14em] text-foreground">
              AQUILOOP
            </span>
            <span className="rounded border border-primary/30 bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-semibold text-primary">
              OS
            </span>
          </div>
          <span className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground">
            PREDICT · ACT · VERIFY
          </span>
        </div>
      )}
    </div>
  );
}
