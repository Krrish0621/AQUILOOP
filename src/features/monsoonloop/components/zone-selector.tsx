"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import type {
  MissionAssignment,
  MonsoonPhase,
  MonsoonRiskLevel,
  ResilienceZone,
  SpongeMapAsset,
  ZoneWeatherSummary,
} from "@/types";
import { evaluateZoneFloodRisk } from "@/features/monsoonloop/lib/risk-engine";
import { cn } from "@/lib/utils";

interface ZoneSelectorProps {
  zones: ResilienceZone[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  selectedStage: MonsoonPhase;
  missions?: MissionAssignment[];
  weatherByLocation?: Record<string, ZoneWeatherSummary>;
  assets?: SpongeMapAsset[];
}

const riskBadgeStyles: Record<MonsoonRiskLevel, string> = {
  CRITICAL: "border-danger/45 bg-danger/15 text-danger",
  HIGH: "border-warning/45 bg-warning/15 text-warning",
  MODERATE: "border-info/45 bg-info/15 text-info",
  LOW: "border-success/45 bg-success/15 text-success",
};

const riskDisplayLabel: Record<MonsoonRiskLevel, string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH RISK",
  MODERATE: "MODERATE",
  LOW: "LOW",
};

export function getShortZoneLocality(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("mayapuri")) return "Mayapuri";
  if (lower.includes("najafgarh")) return "Najafgarh";
  if (lower.includes("dwarka")) return "Dwarka";
  if (lower.includes("rohini")) return "Rohini";
  if (lower.includes("bawana")) return "Bawana";
  if (lower.includes("okhla")) return "Okhla";
  if (lower.includes("narela")) return "Narela";
  if (lower.includes("delhi")) return "Delhi";
  if (lower.includes("vasant")) return "Rohini";
  return name;
}

export function ZoneSelector({
  zones,
  selectedZoneId,
  onSelectZone,
  selectedStage,
  missions = [],
  weatherByLocation = {},
  assets = [],
}: ZoneSelectorProps) {
  return (
    <section aria-label="Risk Zones" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Risk Zones
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Select a zone to update Open-Meteo forecast, risk, map, and actions
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const locality = zone.locationKey || getShortZoneLocality(zone.name);
          const zoneWeather = weatherByLocation[locality] ?? null;
          const zoneAssets = assets.filter((a) => a.zoneId === zone.id);
          const riskEval = evaluateZoneFloodRisk(
            zone,
            selectedStage,
            undefined,
            zoneWeather,
            zoneAssets,
            missions
          );
          const displayRainMm = zoneWeather
            ? zoneWeather.totalRainfallMm.toFixed(1)
            : zone.forecastRainfallMm.toFixed(1);
          const displayPeakMmHr = zoneWeather
            ? zoneWeather.peakRainfallMmHr.toFixed(1)
            : zone.peakIntensityMmHr.toFixed(1);

          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onSelectZone(zone.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/[0.09] shadow-sm ring-1 ring-primary"
                  : "border-border bg-surface hover:border-border-strong"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold uppercase tracking-wide text-foreground">
                  {locality}
                </span>
                <span
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                    riskBadgeStyles[riskEval.riskLevel]
                  )}
                >
                  {riskDisplayLabel[riskEval.riskLevel]}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <div>
                  <span className="font-mono text-lg font-bold text-foreground">
                    {displayRainMm} mm
                  </span>
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                    ({displayPeakMmHr} mm/hr peak)
                  </span>
                </div>
                <span className="text-xs font-medium text-warning shrink-0">
                  {zone.blockedDrainsCount}{" "}
                  {zone.blockedDrainsCount === 1
                    ? "drain blocked"
                    : "drains blocked"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
