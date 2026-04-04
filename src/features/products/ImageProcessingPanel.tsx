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
  { value: "leafy-greens", label: "Leafy Greens" },
  { value: "root-veggies", label: "Root Veggies" },
  { value: "regulars", label: "Regulars" },
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]["value"];
export type ImageSize = 200 | 800;

interface ImageSlot {
  id: string;
  file: File | null;
  rawPreview: string | null; // object URL of original file — shown blurred before compression
  blob: Blob | null;
  preview: string | null;    // object URL of compressed result — shown crisp when ready
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
  /** Fires true when any slot has a file picked but not yet compressed. */
  onUncompressedChange?: (hasUncompressed: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSlot(size: ImageSize = 800): ImageSlot {
  return { id: Math.random().toString(36).slice(2), file: null, rawPreview: null, blob: null, preview: null, size, status: "empty", error: null };
}
function qualityFor(size: ImageSize) { return size === 200 ? 1.0 : 0.8; }
function whiteBgFor(size: ImageSize) { return size === 800; }

// ─── Slot card ────────────────────────────────────────────────────────────────

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
    if (slot.status === "compressing") return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(slot.id, file);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(slot.id, file);
    e.target.value = "";
  };

  const triggerPick = () => {
    if (slot.status !== "compressing") inputRef.current?.click();
  };

  const sizeLabel = slot.size === 200 ? "200×200 · thumbnail" : "800×800 · detail";

  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden bg-card">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
        <Select value={String(slot.size)} onValueChange={(v) => onSizeChange(slot.id, Number(v) as ImageSize)}>
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

      <div className="p-3 space-y-2">

