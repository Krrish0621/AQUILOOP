import { createHash, createHmac } from "node:crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * AQUILOOP — Real Amazon Rekognition Evidence Analysis Handler (Milestone #20)
 *
 * AWS Region: ap-southeast-2
 * Service: Amazon Rekognition `DetectLabels` (GENERAL_LABELS + IMAGE_PROPERTIES)
 *
 * Inspects private S3 evidence images (Bounty Before/After or Stubble Pickup Proof),
 * extracts genuine detected labels and image-quality metrics (Brightness, Sharpness,
 * Contrast, DominantColors), and produces a conservative, non-exaggerated comparison
 * for Operator review. Final approval/rejection remains strictly an OPERATOR decision.
 */

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const MODEL_ID = "amazon.rekognition.detect-labels";
const MODEL_VERSION = "IMAGE_PROPERTIES";

const s3Client = new S3Client({ region: REGION });

export type OverallAssessment =
  | "LIKELY_VALID"
  | "NEEDS_REVIEW"
  | "LIKELY_INVALID";

export interface StructuredAiOutput {
  overallAssessment: OverallAssessment;
  confidence: number;
  taskMatch: {
    score: number;
    assessment: string;
  };
  beforeEvidence: {
    score: number;
    observations: string[];
  };
  afterEvidence: {
    score: number;
    observations: string[];
  };
  beforeAfterConsistency: {
    score: number;
    assessment: string;
  };
  concerns: string[];
  summary: string;
}

export interface PersistedVerificationItem {
  id: string;
  evidenceType: "BOUNTY" | "STUBBLE";
  resourceId: string;
  ownerId: string;
  evidenceFingerprint: string;
  requestedBy: string;
  overallAssessment: OverallAssessment;
  confidence: number;
  taskMatchScore: number;
  taskMatchAssessment: string;
  beforeEvidenceScore: number;
  beforeObservations: string[];
  afterEvidenceScore: number;
  afterObservations: string[];
  consistencyScore: number;
  consistencyAssessment: string;
  summary: string;
  concerns: string[];
  modelId: string;
  modelVersion: string;
  evaluatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface RekognitionLabel {
  Name?: string;
  Confidence?: number;
}

interface RekognitionQuality {
  Brightness?: number;
  Sharpness?: number;
  Contrast?: number;
}

interface RekognitionDominantColor {
  SimplifiedColor?: string;
  PixelPercent?: number;
}

interface RekognitionDetectLabelsResponse {
  Labels?: RekognitionLabel[];
  ImageProperties?: {
    Quality?: RekognitionQuality;
    DominantColors?: RekognitionDominantColor[];
  };
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function clampScore(val: unknown, fallback = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Minimal SigV4 JSON RPC helper for AWS services (DynamoDB & Amazon Rekognition)
 */
async function callAwsJsonRpc(params: {
  service: "dynamodb" | "rekognition";
  target: string;
  contentType: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing Lambda execution role credentials");
  }

  const host = `${params.service}.${REGION}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const body = JSON.stringify(params.payload);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    "content-type": params.contentType,
    host,
    "x-amz-date": amzDate,
    "x-amz-target": params.target,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${params.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, REGION);
  const kService = hmacSha256(kRegion, params.service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${params.service} ${params.target} failed (${response.status}): ${text}`
    );
  }

  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

async function callDynamoDbRpc(
  target: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return callAwsJsonRpc({
    service: "dynamodb",
    target: `DynamoDB_20120810.${target}`,
    contentType: "application/x-amz-json-1.0",
    payload,
  });
}

async function callRekognitionDetectLabels(
  imageBytes: Uint8Array
): Promise<RekognitionDetectLabelsResponse> {
  const base64Image = Buffer.from(imageBytes).toString("base64");
  const raw = await callAwsJsonRpc({
    service: "rekognition",
    target: "RekognitionService.DetectLabels",
    contentType: "application/x-amz-json-1.1",
    payload: {
      Image: {
        Bytes: base64Image,
      },
      MaxLabels: 12,
      MinConfidence: 55,
      Features: ["GENERAL_LABELS", "IMAGE_PROPERTIES"],
    },
  });
  return raw as unknown as RekognitionDetectLabelsResponse;
}

function unmarshalDynamoItem(
  rawItem?: Record<string, Record<string, unknown>>
): Record<string, unknown> | null {
  if (!rawItem) return null;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawItem)) {
    if ("S" in val) result[key] = val.S;
    else if ("N" in val) result[key] = Number(val.N);
    else if ("BOOL" in val) result[key] = Boolean(val.BOOL);
    else if ("L" in val && Array.isArray(val.L)) {
      result[key] = val.L.map((entry: Record<string, unknown>) =>
        "S" in entry ? String(entry.S) : ""
      ).filter(Boolean);
    }
  }
  return result;
}

