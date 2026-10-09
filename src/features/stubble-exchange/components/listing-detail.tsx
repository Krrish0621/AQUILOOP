"use client";

import * as React from "react";
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  MapPin,
  Play,
  Sprout,
  Truck,
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
import { S3EvidenceImage } from "@/components/shared/s3-evidence-media";
import { PickupTracker } from "@/features/stubble-exchange/components/pickup-tracker";
import { PickupEvidence } from "@/features/stubble-exchange/components/pickup-evidence";
import type {
  PickupRecord,
  PickupStatus,
  StubbleEvidence,
  StubbleExchangeListing,
} from "@/types";

interface ListingDetailProps {
  listing: StubbleExchangeListing;
  linkedPickup?: PickupRecord | null;
  onAcceptPickup: (listingId: string) => void;
  onUpdatePickupStage?: (
    pickupId: string,
    nextStatus: PickupStatus,
    scheduledWindowOverride?: string
  ) => void;
  onSubmitEvidence?: (pickupId: string, evidence: StubbleEvidence) => void;
}

export function ListingDetail({
  listing,
  linkedPickup,
  onAcceptPickup,
  onUpdatePickupStage,
  onSubmitEvidence,
}: ListingDetailProps) {
  const [scheduleInput, setScheduleInput] = React.useState(
    linkedPickup?.scheduledWindow || listing.pickupWindow || "Oct 08 · 09:30 IST"
  );

  React.useEffect(() => {
    setScheduleInput(
      linkedPickup?.scheduledWindow ||
        listing.pickupWindow ||
        "Oct 08 · 09:30 IST"
    );
  }, [listing.id, listing.pickupWindow, linkedPickup?.scheduledWindow]);

  const currentStatus = linkedPickup?.status ?? listing.status;

  return (
    <Card className="border-primary/35 shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">
                SELECTED LISTING · {listing.listingCode}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {listing.location} ({listing.distanceKm} km)
              </span>
            </div>
            <CardTitle className="text-base sm:text-lg">
              {listing.title}
            </CardTitle>
            <CardDescription>{listing.locationDetail}</CardDescription>
          </div>

          <StatusBadge
            tone={
              currentStatus === "OPEN"
                ? "warning"
                : currentStatus === "VERIFIED"
                ? "success"
                : currentStatus === "REJECTED"
                ? "danger"
                : currentStatus === "PENDING_VERIFICATION"
                ? "warning"
                : "primary"
            }
            label={
              currentStatus === "PENDING_VERIFICATION"
                ? "Pending Operator Review"
                : currentStatus.replace("_", " ")
            }
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Step-by-Step Progress Bar for the Selected Listing */}
        <PickupTracker status={currentStatus} />

        {/* Selected Listing Details Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Listing ID
            </span>
            <p className="mt-1 font-mono font-bold text-primary">
              {listing.listingCode}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Crop
            </span>
            <p className="mt-1 font-semibold text-foreground flex items-center gap-1">
              <Sprout className="h-3.5 w-3.5 text-secondary" />
              {listing.cropType}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Quantity
            </span>
            <p className="mt-1 font-mono text-sm font-bold text-foreground">
              {listing.quantityTonnes} tonnes
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Location
            </span>
            <p className="mt-1 font-semibold text-foreground">
              {listing.location}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Pickup Window
            </span>
            <p className="mt-1 font-semibold text-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-warning" />
              {linkedPickup?.scheduledWindow ?? listing.pickupWindow}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Expected Reward
            </span>
            <p className="mt-1 font-mono font-bold text-emerald-400 flex items-center gap-1">
              <Award className="h-3.5 w-3.5" />+{listing.expectedArc} ARC
            </p>
          </div>
        </div>

        {/* Access & Condition Note */}
        <div className="rounded-xl border border-border bg-surface-muted/35 p-3.5 text-xs space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              Plot Access &amp; Residue Condition ({listing.condition})
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              {listing.estimatedBiomassUseLabel}
            </span>
          </div>
          <p className="text-foreground/90">
            {listing.notes ?? "Standard tractor-trailer road access."}
          </p>
        </div>

        {/* Rejection Notice if Operator Rejected */}
        {currentStatus === "REJECTED" &&
          (linkedPickup?.rejectionNote || listing.rejectionNote) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/45 bg-danger/10 p-3.5 text-xs text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Verification Rejected — Please Resubmit Pickup Proof
                </p>
                <p className="mt-0.5 text-danger/90">
                  {linkedPickup?.rejectionNote ?? listing.rejectionNote}
                </p>
              </div>
            </div>
          )}

        {/* ==================================================================
         * SINGLE PROMINENT NEXT STEP BY STATE
         * ================================================================== */}

        {/* STATE 1 — OPEN: Accept Pickup */}
        {currentStatus === "OPEN" && (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase text-primary block">
                Next Step — Step 1 of 5
              </span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">
                Accept pickup for {listing.listingCode} ({listing.quantityTonnes}{" "}
                tonnes)
              </h4>
            </div>

            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={() => onAcceptPickup(listing.id)}
              className="gap-1.5 shrink-0 font-mono font-semibold"
            >
              <Truck className="h-4 w-4" />
              <span>Accept Pickup</span>
            </Button>
          </div>
        )}

        {/* STATE 2 — ACCEPTED: Schedule Pickup */}
        {currentStatus === "ACCEPTED" &&
          linkedPickup &&
          onUpdatePickupStage && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-primary block">
                  Next Step — Step 2 of 5
                </span>
                <h4 className="text-sm font-semibold text-foreground mt-0.5">
                  Confirm pickup date &amp; time window
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={scheduleInput}
                  onChange={(e) => setScheduleInput(e.target.value)}
                  className="h-9 rounded-md border border-border bg-surface px-3 text-xs text-foreground"
                />
                <Button
                  type="button"
                  variant="default"
                  onClick={() =>
                    onUpdatePickupStage(
                      linkedPickup.id,
                      "SCHEDULED",
                      scheduleInput
                    )
                  }
                  className="font-mono font-semibold"
                >
                  Schedule Pickup
                </Button>
              </div>
            </div>
          )}

        {/* STATE 3 — SCHEDULED: Start Pickup */}
        {currentStatus === "SCHEDULED" &&
          linkedPickup &&
          onUpdatePickupStage && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-primary block">
                  Next Step — Step 3 of 5
                </span>
                <h4 className="text-sm font-semibold text-foreground mt-0.5">
                  Dispatch vehicle &amp; start pickup ({linkedPickup.scheduledWindow})
                </h4>
              </div>

              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={() =>
                  onUpdatePickupStage(linkedPickup.id, "IN_TRANSIT")
                }
                className="gap-1.5 shrink-0 font-mono font-semibold"
              >
                <Play className="h-4 w-4" />
                <span>Start Pickup</span>
              </Button>
            </div>
          )}

        {/* STATE 4 — IN_TRANSIT: Mark Picked Up */}
        {currentStatus === "IN_TRANSIT" &&
          linkedPickup &&
          onUpdatePickupStage && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-primary block">
                  Next Step — Step 4 of 5
                </span>
                <h4 className="text-sm font-semibold text-foreground mt-0.5">
                  Confirm crop residue loaded at {listing.location}
                </h4>
              </div>

              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={() =>
                  onUpdatePickupStage(linkedPickup.id, "PICKED_UP")
                }
                className="gap-1.5 shrink-0 font-mono font-semibold"
              >
                <Truck className="h-4 w-4" />
                <span>Mark Picked Up</span>
              </Button>
            </div>
          )}

        {/* STATE 5 & 6 — PICKED_UP / REJECTED / PENDING_VERIFICATION: Submit Pickup Proof */}
        {(currentStatus === "PICKED_UP" ||
          currentStatus === "REJECTED" ||
          currentStatus === "PENDING_VERIFICATION") &&
          linkedPickup &&
          onSubmitEvidence && (
            <PickupEvidence
              pickup={linkedPickup}
              onSubmitEvidence={onSubmitEvidence}
            />
          )}

        {/* STATE 7 — VERIFIED */}
        {currentStatus === "VERIFIED" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success/40 bg-success/10 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Pickup Verified — +{listing.expectedArc} ARC Issued
                </span>
              </div>
              <StatusBadge tone="success" label="Completed" />
            </div>

            {linkedPickup?.evidence.photoLabel && (
              <S3EvidenceImage
                s3Key={linkedPickup.evidence.photoLabel}
                label="VERIFIED PICKUP PROOF"
                timestamp={linkedPickup.evidence.pickupTimestamp ?? "Verified"}
                note={linkedPickup.evidence.note}
                tone="success"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
