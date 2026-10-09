/**
 * AQUILOOP Core Domain Types (Foundation + MONSOONLOOP + Flood & Waste Bounties)
 * Core Philosophy: PREDICT -> ACT -> VERIFY -> MEASURE IMPACT
 */

export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "URGENT";

export type MonsoonRiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type ActionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type MonsoonPhase =
  | "WATCH_48H"
  | "PREPARE_24H"
  | "ACTION_12H"
  | "URGENT_6H"
  | "NOWCAST_3H"
  | "EVENT_0H"
  | "VERIFY_6H"
  | "IMPACT_24H"
  | "VERIFY_POST";

export type MissionStatus =
  | "QUEUED"
  | "DISPATCHED"
  | "IN_PROGRESS"
  | "AWAITING_VERIFICATION"
  | "VERIFIED";

export type MonsoonMissionStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VERIFIED"
  | "FAILED";

export type BountyStatus =
  | "OPEN"
  | "CLAIMED"
  | "EVIDENCE_SUBMITTED"
  | "AI_VERIFIED"
  | "CREDITED";

export type WaterAssetType =
  | "PERCOLATION_BASIN"
  | "STORMWATER_RETENTION_POND"
  | "MUNICIPAL_RECHARGE_WELL"
  | "BIOSWALE_CORRIDOR"
  | "CHECK_DAM_CHANNEL";

export type WaterAssetReadiness =
  | "OPTIMAL"
  | "PRE_CLEARANCE_REQUIRED"
  | "DIVERSION_READY"
  | "CAPACITY_NEAR_LIMIT"
  | "REQUIRES_VALIDATION";

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

/**
 * FloodRisk — Localized waterlogging & drainage vulnerability assessment.
 * Uses risk-oriented, probabilistic framing rather than deterministic claims.
 */
export interface FloodRisk {
  id: string;
  wardCode: string;
  zoneName: string;
  corridorName: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100 vulnerability index
  forecastRainMm: number;
  drainageBlockageProbability: number; // percentage 0 - 100
  primaryVulnerabilityFactor: string;
  recommendedActionWindowHours: number;
  linkedBountyCount: number;
  linkedAssetIds: string[];
  coordinates: GeoCoordinate;
  updatedAt: string;
}

/**
 * Bounty — Foundation summary type for Command Center overview.
 */
export interface Bounty {
  id: string;
  code: string;
  title: string;
  wardCode: string;
  locationName: string;
  riskLevel: RiskLevel;
  estimatedWasteKg: number;
  creditRewardUnits: number; // Digital resilience credits (non-monetary MVP representation)
  status: BountyStatus;
  dueInHours: number;
  claimedByWorkerId?: string;
  gpsVerified: boolean;
  beforePhotoSubmitted: boolean;
  afterPhotoSubmitted: boolean;
  aiConfidenceScore?: number;
  coordinates: GeoCoordinate;
}

/**
 * Mission — Coordinated municipal or workforce action generated from MONSOONLOOP.
 */
export interface Mission {
  id: string;
  code: string;
  title: string;
  module: "MONSOONLOOP" | "FLOOD_BOUNTIES" | "STUBBLE_EXCHANGE";
  phase: MonsoonPhase;
  priority: RiskLevel;
  assignedUnit: string;
  targetZone: string;
  targetAssetName: string;
  status: MissionStatus;
  progressPercent: number;
  estimatedRechargeKiloLiters: number;
  etaHours: number;
  verificationMethod: string;
}

/**
 * WaterAsset — Existing municipal water capture/recharge infrastructure or candidate site.
 * Note: Candidate sites require engineering and hydrogeological validation.
 */
export interface WaterAsset {
  id: string;
  code: string;
  name: string;
  type: WaterAssetType;
  zoneName: string;
  readiness: WaterAssetReadiness;
  currentStoragePercent: number;
  availableCaptureCapacityKl: number;
  inletClearanceStatus: "CLEAR" | "PARTIAL_SILTING" | "OBSTRUCTED";
  isCandidateLocation: boolean;
  engineeringValidationNote?: string;
  coordinates: GeoCoordinate;
}

/**
 * RainEvent — Incoming weather & hydrological pulse tracked by MONSOONLOOP RainPulse.
 */
