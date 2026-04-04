import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionDivider } from "@/components/shared/SectionDivider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  searchCustomers, getCustomerDetail, getCustomerOrders, postCustomerRefund,
} from "@/lib/api/adminApi";
import type { CustomerSummary, CustomerDetail, AdminCustomerOrder } from "@/lib/api/adminApi";
import {
  Search, User, Phone, Mail, Calendar, Wallet, MapPin, Package,
  BadgeIndianRupee, CreditCard, RefreshCw, ChevronRight, RotateCcw,
  Star,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRupees(v: number) { return `₹${v.toFixed(2)}`; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const STATUS_CLASS: Record<string, string> = {
  CONFIRMED: "bg-amber-100 text-amber-700",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-muted text-muted-foreground",
  REJECTED: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Pending", OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered", CANCELLED: "Cancelled", REJECTED: "Rejected",
};

// ── Refund Dialog ─────────────────────────────────────────────────────────────

interface RefundDialogProps {
  open: boolean;
  order: AdminCustomerOrder | null;
  customerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function RefundDialog({ open, order, customerId, onClose, onSuccess }: RefundDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState<"WALLET" | "ORIGINAL">("WALLET");

  useEffect(() => {
    if (order) setAmount(order.total.toFixed(2));
  }, [order]);

  const mutation = useMutation({
    mutationFn: () =>
      postCustomerRefund(customerId, order!.orderId, parseFloat(amount), destination),
    onSuccess: () => {
      toast({ title: "Refund initiated", description: "The refund has been processed." });
      onSuccess();
      onClose();
    },
    onError: () => toast({ title: "Refund failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Initiate Refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Order</Label>
            <p className="text-sm font-mono text-muted-foreground mt-0.5">
              #{order?.orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div>
            <Label htmlFor="refund-amount">Amount (₹)</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Refund to</Label>
            <RadioGroup
              value={destination}
              onValueChange={(v) => setDestination(v as "WALLET" | "ORIGINAL")}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="WALLET" id="dest-wallet" />
                <Label htmlFor="dest-wallet">Bajaru Wallet</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ORIGINAL" id="dest-original" />
                <Label htmlFor="dest-original">Original Payment Method</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Processing…" : "Issue Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order, onRefund,
}: { order: AdminCustomerOrder; onRefund: (o: AdminCustomerOrder) => void }) {
  const [expanded, setExpanded] = useState(false);
  const statusClass = STATUS_CLASS[order.status] ?? "bg-muted text-muted-foreground";
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            #{order.orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusClass}`}>
            {statusLabel}
          </span>
          {order.refundStatus && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Refunded
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-foreground">{fmtRupees(order.total)}</span>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>{fmtDateTime(order.placedAt)}</span>
            <span className="capitalize">{order.paymentMethod}</span>
            {order.deliverySlot && <span>Slot: {order.deliverySlot}</span>}
          </div>
          <div className="space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.name} <span className="text-muted-foreground text-xs">({item.unitWeight}) × {item.quantity}</span>
                </span>
                <span className="font-medium">{fmtRupees(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          {(order.status === "DELIVERED" || order.status === "CANCELLED") && !order.refundStatus && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs rounded-lg h-8"
              onClick={() => onRefund(order)}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Initiate Refund
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Customer Detail Sheet ─────────────────────────────────────────────────────

interface CustomerSheetProps {
  customerId: string | null;
  onClose: () => void;
}

function CustomerSheet({ customerId, onClose }: CustomerSheetProps) {
  const queryClient = useQueryClient();
  const [refundOrder, setRefundOrder] = useState<AdminCustomerOrder | null>(null);
  const [moreOrdersPage, setMoreOrdersPage] = useState(1);
  const [extraOrders, setExtraOrders] = useState<AdminCustomerOrder[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: () => getCustomerDetail(customerId!),
    enabled: !!customerId,
    staleTime: 60_000,
  });

  useEffect(() => {
    setExtraOrders([]);
    setMoreOrdersPage(1);
    setHasMore(false);
  }, [customerId]);

  useEffect(() => {
    if (detail) setHasMore(detail.hasMoreOrders);
  }, [detail]);

  const loadMore = async () => {
    if (!customerId || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getCustomerOrders(customerId, moreOrdersPage, 10);
      setExtraOrders((prev) => [...prev, ...page.content]);
      setMoreOrdersPage((p) => p + 1);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const allOrders = [...(detail?.orderHistory ?? []), ...extraOrders];

  return (
    <>
      <Sheet open={!!customerId} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
            {isLoading || !detail ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-40 rounded-xl" />
                <Skeleton className="h-4 w-56 rounded-xl" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {initials(detail.name)}
                </div>
                <div>
                  <SheetTitle className="text-lg">{detail.name}</SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {detail.phone} · Member since {fmtDate(detail.memberSince)}
                  </p>
                </div>
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1">
            {isLoading || !detail ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="p-6">
                <Tabs defaultValue="overview">
                  <TabsList className="w-full mb-6">
                    <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                    <TabsTrigger value="orders" className="flex-1">Orders ({detail.totalOrders})</TabsTrigger>
                    <TabsTrigger value="wallet" className="flex-1">Wallet</TabsTrigger>
                  </TabsList>

                  {/* ── Overview ── */}
                  <TabsContent value="overview" className="space-y-5 mt-0">
                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Orders</p>
                        <p className="text-2xl font-bold text-foreground">{detail.totalOrders}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
                        <p className="text-xs text-muted-foreground">Wallet Balance</p>
                        <p className="text-2xl font-bold text-primary">{fmtRupees(detail.walletBalance)}</p>
                      </div>
                    </div>

                    <SectionDivider>Contact</SectionDivider>
                    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${detail.phone}`} className="text-primary hover:underline">{detail.phone}</a>
                      </div>
                      {detail.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{detail.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Member since {fmtDate(detail.memberSince)}</span>
                      </div>
                      {detail.isSubscriber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className="font-medium text-amber-600">Active Subscriber</span>
                        </div>
                      )}
                    </div>

                    {detail.savedAddresses.length > 0 && (
                      <>
                        <SectionDivider>Saved Addresses</SectionDivider>
                        <div className="space-y-2">
                          {detail.savedAddresses.map((addr, i) => (
                            <div key={i} className="rounded-xl border border-border/50 bg-card p-3 flex items-start gap-3">
                              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {addr.label}{addr.isDefault ? " · Default" : ""}
                                </p>
                                <p className="text-sm text-foreground mt-0.5">{addr.address}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* ── Orders ── */}
                  <TabsContent value="orders" className="mt-0 space-y-3">
                    {allOrders.map((order) => (
                      <OrderCard
                        key={order.orderId}
                        order={order}
                        onRefund={(o) => setRefundOrder(o)}
                      />
                    ))}
                    {allOrders.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-8">No orders found.</p>
                    )}
                    {hasMore && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={loadingMore}
                        onClick={loadMore}
                      >
                        {loadingMore ? "Loading…" : "Load more orders"}
                      </Button>
                    )}
                  </TabsContent>

                  {/* ── Wallet ── */}
                  <TabsContent value="wallet" className="mt-0">
                    <div className="rounded-xl border border-border/50 bg-primary/5 p-4 mb-4 flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Current Balance</p>
                        <p className="text-xl font-bold text-primary">{fmtRupees(detail.walletBalance)}</p>
                      </div>
                    </div>
                    {detail.transactions.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-8">No transactions found.</p>
                    ) : (
                      <div className="rounded-xl border border-border/50 overflow-hidden">
                        <div className="divide-y divide-border/40">
                          {detail.transactions.map((txn, i) => (
                            <div key={i} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-mono text-muted-foreground">{txn.txnId}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{txn.source} · {fmtDate(txn.date)}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${txn.type === "CREDIT" || txn.type === "REFUND" ? "text-green-600" : "text-red-600"}`}>
                                  {txn.type === "DEBIT" ? "−" : "+"}{fmtRupees(txn.amount)}
                                </p>
                                <p className={`text-[10px] font-semibold ${txn.status === "SUCCESS" ? "text-green-600" : "text-red-500"}`}>
                                  {txn.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {detail && (
        <RefundDialog
          open={!!refundOrder}
          order={refundOrder}
          customerId={detail.id}
          onClose={() => setRefundOrder(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customer-detail", customerId] })}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Customers() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const { data: results = [], isLoading, isFetching } = useQuery({
    queryKey: ["customers-search", debouncedQuery],
    queryFn: () => searchCustomers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Customer Support"
        subtitle="Search customers to view profiles, orders, and issue refunds."
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 rounded-xl"
        />
        {isFetching && (
          <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Results */}
      {debouncedQuery.length < 2 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Type at least 2 characters to search</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No customers found for "{debouncedQuery}"</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border/50">
            <p className="text-xs text-muted-foreground font-medium">{results.length} customer{results.length !== 1 ? "s" : ""} found</p>
          </div>
          <div className="divide-y divide-border/40">
            {results.map((c) => (
              <button
                key={c.id}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/40 transition-colors text-left"
                onClick={() => setSelectedId(c.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                    {initials(c.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {c.name}
                      {c.isSubscriber && (
                        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Sub</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{c.totalOrders} orders</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <CustomerSheet customerId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
