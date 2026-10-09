"use client";

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { configureAmplifyClient } from "@/lib/amplify-config";
import { isRealS3EvidenceKey } from "@/lib/storage-client";
import { evaluateSubmittedBountyEvidence } from "@/features/flood-bounties/lib/verification-simulator";
import { evaluateSimulatedStubbleVerification } from "@/features/stubble-exchange/lib/verification-simulator";
import type {
  ActionPriority,
  AiEvidenceVerification,
  AiOverallAssessment,
  BountyEvidence,
  BountyPriority,
  BountyRejectionReason,
  FloodBountyStatus,
  FloodWasteBounty,
  MissionAssignment,
  MonsoonMissionStatus,
  PickupRecord,
  PickupStatus,
  ResilienceCreditTransaction,
  StubbleCondition,
  StubbleCropType,
  StubbleExchangeListing,
  StubbleListingStatus,
  StubbleNcrLocation,
  StubbleRejectionReason,
  WeatherForecastHourlyPoint,
  ZoneWeatherSummary,
} from "@/types";

export type { Schema };
export type TaskRecord = Schema["Task"]["type"];
export type BountyRecord = Schema["Bounty"]["type"];
export type StubbleListingRecord = Schema["StubbleListing"]["type"];
export type UserProfileRecord = Schema["UserProfile"]["type"];
export type WeatherForecastRecord = Schema["WeatherForecast"]["type"];
export type EvidenceVerificationRecord = Schema["EvidenceVerification"]["type"];

export type TaskTypeEnum = NonNullable<TaskRecord["taskType"]>;
export type BountyTypeEnum = NonNullable<BountyRecord["bountyType"]>;

let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;

/**
 * Returns the typed AWS Amplify Gen 2 Data client configured for Cognito User Pool auth.
 */
export function getDataClient() {
  configureAmplifyClient();
  if (!cachedClient) {
    cachedClient = generateClient<Schema>({
      authMode: "userPool",
    });
  }
  return cachedClient;
}

/**
 * Converts AppSync / GraphQL errors into clean, human-readable operational messages.
 */
export function formatDataError(
  error: unknown,
  fallbackMessage = "Unable to complete data operation"
): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : Array.isArray(error)
      ? error
          .map((item) =>
            typeof item === "object" && item !== null && "message" in item
              ? String((item as { message?: unknown }).message)
              : String(item)
          )
          .join("; ")
      : typeof error === "object" && error !== null && "errors" in error
      ? JSON.stringify((error as { errors?: unknown }).errors)
      : String(error ?? "");

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("unauthorized") ||
    lower.includes("not authorized") ||
    lower.includes("access denied") ||
    lower.includes("permission")
  ) {
    return "You do not have permission for this action";
  }

  if (
    lower.includes("conditionalcheckfailed") ||
    lower.includes("not found") ||
    lower.includes("no longer available")
  ) {
    return "This item is no longer available or was recently updated";
  }

  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout")
  ) {
    return `${fallbackMessage}. Please check your connection and retry.`;
  }

  return fallbackMessage;
}

/**
 * Throws if an Amplify Data response contains GraphQL errors.
 */
export function assertNoDataErrors(
  errors: Array<{ message: string }> | undefined,
  fallbackMessage: string
) {
  if (errors && errors.length > 0) {
    throw new Error(formatDataError(errors, fallbackMessage));
  }
}

/**
 * Ensures the authenticated Cognito user has a corresponding UserProfile record in DynamoDB.
 */
export async function ensureUserProfileRecord(params: {
  userId: string;
  email: string;
  role: "OPERATOR" | "WORKER" | "FARMER" | "BUYER";
  displayName?: string;
}): Promise<UserProfileRecord | null> {
  try {
    const client = getDataClient();
    const { data: existing } = await client.models.UserProfile.get({
      id: params.userId,
    });
    if (existing) {
      if (existing.role !== params.role || existing.email !== params.email) {
        const { data: updated } = await client.models.UserProfile.update({
          id: params.userId,
          email: params.email,
          role: params.role,
          displayName:
            params.displayName ??
            existing.displayName ??
            params.email.split("@")[0],
        });
        return updated;
      }
      return existing;
    }

    const { data: created } = await client.models.UserProfile.create({
      id: params.userId,
      email: params.email,
      role: params.role,
      displayName: params.displayName ?? params.email.split("@")[0],
    });
    return created;
  } catch {
    return null;
  }
}

