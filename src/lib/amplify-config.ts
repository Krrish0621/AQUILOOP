"use client";

import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";

/** True once Amplify has been configured with real AWS outputs. */
export let isAmplifyConfigured = false;

/**
 * Configures the AWS Amplify client using the generated `amplify_outputs.json`.
 * Idempotent and safe to call before any Amplify Auth operation.
 */
export function configureAmplifyClient(): boolean {
  if (isAmplifyConfigured) return true;

  try {
    if (outputs && typeof outputs === "object" && "auth" in outputs) {
      Amplify.configure(outputs);
      isAmplifyConfigured = true;
      return true;
    }
    return false;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[AQUILOOP] Amplify configuration warning:", err);
    }
    return false;
  }
}

// Configure immediately on client module load so Auth calls never race with useEffect
if (typeof window !== "undefined") {
  configureAmplifyClient();
}
