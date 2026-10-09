"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
  Navigation,
  PlusCircle,
  Sprout,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  type OperationalTone,
} from "@/components/shared/status-badge";
import { ListingForm } from "@/features/stubble-exchange/components/listing-form";
import { PickupTracker } from "@/features/stubble-exchange/components/pickup-tracker";
import type {
  PickupRecord,
  ResilienceCreditTransaction,
  StubbleCondition,
  StubbleCropType,
  StubbleExchangeListing,
  StubbleListingStatus,
  StubbleNcrLocation,
} from "@/types";
import { cn } from "@/lib/utils";

interface FarmerDashboardProps {
  listings: StubbleExchangeListing[];
  pickups: PickupRecord[];
  arcLedger: ResilienceCreditTransaction[];
  onCreateListing: (draft: {
    title: string;
    cropType: StubbleCropType;
    quantity: number;
    unit: "tonnes" | "kg";
    location: StubbleNcrLocation;
    pickupAddress?: string;
    pickupWindow: string;
    condition: StubbleCondition;
    notes?: string;
  }) => Promise<StubbleExchangeListing | null> | StubbleExchangeListing | null;
}

const listingStatusMeta: Record<
  StubbleListingStatus,
  { tone: OperationalTone; label: string }
> = {
  OPEN: { tone: "warning", label: "Listed · Open for Buyers" },
  ACCEPTED: { tone: "info", label: "Accepted by Buyer" },
  SCHEDULED: { tone: "primary", label: "Pickup Scheduled" },
  IN_TRANSIT: { tone: "primary", label: "Buyer Vehicle In Transit" },
  PICKED_UP: { tone: "info", label: "Picked Up from Farm" },
  PENDING_VERIFICATION: { tone: "warning", label: "Awaiting Operator Review" },
  VERIFIED: { tone: "success", label: "Verified & ARC Credited" },
  REJECTED: { tone: "danger", label: "Needs Updated Proof" },
};