/* ============================================================================
 * 1. MONSOONLOOP TASK <-> MissionAssignment MAPPERS
 * ============================================================================ */

export function mapUiTaskTypeToEnum(label: string): TaskTypeEnum {
  const normalized = label.toUpperCase();
  if (normalized.includes("CLEAR") || normalized.includes("DRAIN CLEAR")) {
    return "DRAIN_CLEARING";
  }
  if (normalized.includes("INSPECT") && normalized.includes("DRAIN")) {
    return "DRAIN_INSPECTION";
  }
  if (
    normalized.includes("RECHARGE") ||
    normalized.includes("ASSET") ||
    normalized.includes("SLUICE") ||
    normalized.includes("DIVERSION") ||
    normalized.includes("WEIR")
  ) {
    return "WATER_ASSET_CHECK";
  }
  if (normalized.includes("WASTE") || normalized.includes("PLASTIC")) {
    return "WASTE_REMOVAL";
  }
  if (normalized.includes("FLOOD") || normalized.includes("RESPONSE")) {
    return "FLOOD_RESPONSE";
  }
  return "OTHER";
}

function inferZoneFromTask(task: TaskRecord): {
  zoneId: string;
  zoneCode: string;
} {
  const combined = `${task.locationName} ${task.description}`.toLowerCase();
  if (combined.includes("zone-01") || combined.includes("najafgarh")) {
    return { zoneId: "zone-01", zoneCode: "ZONE 01" };
  }
  if (combined.includes("zone-02") || combined.includes("dwarka")) {
    return { zoneId: "zone-02", zoneCode: "ZONE 02" };
  }
  if (
    combined.includes("zone-04") ||
    combined.includes("vasant") ||
    combined.includes("rohini")
  ) {
    return { zoneId: "zone-04", zoneCode: "ZONE 04" };
  }
  return { zoneId: "zone-03", zoneCode: "ZONE 03" };
}

function formatRelativeTimestamp(iso?: string | null, prefix = "Updated"): string {
  if (!iso) return `${prefix} recently`;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return `${prefix} recently`;
  const diffMin = Math.max(0, Math.round((Date.now() - parsed) / 60000));
  if (diffMin < 1) return `${prefix} just now`;
  if (diffMin < 60) return `${prefix} ${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${prefix} ${diffHr}h ago`;
  return `${prefix} ${new Date(parsed).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  })}`;
}

export function mapTaskRecordToMission(
  task: TaskRecord,
  index = 0
): MissionAssignment {
  const { zoneId, zoneCode } = inferZoneFromTask(task);
  const codeMatch = task.description.match(/\[(MSN-\d+)\]/i);
  const impactMatch = task.description.match(/Impact:\s*(\d+)/i);
  const sourceMatch = task.description.match(/SourceAction:\s*([a-zA-Z0-9_-]+)/i);

  const missionCode =
    codeMatch?.[1]?.toUpperCase() ??
    `MSN-${301 + index}`;
  const expectedImpactLiters = impactMatch
    ? Number(impactMatch[1])
    : task.priority === "CRITICAL"
    ? 75000
    : task.priority === "HIGH"
    ? 60000
    : 45000;

  const status = (task.status as MonsoonMissionStatus) ?? "PENDING";
  const statusPrefix =
    status === "VERIFIED"
      ? "Verified"
      : status === "SUBMITTED"
      ? "Submitted"
      : status === "IN_PROGRESS"
      ? "Started"
      : status === "FAILED"
      ? "Flagged"
      : status === "PENDING"
      ? "Queued"
      : "Assigned";

  return {
    id: task.id,
    missionCode,
    sourceActionId: sourceMatch?.[1] ?? undefined,
    actionTitle: task.title,
    description: task.description,
    taskType: task.taskType ?? "DRAIN_CLEARING",
    zoneId,
    zoneCode,
    location: task.locationName,
    priority: (task.priority as ActionPriority) ?? "HIGH",
    assignedTeam: task.assignedTeam || "Unassigned Crew",
    assignedWorkerId: task.assignedWorkerId ?? undefined,
    deadline: task.deadline || "Within 4 hours",
    status,
    expectedImpactLiters,
    createdAtLabel: formatRelativeTimestamp(
      task.verifiedAt || task.updatedAt || task.createdAt,
      statusPrefix
    ),
    coordinates: {
      lat: task.latitude,
      lng: task.longitude,
    },
  };
}