export interface RainEvent {
  id: string;
  eventCode: string;
  title: string;
  activePhase: MonsoonPhase;
  timeToPeakHours: number;
  expectedCumulativeMm: number;
  peakIntensityMmPerHr: number;
  confidenceIntervalPercent: number;
  affectedWardsCount: number;
  estimatedCapturePotentialMld: number; // Million Liters per Day equivalent
  advisorySummary: string;
  forecastWindowStart: string;
  forecastWindowEnd: string;
}

/**
 * ImpactMetric — Quantified environmental & water-resilience outcome recorded in RainBank.
 */
export interface ImpactMetric {
  id: string;
  key: string;
  label: string;
  category: "RECHARGE" | "WASTE_CLEARED" | "BIOMASS_DIVERTED" | "CREDITS_ISSUED";
  currentValue: number;
  targetValue: number;
  unit: string;
  deltaPercent: number;
  trendDirection: "UP" | "DOWN" | "STABLE";
  verificationRatePercent: number;
  periodLabel: string;
}

/**
 * StubbleListing — Unburned agricultural crop residue listed on Stubble-to-Water Exchange.
 */
export interface StubbleListing {
  id: string;
  listingCode: string;
  farmerClusterName: string;
  district: string;
  biomassTonnes: number;
  cropType: "PADDY_STRAW" | "WHEAT_STUBBLE" | "MIXED_RESIDUE";
  moisturePercent: number;
  availableUntilDate: string;
  status: "AVAILABLE" | "MATCHED" | "COLLECTED" | "CREDITED";
  matchedBuyerName?: string;
  estimatedResilienceCredits: number;
  soilMoistureRetentionEquivalentKl: number;
}

/**
 * ResilienceCredit — Digital ledger record representing verified environmental resilience actions.
 */
export interface ResilienceCredit {
  id: string;
  ledgerHash: string;
  sourceModule: "FLOOD_BOUNTIES" | "MONSOONLOOP" | "STUBBLE_EXCHANGE";
  recipientRole: "WASTE_RESPONDER" | "FARMER_PRODUCER" | "MUNICIPAL_WARD";
  recipientIdentifier: string;
  unitsIssued: number;
  waterImpactEquivalentKl: number;
  verificationStatus: "PENDING_AI_CHECK" | "VERIFIED_RECORDED" | "AUDITED";
  issuedAt: string;
}

/**
 * Time-series telemetry point for Command Center rainfall, risk, and recharge charts.
 */
export interface RainfallTelemetryPoint {
  timeLabel: string;
  horizonHours: number;
  forecastRainMm: number;
  riskIndex: number;
  projectedRechargeKl: number;
  phaseLabel: string;
}

/* ============================================================================
 * MONSOONLOOP MODULE DOMAIN TYPES
 * ============================================================================ */

export type SpongeAssetCategory =
  | "DRAIN"
  | "POND"
  | "RECHARGE_ASSET"
  | "RWH_ASSET"
  | "CANDIDATE_SITE";

export type SpongeAssetOperationalStatus =
  | "BLOCKED"
  | "SILTING_MODERATE"
  | "READY"
  | "DIVERSION_ACTIVE"
  | "CANDIDATE";

export interface SpongeMapAsset {
  id: string;
  code: string;
  name: string;
  zoneId: string;
  category: SpongeAssetCategory;
  status: SpongeAssetOperationalStatus;
  riskContribution: MonsoonRiskLevel;
  lastInspectionDaysAgo: number;
  recommendedAction: string;
  estimatedCapacityLiters: number;
  currentUtilizationPercent: number;
  isCandidateSite: boolean;
  validationRequirement?: string;
  coordinates: GeoCoordinate;
}

export interface ResilienceZone {
  id: string;
  code: string;
  locationKey?: string;
  name: string;
  wardLabel: string;
  baseRiskScore: number;
  forecastRainfallMm: number;
  peakIntensityMmHr: number;
  expectedDurationHours: number;
  vulnerableAssetsCount: number;
  totalDrainsCount: number;
  blockedDrainsCount: number;
  captureAssetsCount: number;
  availableCaptureCapacityLiters: number;
  drainageCapacityEstimateMmHr: number;
  localVulnerabilityScore: number; // 0 - 100
  lowLyingTopographyFactor: string;
  estimatedBaseRunoffLiters: number;
  center: GeoCoordinate;
  zoom: number;
  polygonCoordinates: [number, number][]; // [lng, lat] ring for GeoJSON
}

