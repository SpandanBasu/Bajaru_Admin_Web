import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Search, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { OrderStatusBadge, PaymentBadge } from "@/features/orders/OrderStatusBadge";
import { OrderDetailSheet } from "@/features/orders/OrderDetailSheet";
import { getWarehouses, getDeliveries } from "@/lib/api/adminApi";
import type { AdminDeliveryListItem, Warehouse } from "@/lib/api/adminApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string) {
  const today = todayISO();
  if (dateStr === today) return "Today";
  if (dateStr === shiftDate(today, -1)) return "Yesterday";
  if (dateStr === shiftDate(today, 1)) return "Tomorrow";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function shortId(id: string) {
  return "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// ─── Status filter tabs ────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: "All",             value: "" },
  { label: "Pending",         value: "pending" },
  { label: "Out for Delivery", value: "outfordelivery" },
  { label: "Delivered",       value: "delivered" },
  { label: "Cancelled",       value: "cancelled" },
  { label: "Rejected",        value: "rejected" },
] as const;

// Map filter value → backend status string (for counting from full list)
const FILTER_TO_STATUS: Record<string, string[]> = {
  "":               ["CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REJECTED"],
  "pending":        ["CONFIRMED"],
  "outfordelivery": ["OUT_FOR_DELIVERY"],
  "delivered":      ["DELIVERED"],
  "cancelled":      ["CANCELLED"],
  "rejected":       ["REJECTED"],
};

// ─── Table row skeleton ────────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border/40">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 rounded-lg" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Orders() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayISO);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // ── Warehouses ──
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].warehouseId);
    }
  }, [warehouses, selectedWarehouseId]);

  // ── Deliveries (always fetch "all" statuses so counts are accurate across tabs) ──
  const {
    data: deliveryPage,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["deliveries", selectedWarehouseId, deliveryDate],
    queryFn: () => getDeliveries({ warehouseId: selectedWarehouseId, deliveryDate, size: 500 }),
    enabled: !!selectedWarehouseId,
    staleTime: 60_000,
  });

  const allOrders: AdminDeliveryListItem[] = deliveryPage?.content ?? [];

  // Tab counts
  const countFor = (tab: string) => {
    const statuses = FILTER_TO_STATUS[tab] ?? [];
    if (tab === "") return allOrders.length;
    return allOrders.filter((o) => statuses.includes(o.status)).length;
  };

  // Filter by tab
  const tabFiltered = statusFilter === ""
    ? allOrders
    : allOrders.filter((o) => FILTER_TO_STATUS[statusFilter]?.includes(o.status));

  // Filter by search (order ID or customer name)
  const filtered = search.trim()
    ? tabFiltered.filter((o) =>
        o.customerName.toLowerCase().includes(search.toLowerCase()) ||
        o.id.includes(search.toLowerCase()) ||
        o.phone.includes(search) ||
        o.area.toLowerCase().includes(search.toLowerCase()),
      )
    : tabFiltered;

  // Summary stats for current date
  const totalRevenue = allOrders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.finalTotal, 0);

  const codCount = allOrders.filter((o) => o.isCOD).length;

  // ── Render ──

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-12">

      {/* ── Header ── */}
      <PageHeader title="Orders" subtitle="Monitor daily deliveries per warehouse.">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Warehouse selector */}
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId} disabled={warehouses.length === 0}>
            <SelectTrigger className="h-9 rounded-xl border-border/50 bg-card text-sm w-52">
              <SelectValue placeholder="Select warehouse…" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {warehouses.map((w) => (
                <SelectItem key={w.warehouseId} value={w.warehouseId}>
                  {w.displayName} — {w.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-border/50"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </PageHeader>

      {/* ── Date navigation ── */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl border-border/50"
          onClick={() => setDeliveryDate((d) => shiftDate(d, -1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="relative">
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => e.target.value && setDeliveryDate(e.target.value)}
            className="h-9 rounded-xl border border-border/50 bg-card px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl border-border/50"
          onClick={() => setDeliveryDate((d) => shiftDate(d, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <span className="text-sm font-semibold text-foreground px-1">
          {formatDateLabel(deliveryDate)}
        </span>

        {deliveryDate !== todayISO() && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-border/50 text-xs"
            onClick={() => setDeliveryDate(todayISO())}
          >
            Today
          </Button>
        )}
      </div>

      {/* ── Summary stats ── */}
      {!isLoading && allOrders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Orders" value={allOrders.length} />
          <StatCard label="Delivered" value={countFor("delivered")} sub={`${allOrders.length > 0 ? Math.round((countFor("delivered") / allOrders.length) * 100) : 0}% completion`} />
          <StatCard label="Revenue (Delivered)" value={`₹${totalRevenue.toFixed(0)}`} />
          <StatCard label="COD Orders" value={codCount} sub={`${allOrders.length - codCount} online`} />
        </div>
      )}

      {/* ── Status tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map((tab) => {
          const count = countFor(tab.value);
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0
                ${isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
            >
              {tab.label}
              {!isLoading && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div className="relative w-full sm:w-80">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, phone, area…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl border-border/50 bg-card h-9"
        />
      </div>

      {/* ── Table ── */}
      {!selectedWarehouseId ? (
        <EmptyState icon={ClipboardList} title="Select a warehouse" description="Choose a warehouse above to view its orders." />
      ) : isLoading ? (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                {["Order", "Customer", "Area", "Items", "Total", "Status", "Rider"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search ? "No matching orders" : "No orders found"}
          description={search ? "Try a different search term." : `No ${statusFilter ? STATUS_TABS.find(t => t.value === statusFilter)?.label.toLowerCase() : ""} orders for ${formatDateLabel(deliveryDate)}.`}
        />
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rider</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    {/* Order ID */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-foreground">{shortId(order.id)}</span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground whitespace-nowrap">{order.customerName}</p>
                      <a
                        href={`tel:${order.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Phone className="w-3 h-3" />{order.phone}
                      </a>
                    </td>

                    {/* Area */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground whitespace-nowrap">{order.area}</p>
                      <p className="text-xs text-muted-foreground">{order.pincode}</p>
                    </td>

                    {/* Items */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{order.itemCount}</span>
                      <span className="text-xs text-muted-foreground ml-1">items</span>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-primary whitespace-nowrap">₹{order.finalTotal.toFixed(0)}</span>
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-3">
                      <PaymentBadge isCOD={order.isCOD} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} size="sm" />
                    </td>

                    {/* Rider */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">
                        {order.riderName ?? <span className="text-muted-foreground text-xs">—</span>}
                      </span>
                    </td>

                    {/* Placed at */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(order.placedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border/50 bg-secondary/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of <span className="font-semibold text-foreground">{allOrders.length}</span> orders
            </p>
            {deliveryPage?.hasMore && (
              <p className="text-xs text-amber-600 font-medium">More orders exist — increase page size to see all.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Detail sheet ── */}
      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
