import { motion } from "framer-motion";
import { Truck, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ProcurementItem } from "@/lib/types";

interface ProcurementListProps {
  items: ProcurementItem[];
  onMarkReceived: (id: string) => void;
}

export function ProcurementList({ items, onMarkReceived }: ProcurementListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold font-display">Recent Orders</h3>
        <span className="text-sm text-muted-foreground">Total: {items.length} items</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="overflow-hidden border-border/50 rounded-2xl hover:shadow-md transition-all group">
              <div className="flex p-4 gap-4 h-full">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-muted border border-border/50">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex flex-col flex-1 py-1 justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-base line-clamp-1 pr-2">{item.name}</h4>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md shrink-0 ${
                        item.status === "Received" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">Order Date: {item.date}</p>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div className="text-lg font-bold font-display text-foreground">
                      {item.quantity} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                    </div>
                    {item.status === "Pending" && (
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
              title="No procurement orders yet."
              className="py-16 border-dashed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
