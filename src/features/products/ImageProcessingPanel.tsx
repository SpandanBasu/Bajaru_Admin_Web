import { useState, useCallback } from "react";
import { Upload, Loader2, CheckCircle2, X, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { processProductImage } from "@/lib/imageProcessing";

// ─── Types ────────────────────────────────────────────────────────────────────

export const IMAGE_CATEGORIES = [
  { value: "exotics", label: "Exotics" },
  { value: "fruits", label: "Fruits" },
  { value: "leafy", label: "Leafy Greens" },
  { value: "root-veggies", label: "Root Veggies" },
  { value: "others", label: "Others" },
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]["value"];

export interface PendingImages {
  thumbnail: Blob;
  detail: Blob;
  thumbnailPreview: string; // object URL for <img>
  detailPreview: string;    // object URL for <img>
  category: ImageCategory;
}

interface ImageProcessingPanelProps {
  current: PendingImages | null;
  onProcessed: (images: PendingImages) => void;
  onClear: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageProcessingPanel({ current, onProcessed, onClear }: ImageProcessingPanelProps) {
  const [processing, setProcessing] = useState(false);
  const [category, setCategory] = useState<ImageCategory>("others");
  const [error, setError] = useState<string | null>(null);

  const handleCategoryChange = (value: ImageCategory) => {
    setCategory(value);
    // If images are already processed, update their category in parent state
    if (current) {
      onProcessed({ ...current, category: value });
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }
      setProcessing(true);
      setError(null);
      try {
        const processed = await processProductImage(file);
        const thumbnailPreview = URL.createObjectURL(processed.thumbnail);
        const detailPreview = URL.createObjectURL(processed.detail);
        onProcessed({ ...processed, thumbnailPreview, detailPreview, category });
      } catch {
        setError("Failed to process image — please try a different file.");
      } finally {
        setProcessing(false);
      }
    },
    [category, onProcessed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so the same file can be re-selected after clearing
      e.target.value = "";
    },
    [processFile],
  );

  return (
    <div className="space-y-3">
      {/* Image folder / category */}
      <FormField label="Image Category">
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

      {/* Drop zone — shown only when no image is ready yet */}
      {!current && (
        <label
          className={`relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
            processing
              ? "border-primary/50 bg-primary/5 cursor-default"
              : "border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-primary/5"
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleInputChange}
            disabled={processing}
          />
          {processing ? (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-primary">Processing image…</p>
              <p className="text-xs text-muted-foreground">
                Creating 200×200 thumbnail and 800×800 detail
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-7 h-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Drop image here or click to upload
              </p>
              <p className="text-xs text-muted-foreground">
                Two WebP variants will be generated automatically
              </p>
            </div>
          )}
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Processed image previews */}
      {current && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Two variants ready — will upload on save
            </div>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
              Change image
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Thumbnail card */}
            <div className="rounded-xl border border-border/50 overflow-hidden bg-secondary/20">
              <div className="aspect-square w-full overflow-hidden">
                <img
                  src={current.thumbnailPreview}
                  alt="Thumbnail variant"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Thumbnail</p>
                <p className="text-[10px] text-muted-foreground">200×200 · WebP · lossless</p>
              </div>
            </div>

            {/* Detail card */}
            <div className="rounded-xl border border-border/50 overflow-hidden bg-secondary/20">
              <div className="aspect-square w-full overflow-hidden">
                <img
                  src={current.detailPreview}
                  alt="Detail variant"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Detail</p>
                <p className="text-[10px] text-muted-foreground">800×800 · WebP · 80% quality</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
