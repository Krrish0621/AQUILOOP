import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { weatherIngest } from "../functions/weather-ingest/resource.js";
import { verifyEvidence } from "../functions/verify-evidence/resource.js";

/**
 * AQUILOOP — AWS Amplify Gen 2 Real Data Resource (AppSync + DynamoDB)
 *
 * Implements the core models for AQUILOOP's three primary product modules:
 * 1. Task (MONSOONLOOP municipal/operator pre-rain tasks)
 * 2. Bounty (Flood & Waste Bounties)
 * 3. StubbleListing (Stubble-to-Water Exchange listings & pickup workflow)
 * 4. UserProfile (Minimal application profile; Cognito JWT group remains authoritative)
 * 5. WeatherForecast (Real Open-Meteo hourly forecast telemetry for MONSOONLOOP)
 * 6. EvidenceVerification (Real Amazon Bedrock assistive AI evidence verification)
 */
const schema = a.schema({
  Task: a
    .model({
      title: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      description: a.string().required(),
      locationName: a.string().required(),
      latitude: a.float().required(),
      longitude: a.float().required(),
      taskType: a.enum([
        "DRAIN_INSPECTION",
        "DRAIN_CLEARING",
        "WATER_ASSET_CHECK",
        "FLOOD_RESPONSE",
        "WASTE_REMOVAL",
        "OTHER",
      ]),
      priority: a.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
      status: a.enum([
        "PENDING",
        "ASSIGNED",
        "IN_PROGRESS",
        "SUBMITTED",
        "VERIFIED",
        "FAILED",
      ]),
      assignedTeam: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      assignedWorkerId: a.string(),
      createdBy: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      deadline: a
        .string()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      verifiedAt: a
        .string()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
    })
    .authorization((allow) => [
      allow.group("OPERATOR").to(["create", "read", "update", "delete"]),
      allow.group("WORKER").to(["read", "update"]),
    ]),

  Bounty: a
    .model({
      title: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      description: a.string().required(),
      locationName: a.string().required(),
      latitude: a.float().required(),
      longitude: a.float().required(),
      bountyType: a.enum(["WASTE", "PLASTIC", "DRAIN_WASTE", "OTHER"]),
      rewardArc: a
        .integer()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      status: a.enum([
        "OPEN",
        "CLAIMED",
        "IN_PROGRESS",
        "SUBMITTED",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
      ]),
      createdBy: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      claimedBy: a.string(),
      assignedAt: a.string(),
      submittedAt: a.string(),
      verifiedAt: a
        .string()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
      beforeEvidenceKey: a.string(),
      afterEvidenceKey: a.string(),
      submittedLatitude: a.float(),
      submittedLongitude: a.float(),
      submittedTimestamp: a.string(),
      rejectionReason: a
        .string()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.group("WORKER").to(["read"]),
        ]),
    })
    .authorization((allow) => [
      allow.group("OPERATOR").to(["create", "read", "update", "delete"]),
      allow.group("WORKER").to(["read", "update"]),
    ]),

  StubbleListing: a
    .model({
      farmerId: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.ownerDefinedIn("farmerId").to(["create", "read", "update"]),
          allow.group("FARMER").to(["create", "read", "update"]),
          allow.group("BUYER").to(["read"]),
        ]),
      farmerName: a
        .string()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.ownerDefinedIn("farmerId").to(["create", "read", "update"]),
          allow.group("FARMER").to(["create", "read", "update"]),
          allow.group("BUYER").to(["read"]),
        ]),
      locationName: a.string().required(),
      latitude: a.float().required(),
      longitude: a.float().required(),
      quantity: a
        .float()
        .required()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.ownerDefinedIn("farmerId").to(["create", "read", "update"]),
          allow.group("FARMER").to(["create", "read", "update"]),
          allow.group("BUYER").to(["read"]),
        ]),
      unit: a.string().required(),
      cropType: a.string(),
      priceOrReward: a.float(),
      description: a.string(),
      status: a.enum([
        "OPEN",
        "ACCEPTED",
        "SCHEDULED",
        "IN_TRANSIT",
        "PICKED_UP",
        "PENDING_VERIFICATION",
        "VERIFIED",
        "REJECTED",
      ]),
      acceptedBy: a.string(),
      pickupDate: a.string(),
      pickedUpAt: a.string(),
      submittedAt: a.string(),
      verifiedAt: a
        .string()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.ownerDefinedIn("farmerId").to(["read"]),
          allow.group("FARMER").to(["read"]),
          allow.group("BUYER").to(["read"]),
        ]),
      proofKey: a.string(),
      rejectionReason: a
        .string()
        .authorization((allow) => [
          allow.group("OPERATOR").to(["create", "read", "update"]),
          allow.ownerDefinedIn("farmerId").to(["read"]),
          allow.group("FARMER").to(["read"]),
          allow.group("BUYER").to(["read"]),
        ]),
    })
    .secondaryIndexes((index) => [index("farmerId")])
    .authorization((allow) => [
      allow.group("OPERATOR").to(["create", "read", "update", "delete"]),
      allow.ownerDefinedIn("farmerId").to(["create", "read", "update"]),
      allow.group("FARMER").to(["create", "read", "update"]),
      allow.group("BUYER").to(["read", "update"]),
    ]),

  UserProfile: a
    .model({
      email: a.string().required(),
      displayName: a.string(),
      role: a.enum(["OPERATOR", "WORKER", "FARMER", "BUYER"]),
      phone: a.string(),
    })
    .authorization((allow) => [
      allow.owner().to(["create", "read", "update"]),
      allow.group("OPERATOR").to(["create", "read", "update", "delete"]),
    ]),

  WeatherForecast: a
    .model({
      locationKey: a.string().required(),
      locationName: a.string().required(),
      latitude: a.float().required(),
      longitude: a.float().required(),
      forecastTime: a.string().required(),
      rainfallMm: a.float().required(),
      rainProbability: a.float(),
      temperatureC: a.float(),
      weatherCode: a.integer(),
      source: a.string().required(),
      fetchedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index("locationKey")
        .sortKeys(["forecastTime"])
        .queryField("listWeatherByLocationAndTime"),
    ])
    .authorization((allow) => [
      allow.authenticated().to(["read"]),
      allow.group("OPERATOR").to(["create", "read", "update", "delete"]),
    ]),

  EvidenceVerification: a
    .model({
      evidenceType: a.enum(["BOUNTY", "STUBBLE"]),
      resourceId: a.string().required(),
      ownerId: a.string().required(),
      evidenceFingerprint: a.string(),
      requestedBy: a.string().required(),
      overallAssessment: a.enum([
        "LIKELY_VALID",
        "NEEDS_REVIEW",
        "LIKELY_INVALID",
      ]),
      confidence: a.integer().required(),
      taskMatchScore: a.integer().required(),
      taskMatchAssessment: a.string(),
      beforeEvidenceScore: a.integer().required(),
      beforeObservations: a.string().array(),
      afterEvidenceScore: a.integer().required(),
      afterObservations: a.string().array(),
      consistencyScore: a.integer().required(),
      consistencyAssessment: a.string(),
      summary: a.string().required(),
      concerns: a.string().array(),
      modelId: a.string().required(),
      modelVersion: a.string(),
      evaluatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index("resourceId")
        .sortKeys(["evaluatedAt"])
        .queryField("listVerificationsByResource"),
    ])
    .authorization((allow) => [
      allow.group("OPERATOR").to(["create", "read", "update", "delete"]),
      allow.ownerDefinedIn("ownerId").to(["read"]),
    ]),

  WeatherRefreshResult: a.customType({
    success: a.boolean().required(),
    locationsProcessed: a.integer().required(),
    recordsUpserted: a.integer().required(),
    fetchedAt: a.string().required(),
    source: a.string().required(),
    message: a.string(),
  }),

  refreshWeatherForecast: a
    .mutation()
    .arguments({
      locationKey: a.string(),
    })
    .returns(a.ref("WeatherRefreshResult"))
    .authorization((allow) => [allow.group("OPERATOR")])
    .handler(a.handler.function(weatherIngest)),

  VerifyEvidenceRecord: a.customType({
    id: a.string().required(),
    evidenceType: a.string().required(),
    resourceId: a.string().required(),
    ownerId: a.string(),
    evidenceFingerprint: a.string(),
    requestedBy: a.string().required(),
    overallAssessment: a.string().required(),
    confidence: a.integer().required(),
    taskMatchScore: a.integer().required(),
    taskMatchAssessment: a.string(),
    beforeEvidenceScore: a.integer().required(),
    beforeObservations: a.string().array(),
    afterEvidenceScore: a.integer().required(),
    afterObservations: a.string().array(),
    consistencyScore: a.integer().required(),
    consistencyAssessment: a.string(),
    summary: a.string().required(),
    concerns: a.string().array(),
    modelId: a.string().required(),
    modelVersion: a.string(),
    evaluatedAt: a.string().required(),
  }),

  VerifyEvidenceResponse: a.customType({
    success: a.boolean().required(),
    status: a.string().required(),
    cached: a.boolean(),
    verification: a.ref("VerifyEvidenceRecord"),
    message: a.string(),
  }),

  verifyEvidence: a
    .mutation()
    .arguments({
      evidenceType: a.enum(["BOUNTY", "STUBBLE"]),
      resourceId: a.string().required(),
      forceRecheck: a.boolean(),
      simulateMalformedOutput: a.boolean(),
    })
    .returns(a.ref("VerifyEvidenceResponse"))
    .authorization((allow) => [allow.group("OPERATOR")])
    .handler(a.handler.function(verifyEvidence)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});