/* ============================================================================
 * 2. FLOOD & WASTE BOUNTY <-> FloodWasteBounty MAPPERS
 * ============================================================================ */

const DELHI_LOCALITIES: FloodWasteBounty["delhiLocality"][] = [
  "Mayapuri",
  "Dwarka",
  "Najafgarh",
  "Bawana",
  "Rohini",
  "Okhla",
  "Yamuna Corridor",
];

function inferDelhiLocality(
  locationName: string,
  description: string
): FloodWasteBounty["delhiLocality"] {
  const text = `${locationName} ${description}`.toLowerCase();
  for (const loc of DELHI_LOCALITIES) {
    if (text.includes(loc.toLowerCase())) {
      return loc;
    }
  }
  if (text.includes("yamuna")) return "Yamuna Corridor";
  return "Mayapuri";
}

function inferPriorityFromBounty(bounty: BountyRecord): BountyPriority {
  const desc = bounty.description.toUpperCase();
  if (desc.includes("PRIORITY:URGENT") || bounty.rewardArc >= 155) {
    return "URGENT";
  }
  if (desc.includes("PRIORITY:LOW") || bounty.rewardArc < 90) {
    return "LOW";
  }
  if (desc.includes("PRIORITY:MEDIUM") || bounty.rewardArc < 115) {
    return "MEDIUM";
  }
  return "HIGH";
}

