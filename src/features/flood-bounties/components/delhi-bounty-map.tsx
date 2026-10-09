"use client";

import * as React from "react";
import { Compass, Eye, LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type OperationalTone } from "@/components/shared/status-badge";
import type { FloodBountyStatus, FloodWasteBounty } from "@/types";
import { cn } from "@/lib/utils";

interface DelhiBountyMapProps {
  bounties: FloodWasteBounty[];
  selectedBountyId: string;
  onSelectBounty: (bountyId: string) => void;
  activeRole: "OPERATOR" | "WORKER";
  onInspectBounty: (bounty: FloodWasteBounty) => void;
  onActionClick?: (bounty: FloodWasteBounty) => void;
}

const statusMapMeta: Record<
  FloodBountyStatus,
  {
    label: string;
    tone: OperationalTone;
    dotColor: string;
    chipClass: string;
  }
> = {
  OPEN: {
    label: "Open",
    tone: "warning",
    dotColor: "#F59E0B",
    chipClass: "border-warning/55 bg-warning/20 text-warning",
  },
  CLAIMED: {
    label: "Claimed",
    tone: "info",
    dotColor: "#22A7F0",
    chipClass: "border-info/55 bg-info/20 text-info",
  },
  IN_PROGRESS: {
    label: "In Progress",
    tone: "primary",
    dotColor: "#0A9EC8",
    chipClass: "border-primary/55 bg-primary/20 text-primary",
  },
  SUBMITTED: {
    label: "Pending Review",
    tone: "warning",
    dotColor: "#F59E0B",
    chipClass: "border-warning/60 bg-warning/25 text-warning",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    tone: "warning",
    dotColor: "#F59E0B",
    chipClass: "border-warning/60 bg-warning/25 text-warning",
  },
  VERIFIED: {
    label: "Verified",
    tone: "success",
    dotColor: "#22B47E",
    chipClass: "border-success/55 bg-success/20 text-success",
  },
  REJECTED: {
    label: "Needs Resubmission",
    tone: "danger",
    dotColor: "#F0425F",
    chipClass: "border-danger/55 bg-danger/20 text-danger",
  },
};

