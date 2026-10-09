"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
  Play,
  Truck,
  UserCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PickupTracker } from "@/features/stubble-exchange/components/pickup-tracker";
import { PickupEvidence } from "@/features/stubble-exchange/components/pickup-evidence";
import type { PickupRecord, PickupStatus, StubbleEvidence } from "@/types";

interface PickupWorkflowProps {
  pickup: PickupRecord;
  onUpdateStage: (
    pickupId: string,
    nextStatus: PickupStatus,
    scheduledWindowOverride?: string
  ) => void;
  onSubmitEvidence: (pickupId: string, evidence: StubbleEvidence) => void;
}

export function PickupWorkflow({
  pickup,
  onUpdateStage,
  onSubmitEvidence,
}: PickupWorkflowProps) {
  const [scheduleInput, setScheduleInput] = React.useState(
    pickup.scheduledWindow || "Oct 08 · 09:30 IST"
  );

  React.useEffect(() => {
    setScheduleInput(pickup.scheduledWindow || "Oct 08 · 09:30 IST");
  }, [pickup.id, pickup.scheduledWindow]);

  return (
    <Card className="border-primary/35">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">
                {pickup.missionCode}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                · Listing {pickup.listingCode}
              </span>
            </div>
            <CardTitle className="text-base sm:text-lg">
              Pickup Workflow — {pickup.pickupLocation}
            </CardTitle>
            <CardDescription>
              Step-by-step pickup progression and proof submission.
            </CardDescription>
          </div>

          <StatusBadge
            tone={
              pickup.status === "VERIFIED"
                ? "success"
                : pickup.status === "REJECTED"
                ? "danger"
                : pickup.status === "PENDING_VERIFICATION"
                ? "warning"
                : "primary"
            }
            label={
              pickup.status === "PENDING_VERIFICATION"
                ? "Pending Operator Review"
                : pickup.status.replace("_", " ")
            }
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <PickupTracker status={pickup.status} />

        {pickup.status === "REJECTED" && pickup.rejectionNote && (
          <div className="flex items-start gap-2.5 rounded-md border border-danger/45 bg-danger/10 p-3 text-xs text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Verification Rejected ({pickup.rejectionReason?.replace("_", " ")})
              </p>
              <p className="mt-0.5 text-danger/90">{pickup.rejectionNote}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface-muted/45 p-3.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Buyer / Field Team
            </span>
            <p className="mt-0.5 font-semibold text-foreground flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              {pickup.buyerName}
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Farmer / Plot
            </span>
            <p className="mt-0.5 font-semibold text-foreground truncate">
              {pickup.farmerName}
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Pickup Location
            </span>
            <p className="mt-0.5 font-semibold text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-warning" />
              {pickup.pickupLocation}
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Quantity &amp; Schedule
            </span>
            <p className="mt-0.5 font-mono font-bold text-emerald-400">
              {pickup.quantityTonnes} tonnes · {pickup.scheduledWindow}
            </p>
          </div>
        </div>

        {/* Single Current Stage Action */}
        {pickup.status === "ACCEPTED" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/70 p-3.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <input
                type="text"
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                className="h-8 rounded border border-border bg-surface px-2.5 text-xs text-foreground"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() =>
                onUpdateStage(pickup.id, "SCHEDULED", scheduleInput)
              }
            >
              Schedule Pickup
            </Button>
          </div>
        )}

        {pickup.status === "SCHEDULED" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/70 p-3.5">
            <span className="text-xs text-muted-foreground">
              Pickup scheduled for {pickup.scheduledWindow}
            </span>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => onUpdateStage(pickup.id, "IN_TRANSIT")}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Start Pickup</span>
            </Button>
          </div>
        )}

        {pickup.status === "IN_TRANSIT" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/70 p-3.5">
            <span className="text-xs text-muted-foreground">
              Vehicle in transit to {pickup.pickupLocation}
            </span>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => onUpdateStage(pickup.id, "PICKED_UP")}
              className="gap-1.5"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Mark Picked Up</span>
            </Button>
          </div>
        )}

        {pickup.status === "VERIFIED" && (
          <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/10 p-3.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" />
              Transaction Verified &amp; ARC Issued
            </span>
          </div>
        )}

        {(pickup.status === "PICKED_UP" ||
          pickup.status === "PENDING_VERIFICATION" ||
          pickup.status === "REJECTED") && (
          <PickupEvidence
            pickup={pickup}
            onSubmitEvidence={onSubmitEvidence}
          />
        )}
      </CardContent>
    </Card>
  );
}
