"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchLatestEvidenceVerification,
  getDataClient,
  mapVerificationRecordToUi,
  triggerOperatorEvidenceVerification,
} from "@/lib/data-client";
import type { AiEvidenceVerification, AiOverallAssessment } from "@/types";
import { cn } from "@/lib/utils";

interface AiEvidenceCheckPanelProps {
  evidenceType: "BOUNTY" | "STUBBLE";
  resourceId: string;
  evidenceFingerprint: string;
  hasValidS3Evidence: boolean;
  operatorDecisionStatus: "PENDING" | "VERIFIED" | "REJECTED";
}

function formatAssessmentLabel(assessment?: AiOverallAssessment | null): string {
  if (assessment === "LIKELY_VALID") return "Scene Labels Match";
  if (assessment === "LIKELY_INVALID") return "Duplicate / Mismatch";
  if (assessment === "NEEDS_REVIEW") return "Needs Manual Review";
  return "Pending";
}

function getAssessmentStyle(assessment?: AiOverallAssessment | null): string {
  if (assessment === "LIKELY_VALID") {
    return "border-success/40 bg-success/15 text-success";
  }
  if (assessment === "LIKELY_INVALID") {
    return "border-danger/40 bg-danger/15 text-danger";
  }
  return "border-warning/40 bg-warning/15 text-warning";
}

