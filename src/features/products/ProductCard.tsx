import { motion } from "framer-motion";
import { Edit2, Package, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  loadingProductId?: string | null;
  animationIndex?: number;
}

export function ProductCard({ product, onEdit, loadingProductId, animationIndex = 0 }: ProductCardProps) {
  const isLoadingThis = loadingProductId === product.id;
  const coverImage = product.imageUrls[0] ?? product.imageUrl;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: animationIndex * 0.05, duration: 0.3 }}
    >
      <Card className="overflow-hidden border-border/50 rounded-2xl hover:border-primary/30 transition-all duration-300 hover:shadow-xl group">
        <div className="h-48 overflow-hidden relative bg-muted">
          {coverImage ? (
            <img
              src={coverImage}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-foreground shadow-sm">
            {product.stock} in stock
          </div>
          {!product.active && (
            <div className="absolute top-3 left-3 bg-destructive/90 text-destructive-foreground px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">
              Inactive
            </div>
          )}
        </div>

        <CardContent className="p-5">
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-bold text-lg text-foreground line-clamp-1">{product.name || "Untitled"}</h3>
              {product.isVeg && (
                <span className="w-4 h-4 rounded-sm border-2 border-green-600 flex items-center justify-center flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-600" />
                </span>
              )}
            </div>
            {product.unitWeight && (
              <p className="text-xs text-muted-foreground mb-1">{product.unitWeight}</p>
            )}
            <div className="flex items-baseline gap-2">
              <p className="text-primary font-bold text-xl">₹{product.price}</p>
              {product.mrp > product.price && (
                <p className="text-muted-foreground line-through text-sm">₹{product.mrp}</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-xl border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors group/btn"
            onClick={() => onEdit(product)}
            disabled={!!loadingProductId}
          >
            {isLoadingThis
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Edit2 className="w-4 h-4 mr-2 text-muted-foreground group-hover/btn:text-current" />
            }
            {isLoadingThis ? "Loading…" : "Edit Item"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
