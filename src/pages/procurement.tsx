import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementForm } from "@/features/procurement/ProcurementForm";
import { ProcurementList } from "@/features/procurement/ProcurementList";
import { useProcurementForm } from "@/features/procurement/useProcurementForm";
import { getProcurementItems, markProcurementReceived } from "@/lib/api/adminApi";
import type { ProcurementItem } from "@/lib/types";
import type { ProcurementOrderItem } from "@/lib/api/adminApi";

function toItem(p: ProcurementOrderItem): ProcurementItem {
  return {
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
    imageUrl: p.imageUrl ?? "",
    date: p.date,
    status: p.status,
  };
}

export default function Procurement() {
  const queryClient = useQueryClient();

  const { data: apiItems = [] } = useQuery({
    queryKey: ["procurement-items"],
    queryFn: getProcurementItems,
  });

  const items: ProcurementItem[] = apiItems.map(toItem);

  const markMutation = useMutation({
    mutationFn: ({ productId, warehouseId }: { productId: string; warehouseId: string }) =>
      markProcurementReceived(productId, warehouseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["procurement-items"] }),
  });

  const markReceived = (id: string) => {
    // id is `productId` for now; warehouseId comes from the raw item
    const raw = apiItems.find((i) => i.id === id);
    if (!raw) return;
    markMutation.mutate({ productId: raw.productId, warehouseId: raw.warehouseId });
  };

  const form = useProcurementForm(items, () => {});

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <PageHeader
        title="Procurement"
        subtitle="Order new supplies and manage incoming inventory."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <ProcurementForm
            formData={form.formData}
            setFormData={form.setFormData}
            imageUrl={form.imageUrl}
            onImageAdded={form.handleImageFile}
            onClearImage={form.clearImage}
            onSubmit={form.handleSubmit}
          />
        </div>
        <div className="xl:col-span-2">
          <ProcurementList items={items} onMarkReceived={markReceived} />
        </div>
      </div>
    </div>
  );
}
