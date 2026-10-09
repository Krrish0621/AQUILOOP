"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Scale,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  S3EvidenceImage,
  S3EvidenceUploader,
} from "@/components/shared/s3-evidence-media";
import {
  assertNoDataErrors,
  formatDataError,
  getDataClient,
} from "@/lib/data-client";
import {
  buildStubbleProofKey,
  isRealS3EvidenceKey,
} from "@/lib/storage-client";
import type { PickupRecord, StubbleEvidence } from "@/types";

interface PickupEvidenceProps {
  pickup: PickupRecord;
  onSubmitEvidence: (pickupId: string, evidence: StubbleEvidence) => void;
}

export function PickupEvidence({
  pickup,
  onSubmitEvidence,
}: PickupEvidenceProps) {
  const [uploadedProofKey, setUploadedProofKey] = React.useState<string>(
    isRealS3EvidenceKey(pickup.evidence.photoLabel)
      ? pickup.evidence.photoLabel
      : ""
  );
  const [confirmedQuantityTonnes, setConfirmedQuantityTonnes] =
    React.useState<number>(
      pickup.evidence.confirmedQuantityTonnes ?? pickup.quantityTonnes
    );
  const [demoLocationLabel, setDemoLocationLabel] = React.useState<string>(
    pickup.evidence.demoLocationLabel ??
      `${pickup.pickupLocation} (${pickup.locationDetail})`
  );
  const [note, setNote] = React.useState<string>(
    pickup.evidence.note ??
      `Loaded ${pickup.quantityTonnes} t of dry crop residue onto buyer vehicle.`
  );
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUploadedProofKey(
      isRealS3EvidenceKey(pickup.evidence.photoLabel)
        ? pickup.evidence.photoLabel
        : ""
    );
    setConfirmedQuantityTonnes(
      pickup.evidence.confirmedQuantityTonnes ?? pickup.quantityTonnes
    );
    setDemoLocationLabel(
      pickup.evidence.demoLocationLabel ??
        `${pickup.pickupLocation} (${pickup.locationDetail})`
    );
    setNote(
      pickup.evidence.note ??
        `Loaded ${pickup.quantityTonnes} t of dry crop residue onto buyer vehicle.`
    );
  }, [pickup]);

  const handlePersistProofKey = async (s3Key: string) => {
    setSubmitError(null);
    try {
      const client = getDataClient();
      const { errors } = await client.models.StubbleListing.update({
        id: pickup.id,
        proofKey: s3Key,
      });
      assertNoDataErrors(errors, "Unable to save pickup proof photo");
      setUploadedProofKey(s3Key);
    } catch (err) {
      throw new Error(
        formatDataError(err, "Unable to save pickup proof photo")
      );
    }
  };

  const handleCaptureDemoLocation = () => {
    setDemoLocationLabel(
      `GPS Confirmed: ${pickup.pickupLocation} Sector Gate`
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isRealS3EvidenceKey(uploadedProofKey)) {
      setSubmitError(
        "Please upload a pickup proof photo before submitting."
      );
      return;
    }

    const nowLabel = `Submitted · ${new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })} IST`;

    onSubmitEvidence(pickup.id, {
      photoSubmitted: true,
      photoLabel: uploadedProofKey,
      confirmedQuantityTonnes:
        Number.isFinite(confirmedQuantityTonnes) && confirmedQuantityTonnes > 0
          ? confirmedQuantityTonnes
          : pickup.quantityTonnes,
      pickupTimestamp: nowLabel,
      demoLocationLabel,
      note,
    });
  };

  if (pickup.status === "PENDING_VERIFICATION") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-warning/40 bg-warning/[0.07] p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Clock className="h-4 w-4 text-warning" />
              <span className="font-mono uppercase">
                Submitted for verification
              </span>
            </div>
            <StatusBadge tone="warning" label="Pending Operator Review" />
          </div>
          <p className="text-xs text-muted-foreground">
            Confirmed Quantity:{" "}
            <strong className="font-mono text-emerald-400">
              {pickup.evidence.confirmedQuantityTonnes ??
                confirmedQuantityTonnes}{" "}
              tonnes
            </strong>{" "}
            · Location:{" "}
            <strong className="text-foreground">
              {pickup.evidence.demoLocationLabel ?? demoLocationLabel}
            </strong>
          </p>
        </div>

        <S3EvidenceImage
          s3Key={pickup.evidence.photoLabel || uploadedProofKey}
          label="PICKUP / DELIVERY PROOF"
          timestamp={pickup.evidence.pickupTimestamp ?? "Submitted"}
          note={pickup.evidence.note ?? note}
          tone="primary"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/35 bg-surface-muted/60 p-4 space-y-4">
      <div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary block">
          Step 5 — Submit Pickup Proof
        </span>
        <h4 className="text-sm font-semibold text-foreground mt-0.5">
          Upload pickup photo, confirm weight, and submit for{" "}
          {pickup.listingCode}
        </h4>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* 1. Pickup Photo Upload */}
        <S3EvidenceUploader
          label="1. Pickup / Delivery Proof Photo"
          description="Upload weighbridge slip or tractor-trailer loading photo (JPEG, PNG, or WebP up to 10 MB)."
          existingS3Key={uploadedProofKey}
          buildTargetKey={(ext) => buildStubbleProofKey(pickup.id, ext)}
          onPersistKey={handlePersistProofKey}
          allowReplace
          accentTone="primary"
        />

        {submitError && (
          <p className="font-mono text-xs font-medium text-danger">
            {submitError}
          </p>
        )}

        {/* 2. Confirmed Quantity & 3. Location */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="evidence-qty"
              className="text-xs font-medium text-foreground flex items-center gap-1"
            >
              <Scale className="h-3.5 w-3.5 text-emerald-400" />
              2. Confirmed Quantity (tonnes)
            </label>
            <input
              id="evidence-qty"
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              value={confirmedQuantityTonnes}
              onChange={(e) =>
                setConfirmedQuantityTonnes(Number(e.target.value))
              }
              className="h-9 w-full rounded-md border border-border bg-surface px-3 font-mono text-xs text-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-warning" />
              3. Location
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={demoLocationLabel}
                onChange={(e) => setDemoLocationLabel(e.target.value)}
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-xs text-foreground"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCaptureDemoLocation}
                className="shrink-0"
              >
                Confirm GPS
              </Button>
            </div>
          </div>
        </div>

        {/* Optional Note & Submit Pickup Proof */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pt-1">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="evidence-note"
              className="text-xs font-medium text-foreground flex items-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-info" />
              Pickup Note (Optional)
            </label>
            <input
              id="evidence-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            disabled={!isRealS3EvidenceKey(uploadedProofKey)}
            className="gap-1.5 shrink-0 font-mono font-semibold"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Submit Pickup Proof</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
