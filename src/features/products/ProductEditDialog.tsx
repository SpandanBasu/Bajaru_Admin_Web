import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { SectionDivider } from "@/components/shared/SectionDivider";
import { TagInput } from "@/components/shared/TagInput";
import { ImageProcessingPanel } from "./ImageProcessingPanel";
import type { PendingImages } from "./ImageProcessingPanel";
import { FIXED_ATTR_KEYS } from "./useProductEditor";
import type { Product } from "@/lib/types";

// ─── Enums ────────────────────────────────────────────────────────────────────

const PRODUCT_TYPES = ["vegetable", "fish", "meat"] as const;
const PRODUCT_CATEGORIES = ["leafyGreen", "fruit", "root", "exotic"] as const;

// ─── Color helpers ────────────────────────────────────────────────────────────

function colorIntToHex(val: number): string {
  const r = (val >> 16) & 0xff;
  const g = (val >> 8) & 0xff;
  const b = val & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToColorInt(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  isNewProduct: boolean;
  onSave: () => void;
  updateField: <K extends keyof Product>(key: K, value: Product[K]) => void;
  updateAttribute: (key: string, value: string) => void;
  removeAttribute: (key: string) => void;
  // Existing images management (edit mode)
  onRemoveImage: (index: number) => void;
  // Pending processed images (both new and edit modes):
  pendingImages: PendingImages | null;
  onImagesProcessed: (images: PendingImages) => void;
  onClearImages: () => void;
  // New product mode: async check whether a typed ID is already taken
  checkIdExists?: (id: string) => Promise<boolean>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductEditDialog({
  open,
  onOpenChange,
  editingProduct,
  isNewProduct,
  onSave,
  updateField,
  updateAttribute,
  removeAttribute,
  onRemoveImage,
  pendingImages,
  onImagesProcessed,
  onClearImages,
  checkIdExists,
}: ProductEditDialogProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Local state for the "add new attribute" row
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");

  // Product ID validation (new product only)
  type IdStatus = "idle" | "checking" | "available" | "taken" | "invalid";
  const [idStatus, setIdStatus] = useState<IdStatus>("idle");
  const idCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validateIdFormat = (id: string) => /^[a-z0-9_]+$/.test(id);

  const handleIdChange = useCallback(
    (value: string) => {
      updateField("id", value);
      if (idCheckTimer.current) clearTimeout(idCheckTimer.current);

      if (!value) { setIdStatus("idle"); return; }
      if (!validateIdFormat(value)) { setIdStatus("invalid"); return; }
      if (!checkIdExists) { setIdStatus("idle"); return; }

      setIdStatus("checking");
      idCheckTimer.current = setTimeout(async () => {
        try {
          const taken = await checkIdExists(value);
          setIdStatus(taken ? "taken" : "available");
        } catch {
          setIdStatus("idle"); // network error — don't block the user
        }
      }, 600);
    },
    [checkIdExists, updateField],
  );

  // Reset transient form state when dialog opens
  useEffect(() => {
    if (open) {
      setNewAttrKey("");
      setNewAttrVal("");
      setIdStatus("idle");
    }
  }, [open]);

  const commitNewAttribute = () => {
    const key = newAttrKey.trim();
    if (!key) return;
    updateAttribute(key, newAttrVal.trim());
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const customEntries = editingProduct
    ? Object.entries(editingProduct.attributes).filter(
        ([k]) => !FIXED_ATTR_KEYS.includes(k as typeof FIXED_ATTR_KEYS[number])
      )
    : [];

  const coverImage = editingProduct?.imageUrls[0] ?? editingProduct?.imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border-border/50 shadow-2xl">

        {/* ── Header banner ── */}
        <div className="h-28 w-full relative bg-muted flex-shrink-0">
          {coverImage && (
            <img src={coverImage} className="w-full h-full object-cover opacity-40" alt="" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute bottom-3 left-6">
            <DialogTitle className="text-xl font-display">
              {isNewProduct ? "New Product" : `Edit — ${editingProduct?.name}`}
            </DialogTitle>
          </div>
        </div>

        {editingProduct && (
          <ScrollArea className="max-h-[65vh]">
            <div className="px-6 pb-2 space-y-4">

              {/* ── Edit-mode info banner ── */}
              {!isNewProduct && (
                <div className="mt-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-primary/80 leading-relaxed">
                  All fields are pre-filled from the database. Only fields you actually change will be updated — unchanged fields are left exactly as they are.
                </div>
              )}

              {/* ── Basic Info ── */}
              <SectionDivider>Basic Info</SectionDivider>

              {/* Product ID — new products only */}
              {isNewProduct && (
                <FormField label="Product ID">
                  <div className="relative">
                    <Input
                      value={editingProduct.id}
                      onChange={(e) => handleIdChange(e.target.value)}
                      placeholder="e.g. veg_coriander_leaves"
                      className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background pr-8 font-mono text-sm"
                      spellCheck={false}
                    />
                    {/* Status indicator */}
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {idStatus === "checking" && (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      )}
                      {idStatus === "available" && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {(idStatus === "taken" || idStatus === "invalid") && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  {/* Helper / error text */}
                  {idStatus === "invalid" && (
                    <p className="text-xs text-destructive mt-1">
                      Only lowercase letters, numbers and underscores allowed.
                    </p>
                  )}
                  {idStatus === "taken" && (
                    <p className="text-xs text-destructive mt-1">
                      This ID is already in use. Choose a different one.
                    </p>
                  )}
                  {idStatus === "available" && (
                    <p className="text-xs text-green-600 mt-1">ID is available.</p>
                  )}
                  {idStatus === "idle" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank to auto-generate. Use underscores: <span className="font-mono">type_name_variant</span>
                    </p>
                  )}
                </FormField>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Name">
                  <Input
                    value={editingProduct.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background"
                  />
                </FormField>
                <FormField label="Local Name">
                  <Input
                    value={editingProduct.localName}
                    onChange={(e) => updateField("localName", e.target.value)}
                    className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background"
                    placeholder="e.g. हरा सेब"
                  />
                </FormField>
              </div>
              <FormField label="Description">
                <Textarea
                  value={editingProduct.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="rounded-xl bg-secondary/50 focus-visible:bg-background resize-none"
                  rows={2}
                />
              </FormField>
              <div className="flex gap-6">
                <div className="flex items-center gap-3">
                  <Switch id="isVeg" checked={editingProduct.isVeg} onCheckedChange={(v) => updateField("isVeg", v)} />
                  <Label htmlFor="isVeg" className="text-sm font-medium">Is Veg</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="active" checked={editingProduct.active} onCheckedChange={(v) => updateField("active", v)} />
                  <Label htmlFor="active" className={`text-sm font-medium ${editingProduct.active ? "text-green-600" : "text-destructive"}`}>
                    {editingProduct.active ? "In Stock" : "Out of Stock"}
                  </Label>
                </div>
              </div>

              {/* ── Pricing & Stock ── */}
              <SectionDivider>Pricing & Stock</SectionDivider>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="MRP (₹)">
                  <Input
                    type="number"
                    value={editingProduct.mrp}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateField("mrp", val);
                      updateField("basePrice", val);
                    }}
                    className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background"
                  />
                </FormField>
                <FormField label="Selling Price (₹)">
                  <Input type="number" value={editingProduct.price} onChange={(e) => updateField("price", Number(e.target.value))} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" />
                </FormField>
                <FormField label="Stock Qty">
                  <Input type="number" value={editingProduct.stock} onChange={(e) => updateField("stock", Number(e.target.value))} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" />
                </FormField>
              </div>
              <FormField label="Unit Weight">
                <Input value={editingProduct.unitWeight} onChange={(e) => updateField("unitWeight", e.target.value)} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" placeholder="e.g. 500 gm, 1 kg, 1 L" />
              </FormField>

              {/* ── Classification (enum dropdowns) ── */}
              <SectionDivider>Classification</SectionDivider>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Type">
                  <Select value={editingProduct.type} onValueChange={(v) => updateField("type", v)}>
                    <SelectTrigger className="rounded-xl h-9 bg-secondary/50 border-border/50 focus:ring-primary/20">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Category">
                  <Select value={editingProduct.category} onValueChange={(v) => updateField("category", v)}>
                    <SelectTrigger className="rounded-xl h-9 bg-secondary/50 border-border/50 focus:ring-primary/20">
                      <SelectValue placeholder="Select category…" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {PRODUCT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              {/* ── Media ── */}
              <SectionDivider>Media</SectionDivider>

              {/* Existing images (edit mode only) — remove individually */}
              {!isNewProduct && editingProduct.imageUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {editingProduct.imageUrls.map((url, i) => (
                    <div key={i} className="relative group/img">
                      <img
                        src={url}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border border-border"
                      />
                      <button
                        onClick={() => onRemoveImage(i)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Process and add new images (both new and edit modes) */}
              <ImageProcessingPanel
                current={pendingImages}
                onProcessed={onImagesProcessed}
                onClear={onClearImages}
              />

              {/* ── Image Color ── */}
              <FormField label="Image Color">
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer shrink-0">
                    <div
                      className="w-10 h-10 rounded-xl border-2 border-border shadow-sm hover:scale-105 transition-transform"
                      style={{ backgroundColor: colorIntToHex(editingProduct.imageColorValue) }}
                    />
                    <input
                      ref={colorInputRef}
                      type="color"
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      value={colorIntToHex(editingProduct.imageColorValue)}
                      onChange={(e) => updateField("imageColorValue", hexToColorInt(e.target.value))}
                    />
                  </label>
                  <div className="flex-1 rounded-xl bg-secondary/50 border border-border/50 h-10 flex flex-col justify-center px-3">
                    <span className="text-xs font-mono text-foreground">{colorIntToHex(editingProduct.imageColorValue).toUpperCase()}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{editingProduct.imageColorValue}</span>
                  </div>
                </div>
              </FormField>

              {/* ── Tags ── */}
              <SectionDivider>Tags</SectionDivider>
              <FormField label="Tags">
                <TagInput
                  value={editingProduct.tags}
                  onChange={(tags) => updateField("tags", tags)}
                  placeholder="Type a tag and press Enter…"
                  badgeVariant="secondary"
                />
              </FormField>
              <FormField label="Search Tags">
                <TagInput
                  value={editingProduct.searchTags}
                  onChange={(tags) => updateField("searchTags", tags)}
                  placeholder="e.g. green apple, seb…"
                  badgeVariant="outline"
                />
              </FormField>

              {/* ── Ratings ── */}
              <SectionDivider>Ratings</SectionDivider>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Rating (0–5)">
                  <Input type="number" step="0.1" min="0" max="5" value={editingProduct.rating} onChange={(e) => updateField("rating", Number(e.target.value))} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" />
                </FormField>
                <FormField label="Rating Count">
                  <Input type="number" value={editingProduct.ratingCount} onChange={(e) => updateField("ratingCount", Number(e.target.value))} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" />
                </FormField>
              </div>

              {/* ── Attributes ── */}
              <SectionDivider>Attributes</SectionDivider>

              {/* All attribute rows share the same 3-column layout: [key label] [value input] [action] */}
              <div className="space-y-2">
                {/* Fixed: Origin */}
                <div className="grid grid-cols-[1fr_2fr_2.25rem] gap-2 items-center">
                  <div className="rounded-xl h-9 bg-secondary/30 border border-border/50 flex items-center px-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Origin</span>
                  </div>
                  <Input value={editingProduct.attributes.origin} onChange={(e) => updateAttribute("origin", e.target.value)} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" placeholder="e.g. Himachal, Maharashtra" />
                  <div className="w-9 h-9" /> {/* spacer — fixed attrs have no delete */}
                </div>

                {/* Fixed: Shelf Life */}
                <div className="grid grid-cols-[1fr_2fr_2.25rem] gap-2 items-center">
                  <div className="rounded-xl h-9 bg-secondary/30 border border-border/50 flex items-center px-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shelf Life</span>
                  </div>
                  <Input value={editingProduct.attributes.shelfLife} onChange={(e) => updateAttribute("shelfLife", e.target.value)} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" placeholder="e.g. 2 weeks, 3 days" />
                  <div className="w-9 h-9" />
                </div>

                {/* Custom attributes */}
                {customEntries.map(([key, val]) => (
                  <div key={key} className="grid grid-cols-[1fr_2fr_2.25rem] gap-2 items-center">
                    <div className="rounded-xl h-9 bg-secondary/30 border border-border/50 flex items-center px-3 min-w-0">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{key}</span>
                    </div>
                    <Input value={val} onChange={(e) => updateAttribute(key, e.target.value)} className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background" placeholder="Value…" />
                    <button
                      type="button"
                      onClick={() => removeAttribute(key)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add new attribute row */}
                <div className="grid grid-cols-[1fr_2fr_2.25rem] gap-2 items-center">
                  <Input
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewAttribute(); } }}
                    className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background text-xs"
                    placeholder="New attribute…"
                  />
                  <Input
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewAttribute(); } }}
                    className="rounded-xl h-9 bg-secondary/50 focus-visible:bg-background"
                    placeholder="Value…"
                  />
                  <button
                    type="button"
                    onClick={commitNewAttribute}
                    disabled={!newAttrKey.trim()}
                    className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="h-2" />
            </div>
          </ScrollArea>
        )}

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border/50 bg-background">
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={onSave} className="rounded-xl shadow-lg shadow-primary/20">
              {isNewProduct ? "Review & Add" : "Review Changes"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
