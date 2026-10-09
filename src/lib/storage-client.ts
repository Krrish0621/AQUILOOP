"use client";

import { uploadData, getUrl, remove } from "aws-amplify/storage";
import { configureAmplifyClient } from "@/lib/amplify-config";

/**
 * AQUILOOP — Real Amazon S3 Evidence Storage Client (Milestone #13)
 *
 * Wraps AWS Amplify Gen 2 Storage (`aws-amplify/storage`) for:
 * - File validation (JPEG, PNG, WebP only; max 10 MB)
 * - Structured S3 path generation with safe UUID filenames:
 *   - bounties/{bountyId}/before/before-{uuid}.{ext}
 *   - bounties/{bountyId}/after/after-{uuid}.{ext}
 *   - stubble/{listingId}/proof/proof-{uuid}.{ext}
 *   - tasks/{taskId}/before/before-{uuid}.{ext}
 *   - tasks/{taskId}/after/after-{uuid}.{ext}
 * - Real S3 upload with byte-transfer progress callbacks
 * - On-demand presigned URL generation via `getUrl({ path })`
 */

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedEvidenceMimeType =
  (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number];

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const MIME_TO_EXTENSION: Record<AllowedEvidenceMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface EvidenceValidationResult {
  valid: boolean;
  error?: string;
  extension?: string;
  mimeType?: AllowedEvidenceMimeType;
}

/**
 * Validates an image file before uploading to Amazon S3.
 * Enforces:
 * - Non-empty file
 * - Allowed MIME types: image/jpeg, image/png, image/webp
 * - Maximum size: 10 MB
 */
export function validateEvidenceFile(file: {
  name?: string;
  type?: string;
  size?: number;
}): EvidenceValidationResult {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return {
      valid: false,
      error: "Selected file is empty. Please choose a valid image.",
    };
  }

  const normalizedType = (file.type || "").toLowerCase().trim();
  if (
    !ALLOWED_EVIDENCE_MIME_TYPES.includes(
      normalizedType as AllowedEvidenceMimeType
    )
  ) {
    return {
      valid: false,
      error: "Unsupported image type. Please upload JPEG, PNG, or WebP.",
    };
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Image is too large. Maximum file size is 10 MB.",
    };
  }

  const mimeType = normalizedType as AllowedEvidenceMimeType;
  return {
    valid: true,
    extension: MIME_TO_EXTENSION[mimeType],
    mimeType,
  };
}

/**
 * Generates a collision-safe UUID token without trusting raw user filenames.
 */
function generateSafeUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sanitizeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Builds structured S3 object keys following AQUILOOP storage architecture:
 * - bounties/{bountyId}/before/before-{uuid}.{ext}
 * - bounties/{bountyId}/after/after-{uuid}.{ext}
 * - stubble/{listingId}/proof/proof-{uuid}.{ext}
 * - tasks/{taskId}/before/before-{uuid}.{ext}
 * - tasks/{taskId}/after/after-{uuid}.{ext}
 */
export function buildBountyEvidenceKey(
  bountyId: string,
  slot: "before" | "after",
  extension: string
): string {
  const safeId = sanitizeSegment(bountyId);
  const cleanExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const uuid = generateSafeUuid();
  return `bounties/${safeId}/${slot}/${slot}-${uuid}.${cleanExt}`;
}

export function buildStubbleProofKey(
  listingId: string,
  extension: string
): string {
  const safeId = sanitizeSegment(listingId);
  const cleanExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const uuid = generateSafeUuid();
  return `stubble/${safeId}/proof/proof-${uuid}.${cleanExt}`;
}

export function buildTaskEvidenceKey(
  taskId: string,
  slot: "before" | "after",
  extension: string
): string {
  const safeId = sanitizeSegment(taskId);
  const cleanExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const uuid = generateSafeUuid();
  return `tasks/${safeId}/${slot}/${slot}-${uuid}.${cleanExt}`;
}

/**
 * Returns true if the given string is a structured S3 object key in AQUILOOP's bucket.
 */
export function isRealS3EvidenceKey(key?: string | null): key is string {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  return (
    trimmed.startsWith("bounties/") ||
    trimmed.startsWith("stubble/") ||
    trimmed.startsWith("tasks/")
  );
}

/**
 * Converts AWS S3 / Amplify Storage errors into clean, human-readable messages.
 */
export function formatStorageError(
  error: unknown,
  fallbackMessage = "Upload failed. Please try again."
): string {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("unsupported image type") ||
    lower.includes("maximum file size is 10 mb") ||
    lower.includes("selected file is empty")
  ) {
    return error instanceof Error ? error.message : raw;
  }

  if (
    lower.includes("accessdenied") ||
    lower.includes("access denied") ||
    lower.includes("not authorized") ||
    lower.includes("unauthorized") ||
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("permission")
  ) {
    return "You do not have permission to access this evidence.";
  }

  if (
    lower.includes("nosuchkey") ||
    lower.includes("notfound") ||
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("does not exist")
  ) {
    return "Evidence image could not be loaded.";
  }

  return fallbackMessage;
}

