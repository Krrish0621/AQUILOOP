import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Unable to Load Data",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-danger/35 bg-danger/5 p-5",
        className
      )}
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-danger/30 bg-danger/15 text-danger">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            className="shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
