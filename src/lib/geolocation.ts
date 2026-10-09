"use client";

import type { TaskGpsCaptureStatus } from "@/types";

export interface BrowserGpsResult {
  ok: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  status: TaskGpsCaptureStatus;
  message: string;
}

/**
 * Requests the Worker's current GPS coordinates from the browser Geolocation API.
 * Never hardcodes or substitutes fallback coordinates when permission is denied,
 * position is unavailable, or the request times out.
 */
export function captureBrowserGpsLocation(
  options?: PositionOptions
): Promise<BrowserGpsResult> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("geolocation" in navigator) ||
    typeof navigator.geolocation?.getCurrentPosition !== "function"
  ) {
    return Promise.resolve({
      ok: false,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      status: "UNAVAILABLE",
      message:
        "Browser geolocation is not available on this device. Coordinates will be recorded as Not available.",
    });
  }

  return new Promise<BrowserGpsResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLat = position?.coords?.latitude;
        const rawLng = position?.coords?.longitude;
        const rawAcc = position?.coords?.accuracy;

        if (
          typeof rawLat !== "number" ||
          !Number.isFinite(rawLat) ||
          typeof rawLng !== "number" ||
          !Number.isFinite(rawLng)
        ) {
          resolve({
            ok: false,
            latitude: null,
            longitude: null,
            accuracyMeters: null,
            status: "UNAVAILABLE",
            message:
              "Valid GPS coordinates could not be determined. Coordinates will be recorded as Not available.",
          });
          return;
        }

        const latitude = Number(rawLat.toFixed(6));
        const longitude = Number(rawLng.toFixed(6));
        const accuracyMeters =
          typeof rawAcc === "number" && Number.isFinite(rawAcc)
            ? Math.round(rawAcc)
            : null;

        resolve({
          ok: true,
          latitude,
          longitude,
          accuracyMeters,
          status: "CAPTURED",
          message: `GPS coordinates captured: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        });
      },
      (error) => {
        const code = error?.code;
        if (code === 1) {
          resolve({
            ok: false,
            latitude: null,
            longitude: null,
            accuracyMeters: null,
            status: "DENIED",
            message:
              "Location permission was denied. Allow browser location access and retry, or continue with GPS recorded as Not available.",
          });
          return;
        }
        if (code === 3) {
          resolve({
            ok: false,
            latitude: null,
            longitude: null,
            accuracyMeters: null,
            status: "TIMEOUT",
            message:
              "GPS location request timed out. Retry capture in an open area or continue with GPS recorded as Not available.",
          });
          return;
        }
        resolve({
          ok: false,
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          status: "UNAVAILABLE",
          message:
            "GPS position is currently unavailable on this device. Retry capture or continue with GPS recorded as Not available.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options,
      }
    );
  });
}

export function hasValidGpsCoordinates(
  lat?: number | null,
  lng?: number | null
): boolean {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

export function formatGpsCoordinates(
  lat?: number | null,
  lng?: number | null,
  decimals = 6
): string {
  if (!hasValidGpsCoordinates(lat, lng)) {
    return "Not available";
  }
  return `${Number(lat).toFixed(decimals)}, ${Number(lng).toFixed(decimals)}`;
}

export function buildGoogleMapsUrl(
  lat?: number | null,
  lng?: number | null
): string | null {
  if (!hasValidGpsCoordinates(lat, lng)) {
    return null;
  }
  return `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}
