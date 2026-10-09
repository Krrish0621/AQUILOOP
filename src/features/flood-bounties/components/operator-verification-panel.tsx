"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  MapPin,
  Navigation,
  ShieldCheck,
  UserCheck,
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
import { EmptyState } from "@/components/shared/empty-state";
import { S3EvidenceImage } from "@/components/shared/s3-evidence-media";
import { AiEvidenceCheckPanel } from "@/components/shared/ai-evidence-check-panel";
import { isRealS3EvidenceKey } from "@/lib/storage-client";
import {
  buildGoogleMapsUrl,
  formatGpsCoordinates,
  hasValidGpsCoordinates,
} from "@/lib/geolocation";
import type { BountyRejectionReason, FloodWasteBounty } from "@/types";

interface OperatorVerificationPanelProps {
  bounties: FloodWasteBounty[];
  reviewingBountyId?: string | null;
  onSelectReviewBounty?: (bountyId: string | null) => void;
  onApproveBounty: (bountyId: string) => void;
  onRejectBounty: (
    bountyId: string,
    reason: BountyRejectionReason,
    detail: string
  ) => void;
}

const REJECTION_OPTIONS: { value: BountyRejectionReason; label: string }[] = [
  { value: "INSUFFICIENT_EVIDENCE", label: "Insufficient evidence" },
  { value: "MISMATCH", label: "Before/after angle mismatch" },
  { value: "CLEANUP_INCOMPLETE", label: "Cleanup incomplete (waste remaining)" },
  { value: "LOCATION_MISMATCH", label: "Location mismatch" },
  { value: "IMAGE_UNCLEAR", label: "Image unclear or obstructed" },
];