export interface WeatherForecastHourlyPoint {
  id: string;
  locationKey: string;
  locationName: string;
  latitude: number;
  longitude: number;
  forecastTime: string;
  rainfallMm: number;
  rainProbability: number;
  temperatureC: number;
  weatherCode: number;
  source: string;
  fetchedAt: string;
}

export interface ZoneWeatherSummary {
  locationKey: string;
  locationName: string;
  hourlyPoints: WeatherForecastHourlyPoint[];
  totalRainfallMm: number;
  peakRainfallMmHr: number;
  peakForecastTime: string | null;
  rainyHoursCount: number;
  maxRainProbability: number;
  latestTemperatureC: number | null;
  fetchedAt: string | null;
  source: string;
}

export interface RiskFactor {
  id: string;
  label: string;
  valueLabel: string;
  severity: MonsoonRiskLevel;
  weightPoints: number;
  explanation: string;
}

export interface MonsoonRiskAssessment {
  zoneId: string;
  zoneName: string;
  riskScore: number; // 0 - 100
  riskLevel: MonsoonRiskLevel;
  headline: string;
  contributingFactors: RiskFactor[];
}

export interface RainfallForecastPoint {
  id: string;
  hourLabel: string;
  offsetHours: number;
  stage: MonsoonPhase;
  stageShortLabel: string;
  intensityMmHr: number;
  cumulativeMm: number;
  riskThresholdMmHr: number;
  estimatedRunoffKl: number;
  estimatedInterceptedKl: number;
}

export interface ActionRecommendation {
  id: string;
  code: string;
  zoneId: string;
  zoneCode: string;
  stage: MonsoonPhase;
  title: string;
  priority: ActionPriority;
  priorityScore: number;
  location: string;
  linkedAssetId?: string;
  reason: string;
  deadlineLabel: string;
  estimatedImpactLiters: number;
  estimatedRiskReductionPts: number;
  suggestedTeam: string;
  actionCategory:
    | "DRAIN_CLEARANCE"
    | "RECHARGE_PREP"
    | "INLET_VERIFICATION"
    | "TEAM_DEPLOYMENT"
    | "FLOW_ROUTING";
}

export type TaskGpsCaptureStatus =
  | "CAPTURED"
  | "DENIED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "NOT_CAPTURED";

