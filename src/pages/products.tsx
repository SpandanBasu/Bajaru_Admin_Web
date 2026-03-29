import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductCard } from "@/features/products/ProductCard";
import { ProductEditDialog } from "@/features/products/ProductEditDialog";
import { useProductEditor } from "@/features/products/useProductEditor";
import { getProducts, createProduct, updateProduct } from "@/lib/api/adminApi";
import type { Product } from "@/lib/types";
import type { AdminProduct } from "@/lib/api/adminApi";

function toProduct(p: AdminProduct): Product {
  return {
    ...p,
    imageUrls: p.imageUrls ?? [],
    imageUrl: p.imageUrl ?? "",
    tags: p.tags ?? [],
    searchTags: p.searchTags ?? [],
    attributes: { origin: "", shelfLife: "", ...(p.attributes ?? {}) },
  };
}

export default function Products() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: paged, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts({ size: 100 }),
  });

  const products: Product[] = (paged?.content ?? []).map(toProduct);
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const editor = useProductEditor(products, () => {});

  const handleSave = async () => {
    const p = editor.editingProduct;
    if (!p) return;

    const payload = {
      name: p.name,
      localName: p.localName,
      description: p.description,
      type: p.type,
      category: p.category,
      isVeg: p.isVeg,
      unitWeight: p.unitWeight,
      basePrice: p.basePrice,
      price: p.price,
      imageUrls: p.imageUrls,
      imageColorValue: p.imageColorValue,
      tags: p.tags,
      searchTags: p.searchTags,
      attributes: p.attributes,
    };

    if (editor.isNewProduct) {
      await createMutation.mutateAsync(payload);
    } else {
      await updateMutation.mutateAsync({ id: p.id, payload });
    }
    editor.setIsDialogOpen(false);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
        <Button className="rounded-xl shadow-lg shadow-primary/20 hover-elevate" onClick={editor.handleNewProduct}>
          <Plus className="w-4 h-4 mr-2" />
          New Product
        </Button>
      </PageHeader>

      {isLoading ? (
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

      {!isLoading && filteredProducts.length === 0 && (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Try adjusting your search criteria."
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
