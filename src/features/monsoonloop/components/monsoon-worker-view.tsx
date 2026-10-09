"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  HardHat,
  MapPin,
  Navigation,
  Play,
  Send,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  type OperationalTone,
} from "@/components/shared/status-badge";
import {
  S3EvidenceImage,
  S3EvidenceUploader,
} from "@/components/shared/s3-evidence-media";
import {
  buildTaskEvidenceKey,
  isRealS3EvidenceKey,
} from "@/lib/storage-client";
import type {
  ActionPriority,
  MissionAssignment,
  MonsoonMissionStatus,
} from "@/types";
import { cn } from "@/lib/utils";

interface MonsoonWorkerViewProps {
  missions: MissionAssignment[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  onUpdateMissionStatus: (
    missionId: string,
    nextStatus: MonsoonMissionStatus
  ) => void;
}

interface WorkerFieldProof {
  beforePhotoCaptured: boolean;
  beforeFileName?: string;
  workCompleted: boolean;
  afterPhotoCaptured: boolean;
  afterFileName?: string;
  locationConfirmed: boolean;
}

const statusTone: Record<
  MonsoonMissionStatus,
  { tone: OperationalTone; label: string }
> = {
  PENDING: { tone: "neutral", label: "Pending Dispatch" },
  ASSIGNED: { tone: "info", label: "Assigned" },
  IN_PROGRESS: { tone: "primary", label: "In Progress" },
  SUBMITTED: { tone: "warning", label: "Submitted" },
  VERIFIED: { tone: "success", label: "Verified" },
  FAILED: { tone: "danger", label: "Needs Rework" },
};

const priorityColors: Record<ActionPriority, string> = {
  CRITICAL: "border-danger/45 bg-danger/15 text-danger",
  HIGH: "border-warning/45 bg-warning/15 text-warning",
  MEDIUM: "border-info/45 bg-info/15 text-info",
  LOW: "border-success/45 bg-success/15 text-success",
};

type WorkerTaskFilter = "ALL_ACTIVE" | "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "PENDING";

export function MonsoonWorkerView({
  missions,
  onSelectMission,
  onUpdateMissionStatus,
}: MonsoonWorkerViewProps) {
  const [modalTaskId, setModalTaskId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    React.useState<WorkerTaskFilter>("ALL_ACTIVE");
  const [proofByTask, setProofByTask] = React.useState<
    Record<string, WorkerFieldProof>
  >({});

  // Separate dispatched/active crew tasks from PENDING (not yet dispatched by Operator)
  const dispatchedMissions = React.useMemo(
    () => missions.filter((m) => m.status !== "PENDING"),
    [missions]
  );

  const counts = React.useMemo(() => {
    const assigned = missions.filter((m) => m.status === "ASSIGNED").length;
    const inProgress = missions.filter((m) => m.status === "IN_PROGRESS").length;
    const submitted = missions.filter(
      (m) => m.status === "SUBMITTED" || m.status === "VERIFIED"
    ).length;
    const pending = missions.filter((m) => m.status === "PENDING").length;
    return {
      assigned,
      inProgress,
      submitted,
      pending,
      totalDispatched: dispatchedMissions.length,
    };
  }, [missions, dispatchedMissions.length]);

  const visibleMissions = React.useMemo(() => {
    if (statusFilter === "ASSIGNED") {
      return missions.filter((m) => m.status === "ASSIGNED");
    }
    if (statusFilter === "IN_PROGRESS") {
      return missions.filter((m) => m.status === "IN_PROGRESS");
    }
    if (statusFilter === "SUBMITTED") {
      return missions.filter(
        (m) => m.status === "SUBMITTED" || m.status === "VERIFIED"
      );
    }
    if (statusFilter === "PENDING") {
      return missions.filter((m) => m.status === "PENDING");
    }
    return dispatchedMissions;
  }, [missions, dispatchedMissions, statusFilter]);

  const modalTask = missions.find((m) => m.id === modalTaskId) ?? null;

  const getTaskProof = (task: MissionAssignment): WorkerFieldProof => {
    const isAlreadyDone =
      task.status === "SUBMITTED" || task.status === "VERIFIED";
    return (
      proofByTask[task.id] ?? {
        beforePhotoCaptured: isAlreadyDone,
        workCompleted: isAlreadyDone,
        afterPhotoCaptured: isAlreadyDone,
        locationConfirmed: isAlreadyDone,
      }
    );
  };

  const updateProof = (taskId: string, patch: Partial<WorkerFieldProof>) => {
    const task = missions.find((m) => m.id === taskId);
    if (!task) return;
    const current = getTaskProof(task);
    setProofByTask((prev) => ({
      ...prev,
      [taskId]: {
        ...current,
        ...patch,
      },
    }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Operational Header */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
          Assigned Pre-Storm Tasks
        </h2>
        <p className="text-xs text-muted-foreground">
          Start assigned drain clearance and sluice tasks and upload before/after
          field photos for operator verification.
        </p>
      </div>

      {/* Status Summary & Filter Bar */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL_ACTIVE")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            statusFilter === "ALL_ACTIVE"
              ? "border-primary bg-primary/12 text-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="block text-[11px] font-medium uppercase">
            All Assigned
          </span>
          <span className="mt-0.5 block font-mono text-lg font-bold text-foreground">
            {counts.totalDispatched}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("ASSIGNED")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            statusFilter === "ASSIGNED"
              ? "border-info bg-info/15 text-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="block text-[11px] font-medium uppercase text-info">
            Assigned
          </span>
          <span className="mt-0.5 block font-mono text-lg font-bold text-foreground">
            {counts.assigned}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("IN_PROGRESS")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            statusFilter === "IN_PROGRESS"
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="block text-[11px] font-medium uppercase text-primary">
            In Progress
          </span>
          <span className="mt-0.5 block font-mono text-lg font-bold text-foreground">
            {counts.inProgress}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("SUBMITTED")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            statusFilter === "SUBMITTED"
              ? "border-success bg-success/15 text-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="block text-[11px] font-medium uppercase text-emerald-400">
            Submitted
          </span>
          <span className="mt-0.5 block font-mono text-lg font-bold text-foreground">
            {counts.submitted}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PENDING")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            statusFilter === "PENDING"
              ? "border-warning bg-warning/15 text-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="block text-[11px] font-medium uppercase text-warning">
            Pending Dispatch
          </span>
          <span className="mt-0.5 block font-mono text-lg font-bold text-foreground">
            {counts.pending}
          </span>
        </button>
      </div>

      {/* Task Cards List */}
      {visibleMissions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No tasks match the selected status filter.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleMissions.map((task) => {
          const s = statusTone[task.status];
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                onSelectMission(task.id);
                setModalTaskId(task.id);
              }}
              className="rounded-xl border border-border bg-surface p-4 text-left transition-all hover:border-primary/60 hover:bg-surface-elevated space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {task.missionCode}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                      priorityColors[task.priority]
                    )}
                  >
                    {task.priority}
                  </span>
                </div>
                <StatusBadge tone={s.tone} label={s.label} />
              </div>

              <p className="text-sm font-semibold text-foreground">
                {task.actionTitle}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t border-border-subtle">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  {task.location}
                </span>
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Users className="h-3.5 w-3.5 text-info shrink-0" />
                  {task.assignedTeam}
                </span>
                <span className="inline-flex items-center gap-1.5 truncate">
                  <HardHat className="h-3.5 w-3.5 text-secondary shrink-0" />
                  {task.assignedWorkerId || "Crew member"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-warning truncate">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {task.deadline}
                </span>
              </div>
            </button>
          );
        })}
        </div>
      )}

