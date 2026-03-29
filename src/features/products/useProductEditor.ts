import { useState } from "react";
import type { Product } from "@/lib/types";

export const FIXED_ATTR_KEYS = ["origin", "shelfLife"] as const;

function blankProduct(): Product {
  return {
    id: "",
    name: "",
    description: "",
    type: "",
    category: "",
    isVeg: true,
    unitWeight: "",
    basePrice: 0,
    price: 0,
    stock: 0,
    imageUrls: [],
    imageUrl: "",
    imageColorValue: 0,
    tags: [],
    rating: 0,
    ratingCount: 0,
    attributes: { origin: "", shelfLife: "" },
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localName: "",
    searchTags: [],
  };
}

/**
 * Local form state for the product edit dialog.
 * Save logic is delegated to the parent page (which owns the API mutation).
 */
export function useProductEditor(_products: Product[], _setProducts: unknown) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleEditClick = (product: Product) => {
    setEditingProduct({ ...product });
    setIsNewProduct(false);
    setIsDialogOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(blankProduct());
    setIsNewProduct(true);
    setIsDialogOpen(true);
  };

  const updateField = <K extends keyof Product>(key: K, value: Product[K]) => {
    setEditingProduct((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateAttribute = (key: string, value: string) => {
    setEditingProduct((prev) =>
      prev ? { ...prev, attributes: { ...prev.attributes, [key]: value } } : prev
    );
  };

  const removeAttribute = (key: string) => {
    if (FIXED_ATTR_KEYS.includes(key as (typeof FIXED_ATTR_KEYS)[number])) return;
    setEditingProduct((prev) => {
      if (!prev) return prev;
      const { [key]: _, ...rest } = prev.attributes;
      return { ...prev, attributes: rest };
    });
  };

  const handleUploadedImages = (urls: string[]) => {
    setEditingProduct((prev) =>
      prev ? { ...prev, imageUrls: [...prev.imageUrls, ...urls] } : prev
    );
  };

  const removeImage = (index: number) => {
    setEditingProduct((prev) =>
      prev ? { ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== index) } : prev
    );
  };

  return {
    editingProduct,
    isNewProduct,
    isDialogOpen,
    setIsDialogOpen,
    handleEditClick,
    handleNewProduct,
    updateField,
    updateAttribute,
    removeAttribute,
    handleUploadedImages,
    removeImage,
  };
}