export function mapBountyRecordToFloodWasteBounty(
  bounty: BountyRecord,
  index = 0
): FloodWasteBounty {
  const delhiLocality = inferDelhiLocality(
    bounty.locationName,
    bounty.description
  );
  const priority = inferPriorityFromBounty(bounty);

  const codeMatch = bounty.description.match(/\[(BOUNTY\s*#DL-\d+)\]/i);
  const wasteMatch = bounty.description.match(/Waste:\s*([^|]+)/i);
  const deadlineMatch = bounty.description.match(/Deadline:\s*([^|]+)/i);

  const code =
    codeMatch?.[1]?.toUpperCase() ??
    `BOUNTY #DL-${String(41 + index).padStart(4, "0")}`;
  const estimatedWasteKgRange = wasteMatch?.[1]?.trim() || "35–45 kg";
  const deadlineLabel =
    bounty.status === "VERIFIED"
      ? "Verified & Credited"
      : bounty.status === "SUBMITTED" || bounty.status === "UNDER_REVIEW"
      ? "Submitted for review"
      : deadlineMatch?.[1]?.trim() || "Before rainfall peak (Within 4h)";

  const cleanReason =
    bounty.description
      .replace(/\[BOUNTY\s*#DL-\d+\]/gi, "")
      .replace(/Priority:\s*[A-Z]+\s*\|?/gi, "")
      .replace(/Waste:\s*[^|]+\|?/gi, "")
      .replace(/Deadline:\s*[^|]+\|?/gi, "")
      .trim() || "Pre-storm drain blockage clearance";

  const hasBefore = isRealS3EvidenceKey(bounty.beforeEvidenceKey);
  const hasAfter = isRealS3EvidenceKey(bounty.afterEvidenceKey);
  const hasGps =
    bounty.submittedLatitude !== null &&
    bounty.submittedLatitude !== undefined &&
    bounty.submittedLongitude !== null &&
    bounty.submittedLongitude !== undefined;

  const evidence: BountyEvidence = {
    beforeImageLabel: hasBefore ? bounty.beforeEvidenceKey! : undefined,
    beforeTimestamp: bounty.assignedAt
      ? formatRelativeTimestamp(bounty.assignedAt, "Captured")
      : hasBefore
      ? "Captured · Field timestamp"
      : undefined,
    beforeLocationLabel: hasBefore ? `${delhiLocality}, Delhi` : undefined,
    beforeNote: hasBefore
      ? `Drain inlet obstruction documented (${bounty.bountyType ?? "DRAIN_WASTE"}).`
      : undefined,
    cleanupCompleted:
      hasAfter ||
      Boolean(bounty.submittedTimestamp) ||
      bounty.status === "SUBMITTED" ||
      bounty.status === "UNDER_REVIEW" ||
      bounty.status === "VERIFIED",
    cleanupCompletedAt:
      bounty.submittedAt || bounty.submittedTimestamp
        ? formatRelativeTimestamp(
            bounty.submittedAt || bounty.submittedTimestamp,
            "Completed"
          )
        : undefined,
    afterImageLabel: hasAfter ? bounty.afterEvidenceKey! : undefined,
    afterTimestamp: hasAfter
      ? formatRelativeTimestamp(
          bounty.submittedAt || bounty.submittedTimestamp,
          "Captured"
        )
      : undefined,
    afterLocationLabel: hasAfter ? `${delhiLocality}, Delhi` : undefined,
    afterNote: hasAfter
      ? "Cleared solid waste and plastic blockage from storm grate."
      : undefined,
    gpsCaptured: hasGps,
    gpsLabel: hasGps
      ? `${delhiLocality}, Delhi (${Number(bounty.submittedLatitude).toFixed(
          4
        )}° N, ${Number(bounty.submittedLongitude).toFixed(4)}° E)`
      : undefined,
    gpsStatusNote: hasGps ? "GPS verified for task area" : undefined,
  };

  let parsedRejectionReason: BountyRejectionReason | undefined;
  let parsedRejectionDetail: string | undefined;
  if (bounty.rejectionReason) {
    const parts = bounty.rejectionReason.split(":");
    const candidate = parts[0]?.trim() as BountyRejectionReason;
    const validReasons: BountyRejectionReason[] = [
      "INSUFFICIENT_EVIDENCE",
      "MISMATCH",
      "CLEANUP_INCOMPLETE",
      "LOCATION_MISMATCH",
      "IMAGE_UNCLEAR",
    ];
    if (validReasons.includes(candidate)) {
      parsedRejectionReason = candidate;
      parsedRejectionDetail = parts.slice(1).join(":").trim() || bounty.rejectionReason;
    } else {
      parsedRejectionReason = "CLEANUP_INCOMPLETE";
      parsedRejectionDetail = bounty.rejectionReason;
    }
  }

  return {
    id: bounty.id,
    code,
    title: bounty.title,
    delhiLocality,
    corridorDetail: bounty.locationName,
    priority,
    reason: cleanReason,
    status: (bounty.status as FloodBountyStatus) ?? "OPEN",
    rewardArc: bounty.rewardArc,
    estimatedWasteKgRange,
    estimatedWasteKgValue: 42,
    deadlineLabel,
    closingSoonHours: priority === "URGENT" ? 2 : 4,
    distanceKm: Number((1.1 + (index % 5) * 0.8).toFixed(1)),
    taskInstructions: [
      `Capture a clear Before Photo showing the blocked inlet at ${bounty.locationName}.`,
      "Remove plastic bags, packaging waste, and debris blocking the grate.",
      "Capture an After Photo from the same angle and confirm GPS location.",
    ],
    assignedWorkerId: bounty.claimedBy ?? undefined,
    assignedWorkerName: bounty.claimedBy ?? undefined,
    evidence,
    verificationCheck: evaluateSubmittedBountyEvidence(delhiLocality, evidence),
    rejectionReason: parsedRejectionReason,
    rejectionDetail: parsedRejectionDetail,
    linkedMonsoonZoneCode:
      delhiLocality === "Najafgarh" || delhiLocality === "Bawana"
        ? "ZONE 01"
        : delhiLocality === "Dwarka" || delhiLocality === "Rohini"
        ? "ZONE 02"
        : delhiLocality === "Okhla"
        ? "ZONE 04"
        : "ZONE 03",
    coordinates: {
      lat: bounty.latitude,
      lng: bounty.longitude,
    },
  };
}

/* ============================================================================
 * 3. STUBBLE LISTING <-> StubbleExchangeListing & PickupRecord MAPPERS
 * ============================================================================ */

const NCR_LOCATIONS: StubbleNcrLocation[] = [
  "Najafgarh",
  "Narela",
  "Bawana",
  "Alipur",
  "Rohini",
  "Ghaziabad",
  "Noida",
  "Sonipat",
  "Bahadurgarh",
];

function inferNcrLocation(locationName: string): StubbleNcrLocation {
  const lower = locationName.toLowerCase();
  for (const loc of NCR_LOCATIONS) {
    if (lower.includes(loc.toLowerCase())) {
      return loc;
    }
  }
  return "Najafgarh";
}

function normalizeCropType(cropType?: string | null): StubbleCropType {
  if (!cropType) return "Paddy Stubble";
  const lower = cropType.toLowerCase();
  if (lower.includes("wheat")) return "Wheat Stubble";
  if (lower.includes("mixed")) return "Mixed Crop Residue";
  return "Paddy Stubble";
}

function parseStubbleRejection(raw?: string | null): {
  reason?: StubbleRejectionReason;
  note?: string;
} {
  if (!raw) return {};
  const validReasons: StubbleRejectionReason[] = [
    "INSUFFICIENT_EVIDENCE",
    "QUANTITY_MISMATCH",
    "UNCLEAR_PICKUP_PROOF",
    "LOCATION_MISMATCH",
    "DUPLICATE_RECORD",
  ];
  const parts = raw.split(":");
  const candidate = parts[0]?.trim() as StubbleRejectionReason;
  if (validReasons.includes(candidate)) {
    return {
      reason: candidate,
      note: parts.slice(1).join(":").trim() || raw,
    };
  }
  return {
    reason: "UNCLEAR_PICKUP_PROOF",
    note: raw,
  };
}

export function mapStubbleRecordToExchangeListing(
  record: StubbleListingRecord,
  index = 0
): StubbleExchangeListing {
  const location = inferNcrLocation(record.locationName);
  const cropType = normalizeCropType(record.cropType);
  const desc = record.description ?? "";

  const codeMatch = desc.match(/\[(STB\s*#DL-\d+)\]/i);
  const condMatch = desc.match(/Condition:\s*([^|]+)/i);
  const windowMatch = desc.match(/Window:\s*([^|]+)/i);
  const titleMatch = desc.match(/Title:\s*([^|]+)/i);
  const addressMatch = desc.match(/Address:\s*([^|]+)/i);

  const listingCode =
    codeMatch?.[1]?.toUpperCase() ??
    `STB #DL-${String(18 + index).padStart(3, "0")}`;

  const conditionRaw = condMatch?.[1]?.trim();
  const condition: StubbleCondition =
    conditionRaw === "Dry / Loose Windrows" ||
    conditionRaw === "Field Stacked / Ready"
      ? conditionRaw
      : "Dry / Baled";

  const pickupWindow =
    record.pickupDate || windowMatch?.[1]?.trim() || "8–10 Oct (08:00 – 17:00)";

  const cleanNotes =
    desc
      .replace(/\[STB\s*#DL-\d+\]/gi, "")
      .replace(/Title:\s*[^|]+\|?/gi, "")
      .replace(/Condition:\s*[^|]+\|?/gi, "")
      .replace(/Window:\s*[^|]+\|?/gi, "")
      .replace(/Address:\s*[^|]+\|?/gi, "")
      .trim() || "Field road accessible for buyer pickup.";

  const quantityTonnes =
    record.unit.toLowerCase() === "kg"
      ? Number((record.quantity / 1000).toFixed(2))
      : Number(record.quantity.toFixed(2));

  const expectedArc = Math.round(
    record.priceOrReward ?? quantityTonnes * 100
  );

  const status = (record.status as StubbleListingStatus) ?? "OPEN";
  const { reason: rejectionReason, note: rejectionNote } =
    parseStubbleRejection(record.rejectionReason);

  const locationDetail =
    addressMatch?.[1]?.trim()
      ? `${addressMatch[1].trim()} (${location})`
      : record.locationName;

  return {
    id: record.id,
    listingCode,
    title:
      titleMatch?.[1]?.trim() ||
      `${cropType} — ${condition} (${location})`,
    farmerId: record.farmerId,
    farmerName: record.farmerName,
    cropType,
    quantityTonnes,
    unit: "tonnes",
    location,
    locationDetail,
    distanceKm: Number((2.4 + (index % 5) * 1.3).toFixed(1)),
    pickupWindow,
    condition,
    notes: cleanNotes,
    expectedArc,
    estimatedBiomassUseLabel: "Protective soil mulch, compost & bio-pellet recovery",
    waterResilienceSupportNote:
      "Credits can be directed toward water-resilience support.",
    status,
    createdAtLabel: formatRelativeTimestamp(
      record.updatedAt || record.createdAt,
      status === "VERIFIED" ? "Completed" : "Listed"
    ),
    buyerId: record.acceptedBy ?? undefined,
    buyerName: record.acceptedBy ?? undefined,
    pickupRecordId: status !== "OPEN" ? record.id : undefined,
    rejectionReason,
    rejectionNote,
    coordinates: {
      lat: record.latitude,
      lng: record.longitude,
    },
  };
}

export function mapStubbleRecordToPickupRecord(
  record: StubbleListingRecord,
  index = 0
): PickupRecord | null {
  const listing = mapStubbleRecordToExchangeListing(record, index);
  if (listing.status === "OPEN") {
    return null;
  }

  const pickupStatus = listing.status as PickupStatus;
  const hasProof = isRealS3EvidenceKey(record.proofKey);

  const evidence = {
    photoSubmitted: hasProof,
    photoLabel: hasProof ? record.proofKey! : undefined,
    confirmedQuantityTonnes: listing.quantityTonnes,
    pickupTimestamp:
      record.submittedAt || record.pickedUpAt
        ? formatRelativeTimestamp(
            record.submittedAt || record.pickedUpAt,
            "Recorded"
          )
        : undefined,
    demoLocationLabel: `${listing.locationDetail} (${record.latitude.toFixed(
      4
    )}° N, ${record.longitude.toFixed(4)}° E)`,
    note: listing.notes,
  };

  return {
    id: record.id,
    missionCode: `MISSION #ST-${String(16 + index).padStart(3, "0")}`,
    listingId: record.id,
    listingCode: listing.listingCode,
    buyerId: record.acceptedBy || "buyer.demo@aquiloop.org",
    buyerName: record.acceptedBy || "GreenLoop Buyer Team",
    farmerId: record.farmerId,
    farmerName: record.farmerName,
    pickupLocation: listing.location,
    locationDetail: listing.locationDetail,
    scheduledWindow: record.pickupDate || listing.pickupWindow,
    quantityTonnes: listing.quantityTonnes,
    status: pickupStatus,
    instructions:
      listing.notes ||
      "Confirm bale condition at field gate and capture loading photo.",
    evidence,
    simulatedVerification: evaluateSimulatedStubbleVerification({
      listedQuantityTonnes: listing.quantityTonnes,
      status: pickupStatus,
      evidence,
    }),
    rejectionReason: listing.rejectionReason,
    rejectionNote: listing.rejectionNote,
  };
}

export function deriveStubbleArcTransactions(
  listings: StubbleExchangeListing[]
): ResilienceCreditTransaction[] {
  let runningBalance = 0;
  const transactions: ResilienceCreditTransaction[] = [];

  for (const [idx, item] of listings.entries()) {
    if (
      item.status !== "VERIFIED" &&
      item.status !== "PENDING_VERIFICATION" &&
      item.status !== "REJECTED"
    ) {
      continue;
    }

    const txStatus =
      item.status === "VERIFIED"
        ? "APPROVED"
        : item.status === "REJECTED"
        ? "REJECTED"
        : "PENDING_VERIFICATION";

    if (txStatus === "APPROVED") {
      runningBalance += item.expectedArc;
    }

    transactions.push({
      id: `arc-tx-${item.id}`,
      transactionCode: `ARC-ST-${8820 + idx}`,
      listingId: item.id,
      listingCode: item.listingCode,
      farmerName: item.farmerName,
      buyerName: item.buyerName ?? "GreenLoop Buyer Team",
      location: item.location,
      quantityTonnes: item.quantityTonnes,
      arcAmount: item.expectedArc,
      status: txStatus,
      timestampLabel: item.createdAtLabel,
      balanceAfterArc: runningBalance,
      resilienceSupportLabel:
        txStatus === "APPROVED"
          ? "Credits can be directed toward water-resilience support"
          : txStatus === "REJECTED"
          ? `Rejected: ${item.rejectionNote ?? "Updated proof required"}`
          : "Awaiting operator verification to issue ARC credits",
    });
  }

  return transactions;
}

/* ============================================================================
 * WEATHER FORECAST MAPPERS & APPSYNC / DYNAMODB HELPERS (MONSOONLOOP)
 * ============================================================================ */

export function mapWeatherRecordToHourlyPoint(record: {
  id: string;
  locationKey: string;
  locationName: string;
  latitude: number;
  longitude: number;
  forecastTime: string;
  rainfallMm: number;
  rainProbability?: number | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
  source: string;
  fetchedAt: string;
}): WeatherForecastHourlyPoint {
  return {
    id: record.id,
    locationKey: record.locationKey,
    locationName: record.locationName,
    latitude: Number(record.latitude ?? 0),
    longitude: Number(record.longitude ?? 0),
    forecastTime: record.forecastTime,
    rainfallMm: Number(Number(record.rainfallMm ?? 0).toFixed(2)),
    rainProbability: Number(Number(record.rainProbability ?? 0).toFixed(0)),
    temperatureC: Number(Number(record.temperatureC ?? 0).toFixed(1)),
    weatherCode: Math.round(Number(record.weatherCode ?? 0)),
    source: record.source || "open-meteo",
    fetchedAt: record.fetchedAt,
  };
}

export function summarizeLocationWeather(
  locationKey: string,
  locationName: string,
  records: WeatherForecastHourlyPoint[]
): ZoneWeatherSummary {
  const sorted = [...records].sort((a, b) =>
    a.forecastTime.localeCompare(b.forecastTime)
  );

  // Take the most recent 72-hour forecast window
  const windowPoints = sorted.slice(-72);

  let totalRainfallMm = 0;
  let peakRainfallMmHr = 0;
  let peakForecastTime: string | null = null;
  let rainyHoursCount = 0;
  let maxRainProbability = 0;
  let latestFetchedAt: string | null = null;

  for (const pt of windowPoints) {
    totalRainfallMm += pt.rainfallMm;
    if (pt.rainfallMm > peakRainfallMmHr) {
      peakRainfallMmHr = pt.rainfallMm;
      peakForecastTime = pt.forecastTime;
    }
    if (pt.rainfallMm >= 0.1) {
      rainyHoursCount += 1;
    }
    if (pt.rainProbability > maxRainProbability) {
      maxRainProbability = pt.rainProbability;
    }
    if (!latestFetchedAt || pt.fetchedAt > latestFetchedAt) {
      latestFetchedAt = pt.fetchedAt;
    }
  }

  if (!peakForecastTime && windowPoints.length > 0) {
    peakForecastTime = windowPoints[0].forecastTime;
  }

  return {
    locationKey,
    locationName,
    hourlyPoints: windowPoints,
    totalRainfallMm: Number(totalRainfallMm.toFixed(1)),
    peakRainfallMmHr: Number(peakRainfallMmHr.toFixed(1)),
    peakForecastTime,
    rainyHoursCount,
    maxRainProbability,
    latestTemperatureC:
      windowPoints.length > 0 ? windowPoints[0].temperatureC : null,
    fetchedAt: latestFetchedAt,
    source: windowPoints[0]?.source || "open-meteo",
  };
}

export async function fetchWeatherForecastsByLocation(
  locationKey: string
): Promise<WeatherForecastHourlyPoint[]> {
  const client = getDataClient();
  const { data, errors } =
    await client.models.WeatherForecast.listWeatherByLocationAndTime(
      {
        locationKey,
      },
      {
        limit: 120,
        sortDirection: "ASC",
      }
    );

  assertNoDataErrors(
    errors,
    `Unable to load weather forecast for ${locationKey}`
  );

  return (data ?? [])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map(mapWeatherRecordToHourlyPoint);
}

export async function triggerOperatorWeatherRefresh(
  locationKey = "ALL"
): Promise<{
  success: boolean;
  locationsProcessed: number;
  recordsUpserted: number;
  fetchedAt: string;
  source: string;
  message?: string | null;
}> {
  const client = getDataClient();
  const { data, errors } = await client.mutations.refreshWeatherForecast({
    locationKey,
  });

  assertNoDataErrors(errors, "Unable to refresh live weather forecast");
  if (!data) {
    throw new Error("Weather refresh returned no response");
  }

  return {
    success: Boolean(data.success),
    locationsProcessed: Number(data.locationsProcessed ?? 0),
    recordsUpserted: Number(data.recordsUpserted ?? 0),
    fetchedAt: data.fetchedAt,
    source: data.source || "open-meteo",
    message: data.message,
  };
}

/* ============================================================================
 * 5. AMAZON BEDROCK AI EVIDENCE VERIFICATION HELPERS (MILESTONE #15)
 * ============================================================================ */

export function mapVerificationRecordToUi(record: {
  id: string;
  evidenceType?: string | null;
  resourceId: string;
  ownerId?: string | null;
  evidenceFingerprint?: string | null;
  requestedBy: string;
  overallAssessment?: string | null;
  confidence: number;
  taskMatchScore: number;
  taskMatchAssessment?: string | null;
  beforeEvidenceScore: number;
  beforeObservations?: (string | null)[] | null;
  afterEvidenceScore: number;
  afterObservations?: (string | null)[] | null;
  consistencyScore: number;
  consistencyAssessment?: string | null;
  summary: string;
  concerns?: (string | null)[] | null;
  modelId: string;
  modelVersion?: string | null;
  evaluatedAt: string;
}): AiEvidenceVerification {
  const assessmentRaw = String(
    record.overallAssessment || "NEEDS_REVIEW"
  ).toUpperCase();
  const overallAssessment: AiOverallAssessment =
    assessmentRaw === "LIKELY_VALID" ||
    assessmentRaw === "LIKELY_INVALID" ||
    assessmentRaw === "NEEDS_REVIEW"
      ? (assessmentRaw as AiOverallAssessment)
      : "NEEDS_REVIEW";

  return {
    id: record.id,
    evidenceType: record.evidenceType === "STUBBLE" ? "STUBBLE" : "BOUNTY",
    resourceId: record.resourceId,
    ownerId: record.ownerId ?? undefined,
    evidenceFingerprint: record.evidenceFingerprint ?? undefined,
    requestedBy: record.requestedBy,
    overallAssessment,
    confidence: Math.max(0, Math.min(100, Number(record.confidence ?? 0))),
    taskMatchScore: Math.max(
      0,
      Math.min(100, Number(record.taskMatchScore ?? 0))
    ),
    taskMatchAssessment: record.taskMatchAssessment ?? undefined,
    beforeEvidenceScore: Math.max(
      0,
      Math.min(100, Number(record.beforeEvidenceScore ?? 0))
    ),
    beforeObservations: (record.beforeObservations ?? []).filter(
      (s): s is string => typeof s === "string" && s.length > 0
    ),
    afterEvidenceScore: Math.max(
      0,
      Math.min(100, Number(record.afterEvidenceScore ?? 0))
    ),
    afterObservations: (record.afterObservations ?? []).filter(
      (s): s is string => typeof s === "string" && s.length > 0
    ),
    consistencyScore: Math.max(
      0,
      Math.min(100, Number(record.consistencyScore ?? 0))
    ),
    consistencyAssessment: record.consistencyAssessment ?? undefined,
    summary: record.summary,
    concerns: (record.concerns ?? []).filter(
      (s): s is string => typeof s === "string" && s.length > 0
    ),
    modelId: record.modelId,
    modelVersion: record.modelVersion ?? undefined,
    evaluatedAt: record.evaluatedAt,
  };
}

export async function fetchLatestEvidenceVerification(
  resourceId: string
): Promise<AiEvidenceVerification | null> {
  try {
    const client = getDataClient();
    const { data, errors } =
      await client.models.EvidenceVerification.listVerificationsByResource(
        { resourceId },
        { limit: 10, sortDirection: "DESC" }
      );
    if (errors && errors.length > 0) {
      return null;
    }
    const items = (data ?? []).filter(
      (item): item is NonNullable<typeof item> => Boolean(item)
    );
    if (items.length === 0) return null;
    return mapVerificationRecordToUi(items[0]);
  } catch {
    return null;
  }
}

export async function triggerOperatorEvidenceVerification(params: {
  evidenceType: "BOUNTY" | "STUBBLE";
  resourceId: string;
  forceRecheck?: boolean;
}): Promise<{
  success: boolean;
  status: string;
  cached: boolean;
  verification: AiEvidenceVerification | null;
  message: string;
}> {
  try {
    const client = getDataClient();
    const { data, errors } = await client.mutations.verifyEvidence({
      evidenceType: params.evidenceType,
      resourceId: params.resourceId,
      forceRecheck: Boolean(params.forceRecheck),
    });

    if (errors && errors.length > 0) {
      return {
        success: false,
        status: "ERROR",
        cached: false,
        verification: null,
        message: formatDataError(errors, "AI verification unavailable"),
      };
    }

    if (!data) {
      return {
        success: false,
        status: "UNAVAILABLE",
        cached: false,
        verification: null,
        message: "AI verification unavailable",
      };
    }

    return {
      success: Boolean(data.success),
      status: data.status || "UNAVAILABLE",
      cached: Boolean(data.cached),
      verification: data.verification
        ? mapVerificationRecordToUi(data.verification)
        : null,
      message: data.message || "AI verification unavailable",
    };
  } catch (err) {
    return {
      success: false,
      status: "ERROR",
      cached: false,
      verification: null,
      message: formatDataError(err, "AI verification unavailable"),
    };
  }
}


