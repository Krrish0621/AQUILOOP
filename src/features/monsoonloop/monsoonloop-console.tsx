"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  HardHat,
  PlusCircle,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { RainPulse } from "@/features/monsoonloop/components/rain-pulse";
import {
  getShortZoneLocality,
  ZoneSelector,
} from "@/features/monsoonloop/components/zone-selector";
import { RiskPanel } from "@/features/monsoonloop/components/risk-panel";
import { SpongeMap } from "@/features/monsoonloop/components/sponge-map";
import { ActionPlan } from "@/features/monsoonloop/components/action-plan";
import { MissionDispatch } from "@/features/monsoonloop/components/mission-dispatch";
import { MonsoonWorkerView } from "@/features/monsoonloop/components/monsoon-worker-view";
import {
  MONSOONLOOP_FIELD_TEAMS,
  MONSOONLOOP_SPONGE_ASSETS,
  MONSOONLOOP_ZONES,
} from "@/features/monsoonloop/data/mock-monsoonloop";
import { evaluateZoneFloodRisk } from "@/features/monsoonloop/lib/risk-engine";
import { generateZoneActionPlan } from "@/features/monsoonloop/lib/action-planner";
import { getDefaultSimulationInputs } from "@/features/monsoonloop/lib/simulator";
import type {
  ActionPriority,
  ActionRecommendation,
  MissionAssignment,
  MonsoonMissionStatus,
  MonsoonPhase,
  SpongeMapAsset,
  ZoneWeatherSummary,
} from "@/types";
import { RoleAccessNotice } from "@/components/auth/role-access-notice";
import { useCurrentRole } from "@/lib/auth-context";
import {
  assertNoDataErrors,
  fetchWeatherForecastsByLocation,
  formatDataError,
  getDataClient,
  mapTaskRecordToMission,
  mapUiTaskTypeToEnum,
  summarizeLocationWeather,
  triggerOperatorWeatherRefresh,
} from "@/lib/data-client";

interface DispatchModalDraft {
  mode: "DISPATCH" | "CREATE";
  existingTaskId?: string;
  missionCode?: string;
  sourceActionId?: string;
  actionTitle: string;
  taskType: string;
  location: string;
  priority: ActionPriority;
  assignedTeam: string;
  assignedWorkerId?: string;
  deadline: string;
  notes?: string;
  targetStatus: "PENDING" | "ASSIGNED";
  expectedImpactLiters: number;
}

const TASK_TYPES = [
  "Drain Clearance",
  "Recharge Asset Inspection",
  "Sluice / Diversion Control",
  "Micro-Recharge Trench",
];

const WORKER_ASSIGNMENT_OPTIONS = [
  {
    value: "",
    label: "Crew-level assignment (No specific individual assigned)",
  },
  {
    value: "worker.demo@aquiloop.test",
    label: "Rajesh Kumar (worker.demo@aquiloop.test · Field Responder)",
  },
];

