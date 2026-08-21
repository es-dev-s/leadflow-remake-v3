"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { BACKEND_URL, uploadFirstResponseProof } from "@/lib/api";

type Props = {
  value: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (path: string) => void;
};

function proofSrc(path: string) {
  if (!path) return "";
  if (path.startsWith("blob:") || path.startsWith("data:")) return path;
  return path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
}

export function FirstResponseProofDrop({
  value,
  disabled,
  required,
  onChange,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    if (value.startsWith("blob:") || value.startsWith("data:")) {
      setPreviewUrl(value);
      return;
    }

    let revoked: string | null = null;
    const controller = new AbortController();
    void fetch(proofSrc(value), {
      credentials: "include",
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("preview failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        if (!controller.signal.aborted) setPreviewUrl(url);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreviewUrl(null);
      });

    return () => {
      controller.abort();
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [value]);

  async function acceptFile(file: File | null | undefined) {
    if (!file || disabled || uploading) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Use a JPEG, PNG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Screenshot must be 5 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFirstResponseProof(file);
      onChange(uploaded.path);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void acceptFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
          Screenshot proof
          {required ? <span className="ml-1 text-[#e86812]">*</span> : null}
        </p>
        {required && !value ? (
          <span className="text-[11px] text-[#c92a2a]">Required to create</span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={onInputChange}
      />

      {value && previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="First response proof"
            className="max-h-56 w-full object-contain bg-[rgba(33,37,41,0.02)]"
          />
          <div className="flex items-center justify-between gap-2 border-t border-[rgba(33,37,41,0.06)] px-3 py-2">
            <p className="truncate text-[11px] text-[#868e96]">
              Screenshot proof attached
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => inputRef.current?.click()}
                className="lf-pressable rounded-lg px-2 py-1 text-[11px] font-medium text-[#495057] hover:bg-white disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange("")}
                className="lf-pressable inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#868e96] hover:bg-white hover:text-[#c92a2a] disabled:opacity-50"
                aria-label="Remove screenshot"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!disabled && !uploading) inputRef.current?.click();
            }
          }}
          onClick={() => {
            if (!disabled && !uploading) inputRef.current?.click();
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
          className={[
            "flex min-h-[148px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragging
              ? "border-[rgba(232,104,18,0.55)] bg-[#fff7ef]"
              : "border-[rgba(33,37,41,0.14)] bg-[#fbfbfc] hover:border-[rgba(33,37,41,0.22)] hover:bg-white",
            disabled || uploading ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          {uploading ? (
            <LoaderCircle
              size={22}
              className="animate-spin text-[#e86812]"
              strokeWidth={1.75}
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#9a3f00] shadow-[inset_0_0_0_1px_rgba(33,37,41,0.06)]">
              <ImagePlus size={18} strokeWidth={1.75} />
            </span>
          )}
          <p className="mt-3 text-[13px] font-medium text-[#212529]">
            {uploading ? "Uploading screenshot…" : "Drop screenshot proof"}
          </p>
          <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-[#868e96]">
            {required
              ? "Required · JPEG, PNG, or WebP · up to 5 MB"
              : "JPEG, PNG, or WebP · up to 5 MB · first-message reply evidence"}
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-[11px] text-[#c92a2a]">{error}</p>
      ) : null}
    </div>
  );
}
