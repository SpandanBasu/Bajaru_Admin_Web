import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementList } from "@/features/procurement/ProcurementList";
import { getProcurementItems, markProcurementReceived } from "@/lib/api/adminApi";
import type { ProcurementLine } from "@/lib/api/adminApi";
import type { ProcurementItem } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingCart, TrendingUp, Layers } from "lucide-react";

function toItem(p: ProcurementLine): ProcurementItem {
  return {
    id: p.id,
    productId: p.productId,
    name: p.name,
    neededToday: p.neededToday,
    unit: p.unit,
    unitWeight: p.unitWeight,
    orderCount: p.orderCount,
    warehouseId: p.warehouseId,
    status: p.status,
  };
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function Procurement() {
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["procurement-items"],
    queryFn: getProcurementItems,
  });

  const markMutation = useMutation({
    mutationFn: ({ productId, warehouseId }: { productId: string; warehouseId: string }) =>
      markProcurementReceived(productId, warehouseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["procurement-items"] }),
  });

  const items: ProcurementItem[] = (summary?.items ?? []).map(toItem);

  const markReceived = (id: string) => {
    const raw = summary?.items.find((i) => i.id === id);
    if (!raw) return;
    markMutation.mutate({ productId: raw.productId, warehouseId: raw.warehouseId });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <PageHeader
        title="Procurement"
        subtitle="Today's procurement requirements based on active orders."
      />

      {isLoading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Package} label="Items to Source" value={summary.itemCount} />
          <StatCard icon={ShoppingCart} label="Active Orders" value={summary.orderCount} />
          <StatCard icon={TrendingUp} label="Total Needed" value={summary.totalNeeded.toFixed(1)} />
          <StatCard icon={Layers} label="To Procure" value={summary.totalToProcure.toFixed(1)} />
        </div>
      ) : null}

      <ProcurementList items={items} isLoading={isLoading} onMarkReceived={markReceived} />
    </div>
  );
}
