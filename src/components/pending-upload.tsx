"use client";

import { Check, ImagePlus, LoaderCircle, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

type UploadStatus = "uploading" | "uploaded" | "error";

export function PendingUpload({
  file,
  onRemove,
  status,
  onRetry,
  uploadedUrl,
}: {
  file: File;
  onRemove: () => void;
  status?: UploadStatus;
  onRetry?: () => void;
  uploadedUrl?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") setPreviewUrl(reader.result);
    });
    reader.readAsDataURL(file);
    return () => {
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);

  const displayUrl = uploadedUrl ?? previewUrl;

  return file.type.startsWith("image/") ? (
    <div className={`pending-image-thumbnail${status ? ` is-${status}` : ""}`} title={file.name}>
      {displayUrl
        ? <Image src={displayUrl} alt={file.name} width={60} height={60} unoptimized />
        : <span className="pending-image-placeholder"><ImagePlus className="size-4" /></span>}
      <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove}><X className="size-3" /></button>
      {status ? (
        <span className="pending-upload-status" aria-label={status === "uploading" ? "Uploading image" : status === "uploaded" ? "Image uploaded" : "Image upload failed"}>
          {status === "uploading" ? <LoaderCircle className="size-3 animate-spin" /> : status === "uploaded" ? <Check className="size-3" /> : <TriangleAlert className="size-3" />}
        </span>
      ) : null}
      {status === "error" && onRetry ? <button type="button" className="pending-upload-retry" onClick={onRetry}>Retry</button> : null}
    </div>
  ) : (
    <span className="attachment-chip">
      <ImagePlus className="size-3" /><span className="max-w-32 truncate">{file.name}</span>
      <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove}><X className="size-3" /></button>
    </span>
  );
}
