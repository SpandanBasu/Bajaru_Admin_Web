import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Link2, Trash2, GitCompareArrows, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  getWarehouses,
  getInventoryByWarehouse,
  getUnmappedCompetitorProducts,
  getCompetitorMappings,
  upsertCompetitorMapping,
  deleteCompetitorMapping,
  type UnmappedCompetitorProduct,
  type WarehouseInventoryItem,
} from "@/lib/api/adminApi";

// A minimal Bajaru product shape used by the mapping picker.
interface BajaruProductOption {
  id: string;
  name: string;
  category: string;
  unitWeight: string;
}

export default function ProductMapping() {
  const queryClient = useQueryClient();
  const [mapping, setMapping] = useState<UnmappedCompetitorProduct | null>(null);

  // Unmapped competitor products awaiting a Bajaru mapping.
  const { data: unmapped = [], isLoading: loadingUnmapped } = useQuery({
    queryKey: ["competitor-unmapped"],
    queryFn: getUnmappedCompetitorProducts,
    staleTime: 60_000,
  });

  // Existing mappings.
  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["competitor-mappings"],
    queryFn: getCompetitorMappings,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCompetitorMapping(id),
    onSuccess: () => {
      toast.success("Mapping removed");
      queryClient.invalidateQueries({ queryKey: ["competitor-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["competitor-unmapped"] });
      queryClient.invalidateQueries({ queryKey: ["competitor-prices"] });
    },
    onError: () => toast.error("Could not remove mapping"),
  });

  return (
    <div>
      <PageHeader
        title="Product Mapping"
        subtitle="Link competitor products to your Bajaru catalog so prices line up on the comparison dashboard."
      />

      {/* Unmapped competitor products */}
      <Card className="mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <PackageSearch className="w-5 h-5 text-primary" />
          <h2 className="font-semibold font-display">Unmapped competitor products</h2>
          <Badge variant="secondary" className="ml-2">{unmapped.length}</Badge>
        </div>
        {loadingUnmapped ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : unmapped.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            All competitor products are mapped. 🎉
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Competitor product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="text-right">Sale price</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmapped.map((p) => (
                <TableRow key={`${p.source}|${p.competitorName}|${p.competitorQuantity}`}>
                  <TableCell><Badge variant="outline" className="capitalize">{p.source}</Badge></TableCell>
                  <TableCell className="font-medium">{p.competitorName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.competitorQuantity}</TableCell>
                  <TableCell className="text-right">₹{p.salePrice}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setMapping(p)}>
                      <Link2 className="w-4 h-4 mr-1" /> Map
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Existing mappings */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <GitCompareArrows className="w-5 h-5 text-primary" />
          <h2 className="font-semibold font-display">Existing mappings</h2>
          <Badge variant="secondary" className="ml-2">{mappings.length}</Badge>
        </div>
        {loadingMappings ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : mappings.length === 0 ? (
          <EmptyState
            icon={GitCompareArrows}
            title="No mappings yet"
            description="Map competitor products above to start comparing prices."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bajaru product</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Competitor product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.bajaruProductName || m.bajaruProductId}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{m.source}</Badge></TableCell>
                  <TableCell>{m.competitorName}</TableCell>
                  <TableCell className="text-muted-foreground">{m.competitorQuantity}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(m.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <MapDialog
        target={mapping}
        onClose={() => setMapping(null)}
        onSaved={() => {
          setMapping(null);
          queryClient.invalidateQueries({ queryKey: ["competitor-mappings"] });
          queryClient.invalidateQueries({ queryKey: ["competitor-unmapped"] });
          queryClient.invalidateQueries({ queryKey: ["competitor-prices"] });
        }}
      />
    </div>
  );
}

// ── Mapping dialog ────────────────────────────────────────────────────────────

function MapDialog({
  target,
  onClose,
  onSaved,
}: {
  target: UnmappedCompetitorProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");

  // Reset the search box each time a new competitor product is opened.
  useEffect(() => {
    if (target) setSearch("");
  }, [target]);

  // Load the Bajaru catalog (from the first warehouse's inventory) for the picker.
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
    staleTime: 60 * 60 * 1000,
  });
  const firstWarehouseId = warehouses[0]?.warehouseId;

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["inventory", firstWarehouseId],
    queryFn: () => getInventoryByWarehouse(firstWarehouseId!),
    enabled: !!firstWarehouseId && !!target,
    staleTime: 60 * 60 * 1000,
  });

  const products: BajaruProductOption[] = useMemo(() => {
    const seen = new Set<string>();
    const out: BajaruProductOption[] = [];
    for (const item of inventory as WarehouseInventoryItem[]) {
      if (seen.has(item.productId)) continue;
      seen.add(item.productId);
      out.push({
        id: item.productId,
        name: item.name,
        category: item.category,
        unitWeight: item.unitWeight,
      });
    }
    return out;
  }, [inventory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 50);
  }, [products, search]);

  const saveMutation = useMutation({
    mutationFn: (product: BajaruProductOption) =>
      upsertCompetitorMapping({
        bajaruProductId: product.id,
        bajaruProductName: product.name,
        source: target!.source,
        competitorName: target!.competitorName,
        competitorQuantity: target!.competitorQuantity,
      }),
    onSuccess: () => {
      toast.success("Mapping saved");
      onSaved();
    },
    onError: () => toast.error("Could not save mapping"),
  });

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Map competitor product</DialogTitle>
          <DialogDescription>
            {target && (
              <span>
                Pick the Bajaru product that matches{" "}
                <span className="font-medium text-foreground">{target.competitorName}</span>{" "}
                ({target.competitorQuantity}) from{" "}
                <span className="capitalize">{target.source}</span>.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search Bajaru products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto -mx-2 px-2 mt-2 space-y-1">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading catalog…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No matching products.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between disabled:opacity-50"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.category}{p.unitWeight ? ` · ${p.unitWeight}` : ""}
                  </p>
                </div>
                <Link2 className="w-4 h-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
