import type {
  MissionAssignment,
  MonsoonPhase,
  MonsoonRiskAssessment,
  MonsoonRiskLevel,
  ResilienceZone,
  RiskFactor,
  SimulationInputs,
  SpongeMapAsset,
  ZoneWeatherSummary,
} from "@/types";

export function deriveMonsoonRiskLevel(score: number): MonsoonRiskLevel {
  if (score >= 76) return "CRITICAL";
  if (score >= 54) return "HIGH";
  if (score >= 32) return "MODERATE";
  return "LOW";
}

/**
 * Deterministic Flood & Waterlogging Risk Engine (Real Open-Meteo Forecast + Configured Capacity)
 *
 * Uses:
 * 1. Real forecast rainfall (hourly peak mm/hr + 72h total mm from Open-Meteo)
 * 2. Rain persistence / duration (rainy hours in 72h window)
 * 3. Configured drainage capacity threshold (`drainageCapacityEstimateMmHr` mm/hr)
 * 4. Existing asset inspection / task status (days since last check, blocked drains, verified tasks)
 */
export function evaluateZoneFloodRisk(
  zone: ResilienceZone,
  stage: MonsoonPhase,
  simOverrides?: SimulationInputs,
  weatherSummary?: ZoneWeatherSummary | null,
  zoneAssets?: SpongeMapAsset[],
  zoneMissions?: MissionAssignment[]
): MonsoonRiskAssessment {
  const configuredCapacityMmHr = zone.drainageCapacityEstimateMmHr;

  // 1. Real forecast rainfall & persistence from Open-Meteo (stored in DynamoDB)
  const realPeakMmHr = weatherSummary
    ? weatherSummary.peakRainfallMmHr
    : simOverrides?.rainfallIntensityMmHr ?? zone.peakIntensityMmHr;

  const realTotalRainMm = weatherSummary
    ? weatherSummary.totalRainfallMm
    : zone.forecastRainfallMm;

  const rainyHours = weatherSummary
    ? weatherSummary.rainyHoursCount
    : realTotalRainMm > 0
    ? zone.expectedDurationHours
    : 0;

  const maxProbability = weatherSummary?.maxRainProbability ?? 0;

  // 2. Existing asset inspection & task status
  const verifiedTaskCount = (zoneMissions ?? []).filter(
    (m) => m.zoneId === zone.id && m.status === "VERIFIED"
  ).length;
  const activeTaskCount = (zoneMissions ?? []).filter(
    (m) =>
      m.zoneId === zone.id &&
      (m.status === "ASSIGNED" ||
        m.status === "IN_PROGRESS" ||
        m.status === "SUBMITTED")
  ).length;

  const effectiveBlockedDrains = Math.max(
    0,
    zone.blockedDrainsCount - verifiedTaskCount
  );

  const maxInspectionDays =
    zoneAssets && zoneAssets.length > 0
      ? Math.max(...zoneAssets.map((a) => a.lastInspectionDaysAgo))
      : effectiveBlockedDrains >= 3
      ? 9
      : 4;

  // 3. Deterministic scoring components (no random values)
  // Component A: Peak hourly rainfall vs configured drainage capacity (0 - 38 pts)
  const capacityRatio =
    configuredCapacityMmHr > 0 ? realPeakMmHr / configuredCapacityMmHr : 0;
  const peakRainfallPts = Math.min(38, Math.round(capacityRatio * 26));

  // Component B: Rain persistence & 72h total volume + probability (0 - 22 pts)
  const persistencePts = Math.min(
    22,
    Math.round(
      rainyHours * 1.2 + realTotalRainMm * 0.25 + (maxProbability >= 60 ? 4 : 0)
    )
  );

  // Component C: Configured drainage capacity deficit when rain exceeds threshold (0 - 18 pts)
  const intensitySurplusMmHr = Math.max(
    0,
    Number((realPeakMmHr - configuredCapacityMmHr).toFixed(1))
  );
  const capacityDeficitPts =
    intensitySurplusMmHr > 0
      ? Math.min(18, Math.round(intensitySurplusMmHr * 1.8) + 4)
      : configuredCapacityMmHr <= 19
      ? 6
      : configuredCapacityMmHr <= 22
      ? 4
      : 2;

  // Component D: Asset inspection & drain blockage status (0 - 34 pts)
  const blockageRatio =
    zone.totalDrainsCount > 0
      ? effectiveBlockedDrains / zone.totalDrainsCount
      : 0;
  const inspectionOverduePts =
    maxInspectionDays >= 8 ? 10 : maxInspectionDays >= 5 ? 6 : 2;
  const drainStatusPts = Math.min(
    34,
    Math.round(blockageRatio * 44) +
      inspectionOverduePts -
      Math.min(6, activeTaskCount * 2)
  );

  // Local catchment vulnerability baseline (0 - 10 pts)
  const catchmentBaselinePts = Math.round(
    (zone.localVulnerabilityScore / 100) * 10
  );

  const rawScore =
    peakRainfallPts +
    persistencePts +
    capacityDeficitPts +
    Math.max(4, drainStatusPts) +
    catchmentBaselinePts;

  const riskScore = Math.max(12, Math.min(98, rawScore));
  const riskLevel = deriveMonsoonRiskLevel(riskScore);

  const forecastSeverity: MonsoonRiskLevel =
    realPeakMmHr >= configuredCapacityMmHr
      ? "CRITICAL"
      : realPeakMmHr >= configuredCapacityMmHr * 0.6 || realTotalRainMm >= 15
      ? "HIGH"
      : realPeakMmHr >= 1 || realTotalRainMm >= 2 || maxProbability >= 40
      ? "MODERATE"
      : "LOW";

  const capacitySeverity: MonsoonRiskLevel =
    intensitySurplusMmHr > 0
      ? "CRITICAL"
      : realPeakMmHr >= configuredCapacityMmHr * 0.7
      ? "HIGH"
      : configuredCapacityMmHr <= 20
      ? "MODERATE"
      : "LOW";

  const inspectionSeverity: MonsoonRiskLevel =
    effectiveBlockedDrains >= 3
      ? "CRITICAL"
      : effectiveBlockedDrains >= 2 || maxInspectionDays >= 7
      ? "HIGH"
      : effectiveBlockedDrains >= 1 || maxInspectionDays >= 4
      ? "MODERATE"
      : "LOW";

  const contributingFactors: RiskFactor[] = [
    {
      id: "rf-rain",
      label: "Forecast rainfall",
      valueLabel: `${realPeakMmHr.toFixed(1)} mm/hr peak · ${realTotalRainMm.toFixed(
        1
      )} mm over 72h (${rainyHours}h rain window)`,
      severity: forecastSeverity,
      weightPoints: peakRainfallPts + persistencePts,
      explanation:
        realPeakMmHr > 0
          ? `Open-Meteo forecasts ${realPeakMmHr.toFixed(1)} mm/hr peak hourly rainfall and ${realTotalRainMm.toFixed(1)} mm total across ${rainyHours} rainy hour(s).`
          : `Open-Meteo forecasts ${realPeakMmHr.toFixed(1)} mm/hr peak rainfall over the next 72 hours (up to ${maxProbability}% rain probability).`,
    },
    {
      id: "rf-capacity",
      label: "Configured drainage capacity",
      valueLabel: `Configured drainage capacity: ${configuredCapacityMmHr} mm/hr`,
      severity: capacitySeverity,
      weightPoints: capacityDeficitPts,
      explanation:
        intensitySurplusMmHr > 0
          ? `Forecast peak (${realPeakMmHr.toFixed(1)} mm/hr) exceeds configured drainage capacity (${configuredCapacityMmHr} mm/hr) by ${intensitySurplusMmHr.toFixed(1)} mm/hr.`
          : `Forecast peak (${realPeakMmHr.toFixed(1)} mm/hr) is within configured drainage capacity (${configuredCapacityMmHr} mm/hr) if primary grates are clear.`,
    },
    {
      id: "rf-inspection",
      label: "Inspection status",
      valueLabel: `${maxInspectionDays} days since last check · ${effectiveBlockedDrains}/${zone.totalDrainsCount} drains blocked or unverified`,
      severity: inspectionSeverity,
      weightPoints: Math.max(4, drainStatusPts),
      explanation:
        effectiveBlockedDrains > 0
          ? `${effectiveBlockedDrains} drain(s) require pre-rain clearance or verification (${maxInspectionDays} days since last field check).`
          : `All ${zone.totalDrainsCount} primary drains verified clear (last checked ${maxInspectionDays} days ago).`,
    },
  ];

  const headline =
    realPeakMmHr >= configuredCapacityMmHr
      ? `Forecast peak (${realPeakMmHr.toFixed(1)} mm/hr) exceeds configured drainage capacity (${configuredCapacityMmHr} mm/hr) with ${effectiveBlockedDrains} blocked/unverified drain(s).`
      : realPeakMmHr >= 2 || realTotalRainMm >= 2
      ? `Moderate rain forecast (${realPeakMmHr.toFixed(1)} mm/hr peak, ${realTotalRainMm.toFixed(1)} mm total) against ${configuredCapacityMmHr} mm/hr configured drainage capacity.`
      : effectiveBlockedDrains > 0
      ? `Low forecast rainfall (${realPeakMmHr.toFixed(1)} mm/hr), but ${effectiveBlockedDrains}/${zone.totalDrainsCount} drains remain blocked or overdue (${maxInspectionDays}d since check).`
      : `Low waterlogging risk under current Open-Meteo forecast (${realPeakMmHr.toFixed(1)} mm/hr) and ${configuredCapacityMmHr} mm/hr configured drainage capacity.`;

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    riskScore,
    riskLevel,
    headline,
    contributingFactors,
  };
}
