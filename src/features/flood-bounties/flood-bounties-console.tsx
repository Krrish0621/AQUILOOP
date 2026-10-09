"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  PlusCircle,
  Scale,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type OperationalTone } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DelhiBountyMap } from "@/features/flood-bounties/components/delhi-bounty-map";
import { WorkerTaskWorkflow } from "@/features/flood-bounties/components/worker-task-workflow";
import { OperatorVerificationPanel } from "@/features/flood-bounties/components/operator-verification-panel";
import { RewardLedgerAnalytics } from "@/features/flood-bounties/components/reward-ledger-analytics";
import {
  DELHI_BOUNTY_LOCATIONS,
  MOCK_WORKER_PROFILES,
} from "@/features/flood-bounties/data/mock-flood-bounties";
import { evaluateSubmittedBountyEvidence } from "@/features/flood-bounties/lib/verification-simulator";
import type {
  BountyEvidence,
  BountyPriority,
  BountyRejectionReason,
  FloodBountyStatus,
  FloodWasteBounty,
} from "@/types";
import { RoleAccessNotice } from "@/components/auth/role-access-notice";
import { S3EvidenceImage } from "@/components/shared/s3-evidence-media";
import { useCurrentRole } from "@/lib/auth-context";
import {
  assertNoDataErrors,
  formatDataError,
  getDataClient,
  mapBountyRecordToFloodWasteBounty,
} from "@/lib/data-client";
import {
  isRealS3EvidenceKey,
  prefetchEvidenceSignedUrls,
} from "@/lib/storage-client";
import { cn } from "@/lib/utils";

type UserRole = "WORKER" | "OPERATOR";
type BoardFilter = "ALL" | "NEARBY" | "URGENT" | "HIGHEST_REWARD" | "CLOSING_SOON";

const statusBadgeMap: Record<
  FloodBountyStatus,
  { tone: OperationalTone; label: string }
> = {
  OPEN: { tone: "warning", label: "OPEN" },
  CLAIMED: { tone: "info", label: "CLAIMED" },
  IN_PROGRESS: { tone: "primary", label: "IN PROGRESS" },
  SUBMITTED: { tone: "warning", label: "PENDING REVIEW" },
  UNDER_REVIEW: { tone: "warning", label: "UNDER REVIEW" },
  VERIFIED: { tone: "success", label: "VERIFIED" },
  REJECTED: { tone: "danger", label: "REJECTED" },
};

const priorityBadgeStyle: Record<BountyPriority, string> = {
  URGENT: "border-danger/45 bg-danger/15 text-danger",
  HIGH: "border-warning/45 bg-warning/15 text-warning",
  MEDIUM: "border-info/45 bg-info/15 text-info",
  LOW: "border-success/45 bg-success/15 text-success",
};

