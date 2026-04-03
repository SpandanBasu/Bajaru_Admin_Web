import { useState, useCallback, useRef } from "react";
import { Upload, Loader2, X, Plus, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/FormField";
import { processProductImageToSize } from "@/lib/imageProcessing";

// ─── Types ────────────────────────────────────────────────────────────────────

export const IMAGE_CATEGORIES = [
  { value: "exotics", label: "Exotics" },
  { value: "fruits", label: "Fruits" },
  { value: "leafy", label: "Leafy Greens" },
  { value: "root-veggies", label: "Root Veggies" },
  { value: "others", label: "Others" },
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]["value"];

export type ImageSize = 200 | 800;

interface ImageSlot {
  id: string;
  file: File | null;
  blob: Blob | null;
  preview: string | null;
  size: ImageSize;
  status: "empty" | "compressing" | "ready" | "error";
  error: string | null;
}

export interface ProcessedSlot {
  blob: Blob;
  preview: string;
  size: ImageSize;
}

export interface PendingImages {
  slots: ProcessedSlot[];
  category: ImageCategory;
}

interface ImageProcessingPanelProps {
  current: PendingImages | null;
  onProcessed: (images: PendingImages) => void;
  onClear: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSlot(size: ImageSize = 800): ImageSlot {
  return {
    id: Math.random().toString(36).slice(2),
    file: null,
    blob: null,
    preview: null,
    size,
    status: "empty",
    error: null,
  };
}

function qualityFor(size: ImageSize) {
  return size === 200 ? 1.0 : 0.8; // lossless for thumbnail, 80% for detail
}

function whiteBgFor(size: ImageSize) {
  return size === 800; // strip alpha for detail
}

// ─── Single image slot ────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: ImageSlot;
  onFile: (id: string, file: File) => void;
  onSizeChange: (id: string, size: ImageSize) => void;
  onCompress: (id: string) => void;
  onRemove: (id: string) => void;
}

function SlotCard({ slot, onFile, onSizeChange, onCompress, onRemove }: SlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(slot.id, file);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(slot.id, file);
    e.target.value = "";
  };

  const sizeLabel = slot.size === 200 ? "200×200 (thumbnail)" : "800×800 (detail)";

  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden bg-card">
      {/* Top bar: size selector + delete */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-secondary/30">
        <Select
          value={String(slot.size)}
          onValueChange={(v) => onSizeChange(slot.id, Number(v) as ImageSize)}
        >
          <SelectTrigger className="h-7 text-xs rounded-lg border-border/50 bg-background flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="200">200×200 — Thumbnail (lossless)</SelectItem>
            <SelectItem value="800">800×800 — Detail (80% quality)</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => onRemove(slot.id)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Image preview or drop zone */}
      <div className="p-3 space-y-2">
        {slot.status === "ready" && slot.preview ? (
          <div className="relative">
            <img
              src={slot.preview}
              alt={sizeLabel}
              className="w-full aspect-square object-cover rounded-xl border border-border/30"
            />
            <div className="absolute top-2 left-2 bg-green-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Ready
            </div>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              slot.status === "compressing"
                ? "border-primary/40 bg-primary/5 cursor-default"
                : "border-border/40 bg-secondary/20 hover:border-primary/40 hover:bg-primary/5"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleInput}
              disabled={slot.status === "compressing"}
            />
            {slot.status === "compressing" ? (
              <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs text-primary font-medium">Compressing…</p>
              </div>
            ) : slot.file ? (
              <div className="flex flex-col items-center gap-1.5 px-2 text-center">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground leading-tight break-all">
                  {slot.file.name}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  Click "Compress" below
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-5 h-5 text-muted-foreground/60" />
                <p className="text-[11px] text-muted-foreground text-center leading-tight px-2">
                  Drop image<br />or click to pick
                </p>
              </div>
            )}
          </label>
        )}

        {/* Error */}
        {slot.error && (
          <div className="flex items-center gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {slot.error}
          </div>
        )}

        {/* Source file for ready state */}
        {slot.status === "ready" && slot.file && (
          <p className="text-[10px] text-muted-foreground truncate">
            Source: {slot.file.name}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {slot.status !== "ready" ? (
            <Button
              type="button"
              size="sm"
              className="w-full h-7 text-xs rounded-lg"
              disabled={!slot.file || slot.status === "compressing"}
              onClick={() => onCompress(slot.id)}
            >
              {slot.status === "compressing" ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Compressing</>
              ) : (
                "Compress"
              )}
            </Button>
          ) : (
            <>
              {/* Re-pick file */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs rounded-lg"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-3 h-3 mr-1" />
                Change
              </Button>
              {/* Re-compress with current file */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs rounded-lg"
                onClick={() => onCompress(slot.id)}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Recompress
              </Button>
            </>
          )}
        </div>

        {/* Size/quality info */}
        <p className="text-[10px] text-muted-foreground/70 text-center">
          {sizeLabel} · WebP · {slot.size === 200 ? "lossless" : "80% quality"}
        </p>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ImageProcessingPanel({ current, onProcessed, onClear }: ImageProcessingPanelProps) {
  // Default: one 800×800 detail slot + one 200×200 thumbnail slot
  const [slots, setSlots] = useState<ImageSlot[]>(() => [makeSlot(800), makeSlot(200)]);
  const [category, setCategory] = useState<ImageCategory>("others");

  /** Compute and push ready results to parent. */
  const syncParent = useCallback(
    (updatedSlots: ImageSlot[], updatedCategory: ImageCategory) => {
      const ready = updatedSlots.filter(
        (s): s is ImageSlot & { blob: Blob; preview: string } =>
          s.status === "ready" && s.blob !== null && s.preview !== null,
      );
      if (ready.length === 0) {
        onClear();
      } else {
        onProcessed({
          slots: ready.map((s) => ({ blob: s.blob, preview: s.preview, size: s.size })),
          category: updatedCategory,
        });
      }
    },
    [onProcessed, onClear],
  );

  const handleCategoryChange = (value: ImageCategory) => {
    setCategory(value);
    if (current) {
      onProcessed({ ...current, category: value });
    }
  };

  const handleFile = useCallback(
    (id: string, file: File) => {
      if (!file.type.startsWith("image/")) return;
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, file, status: "empty", blob: null, preview: null, error: null }
            : s,
        ),
      );
    },
    [],
  );

  const handleSizeChange = useCallback((id: string, size: ImageSize) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, size, blob: null, preview: null, status: s.file ? "empty" : "empty", error: null }
          : s,
      ),
    );
    // If that slot was ready, update parent
    setSlots((prev) => {
      syncParent(prev, category);
      return prev;
    });
  }, [category, syncParent]);

  const handleCompress = useCallback(
    async (id: string) => {
      setSlots((prev) => {
        const slot = prev.find((s) => s.id === id);
        if (!slot?.file) return prev;
        return prev.map((s) => (s.id === id ? { ...s, status: "compressing", error: null } : s));
      });

      setSlots((prev) => {
        const slot = prev.find((s) => s.id === id);
        if (!slot?.file) return prev;

        // Kick off async compress outside of setState
        (async () => {
          try {
            const blob = await processProductImageToSize(
              slot.file!,
              slot.size,
              whiteBgFor(slot.size),
              qualityFor(slot.size),
            );
            // Revoke old preview
            if (slot.preview) URL.revokeObjectURL(slot.preview);
            const preview = URL.createObjectURL(blob);

            setSlots((current) => {
              const updated = current.map((s) =>
                s.id === id ? { ...s, blob, preview, status: "ready" as const, error: null } : s,
              );
              syncParent(updated, category);
              return updated;
            });
          } catch {
            setSlots((current) =>
              current.map((s) =>
                s.id === id
                  ? { ...s, status: "error" as const, error: "Compression failed. Try a different file." }
                  : s,
              ),
            );
          }
        })();

        return prev; // return unchanged for this setState call
      });
    },
    [category, syncParent],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setSlots((prev) => {
        const slot = prev.find((s) => s.id === id);
        if (slot?.preview) URL.revokeObjectURL(slot.preview);
        const updated = prev.filter((s) => s.id !== id);
        syncParent(updated, category);
        return updated;
      });
    },
    [category, syncParent],
  );

  const addSlot = () => {
    setSlots((prev) => [...prev, makeSlot(800)]);
  };

  const readyCount = slots.filter((s) => s.status === "ready").length;

  return (
    <div className="space-y-3">
      {/* Category */}
      <FormField label="Image Category (upload folder)">
        <Select value={category} onValueChange={(v) => handleCategoryChange(v as ImageCategory)}>
          <SelectTrigger className="rounded-xl h-9 bg-secondary/50 border-border/50 focus:ring-primary/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {IMAGE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Status summary */}
      {readyCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {readyCount} image{readyCount !== 1 ? "s" : ""} ready — will upload on save
        </div>
      )}

      {/* Slot grid */}
      <div className="grid grid-cols-2 gap-3">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            onFile={handleFile}
            onSizeChange={handleSizeChange}
            onCompress={handleCompress}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Add image button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addSlot}
        className="w-full rounded-xl border-dashed h-9 text-muted-foreground hover:text-foreground"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Image
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        Each image can be a different source file. Upload and compress independently.
      </p>
    </div>
  );
}