async function getDynamoItemById(
  tableName: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const res = await callDynamoDbRpc("GetItem", {
    TableName: tableName,
    Key: { id: { S: id } },
  });
  return unmarshalDynamoItem(
    res.Item as Record<string, Record<string, unknown>> | undefined
  );
}

async function putVerificationRecord(
  tableName: string,
  item: PersistedVerificationItem
): Promise<void> {
  await callDynamoDbRpc("PutItem", {
    TableName: tableName,
    Item: {
      id: { S: item.id },
      __typename: { S: "EvidenceVerification" },
      evidenceType: { S: item.evidenceType },
      resourceId: { S: item.resourceId },
      ownerId: { S: item.ownerId },
      evidenceFingerprint: { S: item.evidenceFingerprint },
      requestedBy: { S: item.requestedBy },
      overallAssessment: { S: item.overallAssessment },
      confidence: { N: String(item.confidence) },
      taskMatchScore: { N: String(item.taskMatchScore) },
      taskMatchAssessment: { S: item.taskMatchAssessment },
      beforeEvidenceScore: { N: String(item.beforeEvidenceScore) },
      beforeObservations: {
        L: item.beforeObservations.map((s) => ({ S: s })),
      },
      afterEvidenceScore: { N: String(item.afterEvidenceScore) },
      afterObservations: {
        L: item.afterObservations.map((s) => ({ S: s })),
      },
      consistencyScore: { N: String(item.consistencyScore) },
      consistencyAssessment: { S: item.consistencyAssessment },
      summary: { S: item.summary },
      concerns: {
        L: item.concerns.map((s) => ({ S: s })),
      },
      modelId: { S: item.modelId },
      modelVersion: { S: item.modelVersion },
      evaluatedAt: { S: item.evaluatedAt },
      createdAt: { S: item.createdAt },
      updatedAt: { S: item.updatedAt },
    },
  });
}

async function fetchPrivateS3Image(
  bucketName: string,
  key: string
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const trimmedKey = (key || "").trim();
  if (
    !trimmedKey ||
    (!trimmedKey.startsWith("bounties/") &&
      !trimmedKey.startsWith("stubble/") &&
      !trimmedKey.startsWith("tasks/"))
  ) {
    throw new Error("INVALID_EVIDENCE_KEY");
  }

  let response;
  try {
    response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: trimmedKey,
      })
    );
  } catch {
    throw new Error("EVIDENCE_NOT_FOUND");
  }

  if (!response.Body) {
    throw new Error("INVALID_IMAGE_BYTES");
  }

  const byteArray = await response.Body.transformToByteArray();
  if (!byteArray || byteArray.byteLength < 24) {
    throw new Error("INVALID_IMAGE_BYTES");
  }

  const isPng =
    byteArray[0] === 0x89 &&
    byteArray[1] === 0x50 &&
    byteArray[2] === 0x4e &&
    byteArray[3] === 0x47;
  const isJpeg = byteArray[0] === 0xff && byteArray[1] === 0xd8;

  if (!isPng && !isJpeg) {
    throw new Error("INVALID_IMAGE_BYTES");
  }

  return {
    bytes: byteArray,
    sha256: sha256Hex(byteArray),
  };
}

