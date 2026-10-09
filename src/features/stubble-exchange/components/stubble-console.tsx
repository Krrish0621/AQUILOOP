"use client";

import * as React from "react";
import { ShieldCheck, Sprout, Truck } from "lucide-react";
import { RoleAccessNotice } from "@/components/auth/role-access-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { FarmerDashboard } from "@/features/stubble-exchange/components/farmer-dashboard";
import { BuyerMarketplace } from "@/features/stubble-exchange/components/buyer-marketplace";
import { OperatorVerification } from "@/features/stubble-exchange/components/operator-verification";
import { StubbleImpact } from "@/features/stubble-exchange/components/stubble-impact";
import { useStubbleExchangeStore } from "@/features/stubble-exchange/lib/stubble-store";
import { useCurrentRole } from "@/lib/auth-context";
import type { StubbleExchangeRole } from "@/types";

export function StubbleConsole() {
  const { role } = useCurrentRole();
  const {
    listings,
    pickups,
    arcLedger,
    trendData,
    summary,
    isLoading,
    error,
    reload,
    createListing,
    acceptListingPickup,
    updatePickupStage,
    submitPickupEvidence,
    approvePickupVerification,
    rejectPickupVerification,
  } = useStubbleExchangeStore();

  const [selectedBuyerListingId, setSelectedBuyerListingId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (
      listings.length > 0 &&
      (!selectedBuyerListingId ||
        !listings.some((l) => l.id === selectedBuyerListingId))
    ) {
      setSelectedBuyerListingId(listings[0].id);
    }
  }, [listings, selectedBuyerListingId]);

  const handleAcceptPickup = (listingId: string) => {
    void acceptListingPickup(listingId);
    setSelectedBuyerListingId(listingId);
  };

  if (role !== "FARMER" && role !== "BUYER" && role !== "OPERATOR") {
    return (
      <RoleAccessNotice
        moduleName="Stubble-to-Water Exchange"
        allowedRoles={["FARMER", "BUYER", "OPERATOR"]}
      />
    );
  }

  const activeRole: StubbleExchangeRole = role;

  return (
    <div className="space-y-8">
      {/* ====================================================================
       * STUBBLE-TO-WATER HEADER & ROLE WORKSPACE
       * ==================================================================== */}
      <header className="relative overflow-hidden rounded-2xl border border-secondary/45 bg-surface p-6 shadow-panel">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-warning" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 max-w-3xl">
            <StatusBadge
              tone="success"
              code="MODULE 03 · STUBBLE-TO-WATER EXCHANGE"
              label="List Residue → Buyer Pickup → Verify → Earn ARC"
            />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Stubble-to-Water Exchange — Agricultural Residue Recovery
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Connect Delhi NCR farmers with biomass buyers for scheduled
              farm-gate collection, preventing crop-burning smoke while earning
              verified Resilience Credits (ARC).
            </p>
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 shrink-0"
            aria-label="Authenticated Role Workspace"
          >
            {activeRole === "FARMER" && (
              <>
                <Sprout className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  Farmer Workspace ({listings.length} Plots)
                </span>
              </>
            )}

            {activeRole === "BUYER" && (
              <>
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Buyer Workspace ({summary.openListingsCount} Open)
                </span>
              </>
            )}

            {activeRole === "OPERATOR" && (
              <>
                <ShieldCheck className="h-4 w-4 text-warning" />
                <span className="text-xs font-semibold text-foreground">
                  Operator Workspace ({summary.pendingVerificationCount} Review)
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {error && (
        <ErrorState
          title="Stubble Exchange Operation Error"
          message={error}
          onRetry={() => void reload()}
        />
      )}

      {/* ====================================================================
       * STRICT CONDITIONAL ROLE RENDERING: FARMER | BUYER | OPERATOR
       * ==================================================================== */}
      {isLoading ? (
        <LoadingState
          label="Loading residue listings..."
          sublabel="Loading active Stubble-to-Water Exchange listings across Delhi NCR"
          rows={3}
        />
      ) : (
        <React.Suspense
          fallback={
            <LoadingState
              label="Loading workspace..."
              sublabel="Preparing Stubble-to-Water Exchange view"
              rows={2}
            />
          }
        >
          {activeRole === "FARMER" && (
            <FarmerDashboard
              listings={listings}
              pickups={pickups}
              arcLedger={arcLedger}
              onCreateListing={createListing}
            />
          )}

          {activeRole === "BUYER" && (
            <BuyerMarketplace
              listings={listings}
              pickups={pickups}
              selectedListingId={selectedBuyerListingId}
              onSelectListing={setSelectedBuyerListingId}
              onAcceptPickup={handleAcceptPickup}
              onUpdatePickupStage={(id, stage, win) =>
                void updatePickupStage(id, stage, win)
              }
              onSubmitEvidence={(id, ev) => void submitPickupEvidence(id, ev)}
            />
          )}

          {activeRole === "OPERATOR" && (
            <div className="space-y-8">
              <OperatorVerification
                pickups={pickups}
                listings={listings}
                onApprove={(id) => void approvePickupVerification(id)}
                onReject={(id, reason, note) =>
                  void rejectPickupVerification(id, reason, note)
                }
              />

              <StubbleImpact trendData={trendData} summary={summary} />
            </div>
          )}
        </React.Suspense>
      )}
    </div>
  );
}
