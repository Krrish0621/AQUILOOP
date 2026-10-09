import type {
  ActionPriority,
  ActionRecommendation,
  MonsoonPhase,
  MonsoonRiskAssessment,
  ResilienceZone,
  SpongeMapAsset,
  ZoneWeatherSummary,
} from "@/types";

export function scoreToActionPriority(score: number): ActionPriority {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function calculateActionPriorityScore(params: {
  zoneRiskScore: number;
  assetStatusFactor: number;
  weatherUrgencyBonus: number;
}): { score: number; priority: ActionPriority } {
  const raw =
    Math.round(params.zoneRiskScore * 0.55) +
    params.assetStatusFactor +
    params.weatherUrgencyBonus;
  const clamped = Math.max(18, Math.min(99, raw));
  return {
    score: clamped,
    priority: scoreToActionPriority(clamped),
  };
}

/**
 * Deterministic Action Planner Driven by Real Open-Meteo Forecast + Asset State (Section 13)
 *
 * - Heavy rain forecast: prioritizes urgent drain inspection/clearing before peak rainfall.
 * - Moderate rain forecast: recommends recharge/capture preparation and inlet verification.
 * - Low rain forecast: recommends routine inspection/maintenance tasks without fake storm text.
 */
export function generateZoneActionPlan(params: {
  zone: ResilienceZone;
  stage: MonsoonPhase;
  riskAssessment: MonsoonRiskAssessment;
  zoneAssets: SpongeMapAsset[];
  weatherSummary?: ZoneWeatherSummary | null;
}): ActionRecommendation[] {
  const { zone, stage, riskAssessment, zoneAssets, weatherSummary } = params;

  const peakMmHr = weatherSummary
    ? weatherSummary.peakRainfallMmHr
    : zone.peakIntensityMmHr;
  const totalMm = weatherSummary
    ? weatherSummary.totalRainfallMm
    : zone.forecastRainfallMm;
  const configuredCapacity = zone.drainageCapacityEstimateMmHr;

  const isHeavyRain =
    peakMmHr >= configuredCapacity * 0.7 || totalMm >= 15;
  const isModerateRain =
    !isHeavyRain && (peakMmHr >= 2.0 || totalMm >= 2.0);

  const weatherUrgencyBonus = isHeavyRain ? 22 : isModerateRain ? 12 : 2;
  const deadlineLabel = isHeavyRain
    ? "Immediate (Within 2–4 hrs before peak rain)"
    : isModerateRain
    ? "Within 6 hrs (Pre-rain capture window)"
    : "Routine Window (Within 24 hrs)";

  const actions: ActionRecommendation[] = [];
  const primaryDrain =
    zoneAssets.find((a) => a.category === "DRAIN") ?? zoneAssets[0];
  const primaryRecharge =
    zoneAssets.find((a) => a.category === "RECHARGE_ASSET") ?? zoneAssets[1];
  const primaryPond =
    zoneAssets.find(
      (a) => a.category === "POND" || a.category === "RWH_ASSET"
    ) ?? zoneAssets[2];

  // Action 1: Drain Clearance / Routine Drain Maintenance
  if (primaryDrain) {
    const p1 = calculateActionPriorityScore({
      zoneRiskScore: riskAssessment.riskScore,
      assetStatusFactor: primaryDrain.status === "BLOCKED" ? 32 : 18,
      weatherUrgencyBonus,
    });

    const drainTitle = isHeavyRain
      ? `Urgent: Clear ${primaryDrain.code} Before ${peakMmHr.toFixed(1)} mm/hr Peak Rain`
      : isModerateRain
      ? `Clear ${primaryDrain.code} Grate for ${totalMm.toFixed(1)} mm Incoming Rain`
      : primaryDrain.status === "BLOCKED"
      ? `Routine Clearance: Remove Debris at ${primaryDrain.code} (Dry Window)`
      : `Routine Inspection: Check ${primaryDrain.code} Grate & Outfall`;

    const drainReason = isHeavyRain
      ? `${primaryDrain.code} is ${primaryDrain.status.replace("_", " ")} (${primaryDrain.lastInspectionDaysAgo}d since check) while Open-Meteo forecasts ${peakMmHr.toFixed(1)} mm/hr peak rain against ${configuredCapacity} mm/hr configured drainage capacity.`
      : isModerateRain
      ? `Open-Meteo forecasts ${totalMm.toFixed(1)} mm rain (${peakMmHr.toFixed(1)} mm/hr peak); clear ${primaryDrain.code} (${primaryDrain.lastInspectionDaysAgo}d since check) to prevent localized pooling.`
      : `Forecast rainfall is currently low (${peakMmHr.toFixed(1)} mm/hr peak, ${totalMm.toFixed(1)} mm over 72h). Use this dry window to clear ${primaryDrain.code} (last checked ${primaryDrain.lastInspectionDaysAgo} days ago).`;

    actions.push({
      id: `act-${zone.id}-1`,
      code: `${zone.code.replace(" ", "")}-ACT-01`,
      zoneId: zone.id,
      zoneCode: zone.code,
      stage,
      title: drainTitle,
      priority: p1.priority,
      priorityScore: p1.score,
      location: primaryDrain.name,
      linkedAssetId: primaryDrain.id,
      reason: drainReason,
      deadlineLabel,
      estimatedImpactLiters: primaryDrain.estimatedCapacityLiters,
      estimatedRiskReductionPts: 14,
      suggestedTeam: "Team B — Stormwater & Culvert Unit",
      actionCategory: "DRAIN_CLEARANCE",
    });
  }

  // Action 2: Recharge / Capture Asset Preparation or Routine Silt-Trap Maintenance
  if (primaryRecharge) {
    const p2 = calculateActionPriorityScore({
      zoneRiskScore: riskAssessment.riskScore,
      assetStatusFactor:
        primaryRecharge.status === "SILTING_MODERATE" ? 24 : 14,
      weatherUrgencyBonus: isModerateRain
        ? weatherUrgencyBonus + 6
        : weatherUrgencyBonus,
    });

    const rechargeTitle = isHeavyRain
      ? `Open Diversion & Flush Silt Trap at ${primaryRecharge.code}`
      : isModerateRain
      ? `Prepare ${primaryRecharge.code} for ${totalMm.toFixed(1)} mm Recharge Capture`
      : `Routine Maintenance: Inspect Silt Trap at ${primaryRecharge.code}`;

    const rechargeReason =
      isHeavyRain || isModerateRain
        ? `Prepare ${Math.round(primaryRecharge.estimatedCapacityLiters / 1000)} kL percolation capacity at ${primaryRecharge.code} for ${totalMm.toFixed(1)} mm forecast rainfall.`
        : `Low forecast rainfall (${totalMm.toFixed(1)} mm over 72h); perform scheduled desilting at ${primaryRecharge.code} (${primaryRecharge.lastInspectionDaysAgo} days since last check).`;

    actions.push({
      id: `act-${zone.id}-2`,
      code: `${zone.code.replace(" ", "")}-ACT-02`,
      zoneId: zone.id,
      zoneCode: zone.code,
      stage,
      title: rechargeTitle,
      priority: p2.priority,
      priorityScore: p2.score,
      location: primaryRecharge.name,
      linkedAssetId: primaryRecharge.id,
      reason: rechargeReason,
      deadlineLabel,
      estimatedImpactLiters: primaryRecharge.estimatedCapacityLiters,
      estimatedRiskReductionPts: 9,
      suggestedTeam: "Team C — Aquifer & Sluice Operations",
      actionCategory: "RECHARGE_PREP",
    });
  }

  // Action 3: Pond / RWH Inlet Verification
  if (primaryPond) {
    const p3 = calculateActionPriorityScore({
      zoneRiskScore: riskAssessment.riskScore,
      assetStatusFactor: 14,
      weatherUrgencyBonus,
    });

    const pondTitle =
      isHeavyRain || isModerateRain
        ? `Verify ${primaryPond.code} Inlet Screen Before Rain Window`
        : `Routine Check: Verify ${primaryPond.code} Weir & Filter Screen`;

    const pondReason =
      isHeavyRain || isModerateRain
        ? `Route forecast runoff (${peakMmHr.toFixed(1)} mm/hr peak) into ${primaryPond.code} (${Math.round(primaryPond.estimatedCapacityLiters / 1000)} kL capacity).`
        : `Routine inspection of ${primaryPond.code} inlet screen (${primaryPond.lastInspectionDaysAgo} days since last check) while forecast rainfall is ${totalMm.toFixed(1)} mm.`;

    actions.push({
      id: `act-${zone.id}-3`,
      code: `${zone.code.replace(" ", "")}-ACT-03`,
      zoneId: zone.id,
      zoneCode: zone.code,
      stage,
      title: pondTitle,
      priority: p3.priority,
      priorityScore: p3.score,
      location: primaryPond.name,
      linkedAssetId: primaryPond.id,
      reason: pondReason,
      deadlineLabel,
      estimatedImpactLiters: Math.round(
        primaryPond.estimatedCapacityLiters * 0.8
      ),
      estimatedRiskReductionPts: 7,
      suggestedTeam: "Team D — RWH & Basin Inspection Crew",
      actionCategory: "INLET_VERIFICATION",
    });
  }

  return actions.sort((a, b) => b.priorityScore - a.priorityScore);
}
