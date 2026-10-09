"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CloudUpload,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatStorageError,
  getCachedEvidenceSignedUrl,
  getEvidenceSignedUrl,
  isRealS3EvidenceKey,
  uploadEvidenceToS3,
  validateEvidenceFile,
} from "@/lib/storage-client";
import { cn } from "@/lib/utils";

export type UploadLifecycleState =
  | "IDLE"
  | "READY"
  | "UPLOADING"
  | "UPLOADED"
  | "FAILED"
  | "DB_RETRY_NEEDED";

interface S3EvidenceUploaderProps {
  label: string;
  description?: string;
  existingS3Key?: string | null;
  buildTargetKey: (extension: string) => string;
  onPersistKey: (s3Key: string) => Promise<void>;
  allowReplace?: boolean;
  disabled?: boolean;
  accentTone?: "primary" | "warning" | "success";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Reusable Amazon S3 Evidence Uploader component.
 *
 * Clearly distinguishes:
 * - Ready to upload (local preview after file selection, not yet in S3)
 * - Uploading (real byte transfer to S3 + DynamoDB key persistence)
 * - Uploaded (verified in both S3 and DynamoDB, rendered via S3 signed URL)
 * - Failed (validation error, S3 upload error, or recoverable DB save failure)
 */
export function S3EvidenceUploader({
  label,
  description,
  existingS3Key,
  buildTargetKey,
  onPersistKey,
  allowReplace = true,
  disabled = false,
  accentTone = "primary",
}: S3EvidenceUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);

  const hasValidExistingKey = isRealS3EvidenceKey(existingS3Key);

