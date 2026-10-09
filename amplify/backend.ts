import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { storage } from "./storage/resource.js";
import { weatherIngest } from "./functions/weather-ingest/resource.js";
import { verifyEvidence } from "./functions/verify-evidence/resource.js";

/**
 * AQUILOOP — AWS Amplify Gen 2 Backend Definition
 *
 * CONFIGURED RESOURCES:
 * - Stage 11: Amazon Cognito Authentication (`auth`) with groups:
 *   OPERATOR, WORKER, FARMER, BUYER
 * - Stage 12: Amazon DynamoDB via AWS AppSync (`data`) with models:
 *   Task, Bounty, StubbleListing, UserProfile, WeatherForecast, EvidenceVerification
 * - Stage 13: Amazon S3 (`storage`) for private evidence photo uploads:
 *   bounties/*, stubble/*, tasks/*
 * - Stage 14: AWS Lambda + EventBridge Schedule (`weatherIngest`):
 *   Real Open-Meteo hourly weather ingestion every 3h + OPERATOR on-demand refresh
 * - Stage 15 / 20: AWS Lambda + Amazon Rekognition (`verifyEvidence`):
 *   Real DetectLabels & ImageProperties quality analysis on private S3 evidence photos
 */
export const backend = defineBackend({
  auth,
  data,
  storage,
  weatherIngest,
  verifyEvidence,
});

const weatherForecastTable = backend.data.resources.tables["WeatherForecast"];
if (weatherForecastTable) {
  weatherForecastTable.grantReadWriteData(
    backend.weatherIngest.resources.lambda
  );
  backend.weatherIngest.addEnvironment(
    "WEATHER_FORECAST_TABLE_NAME",
    weatherForecastTable.tableName
  );
}

const taskTable = backend.data.resources.tables["Task"];
const bountyTable = backend.data.resources.tables["Bounty"];
const stubbleListingTable = backend.data.resources.tables["StubbleListing"];
const evidenceVerificationTable =
  backend.data.resources.tables["EvidenceVerification"];
const evidenceBucket = backend.storage.resources.bucket;

if (taskTable) {
  taskTable.grantReadData(backend.verifyEvidence.resources.lambda);
  backend.verifyEvidence.addEnvironment(
    "TASK_TABLE_NAME",
    taskTable.tableName
  );
}

if (bountyTable) {
  bountyTable.grantReadData(backend.verifyEvidence.resources.lambda);
  backend.verifyEvidence.addEnvironment(
    "BOUNTY_TABLE_NAME",
    bountyTable.tableName
  );
}

if (stubbleListingTable) {
  stubbleListingTable.grantReadData(backend.verifyEvidence.resources.lambda);
  backend.verifyEvidence.addEnvironment(
    "STUBBLE_LISTING_TABLE_NAME",
    stubbleListingTable.tableName
  );
}

if (evidenceVerificationTable) {
  evidenceVerificationTable.grantReadWriteData(
    backend.verifyEvidence.resources.lambda
  );
  backend.verifyEvidence.addEnvironment(
    "EVIDENCE_VERIFICATION_TABLE_NAME",
    evidenceVerificationTable.tableName
  );
}

if (evidenceBucket) {
  evidenceBucket.grantRead(backend.verifyEvidence.resources.lambda);
  backend.verifyEvidence.addEnvironment(
    "EVIDENCE_BUCKET_NAME",
    evidenceBucket.bucketName
  );
}

backend.verifyEvidence.addEnvironment(
  "BEDROCK_MODEL_ID",
  "amazon.rekognition.detect-labels"
);

backend.verifyEvidence.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["rekognition:DetectLabels"],
    resources: ["*"],
  })
);
