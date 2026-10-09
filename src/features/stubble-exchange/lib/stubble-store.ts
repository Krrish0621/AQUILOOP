"use client";

import * as React from "react";
import type {
  PickupRecord,
  PickupStatus,
  ResilienceCreditTransaction,
  StubbleCondition,
  StubbleCropType,
  StubbleEvidence,
  StubbleExchangeListing,
  StubbleNcrLocation,
  StubbleRejectionReason,
  StubbleTrendPoint,
} from "@/types";
import { INITIAL_STUBBLE_TREND_DATA } from "@/features/stubble-exchange/data/mock-stubble-exchange";
import { calculateExpectedStubbleArc } from "@/features/stubble-exchange/lib/credit-calculator";
import { STUBBLE_REJECTION_REASON_LABELS } from "@/features/stubble-exchange/lib/verification-simulator";
import { useCurrentRole } from "@/lib/auth-context";
import {
  assertNoDataErrors,
  deriveStubbleArcTransactions,
  formatDataError,
  getDataClient,
  mapStubbleRecordToExchangeListing,
  mapStubbleRecordToPickupRecord,
  type StubbleListingRecord,
} from "@/lib/data-client";
import {
  isRealS3EvidenceKey,
  prefetchEvidenceSignedUrls,
} from "@/lib/storage-client";

const NCR_COORDINATES: Record<
  StubbleNcrLocation,
  { lat: number; lng: number }
> = {
  Najafgarh: { lat: 28.609, lng: 76.9855 },
  Narela: { lat: 28.8527, lng: 77.0929 },
  Bawana: { lat: 28.7972, lng: 77.0344 },
  Alipur: { lat: 28.7978, lng: 77.1331 },
  Rohini: { lat: 28.7383, lng: 77.0822 },
  Ghaziabad: { lat: 28.6692, lng: 77.4538 },
  Noida: { lat: 28.5355, lng: 77.391 },
  Sonipat: { lat: 28.9931, lng: 77.0151 },
  Bahadurgarh: { lat: 28.6924, lng: 76.9239 },
};

