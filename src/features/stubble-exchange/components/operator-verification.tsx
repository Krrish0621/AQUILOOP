"use client";

import * as React from "react";
import {
  AlertTriangle,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  Scale,
  ShieldCheck,
  X,
  XCircle,
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
import { AiEvidenceCheckPanel } from "@/components/shared/ai-evidence-check-panel";
import { isRealS3EvidenceKey } from "@/lib/storage-client";
import { STUBBLE_REJECTION_REASON_LABELS } from "@/features/stubble-exchange/lib/verification-simulator";
import type {
  PickupRecord,
  StubbleExchangeListing,
  StubbleRejectionReason,
} from "@/types";
import { cn } from "@/lib/utils";

interface OperatorVerificationProps {
  pickups: PickupRecord[];
  listings: StubbleExchangeListing[];
  onApprove: (pickupId: string) => void;
  onReject: (
    pickupId: string,
    reason: StubbleRejectionReason,
    customNote?: string
  ) => void;
}

const REJECTION_REASONS: StubbleRejectionReason[] = [
  "INSUFFICIENT_EVIDENCE",
  "QUANTITY_MISMATCH",
  "UNCLEAR_PICKUP_PROOF",
  "LOCATION_MISMATCH",
  "DUPLICATE_RECORD",
];

export function OperatorVerification({
  pickups,
  listings,
  onApprove,
  onReject,
}: OperatorVerificationProps) {
  const [queueFilter, setQueueFilter] = React.useState<
    "PENDING" | "ALL" | "VERIFIED"
  >("PENDING");

  const [reviewModalPickupId, setReviewModalPickupId] = React.useState<
    string | null
  >(null);

  const filteredPickups = React.useMemo(() => {
    if (queueFilter === "PENDING") {
      return pickups.filter(
        (p) =>
          p.status === "PENDING_VERIFICATION" ||
          p.status === "PICKED_UP" ||
          p.status === "REJECTED"
      );
    }
    if (queueFilter === "VERIFIED") {
      return pickups.filter((p) => p.status === "VERIFIED");
    }
    return pickups;
  }, [pickups, queueFilter]);

  const verifiedCount = pickups.filter((p) => p.status === "VERIFIED").length;

  const modalPickup =
    pickups.find((p) => p.id === reviewModalPickupId) ?? null;
  const modalListing = modalPickup
    ? listings.find((l) => l.id === modalPickup.listingId)
    : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">
                Pending Verification
              </CardTitle>
              <CardDescription>
                Review submitted pickup proof and approve or reject ARC rewards.
              </CardDescription>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5">
              {(
                [
                  {
                    id: "PENDING",
                    label: `Needs Review (${
                      pickups.filter(
                        (p) =>
                          p.status === "PENDING_VERIFICATION" ||
                          p.status === "PICKED_UP" ||
                          p.status === "REJECTED"
                      ).length
                    })`,
                  },
                  { id: "ALL", label: `All (${pickups.length})` },
                  { id: "VERIFIED", label: `Verified (${verifiedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQueueFilter(tab.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    queueFilter === tab.id
                      ? "bg-surface-elevated text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredPickups.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface-muted/45 p-4 space-y-2.5 transition-all hover:border-border-strong"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {item.listingCode}
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-300">
                    +{Math.round(item.quantityTonnes * 100)} ARC
                  </span>
                </div>

                <StatusBadge
                  tone={
                    item.status === "VERIFIED"
                      ? "success"
                      : item.status === "PENDING_VERIFICATION"
                      ? "warning"
                      : item.status === "REJECTED"
                      ? "danger"
                      : "info"
                  }
                  label={item.status.replace("_", " ")}
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {item.pickupLocation} · {item.quantityTonnes} tonnes
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Farmer: {item.farmerName} · Buyer: {item.buyerName}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border-subtle pt-2.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {item.evidence.pickupTimestamp ?? "Proof attached"}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => setReviewModalPickupId(item.id)}
                  className="gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Review</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pickup Verification Review Modal */}
      {modalPickup && (
        <PickupReviewModal
          pickup={modalPickup}
          listing={modalListing}
          onClose={() => setReviewModalPickupId(null)}
          onApprove={(pickupId) => {
            onApprove(pickupId);
            setReviewModalPickupId(null);
          }}
          onReject={(pickupId, reason, note) => {
            onReject(pickupId, reason, note);
            setReviewModalPickupId(null);
          }}
        />
      )}
    </div>
  );
}

interface PickupReviewModalProps {
  pickup: PickupRecord;
  listing?: StubbleExchangeListing;
  onClose: () => void;
  onApprove: (pickupId: string) => void;
  onReject: (
    pickupId: string,
    reason: StubbleRejectionReason,
    customNote?: string
  ) => void;
}

function PickupReviewModal({
  pickup,
  listing,
  onClose,
  onApprove,
  onReject,
}: PickupReviewModalProps) {
  const [showRejectDrawer, setShowRejectDrawer] = React.useState(false);
  const [rejectReason, setRejectReason] =
    React.useState<StubbleRejectionReason>("UNCLEAR_PICKUP_PROOF");
  const [rejectNote, setRejectNote] = React.useState("");

  const rewardArc =
    listing?.expectedArc ?? Math.round(pickup.quantityTonnes * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-primary/40 bg-surface p-5 sm:p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold text-primary">
                {pickup.listingCode}
              </span>
              <StatusBadge
                tone={
                  pickup.status === "VERIFIED"
                    ? "success"
                    : pickup.status === "REJECTED"
                    ? "danger"
                    : "warning"
                }
                label={pickup.status.replace("_", " ")}
              />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Pickup Verification Review
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-muted p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Close review modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Farmer, Buyer, Quantity, Timestamp, GPS, Pickup Proof */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-muted/45 p-3.5 text-xs">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block">
              Farmer
            </span>
            <p className="mt-0.5 font-semibold text-foreground">
              {pickup.farmerName}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block">
              Buyer
            </span>
            <p className="mt-0.5 font-semibold text-foreground">
              {pickup.buyerName}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block">
              Quantity
            </span>
            <p className="mt-0.5 font-mono font-bold text-foreground flex items-center gap-1">
              <Scale className="h-3.5 w-3.5 text-emerald-400" />
              {pickup.evidence.confirmedQuantityTonnes ?? pickup.quantityTonnes}{" "}
              tonnes
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground block">
              Timestamp
            </span>
            <p className="mt-0.5 font-mono text-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-info" />
              {pickup.evidence.pickupTimestamp ?? "Today · 11:15 IST"}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <S3EvidenceImage
            s3Key={pickup.evidence.photoLabel}
            label="PICKUP / DELIVERY PROOF"
            timestamp={pickup.evidence.pickupTimestamp ?? "Submitted"}
            note={pickup.evidence.note}
            tone="primary"
          />

          <div className="rounded-xl border border-border bg-surface-muted/45 p-3.5 space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-warning" />
              GPS
            </span>
            <p className="font-medium text-foreground">
              {pickup.evidence.demoLocationLabel ?? pickup.locationDetail}
            </p>
          </div>
        </div>

        {/* Real Amazon Bedrock AI Evidence Check (Assistive Only) */}
        <AiEvidenceCheckPanel
          evidenceType="STUBBLE"
          resourceId={pickup.id}
          evidenceFingerprint={pickup.evidence.photoLabel ?? ""}
          hasValidS3Evidence={isRealS3EvidenceKey(pickup.evidence.photoLabel)}
          operatorDecisionStatus={
            pickup.status === "VERIFIED"
              ? "VERIFIED"
              : pickup.status === "REJECTED"
              ? "REJECTED"
              : "PENDING"
          }
        />

        {/* Reject Drawer */}
        {showRejectDrawer && pickup.status !== "VERIFIED" && (
          <div className="rounded-xl border border-danger/45 bg-danger/10 p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-danger">
              <AlertTriangle className="h-4 w-4" />
              <span>Select Rejection Reason</span>
            </div>

            <select
              value={rejectReason}
              onChange={(e) =>
                setRejectReason(e.target.value as StubbleRejectionReason)
              }
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground"
            >
              {REJECTION_REASONS.map((reasonKey) => (
                <option key={reasonKey} value={reasonKey}>
                  {STUBBLE_REJECTION_REASON_LABELS[reasonKey]}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Optional note for farmer/buyer..."
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground"
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => onReject(pickup.id, rejectReason, rejectNote)}
              >
                Confirm Reject
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowRejectDrawer(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Modal Footer: APPROVE / REJECT */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          {pickup.status === "VERIFIED" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" />
              Verified (+{rewardArc} ARC Issued)
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onApprove(pickup.id)}
                className="gap-1.5"
              >
                <Award className="h-3.5 w-3.5" />
                <span>APPROVE (+{rewardArc} ARC)</span>
              </Button>

              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setShowRejectDrawer((prev) => !prev)}
                className="gap-1.5"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>REJECT</span>
              </Button>
            </div>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
