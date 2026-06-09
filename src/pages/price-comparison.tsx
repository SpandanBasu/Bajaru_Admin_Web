import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingDown, TrendingUp, Link2Off, BarChart3, Warehouse as WarehouseIcon, Search, MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/features/dashboard/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  getWarehouses,
  getInventoryByWarehouse,
  getCompetitorPrices,
  getCompetitorPincodes,
  type WarehouseInventoryItem,
} from "@/lib/api/adminApi";

/** Sentinel value for "show every pincode" in the pincode picker. */
const ALL_PINCODES = "__all__";

interface ComparisonRow {
  productId: string;
  productName: string;
  bajaruPrice: number;
  prices: Record<string, number>; // source -> cheapest competitor sale price
  cheapest: number;
  cheapestSource: string;
  /** true when Bajaru is at or below every competitor (the "safe" case). */
  safe: boolean;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function PriceComparison() {
  const [warehouseId, setWarehouseId] = useState("");
  const [pincode, setPincode] = useState("");
  const [search, setSearch] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].warehouseId);
    }
  }, [warehouses, warehouseId]);

  const { data: inventory = [], isLoading: loadingInv } = useQuery({
    queryKey: ["inventory", warehouseId],
    queryFn: () => getInventoryByWarehouse(warehouseId),
    enabled: !!warehouseId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: pincodes = [] } = useQuery({
    queryKey: ["competitor-pincodes"],
    queryFn: getCompetitorPincodes,
    staleTime: 5 * 60 * 1000,
  });

  // Default to the first available pincode once they load (per-pincode view).
  useEffect(() => {
    if (pincodes.length > 0 && !pincode) {
      setPincode(pincodes[0]);
    }
  }, [pincodes, pincode]);

  const { data: competitorPrices = [], isLoading: loadingComp } = useQuery({
    queryKey: ["competitor-prices", pincode],
    queryFn: () =>
      getCompetitorPrices(pincode && pincode !== ALL_PINCODES ? pincode : undefined),
    // Wait until a pincode is chosen (or none exist) before fetching.
    enabled: pincodes.length === 0 || !!pincode,
    staleTime: 60_000,
  });

  // Distinct competitor sources (for table columns).
  const sources = useMemo(() => {
    const set = new Set<string>();
    competitorPrices.forEach((p) => set.add(p.source));
    return [...set].sort();
  }, [competitorPrices]);

  // Bajaru selling price by product id.
  const bajaruById = useMemo(() => {
    const m = new Map<string, WarehouseInventoryItem>();
    (inventory as WarehouseInventoryItem[]).forEach((i) => m.set(i.productId, i));
    return m;
  }, [inventory]);

  const { rows, unmappedCount } = useMemo(() => {
    // productId -> source -> cheapest competitor sale price
    const grouped = new Map<string, Record<string, number>>();
    let unmapped = 0;
    const seenUnmapped = new Set<string>();

    for (const p of competitorPrices) {
      if (!p.bajaruProductId) {
        const key = `${p.source}|${p.competitorName}|${p.competitorQuantity}`;
        if (!seenUnmapped.has(key)) { seenUnmapped.add(key); unmapped++; }
        continue;
      }
      const bySource = grouped.get(p.bajaruProductId) ?? {};
      // Keep the lowest competitor sale price per source.
      if (bySource[p.source] === undefined || p.salePrice < bySource[p.source]) {
        if (p.salePrice > 0) bySource[p.source] = p.salePrice;
      }
      grouped.set(p.bajaruProductId, bySource);
    }

    const out: ComparisonRow[] = [];
    for (const [productId, prices] of grouped) {
      const inv = bajaruById.get(productId);
      if (!inv) continue; // mapped to a product not stocked in this warehouse
      const entries = Object.entries(prices);
      if (entries.length === 0) continue;
      let cheapest = Infinity;
      let cheapestSource = "";
      for (const [src, val] of entries) {
        if (val < cheapest) { cheapest = val; cheapestSource = src; }
      }
      out.push({
        productId,
        productName: inv.name,
        bajaruPrice: inv.sellingPrice,
        prices,
        cheapest,
        cheapestSource,
        safe: inv.sellingPrice <= cheapest,
      });
    }

    // Most expensive-vs-competitor first (largest positive gap on top).
    out.sort((a, b) => (b.bajaruPrice - b.cheapest) - (a.bajaruPrice - a.cheapest));
    return { rows: out, unmappedCount: unmapped };
  }, [competitorPrices, bajaruById]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.productName.toLowerCase().includes(q));
  }, [rows, search]);

  const safeCount = rows.filter((r) => r.safe).length;
  const expensiveCount = rows.length - safeCount;
  const loading = loadingInv || loadingComp;

  return (
    <div>
      <PageHeader
        title="Price Comparison"
        subtitle="Bajaru vs competitor live prices. Green = we're cheaper or matched, red = a competitor undercuts us."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-56">
            <WarehouseIcon className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Select warehouse" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.warehouseId} value={w.warehouseId}>
                {w.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={pincode}
          onValueChange={setPincode}
          disabled={pincodes.length === 0}
        >
          <SelectTrigger className="w-52">
            <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue
              placeholder={pincodes.length === 0 ? "No pincodes yet" : "Select pincode"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PINCODES}>All pincodes</SelectItem>
            {pincodes.map((pc) => (
              <SelectItem key={pc} value={pc}>
                {pc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="We're cheaper / matched" value={safeCount} icon={TrendingDown} color="text-green-600" bg="bg-green-100" animationIndex={0} />
        <StatCard title="Competitor undercuts us" value={expensiveCount} icon={TrendingUp} color="text-red-600" bg="bg-red-100" animationIndex={1} />
        <StatCard title="Unmapped competitor items" value={unmappedCount} icon={Link2Off} color="text-amber-600" bg="bg-amber-100" animationIndex={2} />
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading prices…</div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nothing to compare yet"
            description="Once competitor data is ingested and products are mapped, comparisons will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Bajaru</TableHead>
                  {sources.map((s) => (
                    <TableHead key={s} className="text-right capitalize">{s}</TableHead>
                  ))}
                  <TableHead className="text-right">Cheapest</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => {
                  const gap = r.bajaruPrice - r.cheapest;
                  return (
                    <TableRow key={r.productId}>
                      <TableCell className="font-medium">{r.productName}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          r.safe ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {fmt(r.bajaruPrice)}
                      </TableCell>
                      {sources.map((s) => {
                        const v = r.prices[s];
                        if (v === undefined) {
                          return <TableCell key={s} className="text-right text-muted-foreground">—</TableCell>;
                        }
                        const cheaperThanUs = v < r.bajaruPrice;
                        return (
                          <TableCell
                            key={s}
                            className={`text-right ${
                              cheaperThanUs ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                            }`}
                          >
                            {fmt(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <span className="text-muted-foreground capitalize">{r.cheapestSource}</span>{" "}
                        {fmt(r.cheapest)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            r.safe
                              ? "border-green-200 bg-green-100 text-green-700"
                              : "border-red-200 bg-red-100 text-red-700"
                          }
                        >
                          {gap > 0 ? `+${fmt(gap)}` : gap < 0 ? `-${fmt(Math.abs(gap))}` : "₹0"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
