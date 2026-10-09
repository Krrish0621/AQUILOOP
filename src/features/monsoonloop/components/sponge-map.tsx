"use client";

import * as React from "react";
import Link from "next/link";
import {
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Send,
  ShieldAlert,
  Target,
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
  MissionAssignment,
  MonsoonRiskAssessment,
  ResilienceZone,
  SpongeMapAsset,
  ZoneWeatherSummary,
} from "@/types";
import { cn } from "@/lib/utils";

interface SpongeMapProps {
  zone: ResilienceZone;
  allZones: ResilienceZone[];
  assets: SpongeMapAsset[];
  missions: MissionAssignment[];
  weatherSummary?: ZoneWeatherSummary | null;
  riskAssessment?: MonsoonRiskAssessment;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  selectedMissionId: string | null;
  onSelectMission: (missionId: string) => void;
  onSelectZone: (zoneId: string) => void;
  onOpenDispatchFromAsset: (asset: SpongeMapAsset) => void;
}

function getMarkerStyle(asset: SpongeMapAsset) {
  if (asset.category === "DRAIN" || asset.status === "BLOCKED") {
    return {
      dotColor: "#EF4444",
      chipClass: "border-red-500/75 bg-red-950/90 text-red-100",
      shortStatus: asset.status === "BLOCKED" ? "BLOCKED" : "HIGH RISK",
      conditionLabel:
        asset.status === "BLOCKED"
          ? "Plastic/debris blockage"
          : "Moderate silt & litter build-up",
      badgeTone: "danger" as const,
    };
  }
  if (asset.category === "CANDIDATE_SITE" || asset.isCandidateSite) {
    return {
      dotColor: "#F59E0B",
      chipClass: "border-amber-500/75 bg-amber-950/90 text-amber-100",
      shortStatus: "CANDIDATE",
      conditionLabel: "Candidate capture site",
      badgeTone: "warning" as const,
    };
  }
  return {
    dotColor: "#10B981",
    chipClass: "border-emerald-500/75 bg-emerald-950/90 text-emerald-100",
    shortStatus: "READY",
    conditionLabel:
      asset.status === "SILTING_MODERATE"
        ? "Silt trap inspection needed"
        : "Operational water asset",
    badgeTone: "success" as const,
  };
}

function getShortAssetCode(code: string): string {
  return code
    .replace("Candidate Capture Site", "Site")
    .replace("Recharge Asset", "Recharge")
    .replace("Recharge Basin", "Basin")
    .replace("Recharge Trench", "Trench")
    .replace("Pond Inlet", "Pond")
    .replace("RWH Asset", "RWH");
}