      {/* Task Execution Modal / Drawer */}
      {modalTask && (
        <WorkerTaskModal
          task={modalTask}
          proof={getTaskProof(modalTask)}
          onClose={() => setModalTaskId(null)}
          onStartTask={() => onUpdateMissionStatus(modalTask.id, "IN_PROGRESS")}
          onUpdateProof={(patch) => updateProof(modalTask.id, patch)}
          onSubmitEvidence={() =>
            onUpdateMissionStatus(modalTask.id, "SUBMITTED")
          }
        />
      )}
    </div>
  );
}

interface WorkerTaskModalProps {
  task: MissionAssignment;
  proof: WorkerFieldProof;
  onClose: () => void;
  onStartTask: () => void;
  onUpdateProof: (patch: Partial<WorkerFieldProof>) => void;
  onSubmitEvidence: () => void;
}

function WorkerTaskModal({
  task,
  proof,
  onClose,
  onStartTask,
  onUpdateProof,
  onSubmitEvidence,
}: WorkerTaskModalProps) {
  const badge = statusTone[task.status];
  const isStarted =
    task.status === "IN_PROGRESS" ||
    task.status === "SUBMITTED" ||
    task.status === "VERIFIED";

  let currentStep:
    | "START"
    | "BEFORE_PHOTO"
    | "WORK_COMPLETE"
    | "AFTER_PHOTO"
    | "CONFIRM_LOCATION"
    | "SUBMIT"
    | "SUBMITTED"
    | "VERIFIED" = "START";

  if (task.status === "VERIFIED") {
    currentStep = "VERIFIED";
  } else if (task.status === "SUBMITTED") {
    currentStep = "SUBMITTED";
  } else if (!isStarted) {
    currentStep = "START";
  } else if (!proof.beforePhotoCaptured) {
    currentStep = "BEFORE_PHOTO";
  } else if (!proof.workCompleted) {
    currentStep = "WORK_COMPLETE";
  } else if (!proof.afterPhotoCaptured) {
    currentStep = "AFTER_PHOTO";
  } else if (!proof.locationConfirmed) {
    currentStep = "CONFIRM_LOCATION";
  } else {
    currentStep = "SUBMIT";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-primary/40 bg-surface p-5 sm:p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                {task.missionCode}
              </span>
              <StatusBadge tone={badge.tone} label={badge.label} />
            </div>
            <h3 className="text-lg font-bold text-foreground pt-1">
              {task.actionTitle}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-muted p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Close task modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Location, Team & Deadline */}
        <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-border bg-surface-muted/50 p-3 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Location
              </span>
              <span className="font-semibold text-foreground truncate block">
                {task.location}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-info shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Crew
              </span>
              <span className="font-semibold text-foreground truncate block">
                {task.assignedTeam}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Deadline
              </span>
              <span className="font-semibold text-foreground truncate block">
                {task.deadline}
              </span>
            </div>
          </div>
        </div>

        {/* Completed Steps Summary Strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isStarted && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> Started
            </span>
          )}
          {proof.beforePhotoCaptured && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> Before photo
            </span>
          )}
          {proof.workCompleted && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> Work complete
            </span>
          )}
          {proof.afterPhotoCaptured && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> After photo
            </span>
          )}
          {proof.locationConfirmed && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/35 bg-success/10 px-2 py-1 font-mono text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> Location confirmed
            </span>
          )}
        </div>

        {/* Single Active Step Area */}
        <div className="rounded-xl border border-primary/35 bg-surface-muted/40 p-4 space-y-3">
          {currentStep === "START" && (
            <>
              <div className="space-y-1">
                <span className="font-mono text-xs font-bold uppercase text-primary">
                  Step 1 · Start Task
                </span>
                <p className="text-xs text-muted-foreground">
                  Confirm arrival at {task.location} to begin field work.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={onStartTask}
                className="w-full gap-1.5"
              >
                <Play className="h-4 w-4" />
                <span>START TASK</span>
              </Button>
            </>
          )}

          {currentStep === "BEFORE_PHOTO" && (
            <S3EvidenceUploader
              label="Step 2 · Before Photo"
              description="Upload a photo of the drain or water asset before starting work."
              existingS3Key={proof.beforeFileName}
              buildTargetKey={(ext) =>
                buildTaskEvidenceKey(task.id, "before", ext)
              }
              onPersistKey={async (s3Key) => {
                onUpdateProof({
                  beforePhotoCaptured: true,
                  beforeFileName: s3Key,
                });
              }}
              accentTone="warning"
            />
          )}

          {currentStep === "WORK_COMPLETE" && (
            <>
              <div className="space-y-1">
                <span className="font-mono text-xs font-bold uppercase text-primary">
                  Step 3 · Complete Field Work
                </span>
                <p className="text-xs text-muted-foreground">
                  Complete{" "}
                  <strong className="text-foreground">
                    {task.actionTitle}
                  </strong>{" "}
                  at {task.location}.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={() => onUpdateProof({ workCompleted: true })}
                className="w-full gap-1.5"
              >
                <Wrench className="h-4 w-4" />
                <span>MARK WORK COMPLETE</span>
              </Button>
            </>
          )}

          {currentStep === "AFTER_PHOTO" && (
            <S3EvidenceUploader
              label="Step 4 · After Photo"
              description="Upload a clear photo showing the completed field work."
              existingS3Key={proof.afterFileName}
              buildTargetKey={(ext) =>
                buildTaskEvidenceKey(task.id, "after", ext)
              }
              onPersistKey={async (s3Key) => {
                onUpdateProof({
                  afterPhotoCaptured: true,
                  afterFileName: s3Key,
                });
              }}
              accentTone="success"
            />
          )}

          {currentStep === "CONFIRM_LOCATION" && (
            <>
              <div className="space-y-1">
                <span className="font-mono text-xs font-bold uppercase text-primary">
                  Step 5 · Confirm GPS Location
                </span>
                <p className="text-xs text-muted-foreground">
                  {task.location} ({task.coordinates.lat.toFixed(4)}° N,{" "}
                  {task.coordinates.lng.toFixed(4)}° E)
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={() => onUpdateProof({ locationConfirmed: true })}
                className="w-full gap-1.5"
              >
                <Navigation className="h-4 w-4" />
                <span>CONFIRM LOCATION</span>
              </Button>
            </>
          )}

          {currentStep === "SUBMIT" && (
            <>
              <div className="space-y-1">
                <span className="font-mono text-xs font-bold uppercase text-emerald-400">
                  Step 6 · Submit Evidence
                </span>
                <p className="text-xs text-muted-foreground">
                  Before/after photos and location are ready for operator
                  verification.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={onSubmitEvidence}
                className="w-full gap-1.5"
              >
                <Send className="h-4 w-4" />
                <span>SUBMIT EVIDENCE</span>
              </Button>
            </>
          )}

          {currentStep === "SUBMITTED" && (
            <div className="space-y-3 py-2">
              <div className="text-center space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning/45 bg-warning/15 px-3 py-1.5 font-mono text-xs font-semibold text-warning">
                  Submitted for verification · Verification pending
                </span>
                <p className="text-xs text-muted-foreground">
                  Your before/after photos and location proof are waiting for
                  operator review.
                </p>
              </div>
              {(isRealS3EvidenceKey(proof.beforeFileName) ||
                isRealS3EvidenceKey(proof.afterFileName)) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {isRealS3EvidenceKey(proof.beforeFileName) && (
                    <S3EvidenceImage
                      s3Key={proof.beforeFileName}
                      label="BEFORE PHOTO"
                      tone="warning"
                    />
                  )}
                  {isRealS3EvidenceKey(proof.afterFileName) && (
                    <S3EvidenceImage
                      s3Key={proof.afterFileName}
                      label="AFTER PHOTO"
                      tone="success"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === "VERIFIED" && (
            <div className="space-y-2 text-center py-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/45 bg-success/15 px-3 py-1.5 font-mono text-xs font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Verified complete
              </span>
              <p className="text-xs text-muted-foreground">
                Approved by operator.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Back to Assigned Tasks
          </Button>
        </div>
      </div>
    </div>
  );
}
