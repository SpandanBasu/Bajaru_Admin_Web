import { useState, useRef, useCallback } from "react";
import type { ProcurementItem } from "@/lib/types";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&h=500&fit=crop";

interface FormData {
  name: string;
  quantity: string;
  unit: string;
}

export function useProcurementForm(
  procurementItems: ProcurementItem[],
  setProcurementItems: React.Dispatch<React.SetStateAction<ProcurementItem[]>>
) {
  const [formData, setFormData] = useState<FormData>({ name: "", quantity: "", unit: "kg" });
  const [imageUrl, setImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback((dataUrl: string) => {
    setImageUrl(dataUrl);
  }, []);

  const clearImage = () => {
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.quantity) return;

    const newItem: ProcurementItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: "",
      name: formData.name,
      neededToday: Number(formData.quantity),
      unit: formData.unit,
      unitWeight: formData.unit,
      orderCount: 0,
      warehouseId: "",
      status: "PENDING",
    };

    setProcurementItems([newItem, ...procurementItems]);
    setFormData({ name: "", quantity: "", unit: "kg" });
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    formData,
    setFormData,
    imageUrl,
    fileInputRef,
    handleImageFile,
    clearImage,
    handleSubmit,
  };
}