export interface UploadEvidenceOptions {
  path: string;
  file: File | Blob;
  contentType?: string;
  onProgress?: (percent: number) => void;
}

export interface UploadEvidenceResult {
  key: string;
  size: number;
  contentType: string;
}

/**
 * Uploads an evidence image directly to the private Amazon S3 bucket via Amplify Storage.
 */
export async function uploadEvidenceToS3({
  path,
  file,
  contentType,
  onProgress,
}: UploadEvidenceOptions): Promise<UploadEvidenceResult> {
  configureAmplifyClient();

  const resolvedType = contentType || file.type;
  const validation = validateEvidenceFile({
    type: resolvedType,
    size: file.size,
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const task = uploadData({
      path,
      data: file,
      options: {
        contentType: validation.mimeType,
        onProgress: ({ transferredBytes, totalBytes }) => {
          if (onProgress && totalBytes && totalBytes > 0) {
            const pct = Math.min(
              100,
              Math.max(1, Math.round((transferredBytes / totalBytes) * 100))
            );
            onProgress(pct);
          }
        },
      },
    });

    const result = await task.result;
    onProgress?.(100);
    // Invalidate any cached URL for this path
    signedUrlCache.delete(result.path);

    return {
      key: result.path,
      size: file.size,
      contentType: validation.mimeType!,
    };
  } catch (err) {
    throw new Error(
      formatStorageError(err, "Upload failed. Please try again.")
    );
  }
}

interface CachedSignedUrl {
  url: string;
  expiresAtMs: number;
}

const signedUrlCache = new Map<string, CachedSignedUrl>();
const inFlightSignedUrlRequests = new Map<string, Promise<string>>();
const SIGNED_URL_EXPIRES_IN_SECONDS = 900; // 15 minutes
const SIGNED_URL_CACHE_TTL_MS = 10 * 60 * 1000; // Refresh after 10 minutes
const SESSION_CACHE_PREFIX = "aquiloop.s3url.";

/**
 * Synchronously returns a cached presigned URL if available and not expired.
 */
export function getCachedEvidenceSignedUrl(
  path?: string | null
): string | null {
  if (!path || !isRealS3EvidenceKey(path)) return null;
  const now = Date.now();
  const mem = signedUrlCache.get(path);
  if (mem && mem.expiresAtMs > now) {
    return mem.url;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${path}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedSignedUrl;
        if (parsed?.url && parsed.expiresAtMs > now) {
          signedUrlCache.set(path, parsed);
          return parsed.url;
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }
  return null;
}

function saveCachedSignedUrl(path: string, url: string) {
  const entry: CachedSignedUrl = {
    url,
    expiresAtMs: Date.now() + SIGNED_URL_CACHE_TTL_MS,
  };
  signedUrlCache.set(path, entry);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        `${SESSION_CACHE_PREFIX}${path}`,
        JSON.stringify(entry)
      );
    } catch {
      // Ignore sessionStorage quota errors
    }
  }
}

/**
 * Generates a short-lived presigned S3 URL for an evidence object key.
 * Uses local SigV4 signing (without an extra S3 HeadObject round-trip) plus
 * in-memory, sessionStorage, and in-flight request deduplication for fast loading.
 */
export async function getEvidenceSignedUrl(
  path: string,
  options?: { forceRefresh?: boolean }
): Promise<string> {
  configureAmplifyClient();

  if (!isRealS3EvidenceKey(path)) {
    throw new Error("Evidence image could not be loaded.");
  }

  if (!options?.forceRefresh) {
    const cached = getCachedEvidenceSignedUrl(path);
    if (cached) {
      return cached;
    }
    const existingPromise = inFlightSignedUrlRequests.get(path);
    if (existingPromise) {
      return existingPromise;
    }
  }

  const requestPromise = (async () => {
    try {
      const res = await getUrl({
        path,
        options: {
          expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
          validateObjectExistence: false,
        },
      });
      const signedUrl = res.url.toString();
      saveCachedSignedUrl(path, signedUrl);
      return signedUrl;
    } catch (err) {
      signedUrlCache.delete(path);
      throw new Error(
        formatStorageError(err, "Evidence image could not be loaded.")
      );
    } finally {
      inFlightSignedUrlRequests.delete(path);
    }
  })();

  inFlightSignedUrlRequests.set(path, requestPromise);
  return requestPromise;
}

/**
 * Pre-warms presigned URLs for a list of S3 keys in the background.
 */
export function prefetchEvidenceSignedUrls(
  paths: Array<string | null | undefined>
): void {
  for (const path of paths) {
    if (path && isRealS3EvidenceKey(path) && !getCachedEvidenceSignedUrl(path)) {
      void getEvidenceSignedUrl(path).catch(() => {
        // Ignore background prefetch errors
      });
    }
  }
}

/**
 * Deletes an evidence object from S3 (permitted only for OPERATOR role).
 */
export async function deleteEvidenceFromS3(path: string): Promise<void> {
  configureAmplifyClient();
  try {
    await remove({ path });
    signedUrlCache.delete(path);
  } catch (err) {
    throw new Error(
      formatStorageError(
        err,
        "You do not have permission to delete this evidence."
      )
    );
  }
}
