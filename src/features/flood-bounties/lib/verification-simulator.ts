import type { BountyEvidence, VerificationResult } from "@/types";

/**
 * Simulated Verification Layer (Step 13)
 * Local deterministic evidence check for the hackathon demo.
 * Designed as a clean service boundary so Amazon Bedrock multimodal verification
 * can replace it when AWS AI services are introduced.
 */
export function evaluateSubmittedBountyEvidence(
  locality: string,
  evidence: BountyEvidence
): VerificationResult {
  const hasBefore = Boolean(evidence.beforeImageLabel);
  const hasAfter = Boolean(evidence.afterImageLabel);
  const hasGps = Boolean(evidence.gpsCaptured);

  const isComplete = hasBefore && hasAfter && hasGps;

  return {
    beforeCheckLabel: hasBefore
      ? "Waste visible at drain intake"
      : "Before image missing",
    afterCheckLabel: hasAfter
      ? "Waste reduction detected; grate cleared"
      : "After image missing",
    locationCheckLabel: hasGps
      ? `Within task area (${locality}, Delhi)`
      : "Location proof not captured",
    verdict: isComplete ? "LIKELY_VALID" : "NEEDS_OPERATOR_REVIEW",
    summaryNote: isComplete
      ? "Before/after photo pair and task-area GPS match pre-storm cleanup criteria."
      : "Incomplete evidence fields; requires operator inspection.",
  };
}
