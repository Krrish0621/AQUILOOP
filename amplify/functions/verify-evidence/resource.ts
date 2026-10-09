import { defineFunction } from "@aws-amplify/backend";

/**
 * AQUILOOP — Real Amazon Bedrock AI Evidence Verification Lambda (Milestone #15)
 *
 * - Invoked via AWS AppSync (`verifyEvidence` mutation, restricted to OPERATOR group)
 * - Reads private evidence images directly from Amazon S3 (`aquiloopEvidenceStorage`)
 * - Loads Bounty or StubbleListing metadata from Amazon DynamoDB
 * - Invokes Amazon Bedrock Runtime (`ConverseCommand`) in ap-southeast-2
 * - Persists structured assistive verification results into `EvidenceVerification` table
 * - Assigned to the `data` resource group to avoid circular stack dependencies
 */
export const verifyEvidence = defineFunction({
  name: "verify-evidence",
  entry: "./handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
  resourceGroupName: "data",
});
