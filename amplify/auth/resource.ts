import { defineAuth } from "@aws-amplify/backend";

/**
 * AQUILOOP — Real Amazon Cognito Authentication Resource (Amplify Gen 2)
 *
 * Configures:
 * - Email + password sign-in and sign-up
 * - Email verification (code-based)
 * - Account recovery / password reset via email
 * - Authoritative Cognito User Pool groups for the four AQUILOOP roles:
 *   1. OPERATOR (Municipal / Resilience Command Authority)
 *   2. WORKER   (Field Drain & Waste Cleanup Execution)
 *   3. FARMER   (Agricultural Crop Residue / Stubble Listing)
 *   4. BUYER    (Biomass & Crop Residue Collection / Pickup)
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ["OPERATOR", "WORKER", "FARMER", "BUYER"],
  accountRecovery: "EMAIL_ONLY",
});
