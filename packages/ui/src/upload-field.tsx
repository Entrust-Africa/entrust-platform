"use client";

import {
  useState,
  useRef,
  useId,
  useCallback,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Upload, AlertCircle, CheckCircle2, RotateCcw, X, FileText } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";

export interface UploadedFileValue {
  id: string;
  name: string;
  size?: number;
  contentType?: string;
}

export interface UploadFieldProps {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  accept?: string;
  maxSizeBytes?: number;
  value?: UploadedFileValue | null;
  status?: "idle" | "uploading" | "success" | "error";
  progress?: number;
  uploadFn?: (file: File, onProgress: (pct: number) => void) => Promise<UploadedFileValue | void>;
  onFileSelect?: (file: File) => void;
  onUploadSuccess?: (result: UploadedFileValue) => void;
  onUploadError?: (error: Error) => void;
  onClear?: () => void;
  id?: string;
  className?: string;
}

const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const DEFAULT_MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function UploadField({
  label,
  hint,
  error: externalError,
  disabled = false,
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  value,
  status: controlledStatus,
  progress: controlledProgress,
  uploadFn,
  onFileSelect,
  onUploadSuccess,
  onUploadError,
  onClear,
  id,
  className,
}: UploadFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [internalStatus, setInternalStatus] = useState<"idle" | "uploading" | "success" | "error">(
    value ? "success" : "idle",
  );
  const [internalProgress, setInternalProgress] = useState<number>(0);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const status = controlledStatus ?? internalStatus;
  const progress = controlledProgress ?? internalProgress;
  const displayError = externalError || internalError;

  const handleStartUpload = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      onFileSelect?.(file);

      // Validate size
      if (file.size > maxSizeBytes) {
        const errorMsg = `File is too large (${formatBytes(file.size)}). Maximum size is ${formatBytes(maxSizeBytes)}.`;
        setInternalStatus("error");
        setInternalError(errorMsg);
        onUploadError?.(new Error(errorMsg));
        return;
      }

      // Validate MIME type / extension if accept is specified
      if (accept) {
        const acceptedTokens = accept.split(",").map((t) => t.trim().toLowerCase());
        const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
        const fileType = file.type.toLowerCase();

        const matches = acceptedTokens.some(
          (token) => token === fileType || token === fileExt || (token.endsWith("/*") && fileType.startsWith(token.slice(0, -1))),
        );

        if (!matches) {
          const errorMsg = "Invalid file type. Only PDF, JPEG, and PNG files are accepted.";
          setInternalStatus("error");
          setInternalError(errorMsg);
          onUploadError?.(new Error(errorMsg));
          return;
        }
      }

      if (!uploadFn) {
        // If no uploadFn provided, we stay in selected / idle or let parent handle
        setInternalStatus("idle");
        setInternalError(null);
        return;
      }

      setInternalStatus("uploading");
      setInternalProgress(0);
      setInternalError(null);

      try {
        const result = await uploadFn(file, (pct) => {
          setInternalProgress(Math.min(100, Math.max(0, Math.round(pct))));
        });
        setInternalStatus("success");
        setInternalProgress(100);
        if (result) {
          onUploadSuccess?.(result);
        } else {
          onUploadSuccess?.({
            id: "",
            name: file.name,
            size: file.size,
            contentType: file.type,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
        setInternalStatus("error");
        setInternalError(message);
        onUploadError?.(err instanceof Error ? err : new Error(message));
      }
    },
    [accept, maxSizeBytes, onFileSelect, onUploadError, onUploadSuccess, uploadFn],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleStartUpload(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && status !== "uploading") {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || status === "uploading") return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleStartUpload(file);
    }
  };

  const triggerBrowse = () => {
    if (disabled || status === "uploading") return;
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || status === "uploading") return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerBrowse();
    }
  };

  const handleRetry = () => {
    if (selectedFile) {
      void handleStartUpload(selectedFile);
    } else {
      triggerBrowse();
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setInternalStatus("idle");
    setInternalProgress(0);
    setInternalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClear?.();
  };

  const fileName = value?.name ?? selectedFile?.name;
  const fileSize = value?.size ?? selectedFile?.size;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {label}
      </label>

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        id={fieldId}
        type="file"
        accept={accept}
        disabled={disabled || status === "uploading"}
        onChange={handleInputChange}
        className="sr-only"
        aria-invalid={!!displayError}
        aria-describedby={
          displayError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
        }
      />

      {/* Dropzone container */}
      <div
        role="button"
        tabIndex={disabled || status === "uploading" ? -1 : 0}
        onClick={status === "idle" ? triggerBrowse : undefined}
        onKeyDown={status === "idle" ? handleKeyDown : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-150 ease-out",
          disabled && "cursor-not-allowed bg-surface-2 opacity-60",
          !disabled && status === "idle" && "cursor-pointer hover:border-brand-600 hover:bg-brand-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25",
          isDragOver && "border-brand-600 bg-brand-50/40",
          status === "uploading" && "border-line-strong bg-surface",
          status === "success" && "border-ok/40 bg-ok-50/20",
          status === "error" && "border-danger/40 bg-danger-50/20",
          displayError && status !== "error" && "border-danger",
          !isDragOver && status === "idle" && !displayError && "border-line-strong",
        )}
      >
        {status === "idle" && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <Upload className="size-5" />
            </div>
            <div className="text-sm">
              <span className="font-semibold text-brand-600 hover:text-brand-700">
                Click to upload
              </span>{" "}
              <span className="text-ink-2">or drag and drop</span>
            </div>
            <p className="text-xs text-ink-3">PDF, JPEG, or PNG up to 20 MB</p>
          </div>
        )}

        {status === "uploading" && (
          <div className="flex w-full max-w-sm flex-col gap-3">
            <div className="flex items-center gap-3 text-left">
              <div className="flex size-9 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-600">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{fileName ?? "Uploading file..."}</p>
                {fileSize ? (
                  <p className="text-xs text-ink-3">{formatBytes(fileSize)}</p>
                ) : null}
              </div>
              <span className="text-xs font-semibold text-brand-600">{progress}%</span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full bg-brand-600 transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex w-full items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 truncate">
              <div className="flex size-9 shrink-0 items-center justify-center rounded bg-ok-50 text-ok">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1 truncate">
                <p className="truncate text-sm font-medium text-ink">{fileName ?? "Uploaded file"}</p>
                {fileSize ? (
                  <p className="text-xs text-ink-3">{formatBytes(fileSize)}</p>
                ) : null}
              </div>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="shrink-0 text-ink-3 hover:text-danger"
                aria-label="Remove uploaded file"
              >
                <X className="size-4" />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="flex w-full flex-col items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-danger-50 text-danger">
              <AlertCircle className="size-5" />
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-sm font-semibold text-danger">Upload failed</p>
              <p className="text-xs text-ink-2 mt-0.5 max-w-sm">
                {displayError ?? "An error occurred during upload."}
              </p>
            </div>
            {!disabled && (
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                >
                  Choose another file
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper text or error feedback */}
      {displayError && status !== "error" ? (
        <p id={`${fieldId}-error`} className="text-sm text-danger" role="alert">
          {displayError}
        </p>
      ) : hint && status !== "error" ? (
        <p id={`${fieldId}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
