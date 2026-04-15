import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Package, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductCard } from "@/features/products/ProductCard";
import { ProductEditDialog } from "@/features/products/ProductEditDialog";
import { ChangeSummaryDialog } from "@/features/products/ChangeSummaryDialog";
import { useProductEditor } from "@/features/products/useProductEditor";
import {
  getWarehouses,
  getInventoryByWarehouse,
  getAdminProductById,
  checkProductIdExists,
  createProduct,
  updateProduct,
  upsertInventory,
  toggleInventoryAvailability,
} from "@/lib/api/adminApi";
import { uploadProductImages, thumbnailCount } from "@/lib/supabaseStorage";
import type { Product } from "@/lib/types";
import type {
  WarehouseInventoryItem,
  AdminProduct,
  CreateProductPayload,
  UpsertInventoryPayload,
} from "@/lib/api/adminApi";
import type { FieldChange } from "@/features/products/ChangeSummaryDialog";
import { makeLocalCache, CACHE_TTL_1H } from "@/lib/localQueryCache";
import type { Warehouse } from "@/lib/api/adminApi";

// Per-warehouse inventory cache — 1 hour TTL (products rarely change mid-shift)
// Keyed per warehouse so switching warehouses never shows stale stock from another.
const warehouseListCache = makeLocalCache<Warehouse[]>("warehouses", CACHE_TTL_1H);
import type { PendingImages } from "@/features/products/ImageProcessingPanel";

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Maps a normalized WarehouseInventoryItem to the domain Product type.
 *
 * Boolean/number coercions here are defense-in-depth: the API layer already
 * normalizes these via parseInventoryItem, but we guard again so this function
 * stays correct if ever called with un-normalized data in tests or future refactors.
 */
function toProduct(item: WarehouseInventoryItem): Product {
  return {
    id: item.productId,
    name: item.name,
    localName: item.localName ?? "",
    description: "",
    type: "",
    category: item.category,
    isVeg: false,
    unitWeight: item.unitWeight,
    basePrice: Number(item.mrp) || 0,
    mrp: Number(item.mrp) || 0,
    price: Number(item.sellingPrice) || 0,
    stock: Number(item.quantityAvailable) || 0,
    imageUrls: item.imageUrls ?? [],
    imageUrl: item.imageUrls?.[0] ?? "",
    imageColorValue: 0,
    tags: [],
    searchTags: [],
    rating: 0,
    ratingCount: 0,
    attributes: { origin: "", shelfLife: "" },
    active: Boolean(item.active),
    createdAt: "",
    updatedAt: "",
  };
}

/** Overlay all real catalog fields onto the inventory-sourced product. */
function mergeDetail(base: Product, d: AdminProduct): Product {
  return {
    ...base,
    name: d.name ?? base.name,
    localName: d.localName ?? base.localName,
    description: d.description ?? "",
    type: d.type ?? "",
    category: d.category ?? base.category,
    isVeg: d.isVeg ?? base.isVeg,
    unitWeight: d.unitWeight ?? base.unitWeight,
    basePrice: d.basePrice ?? base.basePrice,
    imageUrls: d.imageUrls?.length ? d.imageUrls : base.imageUrls,
    imageColorValue: d.imageColorValue ?? base.imageColorValue,
    tags: d.tags ?? [],
    searchTags: d.searchTags ?? [],
    rating: d.rating ?? 0,
    ratingCount: d.ratingCount ?? 0,
    attributes:
      d.attributes && Object.keys(d.attributes).length
        ? (d.attributes as Product["attributes"])
        : base.attributes,
  };
}

/**
 * Compare current vs original and return only the fields that changed.
 * Omitted keys → backend leaves those fields untouched (pointer types stay nil).
 */
