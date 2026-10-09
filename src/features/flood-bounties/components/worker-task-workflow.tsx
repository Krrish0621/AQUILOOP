"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Send,
  Sparkles,
  Wrench,
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
import {
  S3EvidenceImage,
  S3EvidenceUploader,
} from "@/components/shared/s3-evidence-media";
import {
  buildBountyEvidenceKey,
  isRealS3EvidenceKey,
} from "@/lib/storage-client";
import {
  buildGoogleMapsUrl,
  captureBrowserGpsLocation,
  formatGpsCoordinates,
  hasValidGpsCoordinates,
} from "@/lib/geolocation";
import { fetchLatestEvidenceVerification } from "@/lib/data-client";
import type { BountyEvidence, FloodWasteBounty } from "@/types";
import { cn } from "@/lib/utils";

interface WorkerTaskWorkflowProps {
  bounty: FloodWasteBounty;
  workerName: string;
  onClaimBounty: (bountyId: string) => void | Promise<void>;
  onStartTask: (bountyId: string) => void | Promise<void>;
  onUpdateEvidence: (
    bountyId: string,
    patch: Partial<BountyEvidence>
  ) => Promise<void>;
  onSubmitForVerification: (bountyId: string) => void | Promise<void>;
  onOpenTaskModal?: (bountyId: string) => void;
}

const WORKFLOW_STEPS = [
  { step: 1, label: "1. Before Photo" },
  { step: 2, label: "2. Work Complete" },
  { step: 3, label: "3. After Photo" },
  { step: 4, label: "4. Location" },
  { step: 5, label: "5. Submit" },
];