export function useStubbleExchangeStore() {
  const { role, user } = useCurrentRole();
  const [records, setRecords] = React.useState<StubbleListingRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const applyListingRecords = React.useCallback(
    (incoming: StubbleListingRecord[]) => {
      const uniqueById = new Map<string, StubbleListingRecord>();
      for (const item of incoming) {
        if (item && item.id) {
          uniqueById.set(item.id, item);
        }
      }
      const sorted = Array.from(uniqueById.values()).sort((a, b) => {
        const tA = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tB = b.createdAt ? Date.parse(b.createdAt) : 0;
        if (tB !== tA) return tB - tA;
        return a.id.localeCompare(b.id);
      });
      prefetchEvidenceSignedUrls(sorted.map((r) => r.proofKey));
      setRecords(sorted);
    },
    []
  );

  const loadListings = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (role !== "FARMER" && role !== "BUYER" && role !== "OPERATOR") {
        return;
      }
      const silent = Boolean(options?.silent);
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const client = getDataClient();
        const { data, errors } = await client.models.StubbleListing.list({
          limit: 100,
        });
        assertNoDataErrors(errors, "Unable to load stubble listings");
        applyListingRecords(data ?? []);
      } catch (err) {
        if (!silent) {
          setError(formatDataError(err, "Unable to load stubble listings"));
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [role, applyListingRecords]
  );

  React.useEffect(() => {
    void loadListings();
  }, [loadListings]);

  // Real-time synchronization via AppSync observeQuery + lightweight background sync
  React.useEffect(() => {
    if (role !== "FARMER" && role !== "BUYER" && role !== "OPERATOR") {
      return;
    }

    let isMounted = true;
    const client = getDataClient();

    let sub: { unsubscribe: () => void } | null = null;
    try {
      sub = client.models.StubbleListing.observeQuery().subscribe({
        next: ({ items }) => {
          if (!isMounted) return;
          if (items && items.length > 0) {
            applyListingRecords(items as StubbleListingRecord[]);
          }
          void loadListings({ silent: true });
        },
        error: () => {
          // Field-level auth can restrict certain subscription payloads; fallback poll handles sync
        },
      });
    } catch {
      // Fallback interval handles synchronization
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadListings({ silent: true });
      }
    }, 5000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        void loadListings({ silent: true });
      }
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      isMounted = false;
      sub?.unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [role, applyListingRecords, loadListings]);

  const listings = React.useMemo<StubbleExchangeListing[]>(
    () =>
      records.map((rec, idx) => mapStubbleRecordToExchangeListing(rec, idx)),
    [records]
  );

  const pickups = React.useMemo<PickupRecord[]>(
    () =>
      records
        .map((rec, idx) => mapStubbleRecordToPickupRecord(rec, idx))
        .filter((item): item is PickupRecord => item !== null),
    [records]
  );

  const arcLedger = React.useMemo<ResilienceCreditTransaction[]>(
    () => deriveStubbleArcTransactions(listings),
    [listings]
  );

  const trendData = React.useMemo<StubbleTrendPoint[]>(() => {
    const totalListed = listings.reduce(
      (sum, item) => sum + item.quantityTonnes,
      0
    );
    const totalRecovered = listings
      .filter((item) => item.status === "VERIFIED")
      .reduce((sum, item) => sum + item.quantityTonnes, 0);
    const totalArc = listings
      .filter((item) => item.status === "VERIFIED")
      .reduce((sum, item) => sum + item.expectedArc, 0);

    return INITIAL_STUBBLE_TREND_DATA.map((pt, idx, arr) =>
      idx === arr.length - 1
        ? {
            ...pt,
            listedTonnes: Number(Math.max(pt.listedTonnes, totalListed).toFixed(1)),
            recoveredTonnes: Number(
              Math.max(pt.recoveredTonnes, totalRecovered).toFixed(1)
            ),
            arcIssued: Math.max(pt.arcIssued, totalArc),
          }
        : pt
    );
  }, [listings]);

  // 1. Farmer creates a new stubble listing in AWS AppSync / DynamoDB
  const createListing = React.useCallback(
    async (draft: {
      title: string;
      cropType: StubbleCropType;
      quantity: number;
      unit: "tonnes" | "kg";
      location: StubbleNcrLocation;
      pickupAddress?: string;
      pickupWindow: string;
      condition: StubbleCondition;
      notes?: string;
    }): Promise<StubbleExchangeListing | null> => {
      setError(null);
      const calc = calculateExpectedStubbleArc({
        quantity: draft.quantity,
        unit: draft.unit,
        cropType: draft.cropType,
        condition: draft.condition,
      });

      const nextNumber = 24 + records.length;
      const listingCode = `STB #DL-0${nextNumber}`;
      const cleanTitle =
        draft.title.trim() ||
        `${draft.cropType} — ${draft.condition} (${draft.location})`;
      const cleanWindow = draft.pickupWindow.trim() || "12 Oct – 14 Oct (08:00 – 17:00 IST)";
      const cleanAddress =
        draft.pickupAddress?.trim() ||
        `${draft.location} Agricultural Sector, Main Field Gate`;
      const cleanNotes =
        draft.notes?.trim() || "Field road accessible for buyer pickup.";

      const description = `[${listingCode}] Title:${cleanTitle} | Condition:${draft.condition} | Window:${cleanWindow} | Address:${cleanAddress} | ${cleanNotes}`;
      const coords = NCR_COORDINATES[draft.location] ?? NCR_COORDINATES.Najafgarh;
      const farmerId =
        user?.username ||
        user?.userId ||
        user?.email ||
        "farmer.demo@aquiloop.test";
      const farmerName = `Kisan Plot (${draft.location}) · ${
        user?.email?.split("@")[0] || "farmer.demo"
      }`;

      try {
        const client = getDataClient();
        const { data: created, errors } =
          await client.models.StubbleListing.create({
            farmerId,
            farmerName,
            locationName: `${cleanAddress} (${draft.location}, Delhi NCR)`,
            latitude: coords.lat,
            longitude: coords.lng,
            quantity: calc.quantityTonnes,
            unit: "tonnes",
            cropType: draft.cropType,
            priceOrReward: calc.expectedArc,
            description,
            status: "OPEN",
            pickupDate: cleanWindow,
          });

        assertNoDataErrors(errors, "Unable to create stubble listing");
        if (!created) {
          throw new Error("Unable to create stubble listing");
        }

        setRecords((prev) => [created, ...prev]);
        return mapStubbleRecordToExchangeListing(created, 0);
      } catch (err) {
        setError(formatDataError(err, "Unable to create stubble listing"));
        return null;
      }
    },
    [records.length, user]
  );

  // 2. Buyer accepts an OPEN listing -> updates StubbleListing in DynamoDB to ACCEPTED
  const acceptListingPickup = React.useCallback(
    async (
      listingId: string,
      buyerNameOverride?: string,
      scheduledWindow = "Oct 08 · 10:00 IST"
    ): Promise<PickupRecord | null> => {
      setError(null);
      const target = records.find((r) => r.id === listingId);
      if (!target || target.status !== "OPEN") {
        setError("This item is no longer available or was recently updated");
        return null;
      }

      const buyerIdentity =
        buyerNameOverride ||
        user?.email ||
        user?.username ||
        "buyer.demo@aquiloop.test";

      try {
        const client = getDataClient();
        const { data: updated, errors } =
          await client.models.StubbleListing.update({
            id: listingId,
            status: "ACCEPTED",
            acceptedBy: buyerIdentity,
            pickupDate: scheduledWindow,
          });

        assertNoDataErrors(errors, "Unable to accept stubble listing");
        if (!updated) {
          throw new Error("Unable to accept stubble listing");
        }

        setRecords((prev) =>
          prev.map((r) => (r.id === listingId ? updated : r))
        );
        return mapStubbleRecordToPickupRecord(updated, 0);
      } catch (err) {
        setError(formatDataError(err, "Unable to accept stubble listing"));
        return null;
      }
    },
    [records, user]
  );

  // 3. Buyer schedules or advances pickup status (ACCEPTED -> SCHEDULED -> IN_TRANSIT -> PICKED_UP)
  const updatePickupStage = React.useCallback(
    async (
      pickupId: string,
      nextStatus: PickupStatus,
      scheduledWindowOverride?: string
    ) => {
      setError(null);
      try {
        const client = getDataClient();
        const { data: updated, errors } =
          await client.models.StubbleListing.update({
            id: pickupId,
            status: nextStatus,
            ...(scheduledWindowOverride
              ? { pickupDate: scheduledWindowOverride }
              : {}),
            ...(nextStatus === "PICKED_UP"
              ? { pickedUpAt: new Date().toISOString() }
              : {}),
          });

        assertNoDataErrors(errors, "Unable to update pickup status");
        if (updated) {
          setRecords((prev) =>
            prev.map((r) => (r.id === pickupId ? updated : r))
          );
        }
      } catch (err) {
        setError(formatDataError(err, "Unable to update pickup status"));
      }
    },
    []
  );

  // 4. Buyer submits pickup evidence -> status moves to PENDING_VERIFICATION
  const submitPickupEvidence = React.useCallback(
    async (pickupId: string, evidence: StubbleEvidence) => {
      setError(null);
      if (!isRealS3EvidenceKey(evidence.photoLabel)) {
        setError(
          "Please upload a pickup proof photo before submitting."
        );
        return;
      }
      try {
        const client = getDataClient();
        const { data: updated, errors } =
          await client.models.StubbleListing.update({
            id: pickupId,
            status: "PENDING_VERIFICATION",
            submittedAt: new Date().toISOString(),
            proofKey: evidence.photoLabel,
          });

        assertNoDataErrors(errors, "Unable to submit pickup proof");
        if (updated) {
          setRecords((prev) =>
            prev.map((r) => (r.id === pickupId ? updated : r))
          );
        }
      } catch (err) {
        setError(formatDataError(err, "Unable to submit pickup proof"));
      }
    },
    []
  );

  // 5. Operator approves verification -> VERIFIED, sets verifiedAt
  const approvePickupVerification = React.useCallback(
    async (pickupId: string) => {
      setError(null);
      try {
        const client = getDataClient();
        const { data: updated, errors } =
          await client.models.StubbleListing.update({
            id: pickupId,
            status: "VERIFIED",
            verifiedAt: new Date().toISOString(),
          });

        assertNoDataErrors(errors, "Unable to verify stubble pickup");
        if (updated) {
          setRecords((prev) =>
            prev.map((r) => (r.id === pickupId ? updated : r))
          );
        }
      } catch (err) {
        setError(formatDataError(err, "Unable to verify stubble pickup"));
      }
    },
    []
  );

  // 6. Operator rejects verification with structured reason
  const rejectPickupVerification = React.useCallback(
    async (
      pickupId: string,
      reason: StubbleRejectionReason,
      customNote?: string
    ) => {
      setError(null);
      const reasonText =
        customNote?.trim() || STUBBLE_REJECTION_REASON_LABELS[reason];
      try {
        const client = getDataClient();
        const { data: updated, errors } =
          await client.models.StubbleListing.update({
            id: pickupId,
            status: "REJECTED",
            rejectionReason: `${reason}: ${reasonText}`,
          });

        assertNoDataErrors(errors, "Unable to reject stubble pickup");
        if (updated) {
          setRecords((prev) =>
            prev.map((r) => (r.id === pickupId ? updated : r))
          );
        }
      } catch (err) {
        setError(formatDataError(err, "Unable to reject stubble pickup"));
      }
    },
    []
  );

  // Computed summary metrics across the exchange
  const summary = React.useMemo(() => {
    const activeListingsCount = listings.filter(
      (l) => l.status !== "VERIFIED"
    ).length;
    const openListingsCount = listings.filter(
      (l) => l.status === "OPEN"
    ).length;
    const totalListedTonnes = Number(
      listings.reduce((acc, l) => acc + l.quantityTonnes, 0).toFixed(1)
    );
    const verifiedPickupsCount = pickups.filter(
      (p) => p.status === "VERIFIED"
    ).length;
    const pendingVerificationCount = pickups.filter(
      (p) => p.status === "PENDING_VERIFICATION"
    ).length;
    const activePickupsCount = pickups.filter(
      (p) => p.status !== "VERIFIED"
    ).length;
    const totalRecoveredTonnes = Number(
      arcLedger
        .filter((tx) => tx.status === "APPROVED")
        .reduce((acc, tx) => acc + tx.quantityTonnes, 0)
        .toFixed(1)
    );
    const totalArcIssued = arcLedger
      .filter((tx) => tx.status === "APPROVED")
      .reduce((acc, tx) => acc + tx.arcAmount, 0);
    const pendingArcTotal = arcLedger
      .filter((tx) => tx.status === "PENDING_VERIFICATION")
      .reduce((acc, tx) => acc + tx.arcAmount, 0);

    return {
      activeListingsCount,
      openListingsCount,
      totalListedTonnes,
      verifiedPickupsCount,
      pendingVerificationCount,
      activePickupsCount,
      totalRecoveredTonnes,
      totalArcIssued,
      pendingArcTotal,
    };
  }, [listings, pickups, arcLedger]);

  return {
    listings,
    pickups,
    arcLedger,
    trendData,
    summary,
    isLoading,
    error,
    reload: loadListings,
    createListing,
    acceptListingPickup,
    updatePickupStage,
    submitPickupEvidence,
    approvePickupVerification,
    rejectPickupVerification,
  };
}
