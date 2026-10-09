import type {
  MissionAssignment,
  MonsoonPhase,
  ResilienceZone,
  SimulationInputs,
  SimulationResult,
} from "@/types";
import { evaluateZoneFloodRisk } from "./risk-engine";

/**
 * Default simulation inputs derived from a selected ResilienceZone.
 */
export function getDefaultSimulationInputs(
  zone: ResilienceZone
): SimulationInputs {
  const blockagePct =
    zone.totalDrainsCount > 0
      ? Math.round((zone.blockedDrainsCount / zone.totalDrainsCount) * 100)
      : 25;

  return {
    rainfallIntensityMmHr: zone.peakIntensityMmHr,
    drainBlockagePercent: blockagePct,
    availableCaptureCapacityPct: 78,
    clearedDrainsCount: Math.max(1, zone.totalDrainsCount - zone.blockedDrainsCount),
  };
}

/**
 * Deterministic What-If Resilience Simulator & RainBank Estimator (Steps 11 & 12)
 * Clearly labeled as ESTIMATE / SIMULATION for pre-monsoon resilience planning.
 */
export function runMonsoonSimulation(params: {
  zone: ResilienceZone;
  inputs: SimulationInputs;
  stage: MonsoonPhase;
  zoneMissions: MissionAssignment[];
}): SimulationResult {
  const { zone, inputs, stage, zoneMissions } = params;

  const riskEval = evaluateZoneFloodRisk(zone, stage, inputs);

  // Intensity ratio relative to zone baseline
  const intensityMultiplier =
    zone.peakIntensityMmHr > 0
      ? inputs.rainfallIntensityMmHr / zone.peakIntensityMmHr
      : 1;

  // Estimated total runoff in liters (scaled by intensity and blockage)
  const blockageRunoffPenalty = 1 + (inputs.drainBlockagePercent / 100) * 0.28;
  const clearedDrainRelief = Math.max(
    0.72,
    1 - inputs.clearedDrainsCount * 0.045
  );

  const estimatedRunoffLiters = Math.round(
    zone.estimatedBaseRunoffLiters *
      intensityMultiplier *
      blockageRunoffPenalty *
      clearedDrainRelief
  );

  // Completed or active mission bonus
  const verifiedOrActiveMissions = zoneMissions.filter(
    (m) =>
      m.status === "VERIFIED" ||
      m.status === "SUBMITTED" ||
      m.status === "IN_PROGRESS"
  ).length;

  // Water intercepted by existing SpongeMap assets (Liters)
  const effectiveAssetCapacity =
    zone.availableCaptureCapacityLiters *
    (inputs.availableCaptureCapacityPct / 100);

  const drainConveyanceEfficiency =
    0.55 +
    (inputs.clearedDrainsCount / Math.max(1, zone.totalDrainsCount)) * 0.35 +
    Math.min(0.1, verifiedOrActiveMissions * 0.025);

  const estimatedWaterInterceptedLiters = Math.min(
    estimatedRunoffLiters,
    Math.round(effectiveAssetCapacity * drainConveyanceEfficiency)
  );

  // Potential aquifer recharge (approx 76% of intercepted volume after evaporation/detention)
  const estimatedRechargePotentialLiters = Math.round(
    estimatedWaterInterceptedLiters * 0.76
  );

  const runoffReductionPercent =
    estimatedRunoffLiters > 0
      ? Math.min(
          85,
          Math.round(
            (estimatedWaterInterceptedLiters / estimatedRunoffLiters) * 100
          )
        )
      : 0;

  return {
    riskScore: riskEval.riskScore,
    riskLevel: riskEval.riskLevel,
    estimatedRunoffLiters,
    estimatedWaterInterceptedLiters,
    estimatedRechargePotentialLiters,
    runoffReductionPercent,
    drainsClearedEffective: inputs.clearedDrainsCount,
    assetsVerifiedEffective: Math.min(
      zone.captureAssetsCount,
      Math.max(2, verifiedOrActiveMissions + 1)
    ),
  };
}
