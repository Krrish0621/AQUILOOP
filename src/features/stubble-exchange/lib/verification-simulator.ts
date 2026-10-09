import type {
  PickupStatus,
  StubbleEvidence,
  StubbleRejectionReason,
  StubbleVerificationResult,
} from "@/types";

/**
 * Local deterministic verification simulator for Stubble-to-Water Exchange.
 * Evaluates demo pickup conditions (evidence photo, confirmed quantity, demo location, pickup status).
 * Does NOT call real AI.
 */
export function evaluateSimulatedStubbleVerification(params: {
  listedQuantityTonnes: number;
  status: PickupStatus;
  evidence: StubbleEvidence;
}): StubbleVerificationResult {
  const { listedQuantityTonnes, status, evidence } = params;

  const hasPhoto = Boolean(evidence.photoSubmitted && evidence.photoLabel);
  const hasQuantity =
    typeof evidence.confirmedQuantityTonnes === "number" &&
    evidence.confirmedQuantityTonnes > 0;
  const quantityDiff = hasQuantity
    ? Math.abs((evidence.confirmedQuantityTonnes ?? 0) - listedQuantityTonnes)
    : listedQuantityTonnes;
  const quantityMatches = hasQuantity && quantityDiff <= 0.35;
  const hasLocation = Boolean(evidence.demoLocationLabel);
  const statusComplete =
    status === "PICKED_UP" ||
    status === "PENDING_VERIFICATION" ||
    status === "VERIFIED";

  const evidencePresentCheck = hasPhoto
    ? `Pickup proof attached (${evidence.photoLabel})`
    : "Missing pickup photo proof";

  const quantityReportedCheck = !hasQuantity
    ? "Confirmed weight not entered yet"
    : quantityMatches
    ? `Reported ${evidence.confirmedQuantityTonnes} t matches listed ${listedQuantityTonnes} t`
    : `Reported ${evidence.confirmedQuantityTonnes} t differs from listed ${listedQuantityTonnes} t`;

  const locationAvailableCheck = hasLocation
    ? `Location recorded (${evidence.demoLocationLabel})`
    : "Pickup location not recorded";

  const pickupStatusCompleteCheck = statusComplete
    ? `Pickup marked complete (${status.replace("_", " ")})`
    : `Pickup currently in ${status.replace("_", " ")} stage`;

  const isLikelyValid =
    hasPhoto && quantityMatches && hasLocation && statusComplete;

  return {
    evidencePresentCheck,
    quantityReportedCheck,
    locationAvailableCheck,
    pickupStatusCompleteCheck,
    verdict: isLikelyValid ? "LIKELY_VALID" : "NEEDS_REVIEW",
    summaryNote: isLikelyValid
      ? "All pickup checks passed (photo proof, confirmed quantity, location, and completed pickup status)."
      : "Needs operator review — ensure pickup photo, confirmed weight, and location are submitted.",
  };
}

export const STUBBLE_REJECTION_REASON_LABELS: Record<
  StubbleRejectionReason,
  string
> = {
  INSUFFICIENT_EVIDENCE: "Insufficient pickup evidence",
  QUANTITY_MISMATCH: "Quantity mismatch between listing and pickup",
  UNCLEAR_PICKUP_PROOF: "Unclear pickup photo / weighbridge proof",
  LOCATION_MISMATCH: "Demo location mismatch",
  DUPLICATE_RECORD: "Duplicate pickup submission",
};
