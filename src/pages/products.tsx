import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Package, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductCard } from "@/features/products/ProductCard";
import { ProductEditDialog } from "@/features/products/ProductEditDialog";
import { useProductEditor } from "@/features/products/useProductEditor";
import {
  getWarehouses,
  getInventoryByWarehouse,
  createProduct,
  updateProduct,
  upsertInventory,
} from "@/lib/api/adminApi";
import type { Product } from "@/lib/types";
import type { WarehouseInventoryItem } from "@/lib/api/adminApi";

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
    basePrice: item.mrp,
    mrp: item.mrp,
    price: item.sellingPrice,
    stock: item.quantityAvailable,
    imageUrls: item.imageUrls ?? [],
    imageUrl: item.imageUrls?.[0] ?? "",
    imageColorValue: 0,
    tags: [],
    searchTags: [],
    rating: 0,
    ratingCount: 0,
    attributes: { origin: "", shelfLife: "" },
    active: item.active,
    createdAt: "",
    updatedAt: "",
  };
}

export default function Products() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  // Auto-select first warehouse
  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].warehouseId);
    }
  }, [warehouses, selectedWarehouseId]);

  // Fetch inventory (products + real pricing) for selected warehouse
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["inventory", selectedWarehouseId],
    queryFn: () => getInventoryByWarehouse(selectedWarehouseId),
    enabled: !!selectedWarehouseId,
  });

  const products: Product[] = inventoryItems.map(toProduct);
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mutations
  const createMutation = useMutation({ mutationFn: createProduct });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(id, payload),
  });
  const upsertMutation = useMutation({ mutationFn: upsertInventory });

  const editor = useProductEditor(products, () => {});

  const handleSave = async () => {
    const p = editor.editingProduct;
    if (!p || !selectedWarehouseId) return;

    const catalogPayload = {
      name: p.name,
      localName: p.localName,
      description: p.description,
      type: p.type,
      category: p.category,
      isVeg: p.isVeg,
      unitWeight: p.unitWeight,
      basePrice: p.basePrice,
      imageUrls: p.imageUrls,
      imageColorValue: p.imageColorValue,
      tags: p.tags,
      searchTags: p.searchTags,
      attributes: p.attributes,
      rating: p.rating,
      ratingCount: p.ratingCount,
    };

    let productId = p.id;

    if (editor.isNewProduct) {
      const created = await createMutation.mutateAsync(catalogPayload);
      productId = created.id;
    } else {
      await updateMutation.mutateAsync({ id: p.id, payload: catalogPayload });
    }

    // Upsert inventory: stock + pricing for the selected warehouse
    await upsertMutation.mutateAsync({
      productId,
      warehouseId: selectedWarehouseId,
      quantity: p.stock,
      mrp: p.mrp,
      sellingPrice: p.price,
    });

    await queryClient.invalidateQueries({ queryKey: ["inventory", selectedWarehouseId] });
    editor.setIsDialogOpen(false);
  };

  const isSaving =
    createMutation.isPending || updateMutation.isPending || upsertMutation.isPending;

  const selectedWarehouse = warehouses.find((w) => w.warehouseId === selectedWarehouseId);

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
              onEdit={editor.handleEditClick}
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

      <ProductEditDialog
        open={editor.isDialogOpen}
        onOpenChange={editor.setIsDialogOpen}
        editingProduct={editor.editingProduct}
        isNewProduct={editor.isNewProduct}
        onSave={handleSave}
        isSaving={isSaving}
        updateField={editor.updateField}
        updateAttribute={editor.updateAttribute}
        removeAttribute={editor.removeAttribute}
        onImagesUploaded={editor.handleUploadedImages}
        onRemoveImage={editor.removeImage}
      />
    </div>
  );
}
