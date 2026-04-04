import { motion } from "framer-motion";
import { Truck, CheckCircle2, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ProcurementItem } from "@/lib/types";

interface ProcurementListProps {
  items: ProcurementItem[];
  isLoading?: boolean;
  onMarkReceived: (id: string) => void;
}

export function ProcurementList({ items, isLoading, onMarkReceived }: ProcurementListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <Skeleton className="h-4 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold font-display">Today's Requirements</h3>
        <span className="text-sm text-muted-foreground">{items.length} items</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="overflow-hidden border-border/50 rounded-2xl hover:shadow-md transition-all group">
              <div className="flex p-4 gap-4 h-full">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div className="flex flex-col flex-1 py-0.5 justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-base line-clamp-1">{item.name}</h4>
                        <p className="text-muted-foreground text-xs mt-0.5">{item.unitWeight}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md shrink-0 ${
                        item.status === "RECEIVED"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {item.status === "RECEIVED" ? "Received" : "Pending"}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">
                      {item.orderCount} {item.orderCount === 1 ? "order" : "orders"} today
                    </p>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div className="text-lg font-bold font-display text-foreground">
                      {item.neededToday.toFixed(1)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                    </div>
                    {item.status !== "RECEIVED" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-lg h-8 text-xs font-semibold hover:bg-primary hover:text-white transition-colors"
                        onClick={() => onMarkReceived(item.id)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Mark Received
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}

        {items.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Truck}
              title="No procurement required today."
              className="py-16 border-dashed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
