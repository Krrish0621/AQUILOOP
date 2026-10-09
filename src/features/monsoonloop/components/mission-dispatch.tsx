"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  HardHat,
  MapPin,
  Play,
  PlusCircle,
  RotateCcw,
  Send,
  Target,
  Users,
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
import {
  StatusBadge,
  type OperationalTone,
} from "@/components/shared/status-badge";
import { getShortZoneLocality } from "@/features/monsoonloop/components/zone-selector";
import type {
  ActionPriority,
  MissionAssignment,
  MonsoonMissionStatus,
  ResilienceZone,
} from "@/types";
import { cn } from "@/lib/utils";

interface MissionDispatchProps {
  zone: ResilienceZone;
  missions: MissionAssignment[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  onOpenDispatchModal: () => void;
  onOpenDispatchForExistingTask: (mission: MissionAssignment) => void;
  onOpenManualCreateModal: () => void;
  onUpdateMissionStatus: (
    missionId: string,
    nextStatus: MonsoonMissionStatus
  ) => void;
}

type LifecycleFilter =
  | "ALL"
  | "DISPATCHABLE"
  | "ACTIVE"
  | "VERIFICATION"
  | "COMPLETED";

const statusMeta: Record<
  MonsoonMissionStatus,
  { tone: OperationalTone; label: string; summary: string }
> = {
  PENDING: {
    tone: "warning",
    label: "PENDING · READY TO DISPATCH",
    summary: "Unassigned pre-storm task — ready for crew dispatch",
  },
  ASSIGNED: {
    tone: "info",
    label: "ASSIGNED TO CREW",
    summary: "Already dispatched to municipal crew — awaiting field start",
  },
  IN_PROGRESS: {
    tone: "primary",
    label: "IN PROGRESS · ACTIVE EXECUTION",
    summary: "Active execution in field — crew deployed on site",
  },
  SUBMITTED: {
    tone: "warning",
    label: "SUBMITTED · AWAITING VERIFICATION",
    summary: "Field work submitted by crew — awaiting operator approval",
  },
  VERIFIED: {
    tone: "success",
    label: "VERIFIED · COMPLETED",
    summary: "Pre-storm readiness action verified complete",
  },
  FAILED: {
    tone: "danger",
    label: "FAILED · NEEDS REWORK",
    summary: "Rework required — re-dispatch crew or return to field",
  },
};

const priorityColors: Record<ActionPriority, string> = {
  CRITICAL: "border-danger/45 bg-danger/15 text-danger",
  HIGH: "border-warning/45 bg-warning/15 text-warning",
  MEDIUM: "border-info/45 bg-info/15 text-info",
  LOW: "border-success/45 bg-success/15 text-success",
};

const statusSortOrder: Record<MonsoonMissionStatus, number> = {
  PENDING: 0,
  FAILED: 1,
  SUBMITTED: 2,
  ASSIGNED: 3,
  IN_PROGRESS: 4,
  VERIFIED: 5,
};

export function MissionDispatch({
  zone,
  missions,
  selectedMissionId,
  onSelectMission,
  onOpenDispatchModal,
  onOpenDispatchForExistingTask,
  onOpenManualCreateModal,
  onUpdateMissionStatus,
}: MissionDispatchProps) {
  const [showAllZones, setShowAllZones] = React.useState(true);
  const [lifecycleFilter, setLifecycleFilter] =
    React.useState<LifecycleFilter>("ALL");
  const shortZoneName = getShortZoneLocality(zone.name);

  const zoneScopedMissions = React.useMemo(
    () =>
      showAllZones
        ? missions
        : missions.filter((m) => m.zoneId === zone.id),
    [missions, showAllZones, zone.id]
  );

  const counts = React.useMemo(() => {
    const dispatchable = zoneScopedMissions.filter(
      (m) => m.status === "PENDING" || m.status === "FAILED"
    ).length;
    const active = zoneScopedMissions.filter(
      (m) => m.status === "ASSIGNED" || m.status === "IN_PROGRESS"
    ).length;
    const verification = zoneScopedMissions.filter(
      (m) => m.status === "SUBMITTED"
    ).length;
    const completed = zoneScopedMissions.filter(
      (m) => m.status === "VERIFIED"
    ).length;
    return {
      all: zoneScopedMissions.length,
      dispatchable,
      active,
      verification,
      completed,
    };
  }, [zoneScopedMissions]);

  const displayedMissions = React.useMemo(() => {
    const filtered = zoneScopedMissions.filter((m) => {
      if (lifecycleFilter === "DISPATCHABLE") {
        return m.status === "PENDING" || m.status === "FAILED";
      }
      if (lifecycleFilter === "ACTIVE") {
        return m.status === "ASSIGNED" || m.status === "IN_PROGRESS";
      }
      if (lifecycleFilter === "VERIFICATION") {
        return m.status === "SUBMITTED";
      }
      if (lifecycleFilter === "COMPLETED") {
        return m.status === "VERIFIED";
      }
      return true;
    });

    return [...filtered].sort(
      (a, b) => statusSortOrder[a.status] - statusSortOrder[b.status]
    );
  }, [zoneScopedMissions, lifecycleFilter]);

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-base sm:text-lg">
                Municipal Crew Dispatch &amp; Task Lifecycle
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Dispatch pending pre-storm readiness tasks to municipal crews,
              track active execution, and verify completed field operations.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAllZones((prev) => !prev)}
              className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllZones
                ? `Showing: All NCR Zones (${missions.length})`
                : `Showing: ${shortZoneName} Only (${zoneScopedMissions.length})`}
            </button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenManualCreateModal}
              className="gap-1.5"
            >
              <PlusCircle className="h-3.5 w-3.5 text-primary" />
              <span>NEW TASK</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onOpenDispatchModal}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>DISPATCH RECOMMENDED ACTION</span>
            </Button>
          </div>
        </div>

        {/* Lifecycle Stage Separation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          {(
            [
              {
                id: "ALL" as const,
                label: `All Tasks (${counts.all})`,
              },
              {
                id: "DISPATCHABLE" as const,
                label: `Ready to Dispatch / Rework (${counts.dispatchable})`,
              },
              {
                id: "ACTIVE" as const,
                label: `Assigned & In Progress (${counts.active})`,
              },
              {
                id: "VERIFICATION" as const,
                label: `Awaiting Verification (${counts.verification})`,
              },
              {
                id: "COMPLETED" as const,
                label: `Verified Complete (${counts.completed})`,
              },
            ] as const
          ).map((tab) => {
            const active = lifecycleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLifecycleFilter(tab.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/15 text-primary font-semibold"
                    : "border-border bg-surface-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5">
        {displayedMissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              No tasks match this filter
            </p>
            <p className="text-xs text-muted-foreground">
              Switch filters above, select All NCR Zones, or create/dispatch a
              new pre-storm task.
            </p>
          </div>
        ) : (
          displayedMissions.map((msn) => {
            const sMeta = statusMeta[msn.status];
            const isSelected = msn.id === selectedMissionId;

            return (
              <div
                key={msn.id}
                onClick={() => onSelectMission(msn.id)}
                className={cn(
                  "rounded-xl border p-4 transition-all cursor-pointer space-y-3",
                  isSelected
                    ? "border-primary bg-surface-elevated shadow-sm"
                    : "border-border bg-surface-muted/45 hover:border-border-strong"
                )}
              >
                {/* Top Row: Code + Priority + Zone + Lifecycle Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-bold text-primary border border-border">
                      {msn.missionCode}
                    </span>
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                        priorityColors[msn.priority]
                      )}
                    >
                      PRIORITY: {msn.priority}
                    </span>
                    <span className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {msn.zoneCode}
                    </span>
                  </div>

                  <StatusBadge
                    tone={sMeta.tone}
                    pulse={
                      msn.status === "PENDING" ||
                      msn.status === "IN_PROGRESS" ||
                      msn.status === "SUBMITTED"
                    }
                    label={sMeta.label}
                  />
                </div>

                {/* Task Title & Lifecycle Context */}
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-semibold text-foreground">
                    {msn.actionTitle}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {sMeta.summary} · {msn.createdAtLabel}
                  </p>
                </div>

                {/* Required Structured Metadata Grid: Location, Priority, Assigned Team, Assigned Worker, Deadline */}
                <div className="grid grid-cols-1 gap-2 rounded-lg border border-border-subtle bg-background/60 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                        Location
                      </span>
                      <span className="font-medium text-foreground">
                        {msn.location}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Users className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                        Assigned Team
                      </span>
                      <span className="font-medium text-foreground">
                        {msn.status === "PENDING"
                          ? `${msn.assignedTeam} (Suggested)`
                          : msn.assignedTeam}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <HardHat className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                        Assigned Worker
                      </span>
                      <span className="font-medium text-foreground">
                        {msn.assignedWorkerId
                          ? msn.assignedWorkerId
                          : msn.status === "PENDING"
                          ? "Awaiting dispatch"
                          : "Crew-level assignment"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                        Target Deadline
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {msn.deadline}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status-Specific Action Bar (Never mix dispatchable with already assigned/active) */}
                <div
                  className="pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {msn.status === "PENDING" && (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <Send className="h-4 w-4 text-warning shrink-0" />
                        <span>
                          <strong>Ready to Dispatch:</strong> Confirm crew,
                          worker assignment, and deadline to dispatch this task.
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => onOpenDispatchForExistingTask(msn)}
                        className="gap-1.5 shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Dispatch Task</span>
                      </Button>
                    </div>
                  )}

                  {msn.status === "ASSIGNED" && (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-info/35 bg-info/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-info shrink-0" />
                        <span>
                          <strong>Already Assigned:</strong> Dispatched to{" "}
                          <span className="font-semibold">
                            {msn.assignedTeam}
                          </span>
                          {msn.assignedWorkerId
                            ? ` (${msn.assignedWorkerId})`
                            : ""}
                          . Awaiting crew field start.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            onUpdateMissionStatus(msn.id, "IN_PROGRESS")
                          }
                          className="gap-1.5"
                        >
                          <Play className="h-3.5 w-3.5 text-primary" />
                          <span>Mark In Progress</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenDispatchForExistingTask(msn)}
                        >
                          Reassign Crew
                        </Button>
                      </div>
                    </div>
                  )}

                  {msn.status === "IN_PROGRESS" && (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-primary/35 bg-primary/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <HardHat className="h-4 w-4 text-primary shrink-0" />
                        <span>
                          <strong>Active Field Execution:</strong>{" "}
                          {msn.assignedTeam}
                          {msn.assignedWorkerId
                            ? ` (${msn.assignedWorkerId})`
                            : ""}{" "}
                          is actively executing this task on site.
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                        Active in Field · Awaiting Completion Proof
                      </span>
                    </div>
                  )}

                  {msn.status === "SUBMITTED" && (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <Camera className="h-4 w-4 text-warning shrink-0" />
                        <span>
                          <strong>Awaiting Verification:</strong> Before/after
                          field photos and location proof submitted by{" "}
                          {msn.assignedWorkerId || msn.assignedTeam}.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() =>
                            onUpdateMissionStatus(msn.id, "VERIFIED")
                          }
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Approve &amp; Verify</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            onUpdateMissionStatus(msn.id, "FAILED")
                          }
                          className="gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5 text-danger" />
                          <span>Needs Rework</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {msn.status === "FAILED" && (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                        <span>
                          <strong>Needs Rework:</strong> Field task requires
                          follow-up clearance or updated completion proof.
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => onOpenDispatchForExistingTask(msn)}
                        className="gap-1.5 shrink-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Re-Dispatch Crew</span>
                      </Button>
                    </div>
                  )}

                  {msn.status === "VERIFIED" && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-xs text-success">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Completed &amp; verified by operator · Pre-storm
                        readiness confirmed
                      </span>
                      <span className="font-mono text-[11px]">
                        {(msn.expectedImpactLiters / 1000).toFixed(0)} kL
                        runoff capacity protected
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
