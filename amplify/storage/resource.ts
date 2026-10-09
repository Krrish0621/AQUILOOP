import { defineStorage } from "@aws-amplify/backend";

/**
 * AQUILOOP — AWS Amplify Gen 2 Storage Resource (Milestone #13)
 *
 * Configures a private Amazon S3 bucket in ap-southeast-2 for field evidence:
 * - Flood & Waste Bounties:
 *   - bounties/{bountyId}/before/before-{uuid}.{ext}
 *   - bounties/{bountyId}/after/after-{uuid}.{ext}
 * - Stubble-to-Water Exchange:
 *   - stubble/{listingId}/proof/proof-{uuid}.{ext}
 * - MONSOONLOOP Tasks (optional field evidence):
 *   - tasks/{taskId}/before/before-{uuid}.{ext}
 *   - tasks/{taskId}/after/after-{uuid}.{ext}
 *
 * Authorization:
 * - Bucket is strictly PRIVATE (zero guest/public access).
 * - OPERATOR has full read, write, and delete access across all prefixes.
 * - WORKER has read and write access to bounties/* and tasks/* (no delete access,
 *   and zero access to stubble/*).
 * - FARMER and BUYER have read and write access to stubble/* (no delete access,
 *   and zero access to bounties/* or tasks/*).
 */
export const storage = defineStorage({
  name: "aquiloopEvidenceStorage",
  access: (allow) => ({
    "bounties/*": [
      allow.groups(["OPERATOR"]).to(["read", "write", "delete"]),
      allow.groups(["WORKER"]).to(["read", "write"]),
    ],
    "stubble/*": [
      allow.groups(["OPERATOR"]).to(["read", "write", "delete"]),
      allow.groups(["FARMER", "BUYER"]).to(["read", "write"]),
    ],
    "tasks/*": [
      allow.groups(["OPERATOR"]).to(["read", "write", "delete"]),
      allow.groups(["WORKER"]).to(["read", "write"]),
    ],
  }),
});