function formatTopLabels(labels: RekognitionLabel[] = [], limit = 6): string {
  const valid = labels
    .filter((l) => l.Name && typeof l.Confidence === "number")
    .slice(0, limit);
  if (valid.length === 0) return "None above 55% threshold";
  return valid
    .map((l) => `${l.Name} (${Math.round(Number(l.Confidence))}%)`)
    .join(", ");
}

function computeQualityScore(quality?: RekognitionQuality): number {
  const sharpness = Number(quality?.Sharpness ?? 70);
  const brightness = Number(quality?.Brightness ?? 60);
  const contrast = Number(quality?.Contrast ?? 70);
  return clampScore(sharpness * 0.45 + brightness * 0.25 + contrast * 0.3, 70);
}

function formatQualitySummary(quality?: RekognitionQuality): string {
  const s = Math.round(Number(quality?.Sharpness ?? 0));
  const b = Math.round(Number(quality?.Brightness ?? 0));
  const c = Math.round(Number(quality?.Contrast ?? 0));
  return `Image quality: Sharpness ${s}/100, Brightness ${b}/100, Contrast ${c}/100`;
}

const URBAN_DRAIN_CONTEXT_KEYWORDS = new Set([
  "drain",
  "road",
  "street",
  "city",
  "urban",
  "path",
  "sidewalk",
  "pavement",
  "gutter",
  "asphalt",
  "neighborhood",
  "outdoors",
  "water",
  "channel",
  "curb",
]);

const AGRI_BIOMASS_CONTEXT_KEYWORDS = new Set([
  "straw",
  "hay",
  "harvest",
  "countryside",
  "rural",
  "farm",
  "field",
  "agriculture",
  "nature",
  "outdoors",
  "grass",
  "plant",
  "soil",
  "vehicle",
  "truck",
  "tractor",
  "wheel",
]);

