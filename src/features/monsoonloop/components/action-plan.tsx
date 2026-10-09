"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
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
import { getShortZoneLocality } from "@/features/monsoonloop/components/zone-selector";
import type {
  ActionPriority,
  ActionRecommendation,
  MissionAssignment,
  MonsoonPhase,
  ResilienceZone,
} from "@/types";
import { cn } from "@/lib/utils";

interface ActionPlanProps {
  zone: ResilienceZone;
  stage: MonsoonPhase;
  recommendations: ActionRecommendation[];
  missions: MissionAssignment[];
  onOpenDispatchFromRecommendation: (rec: ActionRecommendation) => void;
  onInspectAsset?: (assetId: string) => void;
}

const priorityBadgeStyles: Record<
  ActionPriority,
  { badge: string; dot: string }
> = {
  CRITICAL: {
    badge: "border-danger/45 bg-danger/15 text-danger",
    dot: "bg-danger",
  },
  HIGH: {
    badge: "border-warning/45 bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  MEDIUM: {
    badge: "border-info/45 bg-info/15 text-info",
    dot: "bg-info",
  },
  LOW: {
    badge: "border-success/45 bg-success/15 text-success",
    dot: "bg-success",
  },
};

function resolveDelhiLocalityForBounty(zoneName: string): string {
  const short = getShortZoneLocality(zoneName);
  if (short === "Vasant Kunj") return "Rohini";
  return short;
}

export function ActionPlan({
  zone,
  recommendations,
  missions,
  onOpenDispatchFromRecommendation,
  onInspectAsset,
}: ActionPlanProps) {
  const [showAll, setShowAll] = React.useState(false);
  const shortZoneName = getShortZoneLocality(zone.name);
  const bountyLocality = resolveDelhiLocalityForBounty(zone.name);

  const visibleRecommendations = showAll
    ? recommendations
    : recommendations.slice(0, 3);

  return (
    <Card className="border-primary/30 h-full flex flex-col justify-between">
      <CardHeader className="pb-3 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              Pre-Storm Action Decisions
            </CardTitle>
          </div>

          <StatusBadge tone="primary" label={shortZoneName} />
        </div>
        <CardDescription className="text-xs">
          Dispatch municipal engineering crews directly in MONSOONLOOP, or post
          solid-waste drain blockages as ARC-rewarded Flood &amp; Waste Bounties.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {visibleRecommendations.map((rec) => {
          const pStyle = priorityBadgeStyles[rec.priority];
          const existingMission = missions.find(
            (m) =>
              m.sourceActionId === rec.id ||
              (m.zoneId === rec.zoneId &&
                m.actionTitle.toLowerCase() === rec.title.toLowerCase())
          );

          const isDispatchable =
            !existingMission ||
            existingMission.status === "PENDING" ||
            existingMission.status === "FAILED";

          const isSolidWasteDrainIssue =
            rec.linkedAssetId?.includes("drain") ||
            rec.title.toLowerCase().includes("drain") ||
            rec.title.toLowerCase().includes("trash") ||
            rec.title.toLowerCase().includes("inlet");

          return (
            <div
              key={rec.id}
              className="rounded-xl border border-border bg-surface-muted/45 p-4 transition-colors hover:border-border-strong space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {rec.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {shortZoneName} · {rec.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-info" />
                      {rec.suggestedTeam}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                      {rec.deadlineLabel}
                    </span>
                    {rec.linkedAssetId && onInspectAsset && (
                      <button
                        type="button"
                        onClick={() => onInspectAsset(rec.linkedAssetId!)}
                        className="font-mono text-[11px] text-primary hover:underline"
                      >
                        View on Map
                      </button>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0",
                    pStyle.badge
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", pStyle.dot)} />
                  {rec.priority}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-2.5">
                {isSolidWasteDrainIssue && (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/flood-bounties?locality=${encodeURIComponent(
                        bountyLocality
                      )}&corridor=${encodeURIComponent(
                        rec.location
                      )}&task=${encodeURIComponent(
                        rec.title
                      )}&waste=MIXED_DRAIN_CHOKES&priority=${encodeURIComponent(
                        rec.priority === "CRITICAL" ? "CRITICAL" : "HIGH"
                      )}`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                      <span>POST CLEANUP BOUNTY</span>
                    </Link>
                  </Button>
                )}

                {!isDispatchable && existingMission ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/12 px-2.5 py-1.5 font-mono text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {existingMission.status === "VERIFIED"
                      ? `VERIFIED (${existingMission.missionCode})`
                      : existingMission.status === "IN_PROGRESS"
                      ? `IN PROGRESS (${existingMission.missionCode})`
                      : existingMission.status === "SUBMITTED"
                      ? `AWAITING REVIEW (${existingMission.missionCode})`
                      : `ASSIGNED (${existingMission.missionCode})`}
                  </span>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onOpenDispatchFromRecommendation(rec)}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {existingMission?.status === "PENDING"
                        ? `DISPATCH (${existingMission.missionCode})`
                        : "DISPATCH CREW"}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {recommendations.length > 3 && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="font-mono text-xs font-semibold uppercase text-primary hover:underline"
            >
              {showAll ? "SHOW TOP 3" : `SHOW ALL (${recommendations.length})`}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