function buildCatalogDiff(
  current: Product,
  original: Product,
): Partial<CreateProductPayload> {
  const diff: Partial<CreateProductPayload> = {};
  if (current.name !== original.name) diff.name = current.name;
  if (current.localName !== original.localName) diff.localName = current.localName;
  if (current.description !== original.description) diff.description = current.description;
  if (current.type !== original.type) diff.type = current.type;
  if (current.category !== original.category) diff.category = current.category;
  if (current.isVeg !== original.isVeg) diff.isVeg = current.isVeg;
  if (current.unitWeight !== original.unitWeight) diff.unitWeight = current.unitWeight;
  if (current.basePrice !== original.basePrice) diff.basePrice = current.basePrice;
  if (current.imageColorValue !== original.imageColorValue) diff.imageColorValue = current.imageColorValue;
  if (current.rating !== original.rating) diff.rating = current.rating;
  if (current.ratingCount !== original.ratingCount) diff.ratingCount = current.ratingCount;
  if (JSON.stringify(current.imageUrls) !== JSON.stringify(original.imageUrls)) diff.imageUrls = current.imageUrls;
  if (JSON.stringify(current.tags) !== JSON.stringify(original.tags)) diff.tags = current.tags;
  if (JSON.stringify(current.searchTags) !== JSON.stringify(original.searchTags)) diff.searchTags = current.searchTags;
  if (JSON.stringify(current.attributes) !== JSON.stringify(original.attributes)) diff.attributes = current.attributes;
  return diff;
}

// Human-readable label for each diffable key
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  localName: "Local Name",
  description: "Description",
  type: "Type",
  category: "Category",
  isVeg: "Vegetarian",
  unitWeight: "Unit Weight",
  basePrice: "Base Price (₹)",
  imageColorValue: "Image Color",
  rating: "Rating",
  ratingCount: "Rating Count",
  imageUrls: "Images",
  tags: "Tags",
  searchTags: "Search Tags",
  attributes: "Attributes",
};

function fmt(val: unknown): string {
  if (val === null || val === undefined || val === "") return "(empty)";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "(none)";
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => `${k}: ${v}`);
    return entries.length ? entries.join(" · ") : "(empty)";
  }
  return String(val);
}

function toCatalogChanges(
  diff: Partial<CreateProductPayload>,
  original: Product,
): FieldChange[] {
  return Object.entries(diff).map(([key, newVal]) => ({
    label: FIELD_LABELS[key] ?? key,
    oldValue: fmt(original[key as keyof Product]),
    newValue: fmt(newVal),
  }));
}

function toInventoryChanges(current: Product, original: Product): FieldChange[] {
  const changes: FieldChange[] = [];
  if (current.active !== original.active)
    changes.push({ label: "Stock Status", oldValue: original.active ? "In Stock" : "Out of Stock", newValue: current.active ? "In Stock" : "Out of Stock" });
  if (current.mrp !== original.mrp)
    changes.push({ label: "MRP (₹)", oldValue: fmt(original.mrp), newValue: fmt(current.mrp) });
  if (current.price !== original.price)
    changes.push({ label: "Selling Price (₹)", oldValue: fmt(original.price), newValue: fmt(current.price) });
  if (current.stock !== original.stock)
    changes.push({ label: "Stock Qty", oldValue: fmt(original.stock), newValue: fmt(current.stock) });
  return changes;
}

// ─── Pending confirmation shape ───────────────────────────────────────────────