function buildBountyRekognitionAssessment(params: {
  beforeRekog: RekognitionDetectLabelsResponse;
  afterRekog: RekognitionDetectLabelsResponse;
  beforeSha256: string;
  afterSha256: string;
}): StructuredAiOutput {
  const beforeLabels = params.beforeRekog.Labels ?? [];
  const afterLabels = params.afterRekog.Labels ?? [];
  const beforeQual = params.beforeRekog.ImageProperties?.Quality;
  const afterQual = params.afterRekog.ImageProperties?.Quality;

  const beforeScore = computeQualityScore(beforeQual);
  const afterScore = computeQualityScore(afterQual);

  if (params.beforeSha256 === params.afterSha256) {
    return {
      overallAssessment: "LIKELY_INVALID",
      confidence: 95,
      taskMatch: {
        score: 20,
        assessment:
          "Before and After uploads have identical image hashes; two distinct photos are required.",
      },
      beforeEvidence: {
        score: beforeScore,
        observations: [
          `Before labels: ${formatTopLabels(beforeLabels)}`,
          `Before ${formatQualitySummary(beforeQual)}`,
        ],
      },
      afterEvidence: {
        score: afterScore,
        observations: [
          "After photo is byte-for-byte identical to the Before photo.",
        ],
      },
      beforeAfterConsistency: {
        score: 0,
        assessment: "Identical duplicate upload detected (0% visual change).",
      },
      concerns: [
        "Before and After images are identical files. Reject and request a genuine post-cleanup photo.",
      ],
      summary:
        "Duplicate image detected: Before and After photos are identical files.",
    };
  }

  const beforeNames = new Set(
    beforeLabels.map((l) => (l.Name || "").toLowerCase()).filter(Boolean)
  );
  const afterNames = new Set(
    afterLabels.map((l) => (l.Name || "").toLowerCase()).filter(Boolean)
  );

  const matchedDrainBefore = [...beforeNames].filter((n) =>
    URBAN_DRAIN_CONTEXT_KEYWORDS.has(n)
  );
  const matchedDrainAfter = [...afterNames].filter((n) =>
    URBAN_DRAIN_CONTEXT_KEYWORDS.has(n)
  );
  const sharedLabels = [...beforeNames].filter((n) => afterNames.has(n));

  const hasDrainOrStreetContext =
    matchedDrainBefore.length >= 2 && matchedDrainAfter.length >= 2;

  const topConfs = [...beforeLabels, ...afterLabels]
    .slice(0, 8)
    .map((l) => Number(l.Confidence || 0))
    .filter((n) => n > 0);
  const avgConfidence =
    topConfs.length > 0
      ? clampScore(
          topConfs.reduce((acc, v) => acc + v, 0) / topConfs.length,
          75
        )
      : 70;

  const beforeBrightness = Math.round(Number(beforeQual?.Brightness ?? 0));
  const afterBrightness = Math.round(Number(afterQual?.Brightness ?? 0));
  const brightnessDelta = afterBrightness - beforeBrightness;
  const deltaSign = brightnessDelta >= 0 ? `+${brightnessDelta}` : `${brightnessDelta}`;

  const consistencyScore = clampScore(
    Math.min(
      95,
      45 + sharedLabels.length * 10 + (hasDrainOrStreetContext ? 15 : 0)
    ),
    65
  );

  const taskMatchScore = clampScore(
    hasDrainOrStreetContext
      ? Math.min(94, 65 + (matchedDrainBefore.length + matchedDrainAfter.length) * 4)
      : 48,
    60
  );

  const lowSharpness =
    Number(beforeQual?.Sharpness ?? 80) < 35 ||
    Number(afterQual?.Sharpness ?? 80) < 35;

  const overallAssessment: OverallAssessment =
    hasDrainOrStreetContext && !lowSharpness ? "LIKELY_VALID" : "NEEDS_REVIEW";

  const sharedDisplay =
    sharedLabels.length > 0
      ? sharedLabels
          .slice(0, 5)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(", ")
      : "None";

  const concerns: string[] = [];
  if (lowSharpness) {
    concerns.push("One or both photos have low sharpness (< 35/100).");
  }
  if (!hasDrainOrStreetContext) {
    concerns.push(
      "Few roadside or drainage scene labels were detected; inspect photos carefully."
    );
  }

  return {
    overallAssessment,
    confidence: avgConfidence,
    taskMatch: {
      score: taskMatchScore,
      assessment: hasDrainOrStreetContext
        ? `Urban roadside/drain context detected (${matchedDrainBefore.concat(matchedDrainAfter).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5).join(", ")}).`
        : "Limited roadside/drainage labels detected; manual inspection required.",
    },
    beforeEvidence: {
      score: beforeScore,
      observations: [
        `Before labels: ${formatTopLabels(beforeLabels, 5)}`,
        `Before ${formatQualitySummary(beforeQual)}`,
      ],
    },
    afterEvidence: {
      score: afterScore,
      observations: [
        `After labels: ${formatTopLabels(afterLabels, 5)}`,
        `After ${formatQualitySummary(afterQual)}`,
      ],
    },
    beforeAfterConsistency: {
      score: consistencyScore,
      assessment: `Shared scene labels: ${sharedDisplay}. Brightness shifted ${beforeBrightness} → ${afterBrightness} (${deltaSign} pts). Distinct image files verified.`,
    },
    concerns,
    summary: `Detected ${formatTopLabels(beforeLabels, 3)} in Before and ${formatTopLabels(afterLabels, 3)} in After (shared: ${sharedDisplay}; brightness ${beforeBrightness} → ${afterBrightness}).`,
  };
}