export function FloodBountiesConsole() {
  const searchParams = useSearchParams();
  const { role, user } = useCurrentRole();

  const activeRole: UserRole = role === "OPERATOR" ? "OPERATOR" : "WORKER";
  const [bounties, setBounties] = React.useState<FloodWasteBounty[]>([]);
  const [isLoadingBounties, setIsLoadingBounties] =
    React.useState<boolean>(true);
  const [bountiesError, setBountiesError] = React.useState<string | null>(null);

  const [selectedBountyId, setSelectedBountyId] =
    React.useState<string>("");
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [inspectBountyId, setInspectBountyId] = React.useState<string | null>(
    null
  );
  const [reviewBountyId, setReviewBountyId] = React.useState<string | null>(
    null
  );
  const [boardFilter, setBoardFilter] = React.useState<BoardFilter>("ALL");
  const [workerViewMode, setWorkerViewMode] = React.useState<
    "SPLIT" | "LIST" | "MAP"
  >("SPLIT");

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [draftLocality, setDraftLocality] =
    React.useState<FloodWasteBounty["delhiLocality"]>("Mayapuri");
  const [draftCorridor, setDraftCorridor] = React.useState(
    "Mayapuri Drain Inlet #17"
  );
  const [draftTitle, setDraftTitle] = React.useState(
    "Clear drainage inlet waste"
  );
  const [draftPriority, setDraftPriority] =
    React.useState<BountyPriority>("HIGH");
  const [draftDeadline, setDraftDeadline] = React.useState(
    "Before rainfall peak (Within 4h)"
  );
  const [draftRewardArc, setDraftRewardArc] = React.useState<number>(120);
  const [draftWasteRange, setDraftWasteRange] = React.useState("35–45 kg");
  const [draftReason, setDraftReason] = React.useState(
    "Pre-storm blockage reduction"
  );

  const activeWorker = MOCK_WORKER_PROFILES[0];
  const workerIdentity =
    user?.email || user?.username || activeWorker.name;

  const isClaimedByCurrentWorker = React.useCallback(
    (bounty: FloodWasteBounty) => {
      const claimed = (bounty.assignedWorkerId ?? "").trim().toLowerCase();
      if (!claimed) return false;
      const candidates = [
        workerIdentity,
        user?.email,
        user?.username,
        activeWorker.name,
        "worker.demo@aquiloop.test",
        "worker.demo@aquiloop.org",
      ]
        .filter(Boolean)
        .map((s) => String(s).trim().toLowerCase());
      return candidates.includes(claimed);
    },
    [workerIdentity, user?.email, user?.username, activeWorker.name]
  );

  const applyBountyRecords = React.useCallback(
    (records: NonNullable<Awaited<ReturnType<ReturnType<typeof getDataClient>["models"]["Bounty"]["list"]>>["data"]>) => {
      const uniqueById = new Map<string, (typeof records)[number]>();
      for (const item of records) {
        if (item && item.id) {
          uniqueById.set(item.id, item);
        }
      }
      const sorted = Array.from(uniqueById.values()).sort((a, b) => {
        const tA = a.updatedAt
          ? Date.parse(a.updatedAt)
          : a.createdAt
          ? Date.parse(a.createdAt)
          : 0;
        const tB = b.updatedAt
          ? Date.parse(b.updatedAt)
          : b.createdAt
          ? Date.parse(b.createdAt)
          : 0;
        if (tB !== tA) return tB - tA;
        return a.id.localeCompare(b.id);
      });
      const mapped = sorted.map((record, index) =>
        mapBountyRecordToFloodWasteBounty(record, index)
      );
      prefetchEvidenceSignedUrls(
        mapped.flatMap((b) => [
          b.evidence.beforeImageLabel,
          b.evidence.afterImageLabel,
        ])
      );
      setBounties(mapped);
      setSelectedBountyId((prev) =>
        prev && mapped.some((b) => b.id === prev)
          ? prev
          : mapped[0]?.id ?? ""
      );
    },
    []
  );

  const loadBounties = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (role !== "OPERATOR" && role !== "WORKER") return;
      const silent = Boolean(options?.silent);
      if (!silent) {
        setIsLoadingBounties(true);
        setBountiesError(null);
      }
      try {
        const client = getDataClient();
        const { data, errors } = await client.models.Bounty.list({
          limit: 100,
        });
        assertNoDataErrors(errors, "Unable to load bounties");
        applyBountyRecords(data ?? []);
      } catch (err) {
        if (!silent) {
          setBountiesError(formatDataError(err, "Unable to load bounties"));
        }
      } finally {
        if (!silent) {
          setIsLoadingBounties(false);
        }
      }
    },
    [role, applyBountyRecords]
  );

  React.useEffect(() => {
    void loadBounties();
  }, [loadBounties]);

  // Real-time synchronization via AppSync observeQuery + lightweight background sync
  React.useEffect(() => {
    if (role !== "OPERATOR" && role !== "WORKER") return;

    let isMounted = true;
    const client = getDataClient();

    let sub: { unsubscribe: () => void } | null = null;
    try {
      sub = client.models.Bounty.observeQuery().subscribe({
        next: ({ items }) => {
          if (!isMounted) return;
          if (items && items.length > 0) {
            applyBountyRecords(items);
          }
          void loadBounties({ silent: true });
        },
        error: () => {
          // Field-level auth can restrict certain subscription payloads; fallback poll handles sync
        },
      });
    } catch {
      // Fallback interval handles synchronization
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadBounties({ silent: true });
      }
    }, 5000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        void loadBounties({ silent: true });
      }
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      isMounted = false;
      sub?.unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [role, applyBountyRecords, loadBounties]);

  React.useEffect(() => {
    if (role !== "OPERATOR") return;

    const fromLocality = searchParams.get("locality");
    const fromCorridor = searchParams.get("corridor");
    const fromTask = searchParams.get("task");
    const fromPriority = searchParams.get("priority");
    const fromZone = searchParams.get("zone");

    if (fromLocality || fromTask || fromCorridor) {
      setShowCreateModal(true);
      const matchedLoc = DELHI_BOUNTY_LOCATIONS.find(
        (l) => l.locality.toLowerCase() === fromLocality?.toLowerCase()
      );
      if (matchedLoc) {
        setDraftLocality(matchedLoc.locality);
        setDraftCorridor(fromCorridor || matchedLoc.defaultCorridor);
      } else if (fromCorridor) {
        setDraftCorridor(fromCorridor);
      }
      if (fromTask) {
        setDraftTitle(fromTask);
      }
      if (fromPriority) {
        const normalized = fromPriority.toUpperCase();
        if (normalized === "CRITICAL" || normalized === "URGENT") {
          setDraftPriority("URGENT");
        } else if (normalized === "HIGH") {
          setDraftPriority("HIGH");
        } else if (normalized === "MEDIUM") {
          setDraftPriority("MEDIUM");
        }
      }
      if (fromZone) {
        setDraftReason(`Pre-storm drain clearance in ${fromZone}`);
      } else {
        setDraftReason("Solid waste & plastic blockage clearance before rainfall");
      }
    }
  }, [searchParams, role]);

  const openCount = bounties.filter((b) => b.status === "OPEN").length;
  const urgentCount = bounties.filter(
    (b) =>
      b.priority === "URGENT" &&
      b.status !== "VERIFIED" &&
      b.status !== "REJECTED"
  ).length;
  const claimedOrInProgressCount = bounties.filter(
    (b) => b.status === "CLAIMED" || b.status === "IN_PROGRESS"
  ).length;
  const pendingVerificationCount = bounties.filter(
    (b) => b.status === "SUBMITTED" || b.status === "UNDER_REVIEW"
  ).length;
  const completedVerifiedCount = bounties.filter(
    (b) => b.status === "VERIFIED"
  ).length;

  const earnedArcTotal = bounties
    .filter((b) => b.status === "VERIFIED")
    .reduce((sum, b) => sum + b.rewardArc, 0);

  const pendingArcTotal = bounties
    .filter(
      (b) =>
        b.status === "SUBMITTED" ||
        b.status === "UNDER_REVIEW" ||
        b.status === "CLAIMED" ||
        b.status === "IN_PROGRESS"
    )
    .reduce((sum, b) => sum + b.rewardArc, 0);

  const filteredBounties = React.useMemo(() => {
    const list = [...bounties];
    if (boardFilter === "NEARBY") {
      return list.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    if (boardFilter === "URGENT") {
      return list.filter(
        (b) => b.priority === "URGENT" || b.priority === "HIGH"
      );
    }
    if (boardFilter === "HIGHEST_REWARD") {
      return list.sort((a, b) => b.rewardArc - a.rewardArc);
    }
    if (boardFilter === "CLOSING_SOON") {
      return list
        .filter((b) => b.status === "OPEN" || b.status === "CLAIMED")
        .sort((a, b) => a.closingSoonHours - b.closingSoonHours);
    }
    return list;
  }, [bounties, boardFilter]);

  const selectedBounty =
    bounties.find((b) => b.id === selectedBountyId) ?? bounties[0];

  const ongoingWorkerTask = React.useMemo(() => {
    const isOngoing = (status: FloodBountyStatus) =>
      status === "IN_PROGRESS" || status === "CLAIMED" || status === "REJECTED";

    if (activeTaskId) {
      const explicit = bounties.find((b) => b.id === activeTaskId);
      if (explicit && isOngoing(explicit.status)) {
        return explicit;
      }
    }

    const workerOwned = bounties.filter(
      (b) => isClaimedByCurrentWorker(b) && isOngoing(b.status)
    );
    const pool =
      workerOwned.length > 0
        ? workerOwned
        : bounties.filter((b) => isOngoing(b.status));

    return (
      pool.find((b) => b.status === "IN_PROGRESS") ??
      pool.find((b) => b.status === "CLAIMED") ??
      pool.find((b) => b.status === "REJECTED") ??
      null
    );
  }, [bounties, activeTaskId, isClaimedByCurrentWorker]);

  // Single authoritative active task derived from bounties & authenticated worker identity
  const activeTaskBounty = React.useMemo(() => {
    const isTaskActiveStatus = (status: FloodBountyStatus) =>
      status === "CLAIMED" ||
      status === "IN_PROGRESS" ||
      status === "REJECTED" ||
      status === "SUBMITTED" ||
      status === "UNDER_REVIEW";

    if (activeTaskId) {
      const explicit = bounties.find((b) => b.id === activeTaskId);
      if (explicit && isTaskActiveStatus(explicit.status)) {
        return explicit;
      }
    }

    if (ongoingWorkerTask) {
      return ongoingWorkerTask;
    }

    const workerOwned = bounties.filter(
      (b) => isClaimedByCurrentWorker(b) && isTaskActiveStatus(b.status)
    );
    const pool =
      workerOwned.length > 0
        ? workerOwned
        : bounties.filter((b) => isTaskActiveStatus(b.status));

    return (
      pool.find(
        (b) => b.status === "SUBMITTED" || b.status === "UNDER_REVIEW"
      ) ?? null
    );
  }, [bounties, activeTaskId, isClaimedByCurrentWorker, ongoingWorkerTask]);

  const inspectedBounty = React.useMemo(
    () => bounties.find((b) => b.id === inspectBountyId) ?? null,
    [bounties, inspectBountyId]
  );

  const handleOpenActiveTask = React.useCallback(
    (bountyId?: string) => {
      setInspectBountyId(null);
      const targetId = bountyId ?? ongoingWorkerTask?.id ?? activeTaskBounty?.id;
      if (targetId) {
        setActiveTaskId(targetId);
        setSelectedBountyId(targetId);
      }
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const section = document.getElementById("worker-active-task-section");
          if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
            section.focus({ preventScroll: true });
          }
        });
      }
    },
    [ongoingWorkerTask, activeTaskBounty]
  );

  const handlePublishBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    setBountiesError(null);
    const locMeta =
      DELHI_BOUNTY_LOCATIONS.find((l) => l.locality === draftLocality) ??
      DELHI_BOUNTY_LOCATIONS[0];
    const nextNumber = 50 + bounties.length;
    const code = `BOUNTY #DL-00${nextNumber}`;
    const description = `[${code}] Priority:${draftPriority} | Waste:${
      draftWasteRange.trim() || "35–45 kg"
    } | Deadline:${draftDeadline.trim() || "Before rainfall peak"} | ${
      draftReason.trim() || "Pre-storm blockage reduction"
    }`;

    try {
      const client = getDataClient();
      const { data: created, errors } = await client.models.Bounty.create({
        title: draftTitle.trim() || "Clear drainage inlet waste",
        description,
        locationName: draftCorridor.trim() || locMeta.defaultCorridor,
        latitude: locMeta.coordinates.lat,
        longitude: locMeta.coordinates.lng,
        bountyType: "DRAIN_WASTE",
        rewardArc: Number(draftRewardArc) || 120,
        status: "OPEN",
        createdBy: user?.email || user?.username || "operator.demo@aquiloop.test",
      });

      assertNoDataErrors(errors, "Unable to create bounty");
      if (!created) {
        throw new Error("Unable to create bounty");
      }

      const mapped = mapBountyRecordToFloodWasteBounty(created, 0);
      setBounties((prev) => [mapped, ...prev]);
      setSelectedBountyId(mapped.id);
      setShowCreateModal(false);
    } catch (err) {
      setBountiesError(formatDataError(err, "Unable to create bounty"));
    }
  };

  const handleClaimBounty = async (bountyId: string) => {
    setBountiesError(null);
    const target = bounties.find((b) => b.id === bountyId);
    if (!target || target.status !== "OPEN") {
      setBountiesError(
        "This item is no longer available or was recently updated"
      );
      return;
    }

    try {
      const client = getDataClient();
      const { data: updated, errors } = await client.models.Bounty.update({
        id: bountyId,
        status: "CLAIMED",
        claimedBy: workerIdentity,
        assignedAt: new Date().toISOString(),
      });
      assertNoDataErrors(errors, "Unable to claim bounty");
      if (!updated) {
        throw new Error("Unable to claim bounty");
      }

      setBounties((prev) =>
        prev.map((b, idx) =>
          b.id === bountyId ? mapBountyRecordToFloodWasteBounty(updated, idx) : b
        )
      );
      handleOpenActiveTask(bountyId);
    } catch (err) {
      setBountiesError(formatDataError(err, "Unable to claim bounty"));
    }
  };

  const handleStartTask = async (bountyId: string) => {
    setBountiesError(null);
    const target = bounties.find((b) => b.id === bountyId);
    if (
      target &&
      target.status !== "CLAIMED" &&
      target.status !== "REJECTED" &&
      target.status !== "IN_PROGRESS"
    ) {
      setBountiesError(
        `Cannot start task from status ${target.status}. Claim the bounty first.`
      );
      return;
    }

    try {
      const client = getDataClient();
      const { data: updated, errors } = await client.models.Bounty.update({
        id: bountyId,
        status: "IN_PROGRESS",
        claimedBy: workerIdentity,
      });
      assertNoDataErrors(errors, "Unable to start bounty task");
      if (updated) {
        setBounties((prev) =>
          prev.map((b, idx) =>
            b.id === bountyId ? mapBountyRecordToFloodWasteBounty(updated, idx) : b
          )
        );
        setActiveTaskId(bountyId);
        setSelectedBountyId(bountyId);
      }
    } catch (err) {
      setBountiesError(formatDataError(err, "Unable to start bounty task"));
    }
  };

  const handleUpdateEvidence = async (
    bountyId: string,
    patch: Partial<BountyEvidence>
  ) => {
    const target = bounties.find((b) => b.id === bountyId);
    if (!target) return;

    const needsDbUpdate =
      Boolean(patch.beforeImageLabel) ||
      Boolean(patch.cleanupCompleted) ||
      Boolean(patch.afterImageLabel) ||
      Boolean(patch.gpsCaptured) ||
      patch.submittedLatitude !== undefined ||
      patch.submittedLongitude !== undefined;

    if (needsDbUpdate) {
      try {
        const client = getDataClient();
        const { errors } = await client.models.Bounty.update({
          id: bountyId,
          ...(patch.beforeImageLabel
            ? { beforeEvidenceKey: patch.beforeImageLabel }
            : {}),
          ...(patch.cleanupCompleted
            ? { submittedTimestamp: new Date().toISOString() }
            : {}),
          ...(patch.afterImageLabel
            ? { afterEvidenceKey: patch.afterImageLabel }
            : {}),
          ...(patch.gpsCaptured ||
          patch.submittedLatitude !== undefined ||
          patch.submittedLongitude !== undefined
            ? {
                submittedLatitude:
                  patch.submittedLatitude !== undefined
                    ? patch.submittedLatitude
                    : target.evidence.submittedLatitude ?? null,
                submittedLongitude:
                  patch.submittedLongitude !== undefined
                    ? patch.submittedLongitude
                    : target.evidence.submittedLongitude ?? null,
                submittedTimestamp: new Date().toISOString(),
              }
            : {}),
        });
        assertNoDataErrors(errors, "Unable to save bounty evidence");
      } catch (err) {
        const msg = formatDataError(err, "Unable to save bounty evidence");
        setBountiesError(msg);
        throw new Error(msg);
      }
    }

    setBounties((prev) =>
      prev.map((b) => {
        if (b.id !== bountyId) return b;
        const nextEvidence = { ...b.evidence, ...patch };
        return {
          ...b,
          evidence: nextEvidence,
          verificationCheck: evaluateSubmittedBountyEvidence(
            b.delhiLocality,
            nextEvidence
          ),
        };
      })
    );
  };

  const handleSubmitForVerification = async (bountyId: string) => {
    setBountiesError(null);
    const target = bounties.find((b) => b.id === bountyId);
    if (!target) return;

    if (target.status !== "IN_PROGRESS" && target.status !== "CLAIMED") {
      setBountiesError(
        `Cannot submit bounty from status ${target.status}.`
      );
      return;
    }

    if (
      !isRealS3EvidenceKey(target.evidence.beforeImageLabel) ||
      !isRealS3EvidenceKey(target.evidence.afterImageLabel)
    ) {
      setBountiesError(
        "Please upload both Before and After evidence photos before submitting."
      );
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      const client = getDataClient();
      const { data: updated, errors } = await client.models.Bounty.update({
        id: bountyId,
        status: "SUBMITTED",
        submittedAt: nowIso,
        beforeEvidenceKey: target.evidence.beforeImageLabel,
        afterEvidenceKey: target.evidence.afterImageLabel,
        submittedLatitude: target.evidence.submittedLatitude ?? null,
        submittedLongitude: target.evidence.submittedLongitude ?? null,
        submittedTimestamp: nowIso,
      });
      assertNoDataErrors(errors, "Unable to submit bounty evidence");
      if (updated) {
        setBounties((prev) =>
          prev.map((b, idx) =>
            b.id === bountyId ? mapBountyRecordToFloodWasteBounty(updated, idx) : b
          )
        );
        setActiveTaskId(bountyId);
      }
    } catch (err) {
      setBountiesError(formatDataError(err, "Unable to submit bounty evidence"));
    }
  };

  const handleApproveBounty = async (bountyId: string) => {
    setBountiesError(null);
    const target = bounties.find((b) => b.id === bountyId);
    if (
      target &&
      target.status !== "SUBMITTED" &&
      target.status !== "UNDER_REVIEW"
    ) {
      setBountiesError(
        "Only submitted bounties with evidence can be verified."
      );
      return;
    }

    try {
      const client = getDataClient();
      const { data: updated, errors } = await client.models.Bounty.update({
        id: bountyId,
        status: "VERIFIED",
        verifiedAt: new Date().toISOString(),
      });
      assertNoDataErrors(errors, "Unable to verify bounty");
      if (updated) {
        setBounties((prev) =>
          prev.map((b, idx) =>
            b.id === bountyId ? mapBountyRecordToFloodWasteBounty(updated, idx) : b
          )
        );
      }
    } catch (err) {
      setBountiesError(formatDataError(err, "Unable to verify bounty"));
    }
  };

  const handleRejectBounty = async (
    bountyId: string,
    reason: BountyRejectionReason,
    detail: string
  ) => {
    setBountiesError(null);
    try {
      const client = getDataClient();
      const { data: updated, errors } = await client.models.Bounty.update({
        id: bountyId,
        status: "REJECTED",
        rejectionReason: `${reason}: ${detail}`,
      });
      assertNoDataErrors(errors, "Unable to reject bounty");
      if (updated) {
        setBounties((prev) =>
          prev.map((b, idx) =>
            b.id === bountyId ? mapBountyRecordToFloodWasteBounty(updated, idx) : b
          )
        );
      }
    } catch (err) {
      setBountiesError(formatDataError(err, "Unable to reject bounty"));
    }
  };

  if (role !== "OPERATOR" && role !== "WORKER") {
    return (
      <RoleAccessNotice
        moduleName="Flood & Waste Bounties"
        allowedRoles={["OPERATOR", "WORKER"]}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* ====================================================================
       * HEADER & ROLE WORKSPACE
       * ==================================================================== */}
      <header className="relative overflow-hidden rounded-2xl border border-warning/40 bg-surface p-6 shadow-panel">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-warning via-primary to-secondary" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 max-w-3xl">
            <StatusBadge
              tone="warning"
              code="MODULE 02 · FLOOD & WASTE BOUNTIES"
              label="Claim Bounty → Clear Waste → Photo Proof → Earn ARC"
            />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Flood &amp; Waste Bounties — Verified Drain Cleanup &amp; ARC Rewards
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Field workers claim plastic and solid-waste drain blockages,
              upload geotagged before/after cleanup photos, and earn verified
              AQUILOOP Resilience Credits (ARC) upon operator approval.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2"
              aria-label="Authenticated Role Workspace"
            >
              {activeRole === "WORKER" ? (
                <>
                  <UserCheck className="h-4 w-4 text-secondary" />
                  <span className="text-xs font-semibold text-foreground">
                    Field Worker Workspace
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Operator Workspace ({pendingVerificationCount} Review)
                  </span>
                </>
              )}
            </div>

            {activeRole === "OPERATOR" && (
              <Button
                variant="default"
                size="default"
                onClick={() => setShowCreateModal((prev) => !prev)}
              >
                <PlusCircle className="h-4 w-4" />
                <span>{showCreateModal ? "Close Form" : "Create Bounty"}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {bountiesError && (
        <ErrorState
          title="Bounty Operation Error"
          message={bountiesError}
          onRetry={() => void loadBounties()}
        />
      )}

      {/* ====================================================================
       * CONDITIONAL RENDERING BY ROLE
       * ==================================================================== */}
      {isLoadingBounties ? (
        <LoadingState
          label="Loading cleanup bounties..."
          sublabel="Loading active drain cleanup bounties across Delhi NCR"
          rows={3}
        />
      ) : activeRole === "WORKER" ? (
        <>
          {/* 1. WORKER VIEW: Simple ARC Balance & Nearby Count */}
          <section
            aria-label="Field Worker Summary & My ARC"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <div className="rounded-xl border border-secondary/40 bg-secondary/[0.08] p-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                  My ARC
                </span>
                <span className="mt-1 font-mono text-2xl font-bold text-emerald-400 block">
                  {earnedArcTotal} ARC
                </span>
                <span className="text-xs text-muted-foreground">
                  {activeWorker.name}
                </span>
              </div>
              <Award className="h-8 w-8 text-emerald-400/80" />
            </div>

            <div className="rounded-xl border border-warning/35 bg-warning/[0.06] p-4">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-warning block">
                Pending Reward
              </span>
              <span className="mt-1 font-mono text-2xl font-bold text-warning block">
                +{pendingArcTotal} ARC
              </span>
              <span className="text-xs text-muted-foreground">
                Active &amp; submitted cleanups
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Nearby Bounties
              </span>
              <span className="mt-1 font-mono text-2xl font-bold text-foreground block">
                {openCount} Open
              </span>
              <span className="text-xs text-muted-foreground">
                {urgentCount} urgent before peak rain
              </span>
            </div>
          </section>

          {/* 2. WORKER VIEW: My Active Task Step-by-Step Execution */}
          <section
            id="worker-active-task-section"
            tabIndex={-1}
            className="space-y-3 scroll-mt-6 outline-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  My Active Task
                </h2>
                <p className="text-xs text-muted-foreground">
                  Complete your claimed cleanup step-by-step with before and after photo proof.
                </p>
              </div>
            </div>

            {activeTaskBounty ? (
              <WorkerTaskWorkflow
                key={activeTaskBounty.id}
                bounty={activeTaskBounty}
                workerName={activeWorker.name}
                onClaimBounty={handleClaimBounty}
                onStartTask={handleStartTask}
                onUpdateEvidence={handleUpdateEvidence}
                onSubmitForVerification={handleSubmitForVerification}
              />
            ) : (
              <Card className="border-border bg-surface">
                <CardContent className="p-6 text-center space-y-2">
                  <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                    No Active Task Claimed Yet
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Select an open drain cleanup bounty from the Nearby Bounties board below and click{" "}
                    <strong className="text-foreground">Claim Bounty</strong> to start your field task.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* 3. WORKER VIEW: Nearby Bounties Board & Map */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Nearby Bounties
                </h2>
                <p className="text-xs text-muted-foreground">
                  Every bounty is an independent field task. Inspect details, claim an open bounty, or open your active task.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
                  {(
                    [
                      { id: "ALL", label: "All" },
                      { id: "NEARBY", label: "Nearby" },
                      { id: "URGENT", label: "Urgent" },
                      { id: "HIGHEST_REWARD", label: "Highest Reward" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setBoardFilter(f.id)}
                      className={cn(
                        "rounded px-2.5 py-1 font-mono text-[11px] transition-colors",
                        boardFilter === f.id
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center rounded-lg border border-border bg-surface p-1">
                  {(["SPLIT", "LIST", "MAP"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorkerViewMode(mode)}
                      className={cn(
                        "rounded px-2.5 py-1 font-mono text-[10px] uppercase",
                        workerViewMode === mode
                          ? "bg-surface-elevated text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={cn(
                "grid grid-cols-1 gap-6",
                workerViewMode === "SPLIT" && "xl:grid-cols-12"
              )}
            >
              {workerViewMode !== "MAP" && (
                <div
                  className={cn(
                    "space-y-3",
                    workerViewMode === "SPLIT" ? "xl:col-span-7" : "w-full"
                  )}
                >
                  {filteredBounties.length === 0 ? (
                    <EmptyState
                      title="No bounties available yet"
                      description="No Flood & Waste Bounties match your current filter."
                    />
                  ) : (
                    filteredBounties.map((bounty) => {
                      const isSelected = bounty.id === selectedBounty?.id;
                      const sBadge = statusBadgeMap[bounty.status];

                      return (
                        <div
                          key={bounty.id}
                          onClick={() => setSelectedBountyId(bounty.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedBountyId(bounty.id);
                            }
                          }}
                          className={cn(
                            "rounded-xl border p-4 transition-all cursor-pointer space-y-3",
                            isSelected
                              ? "border-primary bg-surface-elevated shadow-sm"
                              : "border-border bg-surface hover:border-border-strong"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">
                                {bounty.code}
                              </span>
                              <span
                                className={cn(
                                  "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                                  priorityBadgeStyle[bounty.priority]
                                )}
                              >
                                Priority: {bounty.priority}
                              </span>
                              <StatusBadge
                                tone={sBadge.tone}
                                label={`Status: ${sBadge.label}`}
                              />
                            </div>

                            <span className="rounded-md bg-secondary/15 border border-secondary/35 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                              +{bounty.rewardArc} ARC
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              {bounty.title} — {bounty.delhiLocality}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {bounty.corridorDetail}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Scale className="h-3 w-3 text-primary" />
                                {bounty.estimatedWasteKgRange}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-info" />
                                {bounty.distanceKm} km
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3 text-warning" />
                                {bounty.deadlineLabel}
                              </span>
                            </div>

                            <div
                              className="flex flex-wrap items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setInspectBountyId(bounty.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Inspect Bounty</span>
                              </Button>

                              {bounty.status === "OPEN" ? (
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    void handleClaimBounty(bounty.id)
                                  }
                                >
                                  Claim Bounty
                                </Button>
                              ) : bounty.status !== "VERIFIED" ? (
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    handleOpenActiveTask(bounty.id)
                                  }
                                >
                                  Open Active Task
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {workerViewMode !== "LIST" && (
                <div
                  className={cn(
                    workerViewMode === "SPLIT" ? "xl:col-span-5" : "w-full"
                  )}
                >
                  <DelhiBountyMap
                    bounties={bounties}
                    selectedBountyId={selectedBounty?.id ?? ""}
                    onSelectBounty={setSelectedBountyId}
                    activeRole="WORKER"
                    onInspectBounty={(b) => setInspectBountyId(b.id)}
                    onActionClick={(b) => {
                      setSelectedBountyId(b.id);
                      if (b.status === "OPEN") {
                        void handleClaimBounty(b.id);
                      } else {
                        handleOpenActiveTask(b.id);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* 1. OPERATOR VIEW: Open / Active / Pending / Verified Summary */}
          <section
            aria-label="Operator Bounty Summary"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Open Bounties
              </span>
              <span className="mt-1 font-mono text-2xl font-bold text-warning block">
                {openCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {urgentCount} urgent hotspots
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Active Bounties
              </span>
              <span className="mt-1 font-mono text-2xl font-bold text-info block">
                {claimedOrInProgressCount}
              </span>
              <span className="text-xs text-muted-foreground">
                Claimed by field workers
              </span>
            </div>

            <div className="rounded-xl border border-warning/40 bg-warning/[0.06] p-4">
              <span className="font-mono text-[10px] uppercase text-warning block">
                Pending Verification
              </span>
              <span className="mt-1 font-mono text-2xl font-bold text-warning block">
                {pendingVerificationCount}
              </span>
              <span className="text-xs text-muted-foreground">
                Ready for evidence review
              </span>
            </div>

            <div className="rounded-xl border border-secondary/40 bg-secondary/[0.06] p-4">
              <span className="font-mono text-[10px] uppercase text-emerald-300 block">
                Completed / Verified
              </span>
              <span className="mt-1 font-mono text-2xl font-bold text-emerald-400 block">
                {completedVerifiedCount}
              </span>
              <span className="text-xs text-muted-foreground">
                +{earnedArcTotal} ARC issued
              </span>
            </div>
          </section>

          {/* 2. OPERATOR VIEW: Create Bounty Form (when toggled) */}
          {showCreateModal && (
            <Card className="border-primary/50 bg-surface-elevated/95 shadow-elevated">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Create Drain Cleanup Bounty
                    </CardTitle>
                    <CardDescription>
                      Publish a targeted drain cleanup task for nearby workers.
                    </CardDescription>
                  </div>
                  <StatusBadge tone="primary" label="New Bounty" />
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={handlePublishBounty} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="bty-locality"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Delhi Locality
                      </label>
                      <select
                        id="bty-locality"
                        value={draftLocality}
                        onChange={(e) => {
                          const nextLoc = e.target
                            .value as FloodWasteBounty["delhiLocality"];
                          setDraftLocality(nextLoc);
                          const found = DELHI_BOUNTY_LOCATIONS.find(
                            (l) => l.locality === nextLoc
                          );
                          if (found) setDraftCorridor(found.defaultCorridor);
                        }}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                      >
                        {DELHI_BOUNTY_LOCATIONS.map((loc) => (
                          <option key={loc.locality} value={loc.locality}>
                            {loc.locality}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="bty-corridor"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Drain / Location Detail
                      </label>
                      <input
                        id="bty-corridor"
                        type="text"
                        value={draftCorridor}
                        onChange={(e) => setDraftCorridor(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bty-task"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Cleanup Task
                      </label>
                      <input
                        id="bty-task"
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label
                        htmlFor="bty-priority"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Priority
                      </label>
                      <select
                        id="bty-priority"
                        value={draftPriority}
                        onChange={(e) =>
                          setDraftPriority(e.target.value as BountyPriority)
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                      >
                        <option value="URGENT">URGENT</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="bty-deadline"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Deadline
                      </label>
                      <input
                        id="bty-deadline"
                        type="text"
                        value={draftDeadline}
                        onChange={(e) => setDraftDeadline(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bty-reward"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Reward (ARC)
                      </label>
                      <input
                        id="bty-reward"
                        type="number"
                        min={20}
                        step={10}
                        value={draftRewardArc}
                        onChange={(e) =>
                          setDraftRewardArc(Number(e.target.value))
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bty-waste"
                        className="font-mono text-[10px] uppercase text-muted-foreground block mb-1"
                      >
                        Estimated Waste
                      </label>
                      <input
                        id="bty-waste"
                        type="text"
                        value={draftWasteRange}
                        onChange={(e) => setDraftWasteRange(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="default" size="sm">
                      Publish Bounty
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 3. OPERATOR VIEW: Pending Verification List + Evidence Review Modal */}
          <OperatorVerificationPanel
            bounties={bounties}
            reviewingBountyId={reviewBountyId}
            onSelectReviewBounty={setReviewBountyId}
            onApproveBounty={handleApproveBounty}
            onRejectBounty={handleRejectBounty}
          />

          {/* 4. OPERATOR VIEW: Bounty Board + Delhi Map */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Bounty Board &amp; Delhi Map
              </h2>
              <p className="text-xs text-muted-foreground">
                Each bounty is an independent card. Click Inspect Bounty to view full task details.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="space-y-3 xl:col-span-7">
                {filteredBounties.length === 0 ? (
                  <EmptyState
                    title="No bounties available yet"
                    description="Create a drain cleanup bounty above to publish it to the field board."
                    actionLabel="Create Bounty"
                    onAction={() => setShowCreateModal(true)}
                  />
                ) : (
                  filteredBounties.map((bounty) => {
                    const isSelected = bounty.id === selectedBounty?.id;
                    const sBadge = statusBadgeMap[bounty.status];

                    return (
                      <div
                        key={bounty.id}
                        onClick={() => setSelectedBountyId(bounty.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedBountyId(bounty.id);
                          }
                        }}
                        className={cn(
                          "rounded-xl border p-4 transition-all cursor-pointer space-y-3",
                          isSelected
                            ? "border-primary bg-surface-elevated shadow-sm"
                            : "border-border bg-surface hover:border-border-strong"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary">
                              {bounty.code}
                            </span>
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                                priorityBadgeStyle[bounty.priority]
                              )}
                            >
                              Priority: {bounty.priority}
                            </span>
                            <StatusBadge
                              tone={sBadge.tone}
                              label={`Status: ${sBadge.label}`}
                            />
                          </div>

                          <span className="rounded-md bg-secondary/15 border border-secondary/35 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                            +{bounty.rewardArc} ARC
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              {bounty.title} — {bounty.delhiLocality}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {bounty.corridorDetail} · Est.{" "}
                              {bounty.estimatedWasteKgRange}
                            </p>
                          </div>

                          <div
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setInspectBountyId(bounty.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Inspect Bounty</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="xl:col-span-5">
                <DelhiBountyMap
                  bounties={bounties}
                  selectedBountyId={selectedBounty?.id ?? ""}
                  onSelectBounty={setSelectedBountyId}
                  activeRole="OPERATOR"
                  onInspectBounty={(b) => setInspectBountyId(b.id)}
                />
              </div>
            </div>
          </section>

          {/* 5. OPERATOR VIEW: Compact Cleanup Outcome Summary */}
          <RewardLedgerAnalytics
            bounties={bounties}
            earnedArcTotal={earnedArcTotal}
            pendingArcTotal={pendingArcTotal}
          />
        </>
      )}

      {/* ====================================================================
       * INSPECT BOUNTY DETAIL MODAL / DRAWER
       * ==================================================================== */}
      {inspectedBounty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-bounty-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border-strong bg-surface p-6 shadow-elevated space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {inspectedBounty.code}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                      priorityBadgeStyle[inspectedBounty.priority]
                    )}
                  >
                    Priority: {inspectedBounty.priority}
                  </span>
                  <StatusBadge
                    tone={statusBadgeMap[inspectedBounty.status].tone}
                    label={statusBadgeMap[inspectedBounty.status].label}
                  />
                </div>
                <h3
                  id="inspect-bounty-title"
                  className="text-lg font-bold text-foreground"
                >
                  {inspectedBounty.title} — {inspectedBounty.delhiLocality}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {inspectedBounty.corridorDetail}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectBountyId(null)}
                className="rounded-lg border border-border bg-surface-muted p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Close bounty details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Key Attributes Grid */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-muted/50 p-3.5 text-xs sm:grid-cols-3">
              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Estimated Waste
                </span>
                <span className="font-mono font-bold text-foreground block mt-0.5">
                  {inspectedBounty.estimatedWasteKgRange}
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Deadline
                </span>
                <span className="font-semibold text-warning block mt-0.5">
                  {inspectedBounty.deadlineLabel}
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Reward
                </span>
                <span className="font-mono font-bold text-emerald-400 block mt-0.5">
                  +{inspectedBounty.rewardArc} ARC
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Assigned Worker
                </span>
                <span className="font-semibold text-foreground block mt-0.5">
                  {inspectedBounty.assignedWorkerName ?? "Unclaimed"}
                </span>
              </div>

              <div className="col-span-2">
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  Operational Reason
                </span>
                <span className="text-foreground block mt-0.5">
                  {inspectedBounty.reason}
                </span>
              </div>
            </div>

            {/* Task Requirements */}
            <div className="rounded-xl border border-border bg-background/70 p-4 space-y-2">
              <p className="font-mono text-[11px] font-bold uppercase text-muted-foreground">
                Task Requirements
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs text-foreground/90">
                {inspectedBounty.taskInstructions.map((inst) => (
                  <li key={inst}>{inst}</li>
                ))}
              </ul>
            </div>

            {/* Submitted Evidence */}
            {(inspectedBounty.evidence.beforeImageLabel ||
              inspectedBounty.evidence.afterImageLabel) && (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2.5">
                <p className="font-mono text-[11px] font-bold uppercase text-primary">
                  Submitted Photo Evidence
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <S3EvidenceImage
                    s3Key={inspectedBounty.evidence.beforeImageLabel}
                    label="BEFORE PHOTO"
                    timestamp={inspectedBounty.evidence.beforeTimestamp}
                    tone="warning"
                  />
                  <S3EvidenceImage
                    s3Key={inspectedBounty.evidence.afterImageLabel}
                    label="AFTER PHOTO"
                    timestamp={inspectedBounty.evidence.afterTimestamp}
                    tone="success"
                  />
                </div>
              </div>
            )}

            {/* Modal Footer with Relevant Next Action */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInspectBountyId(null)}
              >
                Close
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {activeRole === "WORKER" ? (
                  inspectedBounty.status === "OPEN" ? (
                    ongoingWorkerTask ? (
                      <>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => {
                            handleOpenActiveTask(ongoingWorkerTask.id);
                          }}
                        >
                          Open Active Task
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void handleClaimBounty(inspectedBounty.id);
                          }}
                        >
                          Claim Bounty (+{inspectedBounty.rewardArc} ARC)
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          void handleClaimBounty(inspectedBounty.id);
                        }}
                      >
                        Claim Bounty (+{inspectedBounty.rewardArc} ARC)
                      </Button>
                    )
                  ) : inspectedBounty.status !== "VERIFIED" ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => {
                        handleOpenActiveTask(inspectedBounty.id);
                      }}
                    >
                      Open Active Task
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Completed &amp; Verified
                    </span>
                  )
                ) : inspectedBounty.status === "SUBMITTED" ||
                  inspectedBounty.status === "UNDER_REVIEW" ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const targetId = inspectedBounty.id;
                      setInspectBountyId(null);
                      setReviewBountyId(targetId);
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Review Evidence</span>
                  </Button>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    Status: {statusBadgeMap[inspectedBounty.status].label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