export interface TaskEvidenceSubmission {
  beforeEvidenceKey?: string;
  beforeUploadedAt?: string;
  workCompleted?: boolean;
  workCompletedAt?: string;
  afterEvidenceKey?: string;
  afterUploadedAt?: string;
  submittedLatitude?: number | null;
  submittedLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
  gpsStatus?: TaskGpsCaptureStatus;
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface MissionAssignment {
  id: string;
  missionCode: string;
  sourceActionId?: string;
  actionTitle: string;
  description?: string;
  notes?: string;
  taskType?: string;
  zoneId: string;
  zoneCode: string;
  location: string;
  priority: ActionPriority;
  assignedTeam: string;
  assignedWorkerId?: string;
  deadline: string;
  status: MonsoonMissionStatus;
  expectedImpactLiters: number;
  createdAtLabel: string;
  createdAt?: string;
  updatedAt?: string;
  coordinates: GeoCoordinate;
  evidence?: TaskEvidenceSubmission;
}

export interface SimulationInputs {
  rainfallIntensityMmHr: number;
  drainBlockagePercent: number;
  availableCaptureCapacityPct: number;
  clearedDrainsCount: number;
}

export interface SimulationResult {
  riskScore: number;
  riskLevel: MonsoonRiskLevel;
  estimatedRunoffLiters: number;
  estimatedWaterInterceptedLiters: number;
  estimatedRechargePotentialLiters: number;
  runoffReductionPercent: number;
  drainsClearedEffective: number;
  assetsVerifiedEffective: number;
}

/* ============================================================================
 * FLOOD & WASTE BOUNTIES MODULE DOMAIN TYPES (Step 20 & Step 27)
 * ============================================================================ */

export type FloodBountyStatus =
  | "OPEN"
  | "CLAIMED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "REJECTED";

export type BountyPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export type BountyRejectionReason =
  | "INSUFFICIENT_EVIDENCE"
  | "MISMATCH"
  | "CLEANUP_INCOMPLETE"
  | "LOCATION_MISMATCH"
  | "IMAGE_UNCLEAR";

export interface BountyEvidence {
  beforeImageLabel?: string;
  beforeTimestamp?: string;
  beforeLocationLabel?: string;
  beforeNote?: string;
  cleanupCompleted?: boolean;
  cleanupCompletedAt?: string;
  afterImageLabel?: string;
  afterTimestamp?: string;
  afterLocationLabel?: string;
  afterNote?: string;
  gpsCaptured?: boolean;
  gpsLabel?: string;
  gpsStatusNote?: string;
  submittedLatitude?: number | null;
  submittedLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
  gpsStatus?: TaskGpsCaptureStatus;
}

export interface VerificationResult {
  beforeCheckLabel: string;
  afterCheckLabel: string;
  locationCheckLabel: string;
  verdict: "LIKELY_VALID" | "NEEDS_OPERATOR_REVIEW";
  summaryNote: string;
}

export interface FloodWasteBounty {
  id: string;
  code: string; // e.g., "BOUNTY #DL-0047"
  title: string;
  delhiLocality:
    | "Mayapuri"
    | "Dwarka"
    | "Najafgarh"
    | "Bawana"
    | "Rohini"
    | "Okhla"
    | "Yamuna Corridor";
  corridorDetail: string;
  priority: BountyPriority;
  reason: string;
  status: FloodBountyStatus;
  rewardArc: number; // Digital Resilience Credits (ARC)
  estimatedWasteKgRange: string; // e.g., "35-45 kg"
  estimatedWasteKgValue: number;
  deadlineLabel: string;
  closingSoonHours: number;
  distanceKm: number;
  taskInstructions: string[];
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  evidence: BountyEvidence;
  verificationCheck: VerificationResult;
  rejectionReason?: BountyRejectionReason;
  rejectionDetail?: string;
  linkedMonsoonZoneCode?: string;
  coordinates: GeoCoordinate;
}

export interface WorkerProfile {
  id: string;
  name: string;
  collectiveName: string;
  baseLocality: string;
  earnedArc: number;
  pendingArc: number;
  verifiedCleanupsCount: number;
  activeClaimedCount: number;
}

export interface RewardLedgerEntry {
  id: string;
  bountyCode: string;
  taskTitle: string;
  locality: string;
  workerName: string;
  arcAmount: number;
  status: "VERIFIED_EARNED" | "PENDING_VERIFICATION";
  timestampLabel: string;
  balanceAfterArc: number;
}

export interface BountyTrendPoint {
  dayLabel: string;
  bountiesCompleted: number;
  wasteDivertedKg: number;
}

/**
 * ============================================================================
 * MODULE 3: STUBBLE-TO-WATER EXCHANGE DOMAIN TYPES (PROMPT #4)
 * Core Flow: FARMER -> LISTING -> BUYER -> PICKUP -> VERIFICATION -> ARC -> IMPACT
 * ============================================================================
 */

export type StubbleExchangeRole = "FARMER" | "BUYER" | "OPERATOR";

export type StubbleNcrLocation =
  | "Najafgarh"
  | "Narela"
  | "Bawana"
  | "Alipur"
  | "Rohini"
  | "Ghaziabad"
  | "Noida"
  | "Sonipat"
  | "Bahadurgarh";

export type StubbleCropType =
  | "Paddy Stubble"
  | "Wheat Stubble"
  | "Mixed Crop Residue";

export type StubbleCondition =
  | "Dry / Baled"
  | "Dry / Loose Windrows"
  | "Field Stacked / Ready";

export type StubbleListingStatus =
  | "OPEN"
  | "ACCEPTED"
  | "SCHEDULED"
  | "IN_TRANSIT"
  | "PICKED_UP"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED";

export type PickupStatus =
  | "ACCEPTED"
  | "SCHEDULED"
  | "IN_TRANSIT"
  | "PICKED_UP"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED";

export type StubbleRejectionReason =
  | "INSUFFICIENT_EVIDENCE"
  | "QUANTITY_MISMATCH"
  | "UNCLEAR_PICKUP_PROOF"
  | "LOCATION_MISMATCH"
  | "DUPLICATE_RECORD";

export interface FarmerProfile {
  id: string;
  name: string;
  farmGroupLabel: string;
  location: StubbleNcrLocation;
  activeListingsCount: number;
  stubbleListedTonnes: number;
  pickupsCompletedCount: number;
  arcEarned: number;
  arcPending: number;
}

export interface BuyerProfile {
  id: string;
  name: string;
  organizationType: string;
  hubLocation: StubbleNcrLocation;
  activePickupsCount: number;
  verifiedRecoveredTonnes: number;
}

export interface StubbleEvidence {
  photoSubmitted: boolean;
  photoLabel?: string;
  confirmedQuantityTonnes?: number;
  pickupTimestamp?: string;
  demoLocationLabel?: string;
  note?: string;
}

export interface StubbleVerificationResult {
  evidencePresentCheck: string;
  quantityReportedCheck: string;
  locationAvailableCheck: string;
  pickupStatusCompleteCheck: string;
  verdict: "LIKELY_VALID" | "NEEDS_REVIEW";
  summaryNote: string;
}

export interface PickupRecord {
  id: string;
  missionCode: string; // e.g., "MISSION #ST-018"
  listingId: string;
  listingCode: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName: string;
  pickupLocation: StubbleNcrLocation;
  locationDetail: string;
  scheduledWindow: string;
  quantityTonnes: number;
  status: PickupStatus;
  instructions: string;
  evidence: StubbleEvidence;
  simulatedVerification: StubbleVerificationResult;
  rejectionReason?: StubbleRejectionReason;
  rejectionNote?: string;
}

export interface StubbleExchangeListing {
  id: string;
  listingCode: string; // e.g., "STB #DL-018"
  title: string;
  farmerId: string;
  farmerName: string;
  cropType: StubbleCropType;
  quantityTonnes: number;
  unit: "tonnes" | "kg";
  location: StubbleNcrLocation;
  locationDetail: string;
  distanceKm: number;
  pickupWindow: string;
  condition: StubbleCondition;
  notes?: string;
  expectedArc: number; // Digital Resilience Credits (ARC)
  estimatedBiomassUseLabel: string;
  waterResilienceSupportNote: string;
  status: StubbleListingStatus;
  createdAtLabel: string;
  buyerId?: string;
  buyerName?: string;
  pickupRecordId?: string;
  rejectionReason?: StubbleRejectionReason;
  rejectionNote?: string;
  coordinates: GeoCoordinate;
}

export interface ResilienceCreditTransaction {
  id: string;
  transactionCode: string;
  listingId: string;
  listingCode: string;
  farmerName: string;
  buyerName: string;
  location: StubbleNcrLocation;
  quantityTonnes: number;
  arcAmount: number;
  status: "APPROVED" | "PENDING_VERIFICATION" | "REJECTED";
  timestampLabel: string;
  balanceAfterArc: number;
  resilienceSupportLabel: string;
}

export interface StubbleTrendPoint {
  periodLabel: string;
  listedTonnes: number;
  recoveredTonnes: number;
  arcIssued: number;
}

/* ============================================================================
 * MILESTONE #15: AMAZON BEDROCK ASSISTIVE AI EVIDENCE VERIFICATION TYPES
 * ============================================================================ */

export type AiOverallAssessment =
  | "LIKELY_VALID"
  | "NEEDS_REVIEW"
  | "LIKELY_INVALID";

export interface AiEvidenceVerification {
  id: string;
  evidenceType: "BOUNTY" | "STUBBLE";
  resourceId: string;
  ownerId?: string;
  evidenceFingerprint?: string;
  requestedBy: string;
  overallAssessment: AiOverallAssessment;
  confidence: number;
  taskMatchScore: number;
  taskMatchAssessment?: string;
  beforeEvidenceScore: number;
  beforeObservations: string[];
  afterEvidenceScore: number;
  afterObservations: string[];
  consistencyScore: number;
  consistencyAssessment?: string;
  summary: string;
  concerns: string[];
  modelId: string;
  modelVersion?: string;
  evaluatedAt: string;
}


