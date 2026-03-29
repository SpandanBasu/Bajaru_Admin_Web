import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Product } from "@/lib/types";

interface LowStockListProps {
  products: Product[];
}

export function LowStockList({ products }: LowStockListProps) {
  return (
    <Card className="col-span-1 border-border/50 shadow-sm rounded-2xl flex flex-col">
      <CardHeader className="border-b border-border/30 pb-4">
        <CardTitle className="text-lg font-bold flex justify-between items-center">
          <span>Low Stock Items</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">
            {products.length} items
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <EmptyState icon={Package} title="All stock levels are healthy." className="py-8 border-0 bg-transparent" />
        ) : (
          <div className="divide-y divide-border/30">
            {products.map((product) => (
              <div key={product.id} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-border" />
                  <div>
                    <p className="font-semibold text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">₹{product.price} / unit</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600">{product.stock}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">In Stock</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