        {/* ── Image area (layered) ── */}
        <div
          className="relative w-full aspect-square rounded-xl overflow-hidden"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Hidden file input — always present */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleInput}
            disabled={slot.status === "compressing"}
          />

          {/* ── Layer 1: base image ── */}
          {slot.status === "ready" && slot.preview ? (
            // Crisp compressed result
            <img src={slot.preview} alt={sizeLabel} className="w-full h-full object-cover" />
          ) : slot.rawPreview ? (
            // Blurred original — shown while waiting to compress or while compressing
            <>
              <img
                src={slot.rawPreview}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg"
              />
              <div className="absolute inset-0 bg-black/30" />
            </>
          ) : (
            // Empty drop zone — visible dashed border with icon
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl bg-secondary cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
              onClick={triggerPick}
            >
              <Upload className="w-7 h-7 text-muted-foreground" />
              <p className="text-xs text-muted-foreground text-center px-3 leading-relaxed">
                Drop image here<br />or click to pick
              </p>
            </div>
          )}

          {/* ── Layer 2: compressing spinner ── */}
          {slot.status === "compressing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
              <Loader2 className="w-8 h-8 text-white animate-spin drop-shadow" />
              <p className="text-xs text-white font-semibold mt-2 drop-shadow">Compressing…</p>
            </div>
          )}

          {/* ── Layer 3: "file selected" hint (click to change) ── */}
          {slot.file && slot.status === "empty" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
              onClick={triggerPick}
            >
              <div className="bg-black/55 backdrop-blur-sm rounded-xl px-3 py-2 text-center mx-3 max-w-full">
                <p className="text-[11px] text-white font-medium leading-snug truncate">
                  {slot.file.name}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5">tap to change · compress below</p>
              </div>
            </div>
          )}

          {/* ── Layer 4: Ready badge ── */}
          {slot.status === "ready" && (
            <div className="absolute top-2 left-2 bg-green-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Ready
            </div>
          )}

          {/* ── Layer 5: hover-to-change on ready image ── */}
          {slot.status === "ready" && (
            <div
              className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center bg-black/20 cursor-pointer"
              onClick={triggerPick}
            >
              <div className="bg-black/60 rounded-lg px-2.5 py-1.5">
                <p className="text-[11px] text-white font-medium">Click to change</p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {slot.error && (
          <div className="flex items-center gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {slot.error}
          </div>
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
              {slot.status === "compressing"
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Compressing</>
                : "Compress"
              }
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" className="flex-1 h-7 text-xs rounded-lg" onClick={triggerPick}>
                <Upload className="w-3 h-3 mr-1" />Change
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex-1 h-7 text-xs rounded-lg" onClick={() => onCompress(slot.id)}>
                <RefreshCw className="w-3 h-3 mr-1" />Recompress
              </Button>
            </>
          )}
        </div>

        {/* Size/quality label */}
        <p className="text-[10px] text-muted-foreground/70 text-center">
          {sizeLabel} · WebP · {slot.size === 200 ? "lossless" : "80% quality"}
        </p>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ImageProcessingPanel({ current, onProcessed, onClear, onUncompressedChange }: ImageProcessingPanelProps) {
  // Thumbnail (200 px) is always slot 0 — initialise in correct order.
  const [slots, setSlots] = useState<ImageSlot[]>(() => [makeSlot(200), makeSlot(800)]);
  const [category, setCategory] = useState<ImageCategory>("regulars");

  // Always-fresh ref so callbacks never have stale closure over slots
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const syncParent = useCallback(
    (updatedSlots: ImageSlot[], cat: ImageCategory) => {
      const ready = updatedSlots.filter(
        (s): s is ImageSlot & { blob: Blob; preview: string } =>
          s.status === "ready" && s.blob !== null && s.preview !== null,
      );
      if (ready.length === 0) {
        onClear();
      } else {
        onProcessed({ slots: ready.map((s) => ({ blob: s.blob, preview: s.preview, size: s.size })), category: cat });
      }
      // Notify parent if any slot has a file selected but isn't compressed yet
      const hasUncompressed = updatedSlots.some(
        (s) => s.file !== null && s.status !== "ready" && s.status !== "compressing",
      );
      onUncompressedChange?.(hasUncompressed);
    },
    [onProcessed, onClear, onUncompressedChange],
  );

  const handleCategoryChange = (value: ImageCategory) => {
    setCategory(value);
    if (current) onProcessed({ ...current, category: value });
  };

  const handleFile = useCallback((id: string, file: File) => {
    if (!file.type.startsWith("image/")) return;
    // Revoke old rawPreview for this slot
    const old = slotsRef.current.find((s) => s.id === id);
    if (old?.rawPreview) URL.revokeObjectURL(old.rawPreview);

    const rawPreview = URL.createObjectURL(file);
    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, file, rawPreview, status: "empty", blob: null, preview: null, error: null }
          : s,
      ),
    );
  }, []);

  const handleSizeChange = useCallback((id: string, size: ImageSize) => {
    setSlots((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        // Revoke compressed preview (raw stays — same source file)
        if (s.preview) URL.revokeObjectURL(s.preview);
        return { ...s, size, blob: null, preview: null, status: "empty" as const, error: null };
      });
      syncParent(updated, slotsRef.current.find((s) => s.id === id)?.size === size
        ? category
        : category); // category unchanged, just re-sync
      return updated;
    });
  }, [category, syncParent]);

  const handleCompress = useCallback(async (id: string) => {
    const slot = slotsRef.current.find((s) => s.id === id);
    if (!slot?.file) return;

    const { file, size } = slot;

    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, status: "compressing" as const, error: null } : s));

    try {
      const blob = await processProductImageToSize(file, size, whiteBgFor(size), qualityFor(size));
      const preview = URL.createObjectURL(blob);

      setSlots((prev) => {
        const old = prev.find((s) => s.id === id);
        if (old?.preview) URL.revokeObjectURL(old.preview); // revoke old compressed
        const updated = prev.map((s) =>
          s.id === id ? { ...s, blob, preview, status: "ready" as const, error: null } : s,
        );
        syncParent(updated, category);
        return updated;
      });
    } catch {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "error" as const, error: "Compression failed. Try a different file." } : s,
        ),
      );
    }
  }, [category, syncParent]);

  const handleRemove = useCallback((id: string) => {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === id);
      if (slot?.rawPreview) URL.revokeObjectURL(slot.rawPreview);
      if (slot?.preview) URL.revokeObjectURL(slot.preview);
      const updated = prev.filter((s) => s.id !== id);
      syncParent(updated, category);
      return updated;
    });
  }, [category, syncParent]);

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
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Ready count */}
      {readyCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {readyCount} image{readyCount !== 1 ? "s" : ""} ready — will upload on save
        </div>
      )}

      {/* Slot grid — thumbnails (200 px) always rendered first / leftmost */}
      <div className="grid grid-cols-2 gap-3">
        {[...slots].sort((a, b) => a.size - b.size).map((slot, displayIndex) => (
          <div key={slot.id} className="space-y-1">
            {/* Index badge so the user knows which position each image gets in the DB */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                index {displayIndex}
              </span>
              {slot.size === 200 && (
                <span className="text-[10px] text-muted-foreground font-medium">thumbnail</span>
              )}
              {slot.size === 800 && (
                <span className="text-[10px] text-muted-foreground font-medium">detail</span>
              )}
            </div>
            <SlotCard
              slot={slot}
              onFile={handleFile}
              onSizeChange={handleSizeChange}
              onCompress={handleCompress}
              onRemove={handleRemove}
            />
          </div>
        ))}
      </div>

      {/* Add slot */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSlots((prev) => [...prev, makeSlot(800)])}
        className="w-full rounded-xl border-dashed h-9 text-muted-foreground hover:text-foreground"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Image
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        Each slot can use a different source image. Upload and compress independently.
      </p>
    </div>
  );
}