export function WorkerTaskWorkflow({
  bounty,
  workerName,
  onClaimBounty,
  onStartTask,
  onUpdateEvidence,
  onSubmitForVerification,
}: WorkerTaskWorkflowProps) {
  const [beforeNoteInput, setBeforeNoteInput] = React.useState(
    bounty.evidence.beforeNote ??
      "Plastic packaging and solid waste blocking drainage inlet bars."
  );
  const [afterNoteInput, setAfterNoteInput] = React.useState(
    bounty.evidence.afterNote ??
      "Cleared inlet grate completely; bagged waste staged for collection."
  );
  const [aiCheckCompleted, setAiCheckCompleted] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [gpsErrorMessage, setGpsErrorMessage] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    setBeforeNoteInput(
      bounty.evidence.beforeNote ??
        "Plastic packaging and solid waste blocking drainage inlet bars."
    );
    setAfterNoteInput(
      bounty.evidence.afterNote ??
        "Cleared inlet grate completely; bagged waste staged for collection."
    );
    setGpsErrorMessage(null);
  }, [bounty.id, bounty.evidence.beforeNote, bounty.evidence.afterNote]);

  React.useEffect(() => {
    let active = true;
    if (
      bounty.status === "SUBMITTED" ||
      bounty.status === "UNDER_REVIEW" ||
      bounty.status === "VERIFIED"
    ) {
      fetchLatestEvidenceVerification(bounty.id)
        .then((res) => {
          if (active) {
            setAiCheckCompleted(Boolean(res));
          }
        })
        .catch(() => {
          if (active) setAiCheckCompleted(false);
        });
    } else {
      setAiCheckCompleted(false);
    }
    return () => {
      active = false;
    };
  }, [bounty.id, bounty.status]);

  const ev = bounty.evidence;
  const hasBefore = isRealS3EvidenceKey(ev.beforeImageLabel);
  const hasCleanup = Boolean(ev.cleanupCompleted);
  const hasAfter = isRealS3EvidenceKey(ev.afterImageLabel);
  const hasGps = Boolean(ev.gpsCaptured);

  const activeStep = !hasBefore
    ? 1
    : !hasCleanup
    ? 2
    : !hasAfter
    ? 3
    : !hasGps
    ? 4
    : 5;

  const handlePersistBeforeKey = async (s3Key: string) => {
    await onUpdateEvidence(bounty.id, {
      beforeImageLabel: s3Key,
      beforeTimestamp: `Captured · ${new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })} IST`,
      beforeLocationLabel: `${bounty.delhiLocality}, Delhi`,
      beforeNote: beforeNoteInput,
    });
  };

  const handleCompleteCleanup = async () => {
    setIsBusy(true);
    try {
      await onUpdateEvidence(bounty.id, {
        cleanupCompleted: true,
        cleanupCompletedAt: `Completed · ${new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })} IST`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handlePersistAfterKey = async (s3Key: string) => {
    await onUpdateEvidence(bounty.id, {
      afterImageLabel: s3Key,
      afterTimestamp: `Captured · ${new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })} IST`,
      afterLocationLabel: `${bounty.delhiLocality}, Delhi`,
      afterNote: afterNoteInput,
    });
  };

  const handleConfirmLocation = async () => {
    setIsBusy(true);
    setGpsErrorMessage(null);
    try {
      const result = await captureBrowserGpsLocation();
      if (
        result.status === "CAPTURED" &&
        hasValidGpsCoordinates(result.latitude, result.longitude)
      ) {
        await onUpdateEvidence(bounty.id, {
          gpsCaptured: true,
          submittedLatitude: result.latitude,
          submittedLongitude: result.longitude,
          gpsAccuracyMeters: result.accuracyMeters,
          gpsStatus: "CAPTURED",
          gpsLabel: `${formatGpsCoordinates(
            result.latitude,
            result.longitude
          )}`,
          gpsStatusNote: "GPS confirmed via browser geolocation",
        });
      } else {
        setGpsErrorMessage(result.message);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleContinueWithoutGps = async () => {
    setIsBusy(true);
    try {
      await onUpdateEvidence(bounty.id, {
        gpsCaptured: true,
        submittedLatitude: null,
        submittedLongitude: null,
        gpsAccuracyMeters: null,
        gpsStatus: "UNAVAILABLE",
        gpsLabel: "Not available",
        gpsStatusNote: "GPS coordinates not available",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleClaimClick = async () => {
    setIsBusy(true);
    try {
      await onClaimBounty(bounty.id);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartClick = async () => {
    setIsBusy(true);
    try {
      await onStartTask(bounty.id);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitClick = async () => {
    setIsBusy(true);
    try {
      await onSubmitForVerification(bounty.id);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card className="border-primary/40 shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">
                {bounty.code}
              </span>
              <StatusBadge
                tone={
                  bounty.status === "VERIFIED"
                    ? "success"
                    : bounty.status === "REJECTED"
                    ? "danger"
                    : bounty.status === "SUBMITTED" ||
                      bounty.status === "UNDER_REVIEW"
                    ? "warning"
                    : "primary"
                }
                label={
                  bounty.status === "SUBMITTED" ||
                  bounty.status === "UNDER_REVIEW"
                    ? "Pending Review"
                    : bounty.status.replace("_", " ")
                }
              />
              <span className="rounded bg-secondary/15 border border-secondary/35 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                +{bounty.rewardArc} ARC
              </span>
            </div>

            <CardTitle className="text-base sm:text-lg">
              {bounty.title} — {bounty.delhiLocality}
            </CardTitle>
            <CardDescription>
              {bounty.corridorDetail} · Est. {bounty.estimatedWasteKgRange} ·
              Due:{" "}
              <strong className="text-warning">{bounty.deadlineLabel}</strong>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rejection Banner if operator rejected */}
        {bounty.status === "REJECTED" && (
          <div className="rounded-xl border border-danger/45 bg-danger/10 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-danger font-mono text-xs font-bold uppercase">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Action Needed —{" "}
                {bounty.rejectionReason?.replace("_", " ") ??
                  "Please Update Proof"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {bounty.rejectionDetail ??
                "Please update your after-cleanup photo and resubmit."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => void handleStartClick()}
            >
              Resubmit Evidence
            </Button>
          </div>
        )}

        {/* STATE 1: OPEN -> CLAIM BOUNTY */}
        {bounty.status === "OPEN" && (
          <div className="rounded-xl border border-border bg-surface-muted/55 p-4 space-y-4">
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
                Task Checklist
              </p>
              <ul className="space-y-1 text-xs text-foreground/90 list-disc pl-4">
                {bounty.taskInstructions.map((inst) => (
                  <li key={inst}>{inst}</li>
                ))}
              </ul>
            </div>

            <Button
              variant="default"
              size="lg"
              disabled={isBusy}
              className="w-full sm:w-auto font-mono font-semibold"
              onClick={() => void handleClaimClick()}
            >
              {isBusy
                ? "CLAIMING..."
                : `CLAIM BOUNTY (+${bounty.rewardArc} ARC)`}
            </Button>
          </div>
        )}

        {/* STATE 2: CLAIMED -> START TASK */}
        {bounty.status === "CLAIMED" && (
          <div className="rounded-xl border border-info/40 bg-info/10 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-info">
                  Claimed by {bounty.assignedWorkerName ?? workerName}
                </span>
                <h3 className="text-sm font-semibold text-foreground mt-0.5">
                  Ready to start cleanup at {bounty.corridorDetail}
                </h3>
              </div>
              <StatusBadge tone="info" label="Ready to Start" />
            </div>

            <Button
              variant="default"
              size="lg"
              disabled={isBusy}
              className="w-full sm:w-auto font-mono font-semibold"
              onClick={() => void handleStartClick()}
            >
              <Play className="h-4 w-4" />
              <span>{isBusy ? "STARTING..." : "START TASK"}</span>
            </Button>
          </div>
        )}

        {/* STATE 3: IN_PROGRESS -> STEP-BY-STEP WORKFLOW */}
        {bounty.status === "IN_PROGRESS" && (
          <div className="space-y-4">
            {/* Step Progress Indicator Bar */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {WORKFLOW_STEPS.map((s) => {
                const isDone = s.step < activeStep;
                const isCurrent = s.step === activeStep;
                return (
                  <div
                    key={s.step}
                    className={cn(
                      "rounded-lg border p-2 text-center transition-colors",
                      isDone
                        ? "border-success/40 bg-success/12 text-success"
                        : isCurrent
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-surface-muted/40 text-muted-foreground"
                    )}
                  >
                    <span className="text-xs font-semibold truncate block">
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Completed Steps Chips */}
            {(hasBefore || hasCleanup || hasAfter || hasGps) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {hasBefore && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
                    <CheckCircle2 className="h-3 w-3" /> Before photo uploaded
                  </span>
                )}
                {hasCleanup && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
                    <CheckCircle2 className="h-3 w-3" /> Work complete
                  </span>
                )}
                {hasAfter && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
                    <CheckCircle2 className="h-3 w-3" /> After photo uploaded
                  </span>
                )}
                {hasGps && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
                    <CheckCircle2 className="h-3 w-3" /> Location confirmed
                  </span>
                )}
              </div>
            )}

            {/* Step 1: Upload Before Photo */}
            <div className="space-y-2">
              <S3EvidenceUploader
                label="Step 1 · Before Photo"
                description={`Upload a clear photo of the blocked drainage inlet at ${bounty.corridorDetail}.`}
                existingS3Key={ev.beforeImageLabel}
                buildTargetKey={(ext) =>
                  buildBountyEvidenceKey(bounty.id, "before", ext)
                }
                onPersistKey={handlePersistBeforeKey}
                allowReplace
                accentTone="warning"
              />
              {!hasBefore && (
                <input
                  type="text"
                  value={beforeNoteInput}
                  onChange={(e) => setBeforeNoteInput(e.target.value)}
                  placeholder="Optional before note"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                />
              )}
            </div>

            {/* Step 2: Mark Work Complete */}
            {activeStep === 2 && (
              <div className="rounded-xl border border-warning/50 bg-warning/[0.07] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-warning" />
                  <h4 className="text-xs font-semibold uppercase font-mono text-foreground">
                    Step 2 · Complete Cleanup Work
                  </h4>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Clear {bounty.estimatedWasteKgRange} of drain waste at{" "}
                    {bounty.corridorDetail}.
                  </p>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleCompleteCleanup()}
                    className="shrink-0 gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isBusy ? "SAVING..." : "MARK WORK COMPLETE"}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Upload After Photo */}
            {(activeStep >= 3 || hasAfter) && (
              <div className="space-y-2">
                <S3EvidenceUploader
                  label="Step 3 · After Photo"
                  description="Upload an after photo from the same angle showing the cleared inlet."
                  existingS3Key={ev.afterImageLabel}
                  buildTargetKey={(ext) =>
                    buildBountyEvidenceKey(bounty.id, "after", ext)
                  }
                  onPersistKey={handlePersistAfterKey}
                  allowReplace
                  accentTone="success"
                />
                {!hasAfter && (
                  <input
                    type="text"
                    value={afterNoteInput}
                    onChange={(e) => setAfterNoteInput(e.target.value)}
                    placeholder="Optional after note"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                  />
                )}
              </div>
            )}

            {/* Step 4: Confirm Location */}
            {activeStep === 4 && (
              <div className="rounded-xl border border-primary/45 bg-surface-elevated/80 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-info" />
                  <h4 className="text-xs font-semibold uppercase font-mono text-foreground">
                    Step 4 · Capture Field GPS Location
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Allow browser geolocation access to record your exact GPS
                  latitude and longitude at {bounty.delhiLocality}, Delhi.
                </p>

                {gpsErrorMessage && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{gpsErrorMessage}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleConfirmLocation()}
                    className="shrink-0 gap-1.5"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>CAPTURING GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="h-3.5 w-3.5" />
                        <span>
                          {gpsErrorMessage
                            ? "RETRY GPS CAPTURE"
                            : "CAPTURE GPS LOCATION"}
                        </span>
                      </>
                    )}
                  </Button>

                  {gpsErrorMessage && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void handleContinueWithoutGps()}
                      className="shrink-0 gap-1.5"
                    >
                      <span>CONTINUE WITHOUT GPS (NOT AVAILABLE)</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Submit Evidence */}
            {activeStep === 5 && (
              <div className="rounded-xl border border-primary bg-primary/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-xs">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                      Recorded GPS Coordinates
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatGpsCoordinates(
                        ev.submittedLatitude,
                        ev.submittedLongitude
                      )}
                    </span>
                  </div>
                  {buildGoogleMapsUrl(
                    ev.submittedLatitude,
                    ev.submittedLongitude
                  ) ? (
                    <a
                      href={
                        buildGoogleMapsUrl(
                          ev.submittedLatitude,
                          ev.submittedLongitude
                        )!
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary hover:bg-primary/20"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Google Maps
                    </a>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Google Maps: Not available
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-mono text-xs font-bold uppercase text-foreground">
                      Step 5 · Submit Evidence
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submit your before/after photos and location proof for{" "}
                      <strong className="text-emerald-400">
                        +{bounty.rewardArc} ARC
                      </strong>
                      .
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    disabled={isBusy}
                    onClick={() => void handleSubmitClick()}
                    className="w-full sm:w-auto shrink-0 font-mono font-semibold gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    <span>{isBusy ? "SUBMITTING..." : "SUBMIT EVIDENCE"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATE 4: SUBMITTED / UNDER_REVIEW */}
        {(bounty.status === "SUBMITTED" ||
          bounty.status === "UNDER_REVIEW") && (
          <div className="space-y-3">
            <div className="rounded-xl border border-warning/40 bg-warning/[0.07] p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <h4 className="font-mono text-xs font-bold uppercase text-foreground">
                    Submitted for verification
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {aiCheckCompleted
                      ? "AI check: Completed"
                      : "AI check: Pending review"}
                  </span>
                  <StatusBadge tone="warning" label="Status: Pending Review" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your before photo, after photo, and GPS location have been
                submitted.{" "}
                <strong className="text-emerald-400">
                  +{bounty.rewardArc} ARC
                </strong>{" "}
                will be credited once the operator approves your cleanup.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <S3EvidenceImage
                s3Key={ev.beforeImageLabel}
                label="BEFORE PHOTO"
                timestamp={ev.beforeTimestamp}
                note={ev.beforeNote}
                tone="warning"
              />
              <S3EvidenceImage
                s3Key={ev.afterImageLabel}
                label="AFTER PHOTO"
                timestamp={ev.afterTimestamp}
                note={ev.afterNote}
                tone="success"
              />
            </div>
          </div>
        )}

        {/* STATE 5: VERIFIED */}
        {bounty.status === "VERIFIED" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-success/40 bg-success/[0.07] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <h4 className="font-mono text-xs font-bold uppercase text-foreground">
                    Cleanup Verified
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {aiCheckCompleted && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary" />
                      AI check: Completed
                    </span>
                  )}
                  <StatusBadge
                    tone="success"
                    label={`+${bounty.rewardArc} ARC Earned`}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your drain cleanup at {bounty.corridorDetail} was verified and{" "}
                <strong className="text-emerald-400">
                  +{bounty.rewardArc} ARC
                </strong>{" "}
                has been added to your balance.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <S3EvidenceImage
                s3Key={ev.beforeImageLabel}
                label="BEFORE PHOTO"
                timestamp={ev.beforeTimestamp}
                note={ev.beforeNote}
                tone="warning"
              />
              <S3EvidenceImage
                s3Key={ev.afterImageLabel}
                label="AFTER PHOTO"
                timestamp={ev.afterTimestamp}
                note={ev.afterNote}
                tone="success"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