export function AiEvidenceCheckPanel({
  evidenceType,
  resourceId,
  evidenceFingerprint,
  hasValidS3Evidence,
  operatorDecisionStatus,
}: AiEvidenceCheckPanelProps) {
  const [verification, setVerification] =
    React.useState<AiEvidenceVerification | null>(null);
  const [checkState, setCheckState] = React.useState<
    "IDLE" | "RUNNING" | "COMPLETED" | "FAILED"
  >("IDLE");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const runVerification = React.useCallback(
    async (forceRecheck: boolean) => {
      if (!hasValidS3Evidence) {
        setCheckState("FAILED");
        setErrorMessage("Evidence image is invalid");
        return;
      }

      setCheckState("RUNNING");
      setErrorMessage(null);

      const res = await triggerOperatorEvidenceVerification({
        evidenceType,
        resourceId,
        forceRecheck,
      });

      if (res.success && res.verification) {
        setVerification(res.verification);
        setCheckState("COMPLETED");
      } else {
        setCheckState("FAILED");
        setErrorMessage(res.message || "AI analysis unavailable right now");
      }
    },
    [evidenceType, resourceId, hasValidS3Evidence]
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadOrTrigger() {
      setErrorMessage(null);
      setCheckState("RUNNING");

      const existing = await fetchLatestEvidenceVerification(resourceId);
      if (cancelled) return;

      if (
        existing &&
        (!existing.evidenceFingerprint ||
          existing.evidenceFingerprint === evidenceFingerprint)
      ) {
        setVerification(existing);
        setCheckState("COMPLETED");
        return;
      }

      if (!hasValidS3Evidence) {
        setVerification(null);
        setCheckState("FAILED");
        setErrorMessage("Evidence image is invalid");
        return;
      }

      const res = await triggerOperatorEvidenceVerification({
        evidenceType,
        resourceId,
        forceRecheck: false,
      });
      if (cancelled) return;

      if (res.success && res.verification) {
        setVerification(res.verification);
        setCheckState("COMPLETED");
      } else {
        setCheckState("FAILED");
        setErrorMessage(res.message || "AI analysis unavailable right now");
      }
    }

    void loadOrTrigger();

    return () => {
      cancelled = true;
    };
  }, [resourceId, evidenceFingerprint, evidenceType, hasValidS3Evidence]);

  // Real-time EvidenceVerification updates via AppSync observeQuery + silent background sync
  React.useEffect(() => {
    if (!resourceId) return;

    let isMounted = true;
    const client = getDataClient();

    let sub: { unsubscribe: () => void } | null = null;
    try {
      sub = client.models.EvidenceVerification.observeQuery({
        filter: { resourceId: { eq: resourceId } },
      }).subscribe({
        next: ({ items }) => {
          if (!isMounted || !items || items.length === 0) return;
          const sorted = [...items]
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .sort((a, b) =>
              String(b.evaluatedAt || "").localeCompare(
                String(a.evaluatedAt || "")
              )
            );
          if (sorted[0]) {
            setVerification(mapVerificationRecordToUi(sorted[0]));
            setCheckState("COMPLETED");
            setErrorMessage(null);
          }
        },
        error: () => {
          // Fallback interval handles synchronization
        },
      });
    } catch {
      // Fallback interval handles synchronization
    }

    const intervalId = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const latest = await fetchLatestEvidenceVerification(resourceId);
      if (!isMounted || !latest) return;
      if (
        !latest.evidenceFingerprint ||
        latest.evidenceFingerprint === evidenceFingerprint
      ) {
        setVerification(latest);
        setCheckState("COMPLETED");
        setErrorMessage(null);
      }
    }, 6000);

    return () => {
      isMounted = false;
      sub?.unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [resourceId, evidenceFingerprint]);

  const combinedObservations = React.useMemo(() => {
    if (!verification) return [];
    const list = [
      ...verification.beforeObservations,
      ...verification.afterObservations,
    ];
    if (verification.consistencyAssessment) {
      list.push(verification.consistencyAssessment);
    }
    return list;
  }, [verification]);

  const filteredConcerns = React.useMemo(() => {
    if (!verification?.concerns) return [];
    return verification.concerns.filter(
      (c) =>
        !c.toLowerCase().includes("amazon rekognition") &&
        !c.toLowerCase().includes("verifies scene labels and image")
    );
  }, [verification]);

  const cleanSummary = React.useMemo(() => {
    if (!verification?.summary) return "";
    return verification.summary.replace(/^Rekognition detected /i, "Detected ");
  }, [verification]);

  const operatorDecisionLabel =
    operatorDecisionStatus === "VERIFIED"
      ? "Approved"
      : operatorDecisionStatus === "REJECTED"
        ? "Rejected"
        : "Pending";

  return (
    <div className="rounded-xl border border-primary/35 bg-primary/[0.06] p-4 space-y-3">
      {/* Top Header: AI Image Analysis + Run / Retry Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI Image Analysis
          </span>

          {checkState === "RUNNING" && (
            <span className="inline-flex items-center gap-1 rounded border border-info/35 bg-info/15 px-2 py-0.5 text-[11px] font-semibold text-info">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing photos...
            </span>
          )}

          {checkState === "COMPLETED" && verification && (
            <>
              <span
                className={cn(
                  "rounded border px-2 py-0.5 text-[11px] font-bold",
                  getAssessmentStyle(verification.overallAssessment)
                )}
              >
                {formatAssessmentLabel(verification.overallAssessment)}
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {verification.confidence}% confidence
              </span>
            </>
          )}

          {checkState === "FAILED" && (
            <span className="rounded border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
              Unavailable
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={checkState === "RUNNING" || !hasValidS3Evidence}
          onClick={() => void runVerification(true)}
          className="h-7 px-2.5 text-[11px] gap-1.5"
        >
          {checkState === "RUNNING" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              <span>
                {verification || checkState === "FAILED"
                  ? "Re-run Analysis"
                  : "Run Analysis"}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Analysis Status & Operator Decision */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border border-border bg-background/70 p-2.5 text-xs">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground">
            Analysis status:
          </span>
          <span className="font-semibold text-foreground">
            {checkState === "RUNNING"
              ? "Analyzing evidence..."
              : verification
                ? formatAssessmentLabel(verification.overallAssessment)
                : errorMessage || "AI analysis unavailable right now"}
          </span>
        </div>

        <div className="flex items-center justify-between px-1 sm:border-l sm:border-border sm:pl-3">
          <span className="text-[11px] text-muted-foreground">
            Operator Decision:
          </span>
          <span
            className={cn(
              "font-semibold inline-flex items-center gap-1",
              operatorDecisionStatus === "VERIFIED"
                ? "text-success"
                : operatorDecisionStatus === "REJECTED"
                  ? "text-danger"
                  : "text-warning"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {operatorDecisionLabel}
          </span>
        </div>
      </div>

      {/* Completed Structured Analysis Body */}
      {verification && (
        <div className="space-y-2.5">
          {/* 4 Sub-scores Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
            <div className="rounded border border-border bg-background/70 px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground block">
                Scene relevance
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                {verification.taskMatchScore}/100
              </span>
            </div>

            <div className="rounded border border-border bg-background/70 px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground block">
                {evidenceType === "BOUNTY" ? "Before quality" : "Image quality"}
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                {verification.beforeEvidenceScore}/100
              </span>
            </div>

            <div className="rounded border border-border bg-background/70 px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground block">
                {evidenceType === "BOUNTY" ? "After quality" : "Clarity score"}
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {verification.afterEvidenceScore}/100
              </span>
            </div>

            <div className="rounded border border-border bg-background/70 px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground block">
                {evidenceType === "BOUNTY" ? "Scene overlap" : "Label match"}
              </span>
              <span className="font-mono text-sm font-bold text-info">
                {verification.consistencyScore}/100
              </span>
            </div>
          </div>

          {/* Concise Summary */}
          {cleanSummary && (
            <p className="text-xs font-medium text-foreground bg-background/60 rounded-lg border border-border/70 px-3 py-2">
              {cleanSummary}
            </p>
          )}

          {/* Detected Visual Labels, Image Quality Result & Before/After Comparison */}
          {combinedObservations.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
              {combinedObservations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          )}

          {/* Genuine Quality / Mismatch Concerns Only (No Technical Disclaimer) */}
          {filteredConcerns.length > 0 && (
            <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning">
                <AlertTriangle className="h-3 w-3" />
                Review Note
              </span>
              <ul className="list-disc pl-4 text-xs text-foreground/90 space-y-0.5">
                {filteredConcerns.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Timestamp Attribution */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              Detected labels &amp; image quality
            </span>
            <span className="font-mono">
              Evaluated:{" "}
              {new Date(verification.evaluatedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      )}

      {/* Unavailable / Error State */}
      {checkState === "FAILED" && !verification && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-warning">
              AI analysis unavailable right now
            </p>
            <p className="text-muted-foreground">
              You can review the submitted photos above and approve or reject
              directly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