export function FarmerDashboard({
  listings,
  pickups,
  arcLedger,
  onCreateListing,
}: FarmerDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");

  const activeTab: "listings" | "create" =
    viewParam === "create" ? "create" : "listings";

  const [highlightedListingId, setHighlightedListingId] = React.useState<
    string | null
  >(null);

  const switchFarmerView = (nextView: "listings" | "create") => {
    router.push(`/stubble-exchange?view=${nextView}`, { scroll: false });
  };

  const activeListings = listings.filter((l) => l.status !== "VERIFIED");
  const expectedPickups = pickups.filter(
    (p) => p.status !== "VERIFIED" && p.status !== "REJECTED"
  );
  const totalListedTonnes = Number(
    listings.reduce((acc, l) => acc + l.quantityTonnes, 0).toFixed(1)
  );
  const earnedArc = arcLedger
    .filter((tx) => tx.status === "APPROVED")
    .reduce((acc, tx) => acc + tx.arcAmount, 0);
  const pendingArc = arcLedger
    .filter((tx) => tx.status === "PENDING_VERIFICATION")
    .reduce((acc, tx) => acc + tx.arcAmount, 0);

  return (
    <div className="space-y-8">
      {/* Compact Farmer Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            My Listings
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {activeListings.length} Active
          </p>
          <span className="text-xs text-muted-foreground">
            {listings.length} total ({totalListedTonnes} tonnes)
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Pickup Status
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-info">
            {expectedPickups.length} Scheduled
          </p>
          <span className="text-xs text-muted-foreground">
            Active buyer collections
          </span>
        </div>

        <div className="rounded-2xl border border-secondary/35 bg-secondary/[0.08] p-4 shadow-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-300 block">
            ARC Earned
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
            +{earnedArc} ARC
          </p>
          <span className="text-xs text-muted-foreground">
            Verified pickup rewards
          </span>
        </div>

        <div className="rounded-2xl border border-warning/35 bg-warning/[0.06] p-4 shadow-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-warning block">
            ARC Pending
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-warning">
            +{pendingArc} ARC
          </p>
          <span className="text-xs text-muted-foreground">
            Awaiting operator verification
          </span>
        </div>
      </div>

      {/* Dedicated Farmer View Bar (Synchronized with Farmer Sidebar) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => switchFarmerView("listings")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "listings"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sprout className="h-4 w-4" />
            <span>My Listings ({listings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => switchFarmerView("create")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "create"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <PlusCircle className="h-4 w-4" />
            <span>List Stubble for Pickup</span>
          </button>
        </div>

        {activeTab === "listings" ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => switchFarmerView("create")}
            className="gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ List Stubble for Pickup</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => switchFarmerView("listings")}
          >
            Back to My Listings ({listings.length})
          </Button>
        )}
      </div>

      {/* VIEW 1: LIST STUBBLE FOR PICKUP (Dedicated Form Screen) */}
      {activeTab === "create" ? (
        <div className="mx-auto max-w-4xl">
          <ListingForm
            onCreateListing={onCreateListing}
            onViewCreatedListing={(id) => {
              setHighlightedListingId(id);
              switchFarmerView("listings");
            }}
          />
        </div>
      ) : (
        /* VIEW 2: MY LISTINGS (Standalone Spaced Cards — Never Cramped or Stuck Together) */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                My Crop Residue Listings &amp; Pickup Status
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Each plot listing is tracked from Listed → Accepted → Scheduled
                → Picked Up → Verified.
              </p>
            </div>
            <StatusBadge
              tone="info"
              label={`${listings.length} Listed Plots`}
            />
          </div>

          {listings.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-foreground">
                You have not listed any crop residue plots yet.
              </p>
              <Button
                type="button"
                variant="default"
                onClick={() => switchFarmerView("create")}
                className="gap-1.5"
              >
                <PlusCircle className="h-4 w-4" />
                <span>List Stubble for Pickup</span>
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {listings.map((listing) => {
                const statusInfo = listingStatusMeta[listing.status];
                const isHighlighted = listing.id === highlightedListingId;

                return (
                  <Card
                    key={listing.id}
                    className={cn(
                      "rounded-2xl border transition-all shadow-panel",
                      isHighlighted
                        ? "border-primary bg-surface-elevated ring-2 ring-primary/40"
                        : "border-border bg-surface hover:border-border-strong"
                    )}
                  >
                    <CardContent className="p-5 sm:p-6 space-y-4">
                      {/* Card Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                            {listing.listingCode}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {listing.location}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {listing.createdAtLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-lg border border-secondary/40 bg-secondary/15 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                            +{listing.expectedArc} ARC
                          </span>
                          <StatusBadge
                            tone={statusInfo.tone}
                            label={statusInfo.label}
                          />
                        </div>
                      </div>

                      {/* Title & Crop Summary */}
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-bold text-foreground">
                          {listing.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          <strong className="text-foreground">
                            {listing.quantityTonnes} tonnes
                          </strong>{" "}
                          · {listing.cropType} · {listing.condition}
                        </p>
                      </div>

                      {/* Persisted Pickup Address & Preferred Pickup Window Grid */}
                      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background/65 p-3.5 text-xs sm:grid-cols-2">
                        <div className="flex items-start gap-2.5">
                          <Navigation className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                              Pickup Address
                            </span>
                            <span className="font-medium text-foreground">
                              {listing.locationDetail}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Calendar className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                              Preferred Pickup Window
                            </span>
                            <span className="font-medium text-foreground">
                              {listing.pickupWindow}
                            </span>
                          </div>
                        </div>
                      </div>

                      {listing.status === "REJECTED" &&
                        listing.rejectionNote && (
                          <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{listing.rejectionNote}</span>
                          </div>
                        )}

                      {/* Step Progress Tracker */}
                      <PickupTracker status={listing.status} compact />

                      {/* Footer Row: Buyer & Credit Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Truck className="h-3.5 w-3.5 text-info" />
                          {listing.buyerName ? (
                            <>
                              Assigned Buyer:{" "}
                              <strong className="text-foreground">
                                {listing.buyerName}
                              </strong>
                            </>
                          ) : (
                            "Open for collection by verified Delhi NCR biomass buyers"
                          )}
                        </span>

                        {listing.status === "VERIFIED" ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-success">
                            <CheckCircle2 className="h-4 w-4" />
                            +{listing.expectedArc} ARC Credited
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            Current Stage: {statusInfo.label}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
