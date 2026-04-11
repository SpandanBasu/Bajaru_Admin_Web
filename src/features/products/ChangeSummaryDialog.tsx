import { Loader2, ArrowRight, Plus, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldChange {
  label: string;
  oldValue: string;
  newValue: string;
}

interface ChangeSummaryDialogProps {
  open: boolean;
  onConfirm: () => void;
  onBack: () => void;
  isSaving: boolean;
  productName: string;
  isNewProduct: boolean;
  catalogChanges: FieldChange[];
  inventoryChanges: FieldChange[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── Component  ────────────────────────────────────────────────────────────────

export function ChangeSummaryDialog({
  open,
  onConfirm,
  onBack,
  isSaving,
  productName,
  isNewProduct,
  catalogChanges,
  inventoryChanges,
}: ChangeSummaryDialogProps) {
  const totalChanges = catalogChanges.length + inventoryChanges.length;
  const hasChanges = totalChanges > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isSaving) onBack(); }}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden border-border/50 shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {isNewProduct
                ? <Plus className="w-4 h-4 text-primary" />
                : <Package className="w-4 h-4 text-primary" />
              }
            </div>
            <DialogTitle className="text-lg font-display">
              {isNewProduct ? "Confirm New Product" : "Review Changes"}
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground ml-12">
            {isNewProduct
              ? <>Adding <strong className="text-foreground">{productName}</strong> to the catalog.</>
              : hasChanges
                ? <><strong className="text-foreground">{totalChanges}</strong> field{totalChanges !== 1 ? "s" : ""} will be updated on <strong className="text-foreground">{productName}</strong>.</>
                : <>No changes detected on <strong className="text-foreground">{productName}</strong>.</>
            }
          </p>
        </div>

        <ScrollArea className="max-h-[55vh]">
          <div className="px-6 py-4 space-y-5">

            {/* New product: just confirm */}
            {isNewProduct && (
              <p className="text-sm text-muted-foreground">
                The product will be created in the catalog and its initial stock and pricing will be set for the selected warehouse. Proceed?
              </p>
            )}

            {/* Existing product with no changes */}
            {!isNewProduct && !hasChanges && (
              <p className="text-sm text-muted-foreground">
                You have not changed anything. Click Back to continue editing, or Confirm to re-save the current inventory values.
              </p>
            )}

            {/* Catalog field changes */}
            {!isNewProduct && catalogChanges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Product Details
                </p>
                <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
                  {catalogChanges.map(({ label, oldValue, newValue }) => (
                    <div key={label} className="px-4 py-3 text-sm">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-destructive/80 line-through break-all">{truncate(oldValue)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-primary font-medium break-all">{truncate(newValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory changes */}
            {!isNewProduct && inventoryChanges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stock & Pricing
                </p>
                <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
                  {inventoryChanges.map(({ label, oldValue, newValue }) => (
                    <div key={label} className="px-4 py-3 text-sm">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-destructive/80 line-through">{oldValue}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-primary font-medium">{newValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-background">
          <DialogFooter>
            <Button variant="outline" onClick={onBack} disabled={isSaving} className="rounded-xl">
              Back to Edit
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isSaving}
              className="rounded-xl shadow-lg shadow-primary/20"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSaving ? "Saving…" : isNewProduct ? "Add Product" : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </div>

      </DialogContent>
    </Dialog>
  );
}