export function MonsoonLoopConsole() {
  const { role, user } = useCurrentRole();
  const activeRole = role === "OPERATOR" ? "OPERATOR" : "WORKER";

  // Selected Resilience Zone (defaults to Zone 03: Mayapuri)
  const [selectedZoneId, setSelectedZoneId] =
    React.useState<string>("zone-03");

  const selectedStage: MonsoonPhase = "URGENT_6H";

  const selectedZone = React.useMemo(
    () =>
      MONSOONLOOP_ZONES.find((z) => z.id === selectedZoneId) ??
      MONSOONLOOP_ZONES[0],
    [selectedZoneId]
  );

  const simInputs = React.useMemo(
    () => getDefaultSimulationInputs(selectedZone),
    [selectedZone]
  );

  // Real AWS AppSync / DynamoDB Field Tasks State
  const [missions, setMissions] = React.useState<MissionAssignment[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = React.useState<boolean>(true);
  const [tasksError, setTasksError] = React.useState<string | null>(null);

  // Real AWS DynamoDB WeatherForecast State (Open-Meteo -> Lambda -> DynamoDB)
  const [weatherByLocation, setWeatherByLocation] = React.useState<
    Record<string, ZoneWeatherSummary>
  >({});
  const [isLoadingWeather, setIsLoadingWeather] = React.useState<boolean>(true);
  const [isRefreshingWeather, setIsRefreshingWeather] =
    React.useState<boolean>(false);
  const [weatherRefreshError, setWeatherRefreshError] = React.useState<
    string | null
  >(null);

  // Selected Map Asset & Task State
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(
    "ast-drain-17"
  );
  const [selectedMissionId, setSelectedMissionId] = React.useState<
    string | null
  >(null);

  const loadTasks = React.useCallback(async () => {
    if (role !== "OPERATOR" && role !== "WORKER") return;
    setIsLoadingTasks(true);
    setTasksError(null);
    try {
      const client = getDataClient();
      const { data, errors } = await client.models.Task.list({ limit: 100 });
      assertNoDataErrors(errors, "Unable to load tasks");

      const sorted = [...(data ?? [])].sort((a, b) => {
        const tA = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tB = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tB - tA;
      });
      const mapped = sorted.map((record, index) =>
        mapTaskRecordToMission(record, index)
      );
      setMissions(mapped);
      setSelectedMissionId((prev) =>
        prev && mapped.some((m) => m.id === prev)
          ? prev
          : mapped[0]?.id ?? null
      );
    } catch (err) {
      setTasksError(formatDataError(err, "Unable to load tasks"));
    } finally {
      setIsLoadingTasks(false);
    }
  }, [role]);

  const loadWeatherForecasts = React.useCallback(async () => {
    if (role !== "OPERATOR" && role !== "WORKER") return;
    setIsLoadingWeather(true);
    try {
      const results = await Promise.all(
        MONSOONLOOP_ZONES.map(async (zone) => {
          const locationKey =
            zone.locationKey || getShortZoneLocality(zone.name);
          const points = await fetchWeatherForecastsByLocation(locationKey);
          return {
            locationKey,
            summary: summarizeLocationWeather(locationKey, zone.name, points),
            count: points.length,
          };
        })
      );

      const totalLoaded = results.reduce((acc, r) => acc + r.count, 0);

      if (totalLoaded === 0 && role === "OPERATOR") {
        setIsRefreshingWeather(true);
        try {
          await triggerOperatorWeatherRefresh("ALL");
          const refreshedResults = await Promise.all(
            MONSOONLOOP_ZONES.map(async (zone) => {
              const locationKey =
                zone.locationKey || getShortZoneLocality(zone.name);
              const points = await fetchWeatherForecastsByLocation(locationKey);
              return {
                locationKey,
                summary: summarizeLocationWeather(
                  locationKey,
                  zone.name,
                  points
                ),
              };
            })
          );
          const nextMap: Record<string, ZoneWeatherSummary> = {};
          for (const item of refreshedResults) {
            nextMap[item.locationKey] = item.summary;
          }
          setWeatherByLocation(nextMap);
          setWeatherRefreshError(null);
          return;
        } catch {
          setWeatherRefreshError(
            "Showing last saved forecast. Live refresh failed."
          );
        } finally {
          setIsRefreshingWeather(false);
        }
      }

      const nextMap: Record<string, ZoneWeatherSummary> = {};
      for (const item of results) {
        nextMap[item.locationKey] = item.summary;
      }
      setWeatherByLocation(nextMap);
    } catch {
      // Keep last stored forecast in state if query fails
    } finally {
      setIsLoadingWeather(false);
    }
  }, [role]);

  const handleRefreshWeatherForecast = React.useCallback(async () => {
    if (role !== "OPERATOR") return;
    setIsRefreshingWeather(true);
    setWeatherRefreshError(null);
    try {
      await triggerOperatorWeatherRefresh("ALL");
      const refreshedResults = await Promise.all(
        MONSOONLOOP_ZONES.map(async (zone) => {
          const locationKey =
            zone.locationKey || getShortZoneLocality(zone.name);
          const points = await fetchWeatherForecastsByLocation(locationKey);
          return {
            locationKey,
            summary: summarizeLocationWeather(locationKey, zone.name, points),
          };
        })
      );
      const nextMap: Record<string, ZoneWeatherSummary> = {};
      for (const item of refreshedResults) {
        nextMap[item.locationKey] = item.summary;
      }
      setWeatherByLocation(nextMap);
      setDispatchBannerMessage("Weather forecast updated from Open-Meteo.");
    } catch {
      setWeatherRefreshError(
        "Showing last saved forecast. Live refresh failed."
      );
    } finally {
      setIsRefreshingWeather(false);
    }
  }, [role]);

  React.useEffect(() => {
    void loadTasks();
    void loadWeatherForecasts();
  }, [loadTasks, loadWeatherForecasts]);

  const handleSelectZone = (nextZoneId: string) => {
    setSelectedZoneId(nextZoneId);
    const firstZoneAsset = MONSOONLOOP_SPONGE_ASSETS.find(
      (a) => a.zoneId === nextZoneId
    );
    setSelectedAssetId(firstZoneAsset?.id ?? null);
    const firstZoneMission = missions.find((m) => m.zoneId === nextZoneId);
    if (firstZoneMission) {
      setSelectedMissionId(firstZoneMission.id);
    }
  };

  // Dispatch / Create Task Modal State & Confirmation Banner
  const [dispatchModalDraft, setDispatchModalDraft] =
    React.useState<DispatchModalDraft | null>(null);
  const [dispatchBannerMessage, setDispatchBannerMessage] = React.useState<
    string | null
  >(null);

  const shortZoneName =
    selectedZone.locationKey || getShortZoneLocality(selectedZone.name);

  const selectedZoneWeather = React.useMemo(
    () => weatherByLocation[shortZoneName] ?? null,
    [weatherByLocation, shortZoneName]
  );

  const zoneAssets = React.useMemo(
    () =>
      MONSOONLOOP_SPONGE_ASSETS.filter((a) => a.zoneId === selectedZone.id),
    [selectedZone.id]
  );

  const riskAssessment = React.useMemo(
    () =>
      evaluateZoneFloodRisk(
        selectedZone,
        selectedStage,
        simInputs,
        selectedZoneWeather,
        zoneAssets,
        missions
      ),
    [
      selectedZone,
      selectedStage,
      simInputs,
      selectedZoneWeather,
      zoneAssets,
      missions,
    ]
  );

  const actionRecommendations = React.useMemo(
    () =>
      generateZoneActionPlan({
        zone: selectedZone,
        stage: selectedStage,
        riskAssessment,
        zoneAssets,
        weatherSummary: selectedZoneWeather,
      }),
    [
      selectedZone,
      selectedStage,
      riskAssessment,
      zoneAssets,
      selectedZoneWeather,
    ]
  );

  // Synchronize selected asset and selected mission
  const handleSelectAssetSync = (assetId: string) => {
    setSelectedAssetId(assetId);
    const asset = MONSOONLOOP_SPONGE_ASSETS.find((a) => a.id === assetId);
    if (!asset) return;
    const matchingMission = missions.find(
      (m) =>
        m.zoneId === asset.zoneId &&
        (m.actionTitle.toLowerCase().includes(asset.code.toLowerCase()) ||
          m.location.toLowerCase().includes(asset.name.toLowerCase()))
    );
    if (matchingMission) {
      setSelectedMissionId(matchingMission.id);
    }
  };

  const handleSelectMissionSync = (missionId: string) => {
    setSelectedMissionId(missionId);
    const msn = missions.find((m) => m.id === missionId);
    if (!msn) return;
    const matchingAsset = MONSOONLOOP_SPONGE_ASSETS.find(
      (a) =>
        a.zoneId === msn.zoneId &&
        (msn.actionTitle.toLowerCase().includes(a.code.toLowerCase()) ||
          msn.location.toLowerCase().includes(a.name.toLowerCase()))
    );
    if (matchingAsset) {
      setSelectedAssetId(matchingAsset.id);
    }
  };

  const openDispatchForExistingTask = (msn: MissionAssignment) => {
    setDispatchModalDraft({
      mode: "DISPATCH",
      existingTaskId: msn.id,
      missionCode: msn.missionCode,
      sourceActionId: msn.sourceActionId,
      actionTitle: msn.actionTitle,
      taskType: msn.actionTitle.toLowerCase().includes("drain")
        ? "Drain Clearance"
        : "Recharge Asset Inspection",
      location: msn.location || shortZoneName,
      priority: msn.priority,
      assignedTeam:
        msn.assignedTeam && msn.assignedTeam !== "Unassigned Crew"
          ? msn.assignedTeam
          : MONSOONLOOP_FIELD_TEAMS[0],
      assignedWorkerId: msn.assignedWorkerId ?? "",
      deadline: msn.deadline || "Within 4 hours",
      targetStatus: "ASSIGNED",
      expectedImpactLiters: msn.expectedImpactLiters,
    });
  };

  const openDispatchFromRecommendation = (rec: ActionRecommendation) => {
    // Check if there is already a PENDING or FAILED task matching this recommendation
    const existingPending = missions.find(
      (m) =>
        (m.status === "PENDING" || m.status === "FAILED") &&
        (m.sourceActionId === rec.id ||
          (m.zoneId === rec.zoneId &&
            m.actionTitle.toLowerCase() === rec.title.toLowerCase()))
    );
    if (existingPending) {
      openDispatchForExistingTask(existingPending);
      return;
    }

    setDispatchModalDraft({
      mode: "DISPATCH",
      sourceActionId: rec.id,
      actionTitle: rec.title,
      taskType: rec.title.toLowerCase().includes("drain")
        ? "Drain Clearance"
        : "Recharge Asset Inspection",
      location: rec.location || shortZoneName,
      priority: rec.priority,
      assignedTeam: rec.suggestedTeam || MONSOONLOOP_FIELD_TEAMS[1],
      assignedWorkerId: "",
      deadline: rec.deadlineLabel || "Within 4 hours",
      targetStatus: "ASSIGNED",
      expectedImpactLiters: rec.estimatedImpactLiters,
    });
  };

  const openDispatchFromAsset = (asset: SpongeMapAsset) => {
    setDispatchModalDraft({
      mode: "DISPATCH",
      actionTitle:
        asset.category === "DRAIN"
          ? `Clear ${asset.code}`
          : `${asset.recommendedAction} (${asset.code})`,
      taskType:
        asset.category === "DRAIN"
          ? "Drain Clearance"
          : "Recharge Asset Inspection",
      location: shortZoneName,
      priority:
        asset.riskContribution === "CRITICAL"
          ? "CRITICAL"
          : asset.riskContribution === "HIGH"
          ? "HIGH"
          : "MEDIUM",
      assignedTeam:
        asset.category === "DRAIN"
          ? MONSOONLOOP_FIELD_TEAMS[1]
          : MONSOONLOOP_FIELD_TEAMS[2],
      assignedWorkerId: "",
      deadline: "Within 4 hours",
      targetStatus: "ASSIGNED",
      expectedImpactLiters: asset.estimatedCapacityLiters,
    });
  };

  const openDefaultDispatchModal = () => {
    // Prefer an existing PENDING task in the selected zone or across zones first
    const pendingInZone = missions.find(
      (m) => m.status === "PENDING" && m.zoneId === selectedZone.id
    );
    if (pendingInZone) {
      openDispatchForExistingTask(pendingInZone);
      return;
    }
    const anyPending = missions.find((m) => m.status === "PENDING");
    if (anyPending) {
      openDispatchForExistingTask(anyPending);
      return;
    }

    // Otherwise pick the first undispatched recommendation
    const undispatchedRec = actionRecommendations.find(
      (rec) =>
        !missions.some(
          (m) =>
            m.sourceActionId === rec.id ||
            (m.zoneId === rec.zoneId &&
              m.actionTitle.toLowerCase() === rec.title.toLowerCase())
        )
    );
    if (undispatchedRec) {
      openDispatchFromRecommendation(undispatchedRec);
      return;
    }

    const topRec = actionRecommendations[0];
    if (topRec) {
      openDispatchFromRecommendation(topRec);
      return;
    }

    setDispatchModalDraft({
      mode: "DISPATCH",
      actionTitle: "Clear Drain #17",
      taskType: "Drain Clearance",
      location: shortZoneName,
      priority: "HIGH",
      assignedTeam: MONSOONLOOP_FIELD_TEAMS[1],
      assignedWorkerId: "",
      deadline: "Within 4 hours",
      targetStatus: "ASSIGNED",
      expectedImpactLiters: 85000,
    });
  };

  const openManualCreateTaskModal = () => {
    setDispatchModalDraft({
      mode: "CREATE",
      actionTitle: "",
      taskType: "Drain Clearance",
      location: shortZoneName,
      priority: "HIGH",
      assignedTeam: MONSOONLOOP_FIELD_TEAMS[0],
      assignedWorkerId: "",
      deadline: "Within 4 hours",
      notes: "",
      targetStatus: "PENDING",
      expectedImpactLiters: 65000,
    });
  };

  const handleConfirmDispatch = async (draft: DispatchModalDraft) => {
    setTasksError(null);
    const client = getDataClient();

    try {
      // Case 1: Dispatching or updating an existing task (e.g. PENDING -> ASSIGNED)
      if (draft.existingTaskId) {
        const existingTask = missions.find(
          (m) => m.id === draft.existingTaskId
        );
        const missionCode =
          draft.missionCode || existingTask?.missionCode || "MSN-301";
        const descriptionParts = [
          `[${missionCode}]`,
          `Zone: ${existingTask?.zoneId || selectedZone.id}`,
          `Impact: ${draft.expectedImpactLiters}`,
        ];
        if (draft.sourceActionId) {
          descriptionParts.push(`SourceAction: ${draft.sourceActionId}`);
        }
        if (draft.notes) {
          descriptionParts.push(draft.notes);
        }

        const { data: updated, errors } = await client.models.Task.update({
          id: draft.existingTaskId,
          title: draft.actionTitle,
          description: descriptionParts.join(" | "),
          locationName: draft.location,
          taskType: mapUiTaskTypeToEnum(draft.taskType),
          priority: draft.priority,
          status: "ASSIGNED",
          assignedTeam: draft.assignedTeam,
          assignedWorkerId: draft.assignedWorkerId?.trim() || null,
          deadline: draft.deadline,
        });

        assertNoDataErrors(errors, "Unable to dispatch task");
        if (!updated) {
          throw new Error("Unable to dispatch task");
        }

        const updatedMission = mapTaskRecordToMission(updated, 0);
        setMissions((prev) =>
          prev.map((m) =>
            m.id === updatedMission.id ? updatedMission : m
          )
        );
        setSelectedMissionId(updatedMission.id);
        setDispatchModalDraft(null);
        setDispatchBannerMessage(
          `Task dispatched to ${updatedMission.assignedTeam}: ${updatedMission.missionCode} · ${updatedMission.actionTitle} (${updatedMission.location})`
        );
        return;
      }

      // Case 2: Creating a new task (either queued as PENDING or dispatched immediately as ASSIGNED)
      const nextCodeNumber = 300 + missions.length + 1;
      const missionCode = `MSN-${nextCodeNumber}`;
      const createdBy =
        user?.email || user?.username || "operator.demo@aquiloop.test";
      const descriptionParts = [
        `[${missionCode}]`,
        `Zone: ${selectedZone.id}`,
        `Impact: ${draft.expectedImpactLiters}`,
      ];
      if (draft.sourceActionId) {
        descriptionParts.push(`SourceAction: ${draft.sourceActionId}`);
      }
      if (draft.notes) {
        descriptionParts.push(draft.notes);
      }

      const { data: created, errors } = await client.models.Task.create({
        title: draft.actionTitle,
        description: descriptionParts.join(" | "),
        locationName: draft.location,
        latitude: selectedZone.center.lat,
        longitude: selectedZone.center.lng,
        taskType: mapUiTaskTypeToEnum(draft.taskType),
        priority: draft.priority,
        status: draft.targetStatus,
        assignedTeam: draft.assignedTeam,
        ...(draft.assignedWorkerId?.trim()
          ? { assignedWorkerId: draft.assignedWorkerId.trim() }
          : {}),
        createdBy,
        deadline: draft.deadline,
      });

      assertNoDataErrors(errors, "Unable to create task");
      if (!created) {
        throw new Error("Unable to create task");
      }

      const newMission = mapTaskRecordToMission(created, 0);
      setMissions((prev) => [newMission, ...prev]);
      setSelectedMissionId(newMission.id);
      setDispatchModalDraft(null);
      setDispatchBannerMessage(
        `${
          draft.targetStatus === "PENDING"
            ? "Task queued for dispatch"
            : `Task dispatched to ${newMission.assignedTeam}`
        }: ${newMission.missionCode} · ${newMission.actionTitle} (${
          newMission.location
        })`
      );
    } catch (err) {
      setTasksError(formatDataError(err, "Unable to save task"));
    }
  };

  const handleUpdateMissionStatus = async (
    missionId: string,
    nextStatus: MonsoonMissionStatus
  ) => {
    setTasksError(null);
    try {
      const client = getDataClient();
      const workerIdentity =
        user?.email || user?.username || "worker.demo@aquiloop.test";

      const updatePayload =
        activeRole === "OPERATOR"
          ? {
              id: missionId,
              status: nextStatus,
              ...(nextStatus === "VERIFIED"
                ? { verifiedAt: new Date().toISOString() }
                : {}),
            }
          : {
              id: missionId,
              status: nextStatus,
              assignedWorkerId: workerIdentity,
            };

      const { data: updated, errors } =
        await client.models.Task.update(updatePayload);
      assertNoDataErrors(errors, "Unable to update task");

      if (updated) {
        setMissions((prev) =>
          prev.map((m, idx) =>
            m.id === missionId ? mapTaskRecordToMission(updated, idx) : m
          )
        );
      }
    } catch (err) {
      setTasksError(formatDataError(err, "Unable to update task"));
    }
  };

  const nextActionTitle =
    actionRecommendations[0]?.title ?? "Clear Drain #17";

  if (role !== "OPERATOR" && role !== "WORKER") {
    return (
      <RoleAccessNotice
        moduleName="MONSOONLOOP"
        allowedRoles={["OPERATOR", "WORKER"]}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* ====================================================================
       * MONSOONLOOP HEADER + PRODUCT ROLE CLARITY + SUMMARY
       * ==================================================================== */}
      <header className="relative overflow-hidden rounded-2xl border border-primary/40 bg-surface p-6 shadow-panel space-y-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-warning" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone="primary"
                code="MODULE 01 · MONSOONLOOP"
                label="Forecast → Flood Risk → Municipal Crew Dispatch"
              />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              MONSOONLOOP — Pre-Rain Flood Intelligence &amp; Crew Dispatch
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl">
              Monitor 72-hour rainfall forecasts across Delhi NCR, prioritize
              vulnerable drainage and recharge corridors, and dispatch municipal
              engineering crews before storms hit.{" "}
              <span className="text-foreground/90 font-medium">
                Looking for ARC-rewarded plastic &amp; waste cleanup bounties?
              </span>{" "}
              <Link
                href="/flood-bounties"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                Open Flood &amp; Waste Bounties
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          </div>

          {/* Role Workspace Indicator */}
          <div
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 shrink-0"
            aria-label="Authenticated Role Workspace"
          >
            {activeRole === "OPERATOR" ? (
              <>
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Operator Command Workspace
                </span>
              </>
            ) : (
              <>
                <HardHat className="h-4 w-4 text-secondary" />
                <span className="text-xs font-semibold text-foreground">
                  Field Crew Workspace (
                  {missions.filter((m) => m.status !== "PENDING").length}{" "}
                  Assigned)
                </span>
              </>
            )}
          </div>
        </div>

        {/* ONE Scannable Summary Strip (Operator View Only) */}
        {activeRole === "OPERATOR" && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted/50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm">
              <div>
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  72h Rain:{" "}
                </span>
                <strong className="font-semibold text-foreground">
                  {(
                    selectedZoneWeather?.totalRainfallMm ??
                    selectedZone.forecastRainfallMm
                  ).toFixed(1)}{" "}
                  mm ·{" "}
                  {(
                    selectedZoneWeather?.peakRainfallMmHr ??
                    selectedZone.peakIntensityMmHr
                  ).toFixed(1)}{" "}
                  mm/hr peak
                </strong>
              </div>

              <div>
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  Zone Risk:{" "}
                </span>
                <strong className="font-semibold text-warning">
                  {shortZoneName} · {riskAssessment.riskLevel}
                </strong>
              </div>

              <div>
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  Priority Action:{" "}
                </span>
                <strong className="font-semibold text-emerald-400">
                  {nextActionTitle}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={openManualCreateTaskModal}
              >
                <PlusCircle className="h-3.5 w-3.5 text-primary" />
                <span>NEW TASK</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={openDefaultDispatchModal}
              >
                <Send className="h-3.5 w-3.5" />
                <span>DISPATCH TASK</span>
              </Button>
            </div>
          </div>
        )}

        {/* Task Dispatched Confirmation Banner */}
        {dispatchBannerMessage && activeRole === "OPERATOR" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/12 px-3.5 py-2.5 text-xs text-success">
            <span className="inline-flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {dispatchBannerMessage}
            </span>
            <button
              type="button"
              onClick={() => setDispatchBannerMessage(null)}
              className="text-success/80 hover:text-success"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      {tasksError && (
        <ErrorState
          title="Task Operation Error"
          message={tasksError}
          onRetry={() => void loadTasks()}
        />
      )}

      {/* ====================================================================
       * CONDITIONAL ROLE SEPARATION: WORKER VIEW vs OPERATOR VIEW
       * ==================================================================== */}
      {isLoadingTasks ? (
        <LoadingState
          label="Loading field tasks..."
          sublabel="Loading MONSOONLOOP municipal crew assignments"
          rows={3}
        />
      ) : activeRole === "WORKER" ? (
        <MonsoonWorkerView
          missions={missions}
          selectedMissionId={selectedMissionId}
          onSelectMission={handleSelectMissionSync}
          onUpdateMissionStatus={(id, status) =>
            void handleUpdateMissionStatus(id, status)
          }
        />
      ) : (
        <>
          {/* 1. Risk Zones */}
          <ZoneSelector
            zones={MONSOONLOOP_ZONES}
            selectedZoneId={selectedZone.id}
            onSelectZone={handleSelectZone}
            selectedStage={selectedStage}
            missions={missions}
            weatherByLocation={weatherByLocation}
            assets={MONSOONLOOP_SPONGE_ASSETS}
          />

          {/* 2. When will rainfall peak? + Why is this zone at risk? */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <RainPulse
                selectedZone={selectedZone}
                weatherSummary={selectedZoneWeather}
                isLoadingWeather={isLoadingWeather}
                isRefreshingWeather={isRefreshingWeather}
                refreshError={weatherRefreshError}
                canRefresh={activeRole === "OPERATOR"}
                onRefreshWeather={() => void handleRefreshWeatherForecast()}
              />
            </div>

            <div className="xl:col-span-5">
              <RiskPanel
                zone={selectedZone}
                assessment={riskAssessment}
                weatherSummary={selectedZoneWeather}
              />
            </div>
          </div>

          {/* 3. Risk & Drain Map + Pre-Storm Action Decisions */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <SpongeMap
                zone={selectedZone}
                allZones={MONSOONLOOP_ZONES}
                assets={MONSOONLOOP_SPONGE_ASSETS}
                missions={missions}
                weatherSummary={selectedZoneWeather}
                riskAssessment={riskAssessment}
                selectedAssetId={selectedAssetId}
                onSelectAsset={handleSelectAssetSync}
                selectedMissionId={selectedMissionId}
                onSelectMission={handleSelectMissionSync}
                onSelectZone={handleSelectZone}
                onOpenDispatchFromAsset={openDispatchFromAsset}
              />
            </div>

            <div className="xl:col-span-5">
              <ActionPlan
                zone={selectedZone}
                stage={selectedStage}
                recommendations={actionRecommendations}
                missions={missions}
                onOpenDispatchFromRecommendation={
                  openDispatchFromRecommendation
                }
                onInspectAsset={handleSelectAssetSync}
              />
            </div>
          </div>

          {/* 4. Municipal Crew Dispatch & Task Lifecycle */}
          <MissionDispatch
            zone={selectedZone}
            missions={missions}
            selectedMissionId={selectedMissionId}
            onSelectMission={handleSelectMissionSync}
            onOpenDispatchModal={openDefaultDispatchModal}
            onOpenDispatchForExistingTask={openDispatchForExistingTask}
            onOpenManualCreateModal={openManualCreateTaskModal}
            onUpdateMissionStatus={(id, status) =>
              void handleUpdateMissionStatus(id, status)
            }
          />
        </>
      )}

      {/* ====================================================================
       * DISPATCH TASK / MANUAL CREATE TASK MODAL
       * ==================================================================== */}
      {dispatchModalDraft && (
        <DispatchTaskModal
          initialDraft={dispatchModalDraft}
          onClose={() => setDispatchModalDraft(null)}
          onDispatch={handleConfirmDispatch}
        />
      )}
    </div>
  );
}

interface DispatchTaskModalProps {
  initialDraft: DispatchModalDraft;
  onClose: () => void;
  onDispatch: (draft: DispatchModalDraft) => void;
}

function DispatchTaskModal({
  initialDraft,
  onClose,
  onDispatch,
}: DispatchTaskModalProps) {
  const isManualCreate = initialDraft.mode === "CREATE";

  const [actionTitle, setActionTitle] = React.useState(
    initialDraft.actionTitle
  );
  const [taskType, setTaskType] = React.useState(initialDraft.taskType);
  const [location, setLocation] = React.useState(initialDraft.location);
  const [priority, setPriority] = React.useState<ActionPriority>(
    initialDraft.priority
  );
  const [assignedTeam, setAssignedTeam] = React.useState(
    initialDraft.assignedTeam
  );
  const [assignedWorkerId, setAssignedWorkerId] = React.useState(
    initialDraft.assignedWorkerId ?? ""
  );
  const [deadline, setDeadline] = React.useState(initialDraft.deadline);
  const [notes, setNotes] = React.useState(initialDraft.notes ?? "");
  const [targetStatus, setTargetStatus] = React.useState<
    "PENDING" | "ASSIGNED"
  >(initialDraft.targetStatus);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim()) return;
    onDispatch({
      ...initialDraft,
      actionTitle: actionTitle.trim(),
      taskType,
      location: location.trim(),
      priority,
      assignedTeam,
      assignedWorkerId: assignedWorkerId || undefined,
      deadline: deadline.trim() || "Within 4 hours",
      notes: notes.trim() || undefined,
      targetStatus: isManualCreate ? targetStatus : "ASSIGNED",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-primary/40 bg-surface p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary block">
              {isManualCreate
                ? "NEW PRE-STORM TASK"
                : initialDraft.existingTaskId
                ? `DISPATCH ${initialDraft.missionCode || "TASK"}`
                : "DISPATCH MUNICIPAL CREW"}
            </span>
            <h3 className="text-lg font-bold text-foreground">
              {isManualCreate
                ? "Create Field Task"
                : "Confirm Crew Assignment & Dispatch"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-muted p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label
              htmlFor="dispatch-task-title"
              className="font-medium text-muted-foreground"
            >
              Task Title
            </label>
            <input
              id="dispatch-task-title"
              type="text"
              placeholder="e.g., Clear Drain #17"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="dispatch-task-location"
                className="font-medium text-muted-foreground"
              >
                Location
              </label>
              <input
                id="dispatch-task-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                required
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="dispatch-task-type"
                className="font-medium text-muted-foreground"
              >
                Task Type
              </label>
              <select
                id="dispatch-task-type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="dispatch-task-priority"
                className="font-medium text-muted-foreground"
              >
                Priority
              </label>
              <select
                id="dispatch-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ActionPriority)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="dispatch-task-deadline"
                className="font-medium text-muted-foreground"
              >
                Target Deadline
              </label>
              <input
                id="dispatch-task-deadline"
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="dispatch-task-team"
              className="font-medium text-muted-foreground"
            >
              Assigned Municipal Crew
            </label>
            <select
              id="dispatch-task-team"
              value={assignedTeam}
              onChange={(e) => setAssignedTeam(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {MONSOONLOOP_FIELD_TEAMS.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="dispatch-task-worker"
              className="font-medium text-muted-foreground"
            >
              Assigned Field Worker (Optional)
            </label>
            <select
              id="dispatch-task-worker"
              value={assignedWorkerId}
              onChange={(e) => setAssignedWorkerId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {WORKER_ASSIGNMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isManualCreate && (
            <>
              <div className="space-y-1">
                <label
                  htmlFor="dispatch-task-status"
                  className="font-medium text-muted-foreground"
                >
                  Initial Lifecycle Status
                </label>
                <select
                  id="dispatch-task-status"
                  value={targetStatus}
                  onChange={(e) =>
                    setTargetStatus(e.target.value as "PENDING" | "ASSIGNED")
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="PENDING">
                    Queue as Pending (Ready for Dispatch)
                  </option>
                  <option value="ASSIGNED">
                    Assign &amp; Dispatch Immediately
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="dispatch-task-notes"
                  className="font-medium text-muted-foreground"
                >
                  Optional Operational Notes
                </label>
                <input
                  id="dispatch-task-notes"
                  type="text"
                  placeholder="e.g., Coordinate with local ward supervisor"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="default" size="sm" className="gap-1.5">
            {isManualCreate && targetStatus === "PENDING" ? (
              <>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>QUEUE PENDING TASK</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>CONFIRM &amp; DISPATCH</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
