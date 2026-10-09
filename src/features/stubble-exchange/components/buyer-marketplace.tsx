"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Award,
  Calendar,
  Filter,
  ListFilter,
  MapPin,
  Navigation,
  Sprout,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ListingDetail } from "@/features/stubble-exchange/components/listing-detail";
import { STUBBLE_NCR_LOCATIONS } from "@/features/stubble-exchange/data/mock-stubble-exchange";
import type {
  PickupRecord,
  PickupStatus,
  StubbleEvidence,
  StubbleExchangeListing,
} from "@/types";
import { cn } from "@/lib/utils";

interface BuyerMarketplaceProps {
  listings: StubbleExchangeListing[];
  pickups: PickupRecord[];
  selectedListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onAcceptPickup: (listingId: string) => void;
  onUpdatePickupStage: (
    pickupId: string,
    nextStatus: PickupStatus,
    scheduledWindowOverride?: string
  ) => void;
  onSubmitEvidence: (pickupId: string, evidence: StubbleEvidence) => void;
}

type SortFilterMode = "NEAREST" | "HIGHEST_QTY" | "NEWEST" | "PICKUP_WINDOW";

export function BuyerMarketplace({
  listings,
  pickups,
  selectedListingId,
  onSelectListing,
  onAcceptPickup,
  onUpdatePickupStage,
  onSubmitEvidence,
}: BuyerMarketplaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const isPickupsView = viewParam === "pickups";

  const [sortMode, setSortMode] = React.useState<SortFilterMode>("NEAREST");
  const [locationFilter, setLocationFilter] = React.useState<string>("ALL");

  const switchBuyerView = (nextView: "available" | "pickups") => {
    router.push(`/stubble-exchange?view=${nextView}`, { scroll: false });
  };

  // Strict separation: Available Listings = ONLY status === "OPEN"; My Pickups = status !== "OPEN"
  const filteredListings = React.useMemo(() => {
    const base = listings.filter((item) => {
      if (isPickupsView) {
        if (item.status === "OPEN") return false;
      } else {
        if (item.status !== "OPEN") return false;
      }
      if (locationFilter !== "ALL" && item.location !== locationFilter) {
        return false;
      }
      return true;
    });

    return [...base].sort((a, b) => {
      if (sortMode === "NEAREST") return a.distanceKm - b.distanceKm;
      if (sortMode === "HIGHEST_QTY")
        return b.quantityTonnes - a.quantityTonnes;
      if (sortMode === "PICKUP_WINDOW")
        return a.pickupWindow.localeCompare(b.pickupWindow);
      return 0;
    });
  }, [listings, isPickupsView, locationFilter, sortMode]);

  // Keep selectedListingId aligned with the active view (Available vs My Pickups)
  React.useEffect(() => {
    if (
      filteredListings.length > 0 &&
      (!selectedListingId ||
        !filteredListings.some((l) => l.id === selectedListingId))
    ) {
      onSelectListing(filteredListings[0].id);
    }
  }, [filteredListings, selectedListingId, onSelectListing]);

  const activeListing =
    filteredListings.find((l) => l.id === selectedListingId) ??
    filteredListings[0] ??
    null;

  const linkedPickup = activeListing
    ? pickups.find(
        (p) =>
          p.id === activeListing.pickupRecordId ||
          p.listingId === activeListing.id
      ) ?? null
    : null;

  const openListingsCount = listings.filter((l) => l.status === "OPEN").length;
  const myPickupsCount = listings.filter((l) => l.status !== "OPEN").length;

  return (
    <div className="space-y-6">
      {/* Buyer Navigation Strip: ONLY Available Listings & My Pickups */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => switchBuyerView("available")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all",
              !isPickupsView
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Available Listings ({openListingsCount} Open)</span>
          </button>

          <button
            type="button"
            onClick={() => switchBuyerView("pickups")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all",
              isPickupsView
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>My Pickups ({myPickupsCount})</span>
          </button>
        </div>

        {/* Sort & Location Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" />
            Sort:
          </span>
          {(
            [
              { id: "NEAREST", label: "Nearest" },
              { id: "HIGHEST_QTY", label: "Highest Qty" },
              { id: "PICKUP_WINDOW", label: "Pickup Window" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortMode(opt.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                sortMode === opt.id
                  ? "border-primary/50 bg-primary/15 text-primary font-semibold"
                  : "border-border bg-surface-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}

          <select
            aria-label="Filter by Delhi NCR Location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface-muted px-2.5 text-xs text-foreground"
          >
            <option value="ALL">All NCR Sectors</option>
            {STUBBLE_NCR_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Buyer Workspace: Left Listings List (5 Cols) + Right Selected Listing Only (7 Cols) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left 5 Cols: Listings / Pickups */}
        <Card className="xl:col-span-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {isPickupsView
                    ? "My Active & Completed Pickups"
                    : "Available Crop Residue Listings"}
                </CardTitle>
                <CardDescription>
                  {isPickupsView
                    ? "Select any pickup to manage schedule, transit status, or upload collection proof."
                    : "Select any open listing to inspect farm address and accept pickup."}
                </CardDescription>
              </div>
              <StatusBadge
                tone="primary"
                label={
                  isPickupsView
                    ? `${filteredListings.length} Pickups`
                    : `${filteredListings.length} Open`
                }
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {filteredListings.map((item) => {
              const isSelected = activeListing?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectListing(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectListing(item.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 space-y-2.5 transition-all",
                    isSelected
                      ? "border-primary bg-primary/[0.08] ring-1 ring-primary"
                      : "border-border bg-surface-muted/45 hover:border-border-strong"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {item.listingCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        <MapPin className="h-3 w-3 text-primary" />
                        {item.location}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ({item.distanceKm} km)
                      </span>
                    </div>

                    <StatusBadge
                      tone={
                        item.status === "OPEN"
                          ? "warning"
                          : item.status === "VERIFIED"
                          ? "success"
                          : item.status === "REJECTED"
                          ? "danger"
                          : "info"
                      }
                      label={
                        item.status === "PENDING_VERIFICATION"
                          ? "Pending Review"
                          : item.status.replace("_", " ")
                      }
                    />
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-foreground sm:text-sm">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      <Navigation className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{item.locationDetail}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5 text-xs">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="inline-flex items-center gap-1 font-bold text-foreground">
                        <Sprout className="h-3.5 w-3.5 text-secondary" />
                        {item.quantityTonnes} t
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3 text-warning" />
                        {item.pickupWindow}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded border border-secondary/35 bg-secondary/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                        <Award className="h-3 w-3" />+{item.expectedArc} ARC
                      </span>
                      {item.status === "OPEN" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-7 text-[11px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectListing(item.id);
                            onAcceptPickup(item.id);
                            switchBuyerView("pickups");
                          }}
                        >
                          <Truck className="h-3 w-3" />
                          <span>Accept</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right 7 Cols: Selected Listing Only */}
        <div className="xl:col-span-7">
          {activeListing && (
            <ListingDetail
              listing={activeListing}
              linkedPickup={linkedPickup}
              onAcceptPickup={(id) => {
                onSelectListing(id);
                onAcceptPickup(id);
                switchBuyerView("pickups");
              }}
              onUpdatePickupStage={onUpdatePickupStage}
              onSubmitEvidence={onSubmitEvidence}
            />
          )}
        </div>
      </div>
    </div>
  );
}