export function DelhiBountyMap({
  bounties,
  selectedBountyId,
  onSelectBounty,
  activeRole,
  onInspectBounty,
  onActionClick,
}: DelhiBountyMapProps) {
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const [zoom, setZoom] = React.useState(10.5);

  const selectedBounty =
    bounties.find((b) => b.id === selectedBountyId) ?? bounties[0];

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
          center: [77.12, 28.64],
          zoom: 10.5,
          interactive: false,
          style: {
            version: 8,
            sources: {
              "carto-dark": {
                type: "raster",
                tiles: [
                  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
              },
            },
            layers: [
              {
                id: "delhi-bounty-bg",
                type: "background",
                paint: {
                  "background-color": "#08121E",
                },
              },
              {
                id: "carto-dark-layer",
                type: "raster",
                source: "carto-dark",
                paint: {
                  "raster-opacity": 0.72,
                },
              },
            ],
          },
        });

        mapRef.current = map;
      } catch {
        // Fallback to Delhi geographic SVG overlay if offline
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
  }, []);

  const projectDelhiCoord = (lat: number, lng: number) => {
    const xPct = ((lng - 76.98) / 0.34) * 78 + 11;
    const yPct = ((28.84 - lat) / 0.36) * 74 + 13;
    return {
      left: `${Math.max(10, Math.min(90, xPct))}%`,
      top: `${Math.max(14, Math.min(84, yPct))}%`,
    };
  };

  return (
    <Card className="overflow-hidden border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">
                Delhi NCR Bounty Hotspot Map
              </CardTitle>
            </div>
            <CardDescription className="mt-0.5">
              Select a location pin to inspect blocked-drain bounty status and details.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-border bg-[#08121E]">
          <div
            ref={mapContainerRef}
            className="absolute inset-0 h-full w-full opacity-85"
          />

          {/* Geographic Delhi NCR Roads, Sectors & Waterways Overlay */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 800 320"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Ring Road & Arterial Corridors */}
            <g stroke="rgba(148, 163, 184, 0.16)" strokeWidth="1.2">
              <ellipse cx="430" cy="165" rx="220" ry="110" />
              <path d="M 40 165 L 760 165" />
              <path d="M 380 15 L 440 310" />
              <path d="M 120 55 L 690 275" />
            </g>

            {/* Najafgarh Drain Channel */}
            <path
              d="M 90 230 C 210 200, 320 155, 450 120 C 540 95, 610 65, 650 40"
              stroke="hsl(var(--primary) / 0.55)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
            {/* Yamuna River Channel */}
            <path
              d="M 630 15 C 645 95, 665 170, 690 305"
              stroke="hsl(var(--secondary) / 0.65)"
              strokeWidth="4"
            />

            {/* Geographic Area Labels */}
            <g
              fill="rgba(148, 163, 184, 0.42)"
              fontFamily="monospace"
              fontSize="9"
              fontWeight="600"
            >
              <text x="120" y="255">
                NAJAFGARH DRAIN
              </text>
              <text x="645" y="135">
                YAMUNA RIVER
              </text>
              <text x="275" y="80">
                ROHINI / BAWANA
              </text>
              <text x="490" y="245">
                OKHLA / SOUTH DELHI
              </text>
            </g>
          </svg>

          {/* Top-Left Delhi Context Label */}
          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1 font-mono text-[11px] text-foreground backdrop-blur-sm">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>Delhi NCR Drain Corridors</span>
          </div>

          {/* Top-Right Zoom Controls */}
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-background/90 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(13, z + 0.5))}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-elevated text-foreground"
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(9.5, z - 0.5))}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-elevated text-foreground"
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(10.5)}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-elevated text-primary"
              aria-label="Reset view"
            >
              <LocateFixed className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Interactive Bounty Pins */}
          <div className="relative z-10 h-full w-full">
            {bounties.map((bounty) => {
              const pos = projectDelhiCoord(
                bounty.coordinates.lat,
                bounty.coordinates.lng
              );
              const meta = statusMapMeta[bounty.status];
              const isSelected = selectedBounty?.id === bounty.id;

              return (
                <button
                  key={bounty.id}
                  type="button"
                  onClick={() => onSelectBounty(bounty.id)}
                  style={{ left: pos.left, top: pos.top }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold shadow-elevated transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    meta.chipClass,
                    isSelected &&
                      "ring-2 ring-foreground scale-110 z-30 bg-surface-elevated text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      bounty.status === "OPEN" &&
                        bounty.priority === "URGENT" &&
                        "animate-ping"
                    )}
                    style={{ backgroundColor: meta.dotColor }}
                  />
                  <span>{bounty.delhiLocality}</span>
                  <span className="rounded bg-background/75 px-1 text-[9px]">
                    +{bounty.rewardArc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/90 px-3 py-1.5 text-[11px] backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-warning" />
                Open / Pending Review
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-info" />
                Claimed / In Progress
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                Verified
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Zoom {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Selected Map Point Detail Bar */}
        {selectedBounty && (
          <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-muted/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">
                  {selectedBounty.code}
                </span>
                <StatusBadge
                  tone={statusMapMeta[selectedBounty.status].tone}
                  label={statusMapMeta[selectedBounty.status].label}
                />
                <span className="font-mono text-xs text-emerald-400 font-semibold">
                  +{selectedBounty.rewardArc} ARC
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground sm:text-sm">
                {selectedBounty.title} — {selectedBounty.delhiLocality}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedBounty.corridorDetail} · Est.{" "}
                {selectedBounty.estimatedWasteKgRange}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInspectBounty(selectedBounty)}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect Bounty</span>
              </Button>

              {onActionClick && activeRole === "WORKER" && (
                selectedBounty.status === "OPEN" ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => onActionClick(selectedBounty)}
                  >
                    Claim Bounty
                  </Button>
                ) : selectedBounty.status !== "VERIFIED" ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => onActionClick(selectedBounty)}
                  >
                    Open Active Task
                  </Button>
                ) : null
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