export function SpongeMap({
  zone,
  allZones,
  assets,
  missions,
  weatherSummary,
  riskAssessment,
  selectedAssetId,
  onSelectAsset,
  selectedMissionId,
  onSelectMission,
  onSelectZone,
  onOpenDispatchFromAsset,
}: SpongeMapProps) {
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [zoomLevel, setZoomLevel] = React.useState<number>(zone.zoom);
  const [inspectorMode, setInspectorMode] = React.useState<"ASSET" | "TASK">(
    "ASSET"
  );

  const zoneAssets = React.useMemo(
    () => assets.filter((a) => a.zoneId === zone.id),
    [assets, zone.id]
  );

  const zoneMissions = React.useMemo(
    () => missions.filter((m) => m.zoneId === zone.id),
    [missions, zone.id]
  );

  const selectedAsset =
    zoneAssets.find((a) => a.id === selectedAssetId) ?? zoneAssets[0] ?? null;

  const selectedMission =
    zoneMissions.find((m) => m.id === selectedMissionId) ??
    zoneMissions[0] ??
    null;

  const localityLabel = getShortZoneLocality(zone.name);
  const bountyLocality =
    localityLabel === "Vasant Kunj" ? "Rohini" : localityLabel;

  React.useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          attributionControl: false,
          center: [zone.center.lng, zone.center.lat],
          zoom: zone.zoom,
          style:
            "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        });

        map.on("load", () => {
          if (!cancelled) {
            setMapReady(true);
          }
        });

        mapRef.current = map;
      } catch {
        // Fallback geographic overlay renders below
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [allZones]);

  React.useEffect(() => {
    setZoomLevel(zone.zoom);
    setInspectorMode("ASSET");
    if (mapRef.current && mapReady) {
      try {
        mapRef.current.flyTo({
          center: [zone.center.lng, zone.center.lat],
          zoom: zone.zoom,
          duration: 500,
        });
      } catch {
        // ignore
      }
    }
  }, [zone.id, zone.center.lat, zone.center.lng, zone.zoom, mapReady]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Number(Math.max(11, Math.min(16, prev + delta)).toFixed(1));
      if (mapRef.current && mapReady) {
        try {
          mapRef.current.zoomTo(next, { duration: 250 });
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleResetView = () => {
    setZoomLevel(zone.zoom);
    if (mapRef.current && mapReady) {
      try {
        mapRef.current.flyTo({
          center: [zone.center.lng, zone.center.lat],
          zoom: zone.zoom,
          duration: 350,
        });
      } catch {
        // ignore
      }
    }
  };

  // Distinct, non-overlapping marker layout slots within the viewport
  const assetSlots = [
    { left: "26%", top: "30%" },
    { left: "62%", top: "28%" },
    { left: "74%", top: "58%" },
    { left: "24%", top: "66%" },
    { left: "48%", top: "46%" },
  ];

  const taskSlots = [
    { left: "42%", top: "24%" },
    { left: "54%", top: "68%" },
    { left: "80%", top: "36%" },
  ];

  return (
    <Card className="overflow-hidden border-primary/30 h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <CardTitle className="text-base sm:text-lg">
                Risk &amp; Drain Map
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              Where is the problem? Click any marker in {localityLabel} to inspect or dispatch.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {allZones.map((z) => {
              const loc = getShortZoneLocality(z.name);
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => onSelectZone(z.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors",
                    z.id === zone.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Geographic Map Canvas */}
        <div className="relative h-[340px] w-full overflow-hidden rounded-xl border border-border bg-[#0A131F]">
          <div
            ref={mapContainerRef}
            className="absolute inset-0 h-full w-full"
          />

          {/* Readable Geographic Roads & Drainage Channel Overlay */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 800 340"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              x="55"
              y="35"
              width="210"
              height="105"
              rx="8"
              fill="#111E2E"
              fillOpacity="0.4"
              stroke="#1E324A"
              strokeWidth="1"
            />
            <rect
              x="310"
              y="35"
              width="220"
              height="110"
              rx="8"
              fill="#111E2E"
              fillOpacity="0.4"
              stroke="#1E324A"
              strokeWidth="1"
            />
            <rect
              x="565"
              y="40"
              width="185"
              height="105"
              rx="8"
              fill="#111E2E"
              fillOpacity="0.4"
              stroke="#1E324A"
              strokeWidth="1"
            />
            <rect
              x="75"
              y="180"
              width="225"
              height="110"
              rx="8"
              fill="#111E2E"
              fillOpacity="0.4"
              stroke="#1E324A"
              strokeWidth="1"
            />
            <rect
              x="345"
              y="185"
              width="240"
              height="105"
              rx="8"
              fill="#111E2E"
              fillOpacity="0.4"
              stroke="#1E324A"
              strokeWidth="1"
            />

            {/* Primary Arterial Roads */}
            <path
              d="M 0 162 L 800 155"
              stroke="#2A405C"
              strokeWidth="6"
              strokeOpacity="0.65"
            />
            <path
              d="M 290 0 L 325 340"
              stroke="#2A405C"
              strokeWidth="5"
              strokeOpacity="0.6"
            />

            {/* Main Stormwater Corridor */}
            <path
              d="M 20 285 C 200 245, 350 185, 500 165 C 620 150, 710 105, 785 70"
              stroke="#0EA5E9"
              strokeWidth="5"
              strokeOpacity="0.42"
            />
            <path
              d="M 20 285 C 200 245, 350 185, 500 165 C 620 150, 710 105, 785 70"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              strokeOpacity="0.75"
            />
          </svg>

          {/* Top-Left Location + Real Weather Pill */}
          <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>{localityLabel}, Delhi</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-[11px] text-primary">
              {(weatherSummary?.peakRainfallMmHr ?? zone.peakIntensityMmHr).toFixed(1)} mm/hr peak
            </span>
            {riskAssessment && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono text-[10px] font-bold uppercase text-warning">
                  {riskAssessment.riskLevel}
                </span>
              </>
            )}
          </div>

          {/* Top-Right Zoom Controls */}
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-border bg-background/90 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => handleZoom(0.5)}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-elevated text-foreground"
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.5)}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-elevated text-foreground"
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-elevated text-primary"
              aria-label="Reset view"
            >
              <LocateFixed className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Readable Map Markers */}
          <div className="relative z-10 h-full w-full">
            {zoneAssets.map((asset, idx) => {
              const pos = assetSlots[idx % assetSlots.length];
              const style = getMarkerStyle(asset);
              const isSelected =
                inspectorMode === "ASSET" && selectedAsset?.id === asset.id;

              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelectAsset(asset.id);
                    setInspectorMode("ASSET");
                  }}
                  style={{ left: pos.left, top: pos.top }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    style.chipClass,
                    isSelected && "ring-2 ring-white scale-105 z-30 shadow-xl"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        asset.status === "BLOCKED" && "animate-ping"
                      )}
                      style={{ backgroundColor: style.dotColor }}
                    />
                    <span className="text-xs font-bold leading-none">
                      {getShortAssetCode(asset.code)}
                    </span>
                  </div>
                  <span className="mt-0.5 pl-3.5 font-mono text-[9px] font-semibold uppercase opacity-90">
                    {style.shortStatus}
                  </span>
                </button>
              );
            })}

            {/* BLUE: Active Field Tasks */}
            {zoneMissions.slice(0, 2).map((msn, idx) => {
              const pos = taskSlots[idx % taskSlots.length];
              const isSelected =
                inspectorMode === "TASK" && selectedMission?.id === msn.id;

              return (
                <button
                  key={msn.id}
                  type="button"
                  onClick={() => {
                    onSelectMission(msn.id);
                    setInspectorMode("TASK");
                  }}
                  style={{ left: pos.left, top: pos.top }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-start rounded-lg border border-blue-400/80 bg-blue-950/90 px-2.5 py-1.5 text-left text-blue-100 shadow-md transition-all hover:scale-105",
                    isSelected && "ring-2 ring-white scale-105 z-30"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-blue-300 shrink-0" />
                    <span className="font-mono text-[11px] font-bold leading-none">
                      Task #{msn.missionCode}
                    </span>
                  </div>
                  <span className="mt-0.5 pl-4 font-mono text-[9px] font-semibold uppercase text-blue-200">
                    {msn.status.replace("_", " ")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/95 px-3.5 py-2 text-xs backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Blocked / High-Risk Drain
              </span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Water Asset
              </span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Active Task
              </span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Candidate Location
              </span>
            </div>
          </div>
        </div>

        {/* Selected Marker Detail Card (Section 12) */}
        {inspectorMode === "TASK" && selectedMission ? (
          <div className="rounded-xl border border-blue-500/40 bg-blue-950/20 p-4 space-y-2.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-300">
                    Task #{selectedMission.missionCode}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {localityLabel}
                  </span>
                  <StatusBadge
                    tone="primary"
                    label={selectedMission.status.replace("_", " ")}
                  />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedMission.actionTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Assigned team:{" "}
                  <strong className="text-foreground">
                    {selectedMission.assignedTeam}
                  </strong>{" "}
                  · Forecast:{" "}
                  <strong className="text-foreground">
                    {(weatherSummary?.peakRainfallMmHr ?? zone.peakIntensityMmHr).toFixed(1)} mm/hr
                  </strong>{" "}
                  · Configured drainage capacity: {zone.drainageCapacityEstimateMmHr} mm/hr
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setInspectorMode("ASSET")}
              >
                Back to Drain Marker
              </Button>
            </div>
          </div>
        ) : (
          selectedAsset && (
            <div className="rounded-xl border border-border-strong bg-surface-muted/65 p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {selectedAsset.code}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {localityLabel}
                    </span>
                    <StatusBadge
                      tone={getMarkerStyle(selectedAsset).badgeTone}
                      label={`Status: ${getMarkerStyle(selectedAsset).shortStatus}`}
                    />
                  </div>

                  <h3 className="text-sm font-semibold text-foreground sm:text-base">
                    {selectedAsset.name}
                  </h3>
                </div>

                {/* Primary: DISPATCH TASK | Secondary: CREATE BOUNTY */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => onOpenDispatchFromAsset(selectedAsset)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Dispatch Task</span>
                  </Button>

                  {selectedAsset.category === "DRAIN" && (
                    <Button asChild variant="secondary" size="sm">
                      <Link
                        href={`/flood-bounties?locality=${encodeURIComponent(
                          bountyLocality
                        )}&corridor=${encodeURIComponent(
                          selectedAsset.name
                        )}&task=${encodeURIComponent(
                          `Clear plastic and solid waste at ${selectedAsset.code}`
                        )}&waste=${encodeURIComponent(
                          "35–45 kg"
                        )}&priority=${encodeURIComponent(
                          selectedAsset.riskContribution === "CRITICAL"
                            ? "URGENT"
                            : "HIGH"
                        )}`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                        <span>Create Bounty</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-border-subtle pt-2.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">
                    Forecast rainfall
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {(weatherSummary?.peakRainfallMmHr ?? zone.peakIntensityMmHr).toFixed(1)} mm/hr peak ·{" "}
                    {(weatherSummary?.totalRainfallMm ?? zone.forecastRainfallMm).toFixed(1)} mm
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">
                    Drainage threshold
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    Configured drainage capacity: {zone.drainageCapacityEstimateMmHr} mm/hr
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">
                    Inspection / task status
                  </span>
                  <span className="font-medium text-foreground">
                    {selectedAsset.lastInspectionDaysAgo}d ago ·{" "}
                    {getMarkerStyle(selectedAsset).conditionLabel}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">
                    Recommended action
                  </span>
                  <span className="font-semibold text-primary">
                    {selectedAsset.recommendedAction}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