  const [lifecycle, setLifecycle] = React.useState<UploadLifecycleState>(
    hasValidExistingKey ? "UPLOADED" : "IDLE"
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [uploadedS3Key, setUploadedS3Key] = React.useState<string | null>(
    hasValidExistingKey ? existingS3Key! : null
  );
  const [pendingDbKey, setPendingDbKey] = React.useState<string | null>(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = React.useState<string | null>(
    null
  );
  const [isLoadingSignedUrl, setIsLoadingSignedUrl] =
    React.useState<boolean>(false);

  // Sync when existingS3Key prop changes externally
  React.useEffect(() => {
    if (isRealS3EvidenceKey(existingS3Key)) {
      setUploadedS3Key(existingS3Key);
      setLifecycle("UPLOADED");
    } else {
      setUploadedS3Key(null);
      setSignedPreviewUrl(null);
      setSelectedFile(null);
      setErrorMessage(null);
      setLifecycle("IDLE");
    }
  }, [existingS3Key]);

  // Clean up object URL on unmount or change
  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  // Load real S3 signed URL whenever state is UPLOADED and uploadedS3Key is set
  const loadSignedUrl = React.useCallback(
    async (key: string, forceRefresh = false) => {
      if (!isRealS3EvidenceKey(key)) return;
      setIsLoadingSignedUrl(true);
      try {
        const url = await getEvidenceSignedUrl(key, { forceRefresh });
        setSignedPreviewUrl(url);
      } catch {
        // Keep fallback if signed URL fetch fails temporarily
      } finally {
        setIsLoadingSignedUrl(false);
      }
    },
    []
  );

  React.useEffect(() => {
    if (lifecycle === "UPLOADED" && uploadedS3Key) {
      void loadSignedUrl(uploadedS3Key);
    }
  }, [lifecycle, uploadedS3Key, loadSignedUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setErrorMessage(null);
    setPendingDbKey(null);

    const validation = validateEvidenceFile(file);
    if (!validation.valid) {
      setSelectedFile(null);
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setLifecycle("FAILED");
      setErrorMessage(
        validation.error ??
          "Unsupported image type. Please upload JPEG, PNG, or WebP."
      );
      return;
    }

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    const nextObjectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setLocalPreviewUrl(nextObjectUrl);
    setUploadProgress(0);
    setLifecycle("READY");
  };

  const handleExecuteUpload = async () => {
    if (!selectedFile) return;

    const validation = validateEvidenceFile(selectedFile);
    if (!validation.valid || !validation.extension) {
      setLifecycle("FAILED");
      setErrorMessage(
        validation.error ??
          "Unsupported image type. Please upload JPEG, PNG, or WebP."
      );
      return;
    }

    setLifecycle("UPLOADING");
    setErrorMessage(null);
    setUploadProgress(5);

    const targetPath = buildTargetKey(validation.extension);

    let confirmedS3Key: string;
    try {
      const uploadRes = await uploadEvidenceToS3({
        path: targetPath,
        file: selectedFile,
        contentType: validation.mimeType,
        onProgress: (pct) => setUploadProgress(pct),
      });
      confirmedS3Key = uploadRes.key;
    } catch (uploadErr) {
      setLifecycle("FAILED");
      setErrorMessage(
        formatStorageError(uploadErr, "Upload failed. Please try again.")
      );
      return;
    }

    // Step 2 of atomic workflow: Persist S3 key to DynamoDB
    try {
      await onPersistKey(confirmedS3Key);
      setUploadedS3Key(confirmedS3Key);
      setPendingDbKey(null);
      setLifecycle("UPLOADED");
    } catch (dbErr) {
      setPendingDbKey(confirmedS3Key);
      setLifecycle("DB_RETRY_NEEDED");
      setErrorMessage(
        dbErr instanceof Error
          ? dbErr.message
          : "Photo uploaded, but saving the submission failed. Please retry."
      );
    }
  };

  const handleRetryDbSave = async () => {
    if (!pendingDbKey) return;
    setLifecycle("UPLOADING");
    setErrorMessage(null);
    setUploadProgress(100);
    try {
      await onPersistKey(pendingDbKey);
      setUploadedS3Key(pendingDbKey);
      setPendingDbKey(null);
      setLifecycle("UPLOADED");
    } catch (dbErr) {
      setLifecycle("DB_RETRY_NEEDED");
      setErrorMessage(
        dbErr instanceof Error
          ? dbErr.message
          : "Saving the submission failed. Please retry."
      );
    }
  };

  const statusBadge = (() => {
    switch (lifecycle) {
      case "READY":
        return <StatusBadge tone="warning" label="Ready to upload" />;
      case "UPLOADING":
        return (
          <StatusBadge
            tone="primary"
            pulse
            label={`Uploading (${uploadProgress}%)`}
          />
        );
      case "UPLOADED":
        return <StatusBadge tone="success" label="Uploaded" />;
      case "FAILED":
      case "DB_RETRY_NEEDED":
        return <StatusBadge tone="danger" label="Failed" />;
      default:
        return <StatusBadge tone="neutral" label="No photo uploaded" />;
    }
  })();

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-3 transition-colors",
        lifecycle === "UPLOADED"
          ? "border-success/40 bg-success/[0.05]"
          : lifecycle === "FAILED" || lifecycle === "DB_RETRY_NEEDED"
          ? "border-danger/45 bg-danger/[0.06]"
          : accentTone === "warning"
          ? "border-warning/40 bg-surface-elevated/80"
          : accentTone === "success"
          ? "border-emerald-500/40 bg-surface-elevated/80"
          : "border-primary/40 bg-surface-elevated/80"
      )}
    >
      {/* Hidden File Chooser & Mobile Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || lifecycle === "UPLOADING"}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || lifecycle === "UPLOADING"}
      />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs font-bold uppercase text-foreground">
              {label}
            </span>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {statusBadge}
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/45 bg-danger/10 p-2.5 text-xs text-danger"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* STATE: READY (Local preview selected, awaiting upload) */}
      {lifecycle === "READY" && selectedFile && (
        <div className="space-y-3 rounded-lg border border-warning/35 bg-background/80 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {localPreviewUrl && (
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localPreviewUrl}
                  alt="Selected local preview"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-warning">
                  Preview
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <p className="truncate font-mono text-xs font-semibold text-foreground">
                {selectedFile.name}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {formatFileSize(selectedFile.size)} · {selectedFile.type}
              </p>
              <p className="text-[11px] text-warning">
                Ready to upload — click &ldquo;Upload Photo&rdquo; to attach
                this image.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => void handleExecuteUpload()}
                disabled={disabled}
                className="gap-1.5 font-mono font-semibold"
              >
                <CloudUpload className="h-3.5 w-3.5" />
                <span>Upload Photo</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STATE: UPLOADING (Progress bar) */}
      {lifecycle === "UPLOADING" && (
        <div className="space-y-2 rounded-lg border border-primary/35 bg-background/80 p-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {uploadProgress < 100
                ? "Uploading photo..."
                : "Saving photo..."}
            </span>
            <span className="font-bold text-foreground">{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${Math.max(8, uploadProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* STATE: DB_RETRY_NEEDED */}
      {lifecycle === "DB_RETRY_NEEDED" && pendingDbKey && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/40 bg-background/80 p-3">
          <div className="text-xs">
            <p className="font-mono font-semibold text-foreground">
              Photo uploaded
            </p>
            <p className="text-muted-foreground">
              Retry saving this photo to your submission without re-uploading.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleRetryDbSave()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Save</span>
          </Button>
        </div>
      )}

      {/* STATE: UPLOADED */}
      {lifecycle === "UPLOADED" && uploadedS3Key && (
        <div className="space-y-2.5 rounded-lg border border-success/35 bg-background/85 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted flex items-center justify-center">
              {signedPreviewUrl || localPreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={signedPreviewUrl || localPreviewUrl!}
                  alt={label}
                  className="h-full w-full object-cover"
                  onError={() => {
                    if (uploadedS3Key) {
                      void loadSignedUrl(uploadedS3Key, true);
                    }
                  }}
                />
              ) : isLoadingSignedUrl ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="absolute bottom-1 left-1 rounded bg-emerald-950/90 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-300">
                Verified
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Photo uploaded &amp; saved</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ready for verification
              </p>
            </div>

            {allowReplace && !disabled && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Replace Photo</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATE: IDLE or FAILED -> Action Buttons to Choose File or Use Camera */}
      {(lifecycle === "IDLE" || lifecycle === "FAILED") && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <span className="font-mono text-[11px] text-muted-foreground">
            JPEG, PNG, or WebP · Max 10 MB
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 font-mono font-semibold"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Select Photo</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => cameraInputRef.current?.click()}
              className="gap-1.5 font-mono"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Take Photo</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface S3EvidenceImageProps {
  s3Key?: string | null;
  label: string;
  timestamp?: string;
  note?: string;
  tone?: "warning" | "success" | "primary";
  className?: string;
}

/**
 * Renders an evidence image retrieved securely from private Amazon S3
 * via a short-lived presigned URL (`getUrl({ path })`).
 */
export function S3EvidenceImage({
  s3Key,
  label,
  timestamp,
  note,
  tone = "primary",
  className,
}: S3EvidenceImageProps) {
  const [signedUrl, setSignedUrl] = React.useState<string | null>(() =>
    getCachedEvidenceSignedUrl(s3Key)
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retriedAfterError, setRetriedAfterError] =
    React.useState<boolean>(false);
  const [isEnlarged, setIsEnlarged] = React.useState<boolean>(false);

  const isRealKey = isRealS3EvidenceKey(s3Key);

  const fetchUrl = React.useCallback(
    async (forceRefresh = false) => {
      if (!s3Key || !isRealS3EvidenceKey(s3Key)) {
        setSignedUrl(null);
        setIsLoading(false);
        setError(
          s3Key
            ? "Not available — Evidence image could not be loaded."
            : "Not available"
        );
        return;
      }

      if (!forceRefresh) {
        const cached = getCachedEvidenceSignedUrl(s3Key);
        if (cached) {
          setSignedUrl(cached);
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      try {
        const url = await getEvidenceSignedUrl(s3Key, { forceRefresh });
        setSignedUrl(url);
      } catch (err) {
        setSignedUrl(null);
        setError(
          formatStorageError(
            err,
            "Not available — Evidence image could not be loaded."
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [s3Key]
  );

  React.useEffect(() => {
    setRetriedAfterError(false);
    setIsEnlarged(false);
    void fetchUrl(false);
  }, [fetchUrl]);

  React.useEffect(() => {
    if (!isEnlarged) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEnlarged(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnlarged]);

  const toneBorder =
    tone === "warning"
      ? "border-warning/35 bg-warning/[0.05]"
      : tone === "success"
      ? "border-success/35 bg-success/[0.05]"
      : "border-primary/35 bg-primary/[0.05]";

  const toneHeader =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
      ? "text-emerald-400"
      : "text-primary";

  return (
    <>
      <div
        className={cn(
          "rounded-xl border p-3.5 space-y-2.5",
          toneBorder,
          className
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase",
            toneHeader
          )}
        >
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" />
            {label}
          </span>
          {timestamp && (
            <span className="text-muted-foreground font-normal normal-case">
              {timestamp}
            </span>
          )}
        </div>

        {/* Image Display Area — Clean Photograph With Click-to-Enlarge */}
        <div className="relative min-h-[200px] w-full overflow-hidden rounded-lg border border-border bg-background/90 flex items-center justify-center">
          {isLoading && !signedUrl ? (
            <div className="flex h-56 sm:h-64 w-full flex-col items-center justify-center gap-2 bg-surface-muted/40 animate-pulse p-4 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-mono text-[11px]">
                Loading evidence photo...
              </span>
            </div>
          ) : signedUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={label}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onClick={() => setIsEnlarged(true)}
                className="h-56 sm:h-64 w-full cursor-zoom-in object-cover transition-transform duration-150 hover:scale-[1.01]"
                onError={() => {
                  if (!retriedAfterError) {
                    setRetriedAfterError(true);
                    void fetchUrl(true);
                  } else {
                    setSignedUrl(null);
                    setError(
                      "Not available — Evidence image could not be loaded."
                    );
                  }
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEnlarged(true);
                }}
                className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/85 px-2 py-1 font-mono text-[10px] font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-background"
                title="Click to enlarge photo"
                aria-label={`Enlarge ${label}`}
              >
                <Maximize2 className="h-3 w-3 text-primary" />
                <span>Click to enlarge</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void fetchUrl(true);
                }}
                className="absolute right-2 top-2 rounded-md border border-border/60 bg-background/75 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
                title="Refresh evidence image"
                aria-label="Refresh evidence image"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="text-xs font-semibold text-foreground">
                {error ?? "Not available"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                No verified photo available for this slot.
              </p>
              {isRealKey && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchUrl(true)}
                  className="h-7 gap-1 text-[11px]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry Load</span>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          {note ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{note}</p>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {signedUrl ? "Uploaded field evidence" : "Not available"}
            </span>
          )}
          {signedUrl && (
            <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Verified Photo
            </span>
          )}
        </div>
      </div>

      {/* Click-to-Enlarge Lightbox Modal */}
      {isEnlarged && signedUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} enlarged preview`}
          onClick={() => setIsEnlarged(false)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase",
                    toneHeader
                  )}
                >
                  <Camera className="h-4 w-4" />
                  {label}
                </span>
                {timestamp && (
                  <span className="font-mono text-xs text-muted-foreground">
                    · {timestamp}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEnlarged(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-elevated"
                aria-label="Close enlarged preview"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>

            <div className="flex max-h-[78vh] w-full items-center justify-center overflow-auto rounded-xl bg-black/60 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={`${label} full size`}
                className="max-h-[75vh] max-w-full rounded-lg object-contain"
              />
            </div>

            {note && (
              <p className="text-xs text-muted-foreground px-1">{note}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