function buildStubbleRekognitionAssessment(params: {
  proofRekog: RekognitionDetectLabelsResponse;
}): StructuredAiOutput {
  const labels = params.proofRekog.Labels ?? [];
  const qual = params.proofRekog.ImageProperties?.Quality;
  const qualityScore = computeQualityScore(qual);

  const labelNames = new Set(
    labels.map((l) => (l.Name || "").toLowerCase()).filter(Boolean)
  );
  const matchedAgri = [...labelNames].filter((n) =>
    AGRI_BIOMASS_CONTEXT_KEYWORDS.has(n)
  );
  const hasAgriContext = matchedAgri.length >= 2;

  const topConfs = labels
    .slice(0, 6)
    .map((l) => Number(l.Confidence || 0))
    .filter((n) => n > 0);
  const avgConfidence =
    topConfs.length > 0
      ? clampScore(
          topConfs.reduce((acc, v) => acc + v, 0) / topConfs.length,
          80
        )
      : 70;

  const taskMatchScore = clampScore(
    hasAgriContext ? Math.min(95, 68 + matchedAgri.length * 5) : 45,
    65
  );

  const overallAssessment: OverallAssessment =
    hasAgriContext && qualityScore >= 50 ? "LIKELY_VALID" : "NEEDS_REVIEW";

  const concerns: string[] = [];
  if (!hasAgriContext) {
    concerns.push(
      "Few agricultural or transport scene labels were detected; inspect pickup photo carefully."
    );
  }
  if (qualityScore < 50) {
    concerns.push("Photo clarity or lighting is below standard (< 50/100).");
  }

  return {
    overallAssessment,
    confidence: avgConfidence,
    taskMatch: {
      score: taskMatchScore,
      assessment: hasAgriContext
        ? `Agricultural/pickup labels detected: ${matchedAgri.slice(0, 6).join(", ")}.`
        : "Limited agricultural residue labels detected; operator verification required.",
    },
    beforeEvidence: {
      score: qualityScore,
      observations: [
        `Detected labels: ${formatTopLabels(labels, 6)}`,
      ],
    },
    afterEvidence: {
      score: qualityScore,
      observations: [
        formatQualitySummary(qual),
      ],
    },
    beforeAfterConsistency: {
      score: taskMatchScore,
      assessment: `Matched ${matchedAgri.length} agricultural/transport scene indicators (${matchedAgri.slice(0, 5).join(", ") || "none"}).`,
    },
    concerns,
    summary: `Detected ${formatTopLabels(labels, 4)} (${formatQualitySummary(qual)}).`,
  };
}

interface AppSyncIdentity {
  sub?: string;
  username?: string;
  claims?: Record<string, unknown>;
  groups?: string[] | null;
}

interface VerifyEvidenceEvent {
  arguments?: {
    evidenceType?: "BOUNTY" | "STUBBLE" | null;
    resourceId?: string | null;
    forceRecheck?: boolean | null;
    simulateMalformedOutput?: boolean | null;
  };
  identity?: AppSyncIdentity | null;
}