export function OperatorVerificationPanel({
  bounties,
  reviewingBountyId: controlledReviewId,
  onSelectReviewBounty,
  onApproveBounty,
  onRejectBounty,
}: OperatorVerificationPanelProps) {
  const [internalReviewId, setInternalReviewId] = React.useState<string | null>(
    null
  );
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [selectedReason, setSelectedReason] =
    React.useState<BountyRejectionReason>("CLEANUP_INCOMPLETE");
  const [rejectionDetail, setRejectionDetail] = React.useState(
    "Please clear remaining plastic packaging near the right grate bar and upload a clearer after photo."
  );

  const activeReviewId =
    controlledReviewId !== undefined ? controlledReviewId : internalReviewId;

  const setActiveReviewId = (id: string | null) => {
    setShowRejectForm(false);
    if (onSelectReviewBounty) {
      onSelectReviewBounty(id);
    } else {
      setInternalReviewId(id);
    }
  };

  const pendingBounties = React.useMemo(
    () =>
      bounties.filter(
        (b) => b.status === "SUBMITTED" || b.status === "UNDER_REVIEW"
      ),
    [bounties]
  );

  const reviewBounty = React.useMemo(
    () => bounties.find((b) => b.id === activeReviewId) ?? null,
    [bounties, activeReviewId]
  );

  const handleConfirmApprove = (bountyId: string) => {
    onApproveBounty(bountyId);
    setActiveReviewId(null);
  };

  const handleConfirmReject = (bountyId: string) => {
    onRejectBounty(bountyId, selectedReason, rejectionDetail);
    setShowRejectForm(false);
    setActiveReviewId(null);
  };

  return (
    <>
      <Card className="border-warning/35">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-warning" />
                <CardTitle className="text-base">
                  Pending Verification List
                </CardTitle>
              </div>
              <CardDescription className="mt-0.5">
                Select a submitted cleanup task to review before/after evidence and approve ARC rewards.
              </CardDescription>
            </div>
            <StatusBadge
              tone={pendingBounties.length > 0 ? "warning" : "success"}
              pulse={pendingBounties.length > 0}
              label={`${pendingBounties.length} Pending Review`}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {pendingBounties.length === 0 ? (
            <EmptyState
              title="All submitted bounties have been reviewed"
              description="Switch to Worker View to claim an open bounty and submit before/after cleanup proof."
            />
          ) : (
            pendingBounties.map((bounty) => (
              <div
                key={bounty.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted/45 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {bounty.code}
                    </span>
                    <StatusBadge
                      tone="warning"
                      label={
                        bounty.status === "UNDER_REVIEW"
                          ? "UNDER REVIEW"
                          : "SUBMITTED"
                      }
                    />
                    <span className="rounded bg-secondary/15 border border-secondary/35 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                      +{bounty.rewardArc} ARC
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-foreground">
                    {bounty.title} — {bounty.delhiLocality}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      Worker:{" "}
                      <strong className="text-foreground">
                        {bounty.assignedWorkerName || "Not available"}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-info" />
                      {bounty.corridorDetail}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setActiveReviewId(bounty.id)}
                  className="shrink-0"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Review</span>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ====================================================================
       * EVIDENCE REVIEW MODAL / DRAWER
       * ==================================================================== */}
      {reviewBounty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evidence-review-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-strong bg-surface p-6 shadow-elevated space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {reviewBounty.code}
                  </span>
                  <StatusBadge
                    tone="warning"
                    label={reviewBounty.status.replace("_", " ")}
                  />
                  <span className="rounded bg-secondary/15 border border-secondary/35 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                    +{reviewBounty.rewardArc} ARC
                  </span>
                </div>
                <h3
                  id="evidence-review-title"
                  className="text-lg font-bold text-foreground"
                >
                  {reviewBounty.title} — {reviewBounty.delhiLocality}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Task ID: <span className="font-mono">{reviewBounty.id}</span> ·
                  Requirement: Clear {reviewBounty.estimatedWasteKgRange} at{" "}
                  {reviewBounty.corridorDetail}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveReviewId(null)}
                className="rounded-lg border border-border bg-surface-muted p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Close review modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Worker, GPS Coordinates & Timestamp Strip */}
            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-border bg-surface-muted/50 p-3.5 text-xs sm:grid-cols-3">
              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Assigned Worker
                </span>
                <span className="font-semibold text-foreground inline-flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  {reviewBounty.assignedWorkerName || "Not available"}
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Recorded GPS Coordinates
                </span>
                <span className="font-mono font-semibold text-foreground inline-flex items-center gap-1.5 mt-0.5">
                  <Navigation className="h-3.5 w-3.5 text-info" />
                  {formatGpsCoordinates(
                    reviewBounty.evidence.submittedLatitude,
                    reviewBounty.evidence.submittedLongitude
                  )}
                </span>
                {buildGoogleMapsUrl(
                  reviewBounty.evidence.submittedLatitude,
                  reviewBounty.evidence.submittedLongitude
                ) ? (
                  <a
                    href={
                      buildGoogleMapsUrl(
                        reviewBounty.evidence.submittedLatitude,
                        reviewBounty.evidence.submittedLongitude
                      )!
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Google Maps
                  </a>
                ) : (
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    Google Maps: Not available
                  </span>
                )}
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Submission Timestamp
                </span>
                <span className="font-mono text-foreground inline-flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                  {reviewBounty.evidence.afterTimestamp || "Not available"}
                </span>
              </div>
            </div>

            {/* BEFORE vs AFTER Visual Comparison (Real Amazon S3 Signed URLs) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase text-foreground flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  Submitted Field Photos (Click Image to Enlarge)
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {hasValidGpsCoordinates(
                    reviewBounty.evidence.submittedLatitude,
                    reviewBounty.evidence.submittedLongitude
                  )
                    ? `GPS: ${formatGpsCoordinates(
                        reviewBounty.evidence.submittedLatitude,
                        reviewBounty.evidence.submittedLongitude
                      )}`
                    : "GPS: Not available"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <S3EvidenceImage
                  key={`${reviewBounty.id}-before`}
                  s3Key={reviewBounty.evidence.beforeImageLabel}
                  label="BEFORE PHOTO"
                  timestamp={reviewBounty.evidence.beforeTimestamp}
                  note={reviewBounty.evidence.beforeNote}
                  tone="warning"
                  className="min-h-[220px]"
                />

                <S3EvidenceImage
                  key={`${reviewBounty.id}-after`}
                  s3Key={reviewBounty.evidence.afterImageLabel}
                  label="AFTER PHOTO"
                  timestamp={reviewBounty.evidence.afterTimestamp}
                  note={reviewBounty.evidence.afterNote}
                  tone="success"
                  className="min-h-[220px]"
                />
              </div>
            </div>

            {/* Real Amazon Bedrock AI Evidence Check (Assistive Only) */}
            <AiEvidenceCheckPanel
              evidenceType="BOUNTY"
              resourceId={reviewBounty.id}
              evidenceFingerprint={`${reviewBounty.evidence.beforeImageLabel ?? ""}|${reviewBounty.evidence.afterImageLabel ?? ""}`}
              hasValidS3Evidence={
                isRealS3EvidenceKey(reviewBounty.evidence.beforeImageLabel) &&
                isRealS3EvidenceKey(reviewBounty.evidence.afterImageLabel)
              }
              operatorDecisionStatus={
                reviewBounty.status === "VERIFIED"
                  ? "VERIFIED"
                  : reviewBounty.status === "REJECTED"
                  ? "REJECTED"
                  : "PENDING"
              }
            />

            {/* Structured Rejection Drawer */}
            {showRejectForm && (
              <div className="rounded-xl border border-danger/45 bg-danger/10 p-4 space-y-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Select Rejection Reason</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="modal-rej-reason"
                      className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                    >
                      Reason
                    </label>
                    <select
                      id="modal-rej-reason"
                      value={selectedReason}
                      onChange={(e) =>
                        setSelectedReason(
                          e.target.value as BountyRejectionReason
                        )
                      }
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                    >
                      {REJECTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="modal-rej-detail"
                      className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                    >
                      Worker Feedback
                    </label>
                    <input
                      id="modal-rej-detail"
                      type="text"
                      value={rejectionDetail}
                      onChange={(e) => setRejectionDetail(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRejectForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleConfirmReject(reviewBounty.id)}
                  >
                    Confirm Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Modal Footer: APPROVE / REJECT */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <span className="font-mono text-xs text-muted-foreground">
                Approving issues +{reviewBounty.rewardArc} ARC to{" "}
                {reviewBounty.assignedWorkerName ?? "Worker"}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectForm((prev) => !prev)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>REJECT</span>
                </Button>

                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  onClick={() => handleConfirmApprove(reviewBounty.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>APPROVE (+{reviewBounty.rewardArc} ARC)</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
