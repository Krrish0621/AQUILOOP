"use client";

import * as React from "react";
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  MapPin,
  Navigation,
  PlusCircle,
  Sprout,
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
import {
  STUBBLE_CONDITIONS,
  STUBBLE_CROP_TYPES,
  STUBBLE_NCR_LOCATIONS,
} from "@/features/stubble-exchange/data/mock-stubble-exchange";
import { calculateExpectedStubbleArc } from "@/features/stubble-exchange/lib/credit-calculator";
import type {
  StubbleCondition,
  StubbleCropType,
  StubbleExchangeListing,
  StubbleNcrLocation,
} from "@/types";

interface ListingFormProps {
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
  onViewCreatedListing: (listingId: string) => void;
}

const PICKUP_TIME_SLOTS = [
  "08:00 – 17:00 IST (Full Day)",
  "07:00 – 12:00 IST (Morning Window)",
  "13:00 – 18:00 IST (Afternoon Window)",
];

function getDefaultDateIso(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 86400000);
  return date.toISOString().slice(0, 10);
}

function formatReadableDateRange(
  startIso: string,
  endIso: string,
  timeSlot: string
): string {
  const formatSingle = (iso: string) => {
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const shortTime = timeSlot.replace(/\s*\(.*\)/, "");
  if (!startIso) return `Flexible (${shortTime})`;
  if (!endIso || startIso === endIso) {
    return `${formatSingle(startIso)} (${shortTime})`;
  }
  return `${formatSingle(startIso)} – ${formatSingle(endIso)} (${shortTime})`;
}

export function ListingForm({
  onCreateListing,
  onViewCreatedListing,
}: ListingFormProps) {
  const [title, setTitle] = React.useState(
    "Paddy Stubble — Baled & Ready for Collection"
  );
  const [cropType, setCropType] =
    React.useState<StubbleCropType>("Paddy Stubble");
  const [quantity, setQuantity] = React.useState<number>(2.4);
  const [unit, setUnit] = React.useState<"tonnes" | "kg">("tonnes");
  const [location, setLocation] =
    React.useState<StubbleNcrLocation>("Najafgarh");
  const [pickupAddress, setPickupAddress] = React.useState(
    "Khasra No. 42, Main Mitraon-Najafgarh Link Road, Near Primary School"
  );
  const [pickupStartDate, setPickupStartDate] = React.useState<string>(() =>
    getDefaultDateIso(1)
  );
  const [pickupEndDate, setPickupEndDate] = React.useState<string>(() =>
    getDefaultDateIso(3)
  );
  const [pickupTimeSlot, setPickupTimeSlot] = React.useState<string>(
    PICKUP_TIME_SLOTS[0]
  );
  const [condition, setCondition] =
    React.useState<StubbleCondition>("Dry / Baled");
  const [notes, setNotes] = React.useState(
    "Wide field boundary road accessible for tractor-trailer and baler loader."
  );

  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [confirmedListing, setConfirmedListing] =
    React.useState<StubbleExchangeListing | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const creditEstimate = React.useMemo(
    () =>
      calculateExpectedStubbleArc({
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 2.4,
        unit,
        cropType,
        condition,
      }),
    [quantity, unit, cropType, condition]
  );

  const formattedPickupWindow = React.useMemo(
    () =>
      formatReadableDateRange(pickupStartDate, pickupEndDate, pickupTimeSlot),
    [pickupStartDate, pickupEndDate, pickupTimeSlot]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedAddress = pickupAddress.trim();
    if (trimmedAddress.length < 5) {
      setValidationError(
        "Please enter a valid pickup address or field plot landmark (at least 5 characters)."
      );
      return;
    }

    if (!pickupStartDate) {
      setValidationError(
        "Please select a preferred pickup start date from the calendar."
      );
      return;
    }

    if (pickupEndDate && pickupEndDate < pickupStartDate) {
      setValidationError(
        "Preferred pickup end date cannot be earlier than the start date."
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setValidationError("Please enter a valid crop residue quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onCreateListing({
        title:
          title.trim() ||
          `${cropType} — ${condition} (${location})`,
        cropType,
        quantity,
        unit,
        location,
        pickupAddress: trimmedAddress,
        pickupWindow: formattedPickupWindow,
        condition,
        notes: notes.trim(),
      });
      if (created) {
        setConfirmedListing(created);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-secondary/40 shadow-panel">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-secondary" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Farmer Action · Publish Crop Residue Listing
              </span>
            </div>
            <CardTitle className="text-lg sm:text-xl">
              List Stubble for Pickup
            </CardTitle>
            <CardDescription>
              Schedule your preferred collection dates and specify your farm
              pickup address so verified NCR biomass buyers can collect your
              crop residue.
            </CardDescription>
          </div>
          <StatusBadge
            tone="success"
            label={`Expected Reward: +${creditEstimate.expectedArc} ARC`}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* LISTING LIVE Confirmation Banner when a listing is published */}
        {confirmedListing && (
          <div className="rounded-xl border border-success/45 bg-success/10 p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-success">
                  LISTING PUBLISHED
                </span>
                <StatusBadge
                  tone="warning"
                  label={`Status: ${confirmedListing.status}`}
                />
              </div>
              <span className="font-mono text-xs font-semibold text-foreground">
                ID: {confirmedListing.listingCode}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="rounded-lg border border-border bg-background/80 p-2.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Listing ID
                </span>
                <span className="font-mono font-bold text-primary">
                  {confirmedListing.listingCode}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background/80 p-2.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Pickup Address
                </span>
                <span className="font-semibold text-foreground">
                  {confirmedListing.locationDetail}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background/80 p-2.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Quantity
                </span>
                <span className="font-mono font-bold text-foreground">
                  {confirmedListing.quantityTonnes} tonnes
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background/80 p-2.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Preferred Pickup Window
                </span>
                <span className="font-semibold text-foreground">
                  {confirmedListing.pickupWindow}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-muted-foreground">
                Your listing is live for NCR buyers. Expected credit upon
                verified pickup:{" "}
                <strong className="font-mono text-emerald-400">
                  +{confirmedListing.expectedArc} ARC
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => onViewCreatedListing(confirmedListing.id)}
                >
                  View in My Listings
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmedListing(null)}
                >
                  List Another Plot
                </Button>
              </div>
            </div>
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/45 bg-danger/12 p-3.5 text-xs text-danger"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Crop Residue & Quantity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="stubble-crop"
                className="text-xs font-semibold text-foreground block"
              >
                Crop Type
              </label>
              <select
                id="stubble-crop"
                value={cropType}
                onChange={(e) => {
                  const nextCrop = e.target.value as StubbleCropType;
                  setCropType(nextCrop);
                  setTitle(`${nextCrop} — ${condition} (${location})`);
                }}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {STUBBLE_CROP_TYPES.map((crop) => (
                  <option key={crop} value={crop}>
                    {crop}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stubble-condition"
                className="text-xs font-semibold text-foreground block"
              >
                Residue Condition
              </label>
              <select
                id="stubble-condition"
                value={condition}
                onChange={(e) => {
                  const nextCond = e.target.value as StubbleCondition;
                  setCondition(nextCond);
                  setTitle(`${cropType} — ${nextCond} (${location})`);
                }}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {STUBBLE_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <label
                  htmlFor="stubble-qty"
                  className="text-xs font-semibold text-foreground block"
                >
                  Quantity
                </label>
                <input
                  id="stubble-qty"
                  type="number"
                  step="0.1"
                  min="0.2"
                  max="50000"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="stubble-unit"
                  className="text-xs font-semibold text-foreground block"
                >
                  Unit
                </label>
                <select
                  id="stubble-unit"
                  value={unit}
                  onChange={(e) => {
                    const nextUnit = e.target.value as "tonnes" | "kg";
                    setUnit(nextUnit);
                    setQuantity(nextUnit === "kg" ? 2400 : 2.4);
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-background px-2 font-mono text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="tonnes">tonnes</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Pickup Location & Validated Pickup Address */}
          <div className="rounded-2xl border border-border bg-surface-muted/35 p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Pickup Location &amp; Farm Plot Address</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-4">
                <label
                  htmlFor="stubble-location"
                  className="text-xs font-medium text-foreground block"
                >
                  Delhi NCR Sector / Locality
                </label>
                <select
                  id="stubble-location"
                  value={location}
                  onChange={(e) => {
                    const nextLoc = e.target.value as StubbleNcrLocation;
                    setLocation(nextLoc);
                    setTitle(`${cropType} — ${condition} (${nextLoc})`);
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {STUBBLE_NCR_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-8">
                <label
                  htmlFor="stubble-address"
                  className="text-xs font-medium text-foreground flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-1">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    Pickup Address / Plot Landmark
                  </span>
                  <span className="font-mono text-[10px] text-primary">
                    Required
                  </span>
                </label>
                <input
                  id="stubble-address"
                  type="text"
                  required
                  minLength={5}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="e.g., Khasra No. 42, Main Mitraon Road, Near Village Water Tank"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Preferred Pickup Window (Calendar Date Range Picker + Time Slot) */}
          <div className="rounded-2xl border border-border bg-surface-muted/35 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-warning" />
                <span>Preferred Pickup Window (Calendar Schedule)</span>
              </div>
              <span className="rounded-lg border border-warning/35 bg-warning/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-warning">
                Selected: {formattedPickupWindow}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="stubble-start-date"
                  className="text-xs font-medium text-foreground block"
                >
                  Available From Date
                </label>
                <input
                  id="stubble-start-date"
                  type="date"
                  required
                  value={pickupStartDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setPickupStartDate(nextStart);
                    if (pickupEndDate && pickupEndDate < nextStart) {
                      setPickupEndDate(nextStart);
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="stubble-end-date"
                  className="text-xs font-medium text-foreground block"
                >
                  Available Until Date
                </label>
                <input
                  id="stubble-end-date"
                  type="date"
                  min={pickupStartDate}
                  required
                  value={pickupEndDate}
                  onChange={(e) => setPickupEndDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="stubble-time-slot"
                  className="text-xs font-medium text-foreground block"
                >
                  Preferred Time Window
                </label>
                <select
                  id="stubble-time-slot"
                  value={pickupTimeSlot}
                  onChange={(e) => setPickupTimeSlot(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {PICKUP_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Listing Title & Access Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="stubble-title"
                className="text-xs font-semibold text-foreground block"
              >
                Listing Title
              </label>
              <input
                id="stubble-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stubble-notes"
                className="text-xs font-semibold text-foreground block"
              >
                Tractor / Loader Access Notes
              </label>
              <input
                id="stubble-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate width, road condition, or contact note..."
                className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Expected Credit & Primary CTA */}
          <div className="flex flex-col gap-3 rounded-2xl border border-secondary/40 bg-secondary/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <Award className="h-4 w-4" />
                <span>
                  Expected Credit Reward: +{creditEstimate.expectedArc} ARC
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {creditEstimate.formulaLabel} · Issued upon verified buyer
                pickup
              </p>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="gap-2 font-semibold"
              disabled={isSubmitting}
            >
              <PlusCircle className="h-4 w-4" />
              <span>
                {isSubmitting ? "PUBLISHING LISTING..." : "PUBLISH STUBBLE LISTING"}
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