interface PendingConfirm {
  catalogDiff: Partial<CreateProductPayload>;
  inventoryPayload: UpsertInventoryPayload;
  catalogChanges: FieldChange[];
  inventoryChanges: FieldChange[];
  activeChanged: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Products() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  // Tracks which product's Edit button is spinning while we fetch catalog data
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  // The exact product state we fetched from the backend (baseline for diffing)
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);

  // When non-null, the confirmation dialog is visible
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // Processed image blobs for new product creation (held until confirmed save)
  const [pendingImages, setPendingImages] = useState<PendingImages | null>(null);

  // ── Warehouses (cached 1 h — the list almost never changes) ──
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const data = await getWarehouses();
      warehouseListCache.write(data);
      return data;
    },
    initialData: warehouseListCache.read() ?? undefined,
    initialDataUpdatedAt: warehouseListCache.savedAt() ?? undefined,
    staleTime: CACHE_TTL_1H,
  });

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].warehouseId);
    }
  }, [warehouses, selectedWarehouseId]);

  const selectedWarehouse = warehouses.find((w) => w.warehouseId === selectedWarehouseId);

  // Per-warehouse inventory cache — built lazily so the key is stable
  const inventoryCache = useMemo(
    () => makeLocalCache<WarehouseInventoryItem[]>(`inventory_${selectedWarehouseId}`, CACHE_TTL_1H),
    [selectedWarehouseId],
  );

  // ── Inventory list (cached 1 h — price/stock refreshes after save anyway) ──
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["inventory", selectedWarehouseId],
    queryFn: async () => {
      const data = await getInventoryByWarehouse(selectedWarehouseId);
      inventoryCache.write(data);
      return data;
    },
    enabled: !!selectedWarehouseId,
    initialData: selectedWarehouseId ? (inventoryCache.read() ?? undefined) : undefined,
    initialDataUpdatedAt: selectedWarehouseId ? (inventoryCache.savedAt() ?? undefined) : undefined,
    staleTime: CACHE_TTL_1H,
  });

  const products: Product[] = inventoryItems.map(toProduct);
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ── Mutations ──
  const createMutation = useMutation({ mutationFn: createProduct });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateProductPayload> }) =>
      updateProduct(id, payload),
  });
  const upsertMutation = useMutation({ mutationFn: upsertInventory });

  const editor = useProductEditor(products, () => {});

  // ── Edit click: fetch full catalog data FIRST, then open the dialog ──

  const handleEditClick = async (product: Product) => {
    setLoadingProductId(product.id);
    setOriginalProduct(null);

    let fullProduct = product; // fallback if fetch fails

    try {
      const detail = await getAdminProductById(product.id);
      fullProduct = mergeDetail(product, detail);
    } catch {
      // Catalog fetch failed — open the dialog with the inventory data we have.
      fullProduct = product;
    }

    setOriginalProduct(fullProduct);
    editor.handleEditClick(fullProduct); // opens dialog with all real fields
    setLoadingProductId(null);
  };

  // ── "Review Changes" clicked inside dialog: compute diff and show confirmation ──

  const handleReviewChanges = () => {
    const p = editor.editingProduct;
    if (!p || !selectedWarehouseId) return;

    const inventoryPayload: UpsertInventoryPayload = {
      productId: p.id,
      warehouseId: selectedWarehouseId,
      quantity: p.stock,
      mrp: p.mrp,
      sellingPrice: p.price,
    };

    if (editor.isNewProduct) {
      // No diff for new products — just confirm creation
      setPendingConfirm({
        catalogDiff: {},
        inventoryPayload,
        catalogChanges: [],
        inventoryChanges: [],
        activeChanged: false,
      });
      return;
    }

    const base = originalProduct ?? p;
    const catalogDiff = buildCatalogDiff(p, base);
    const catalogChanges = toCatalogChanges(catalogDiff, base);
    const inventoryChanges = toInventoryChanges(p, base);
    // Use Boolean() coercion so a stray 0/1/null from any code path never
    // produces a spurious toggle — the toggle endpoint must only fire on a
    // deliberate user action, not a type mismatch.
    const activeChanged = Boolean(p.active) !== Boolean(base.active);

    // Pending images are stored separately from the product editor (they're uploaded
    // on confirmed save, not reflected in p.imageUrls yet). Add them to the review
    // so the user can see that new images will be uploaded.
    if (pendingImages && pendingImages.slots.length > 0) {
      const newCount = pendingImages.slots.length;
      const existingCount = p.imageUrls.length;
      catalogChanges.push({
        label: "Images",
        oldValue: existingCount > 0 ? `${existingCount} image(s)` : "(none)",
        newValue: `${existingCount + newCount} image(s) (+${newCount} new will be uploaded)`,
      });
    }

    setPendingConfirm({ catalogDiff, inventoryPayload, catalogChanges, inventoryChanges, activeChanged });
  };

  // ── Confirmed save: fire the actual API calls ──

  const handleConfirmedSave = async () => {
    const p = editor.editingProduct;
    if (!p || !selectedWarehouseId || !pendingConfirm) return;

    const { catalogDiff, inventoryPayload, activeChanged } = pendingConfirm;

    // Server-confirmed active state after save — used for the cache patch and the
    // post-refetch re-apply.  Starts as the user's intended value; updated to the
    // toggle endpoint's actual response so we never cache a state the server rejected.
    let finalActive = Boolean(p.active);

    if (editor.isNewProduct) {
      // Upload images to Supabase first so we have the public URLs for the catalog
      let imageUrls = p.imageUrls;
      if (pendingImages && pendingImages.slots.length > 0) {
        imageUrls = await uploadProductImages(
          pendingImages.slots,
          p.name,
          pendingImages.category,
        );
      }

      const catalogPayload: CreateProductPayload = {
        ...(p.id ? { id: p.id } : {}),
        name: p.name,
        localName: p.localName,
        description: p.description,
        type: p.type,
        category: p.category,
        isVeg: p.isVeg,
        unitWeight: p.unitWeight,
        basePrice: p.basePrice,
        imageUrls,
        imageColorValue: p.imageColorValue,
        tags: p.tags,
        searchTags: p.searchTags,
        attributes: p.attributes,
        rating: p.rating,
        ratingCount: p.ratingCount,
      };
      const created = await createMutation.mutateAsync(catalogPayload);
      // upsert inventory using the real id the backend assigned
      await upsertMutation.mutateAsync({ ...inventoryPayload, productId: created.id });
    } else {
      // Upload any newly processed images and merge with existing imageUrls.
      // Rule: thumbnail (200 px) always at index 0; details follow.
      // uploadProductImages already returns thumbnails first (sorted internally).
      let finalCatalogDiff = catalogDiff;
      if (pendingImages && pendingImages.slots.length > 0) {
        const uploadedUrls = await uploadProductImages(pendingImages.slots, p.name, pendingImages.category);
        const thumbs = uploadedUrls.slice(0, thumbnailCount(pendingImages.slots));
        const details = uploadedUrls.slice(thumbnailCount(pendingImages.slots));
        // New thumbnails → front · existing URLs → middle · new details → end
        finalCatalogDiff = { ...catalogDiff, imageUrls: [...thumbs, ...p.imageUrls, ...details] };
      }
      if (Object.keys(finalCatalogDiff).length > 0) {
        await updateMutation.mutateAsync({ id: p.id, payload: finalCatalogDiff });
      }
      await upsertMutation.mutateAsync(inventoryPayload);
      if (activeChanged) {
        // Capture the server's confirmed new active state — don't assume the toggle
        // succeeded or that the server's value matches the user's intent.
        finalActive = await toggleInventoryAvailability(p.id, selectedWarehouseId);
      }
    }

    // ── Cache update ──────────────────────────────────────────────────────────
    // Directly patch the in-memory and localStorage caches with the values we
    // just saved. This gives an instant UI update without waiting for a network
    // round-trip and closes the staleness window that was causing edited products
    // to disappear from the list (React Query v5 runs invalidateQueries refetches
    // in the background — the UI re-renders before the fetch completes).
    if (!editor.isNewProduct) {
      const currentItems =
        queryClient.getQueryData<WarehouseInventoryItem[]>(["inventory", selectedWarehouseId]) ?? [];
      const patchedItems = currentItems.map((item) =>
        item.productId !== p.id
          ? item
          : {
              ...item,
              mrp: p.mrp,
              sellingPrice: p.price,
              quantityAvailable: p.stock,
              active: finalActive,
            },
      );
      queryClient.setQueryData(["inventory", selectedWarehouseId], patchedItems);
      inventoryCache.write(patchedItems);
    } else {
      // New product: no existing item to patch — clear and let the refetch rebuild.
      inventoryCache.clear();
    }

    // Background refetch — non-blocking. Syncs any server-side changes (catalog
    // fields, images, etc.) that aren't reflected in the local patch above.
    //
    // When active was toggled, re-apply finalActive after the refetch settles so
    // the server's /by-warehouse computed column (which may derive active from qty)
    // can't silently undo the explicit toggle the user just confirmed.
    const warehouseId = selectedWarehouseId;
    const productId = p.id;
    queryClient.refetchQueries({ queryKey: ["inventory", warehouseId] }).then(() => {
      if (!activeChanged) return;
      const freshItems =
        queryClient.getQueryData<WarehouseInventoryItem[]>(["inventory", warehouseId]) ?? [];
      const reapplied = freshItems.map((item) =>
        item.productId !== productId ? item : { ...item, active: finalActive }
      );
      queryClient.setQueryData(["inventory", warehouseId], reapplied);
      inventoryCache.write(reapplied);
    });

    setPendingConfirm(null);
    clearPendingImages();
    editor.setIsDialogOpen(false);
  };

  const clearPendingImages = () => {
    if (pendingImages) {
      // Release object URLs to free browser memory
      pendingImages.slots.forEach((s) => URL.revokeObjectURL(s.preview));
    }
    setPendingImages(null);
  };

  const isSaving =
    createMutation.isPending || updateMutation.isPending || upsertMutation.isPending;

  // ── Render ──

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader title="Products Inventory" subtitle="Manage pricing and stock levels.">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl border-border/50 bg-card"
          />
        </div>
        <Button
          className="rounded-xl shadow-lg shadow-primary/20 hover-elevate"
          onClick={editor.handleNewProduct}
          disabled={!selectedWarehouseId}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Product
        </Button>
      </PageHeader>

      {/* Warehouse selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <WarehouseIcon className="w-4 h-4" />
          <span>Warehouse</span>
        </div>
        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
          <SelectTrigger className="w-72 rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="Select a warehouse…" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {warehouses.map((w) => (
              <SelectItem key={w.warehouseId} value={w.warehouseId}>
                {w.displayName} — {w.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWarehouse && (
          <span className="text-xs text-muted-foreground">
            {selectedWarehouse.servicePincodes.length} pincode(s) · {filteredProducts.length} product(s)
          </span>
        )}
      </div>

      {!selectedWarehouseId ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouse selected"
          description="Select a warehouse above to view its product inventory."
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={handleEditClick}
              loadingProductId={loadingProductId}
              animationIndex={index}
            />
          ))}
        </div>
      )}

      {!isLoading && selectedWarehouseId && filteredProducts.length === 0 && (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Try adjusting your search criteria or add a new product."
        />
      )}

      {/* Edit / New product dialog */}
      <ProductEditDialog
        open={editor.isDialogOpen}
        onOpenChange={(open) => {
          if (!open) clearPendingImages();
          editor.setIsDialogOpen(open);
        }}
        editingProduct={editor.editingProduct}
        isNewProduct={editor.isNewProduct}
        onSave={handleReviewChanges}
        updateField={editor.updateField}
        updateAttribute={editor.updateAttribute}
        removeAttribute={editor.removeAttribute}
        onRemoveImage={editor.removeImage}
        pendingImages={pendingImages}
        onImagesProcessed={setPendingImages}
        onClearImages={clearPendingImages}
        checkIdExists={async (id) => {
          const pincode = selectedWarehouse?.servicePincodes?.[0] ?? "000000";
          return checkProductIdExists(id, pincode);
        }}
      />

      {/* Confirmation / diff dialog */}
      {pendingConfirm && editor.editingProduct && (
        <ChangeSummaryDialog
          open={!!pendingConfirm}
          onConfirm={handleConfirmedSave}
          onBack={() => setPendingConfirm(null)}
          isSaving={isSaving}
          productName={editor.editingProduct.name}
          isNewProduct={editor.isNewProduct}
          catalogChanges={pendingConfirm.catalogChanges}
          inventoryChanges={pendingConfirm.inventoryChanges}
        />
      )}
    </div>
  );
}
