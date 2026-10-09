"use client";

import * as React from "react";
import { configureAmplifyClient } from "@/lib/amplify-config";
import { AuthProvider } from "@/lib/auth-context";

// Ensure Amplify is configured as early as possible on both client and server import
configureAmplifyClient();

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  configureAmplifyClient();

  return <AuthProvider>{children}</AuthProvider>;
}