export const handler = async (event: VerifyEvidenceEvent) => {
  // 1. Enforce authoritative backend OPERATOR authorization
  const groups = event.identity?.groups ?? [];
  const claimsGroups = event.identity?.claims?.["cognito:groups"];
  const isOperator =
    (Array.isArray(groups) && groups.includes("OPERATOR")) ||
    (Array.isArray(claimsGroups) && claimsGroups.includes("OPERATOR")) ||
    (typeof claimsGroups === "string" && claimsGroups.includes("OPERATOR"));

  if (!isOperator) {
    throw new Error("You do not have permission for this action");
  }

  const callerId =
    (typeof event.identity?.claims?.email === "string"
      ? event.identity.claims.email
      : null) ||
    event.identity?.username ||
    event.identity?.sub ||
    "operator.demo@aquiloop.test";

  const evidenceType = event.arguments?.evidenceType;
  const resourceId = event.arguments?.resourceId?.trim();
  const forceRecheck = Boolean(event.arguments?.forceRecheck);

  if (
    (evidenceType !== "BOUNTY" && evidenceType !== "STUBBLE") ||
    !resourceId
  ) {
    return {
      success: false,
      status: "INVALID_REQUEST",
      message: "Evidence could not be analyzed",
    };
  }

  const bountyTable = process.env.BOUNTY_TABLE_NAME;
  const stubbleTable = process.env.STUBBLE_LISTING_TABLE_NAME;
  const verificationTable = process.env.EVIDENCE_VERIFICATION_TABLE_NAME;
  const bucketName = process.env.EVIDENCE_BUCKET_NAME;

  if (!bountyTable || !stubbleTable || !verificationTable || !bucketName) {
    return {
      success: false,
      status: "CONFIG_ERROR",
      message: "AI check unavailable right now",
    };
  }

  // 2. Load target resource metadata & compute evidence fingerprint
  let evidenceFingerprint = "";
  let ownerId = callerId;
  let resourceData: Record<string, unknown> | null = null;
  let s3KeysToLoad: string[] = [];

  if (evidenceType === "BOUNTY") {
    resourceData = await getDynamoItemById(bountyTable, resourceId);
    let beforeKey = String(resourceData?.beforeEvidenceKey || "").trim();
    let afterKey = String(resourceData?.afterEvidenceKey || "").trim();

    if (!resourceData) {
      const taskTable =
        process.env.TASK_TABLE_NAME || bountyTable.replace(/^Bounty-/, "Task-");
      try {
        resourceData = await getDynamoItemById(taskTable, resourceId);
      } catch {
        resourceData = null;
      }
      if (resourceData) {
        const desc = String(resourceData.description || "");
        const beforeMatch = desc.match(/(?:^|\|\s*)BeforeKey:\s*([^|]+)/i);
        const afterMatch = desc.match(/(?:^|\|\s*)AfterKey:\s*([^|]+)/i);
        beforeKey = beforeMatch ? beforeMatch[1].trim() : "";
        afterKey = afterMatch ? afterMatch[1].trim() : "";
      }
    }

    if (!resourceData) {
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Evidence could not be analyzed",
      };
    }
    if (!beforeKey || !afterKey) {
      return {
        success: false,
        status: "INVALID_EVIDENCE",
        message: "Evidence image is invalid",
      };
    }
    evidenceFingerprint = `${beforeKey}|${afterKey}`;
    s3KeysToLoad = [beforeKey, afterKey];
    ownerId = String(
      resourceData.claimedBy ||
        resourceData.assignedWorkerId ||
        resourceData.createdBy ||
        callerId
    );
  } else {
    resourceData = await getDynamoItemById(stubbleTable, resourceId);
    if (!resourceData) {
      return {
        success: false,
        status: "NOT_FOUND",
        message: "Evidence could not be analyzed",
      };
    }
    const proofKey = String(resourceData.proofKey || "").trim();
    if (!proofKey) {
      return {
        success: false,
        status: "INVALID_EVIDENCE",
        message: "Evidence image is invalid",
      };
    }
    evidenceFingerprint = proofKey;
    s3KeysToLoad = [proofKey];
    ownerId = String(
      resourceData.farmerId || resourceData.acceptedBy || callerId
    );
  }

  const fingerprintHash = sha256Hex(evidenceFingerprint).slice(0, 16);
  const verificationId = `${evidenceType}#${resourceId}#${fingerprintHash}`;

  // 3. Return cached verification if evidence has not changed and not forcing recheck
  if (!forceRecheck) {
    const existing = await getDynamoItemById(verificationTable, verificationId);
    if (existing && typeof existing.overallAssessment === "string") {
      return {
        success: true,
        status: "COMPLETED",
        cached: true,
        verification: {
          id: String(existing.id),
          evidenceType: existing.evidenceType as "BOUNTY" | "STUBBLE",
          resourceId: String(existing.resourceId),
          ownerId: String(existing.ownerId || ownerId),
          evidenceFingerprint: String(
            existing.evidenceFingerprint || evidenceFingerprint
          ),
          requestedBy: String(existing.requestedBy || callerId),
          overallAssessment: existing.overallAssessment as OverallAssessment,
          confidence: Number(existing.confidence ?? 0),
          taskMatchScore: Number(existing.taskMatchScore ?? 0),
          taskMatchAssessment: String(existing.taskMatchAssessment || ""),
          beforeEvidenceScore: Number(existing.beforeEvidenceScore ?? 0),
          beforeObservations: Array.isArray(existing.beforeObservations)
            ? (existing.beforeObservations as string[])
            : [],
          afterEvidenceScore: Number(existing.afterEvidenceScore ?? 0),
          afterObservations: Array.isArray(existing.afterObservations)
            ? (existing.afterObservations as string[])
            : [],
          consistencyScore: Number(existing.consistencyScore ?? 0),
          consistencyAssessment: String(existing.consistencyAssessment || ""),
          summary: String(existing.summary || ""),
          concerns: Array.isArray(existing.concerns)
            ? (existing.concerns as string[])
            : [],
          modelId: String(existing.modelId || MODEL_ID),
          modelVersion: String(existing.modelVersion || MODEL_VERSION),
          evaluatedAt: String(existing.evaluatedAt || new Date().toISOString()),
          createdAt: String(existing.createdAt || new Date().toISOString()),
          updatedAt: String(existing.updatedAt || new Date().toISOString()),
        },
        message: "Loaded existing Rekognition image analysis",
      };
    }
  }

  // 4. Fetch real image bytes from private S3 bucket
  let loadedImages: Array<{ bytes: Uint8Array; sha256: string }> = [];
  try {
    loadedImages = await Promise.all(
      s3KeysToLoad.map((k) => fetchPrivateS3Image(bucketName, k))
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    return {
      success: false,
      status: "INVALID_EVIDENCE",
      message:
        code === "INVALID_IMAGE_BYTES" || code === "INVALID_EVIDENCE_KEY"
          ? "Evidence image is invalid"
          : "Evidence could not be analyzed",
    };
  }

  // 5. Invoke real Amazon Rekognition DetectLabels (GENERAL_LABELS + IMAGE_PROPERTIES)
  let parsed: StructuredAiOutput;
  try {
    if (evidenceType === "BOUNTY") {
      const [beforeRekog, afterRekog] = await Promise.all([
        callRekognitionDetectLabels(loadedImages[0].bytes),
        callRekognitionDetectLabels(loadedImages[1].bytes),
      ]);
      parsed = buildBountyRekognitionAssessment({
        beforeRekog,
        afterRekog,
        beforeSha256: loadedImages[0].sha256,
        afterSha256: loadedImages[1].sha256,
      });
    } else {
      const proofRekog = await callRekognitionDetectLabels(
        loadedImages[0].bytes
      );
      parsed = buildStubbleRekognitionAssessment({ proofRekog });
    }
  } catch {
    return {
      success: false,
      status: "REKOGNITION_UNAVAILABLE",
      message: "AI check unavailable right now",
    };
  }

  const nowIso = new Date().toISOString();
  const verificationRecord: PersistedVerificationItem = {
    id: verificationId,
    evidenceType,
    resourceId,
    ownerId,
    evidenceFingerprint,
    requestedBy: callerId,
    overallAssessment: parsed.overallAssessment,
    confidence: parsed.confidence,
    taskMatchScore: parsed.taskMatch.score,
    taskMatchAssessment: parsed.taskMatch.assessment,
    beforeEvidenceScore: parsed.beforeEvidence.score,
    beforeObservations: parsed.beforeEvidence.observations,
    afterEvidenceScore: parsed.afterEvidence.score,
    afterObservations: parsed.afterEvidence.observations,
    consistencyScore: parsed.beforeAfterConsistency.score,
    consistencyAssessment: parsed.beforeAfterConsistency.assessment,
    summary: parsed.summary,
    concerns: parsed.concerns,
    modelId: MODEL_ID,
    modelVersion: MODEL_VERSION,
    evaluatedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 6. Persist structured verification result to DynamoDB EvidenceVerification table
  try {
    await putVerificationRecord(verificationTable, verificationRecord);
  } catch {
    return {
      success: false,
      status: "PERSIST_FAILED",
      message: "Unable to save verification result",
    };
  }

  return {
    success: true,
    status: "COMPLETED",
    cached: false,
    verification: verificationRecord,
    message: "Rekognition image analysis completed",
  };
};
