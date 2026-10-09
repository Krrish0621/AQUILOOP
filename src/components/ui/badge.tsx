import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border border-primary/30 bg-primary/12 text-primary",
        secondary:
          "border border-border bg-surface-muted text-muted-foreground",
        success:
          "border border-success/30 bg-success/12 text-success",
        warning:
          "border border-warning/35 bg-warning/12 text-warning",
        danger:
          "border border-danger/35 bg-danger/12 text-danger",
        info:
          "border border-info/30 bg-info/12 text-info",
        outline:
          "border border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
