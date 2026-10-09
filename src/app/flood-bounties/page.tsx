import * as React from "react";
import { FloodBountiesConsole } from "@/features/flood-bounties/flood-bounties-console";
import { LoadingState } from "@/components/shared/loading-state";

export default function FloodBountiesPage() {
  return (
    <React.Suspense
      fallback={
        <LoadingState
          label="Loading Delhi NCR Flood & Waste Bounties..."
          sublabel="Preparing Operator & Worker workflows"
        />
      }
    >
      <FloodBountiesConsole />
    </React.Suspense>
  );
}
