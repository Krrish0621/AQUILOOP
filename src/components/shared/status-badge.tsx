import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OperationalTone =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  tone?: OperationalTone;
  pulse?: boolean;
  code?: string;
  label: string;
}

const toneToVariant: Record<OperationalTone, BadgeProps["variant"]> = {
  primary: "default",
  secondary: "secondary",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "outline",
};

const toneDotColor: Record<OperationalTone, string> = {
  primary: "bg-primary",
  secondary: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function StatusBadge({
  tone = "primary",
  pulse = false,
  code,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant={toneToVariant[tone]}
      className={cn("font-mono text-[10px] uppercase tracking-wider", className)}
      {...props}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              toneDotColor[tone]
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            toneDotColor[tone]
          )}
        />
      </span>
      {code && <span className="opacity-70">{code} ·</span>}
      <span>{label}</span>
    </Badge>
  );
}
