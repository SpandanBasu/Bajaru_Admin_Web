import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SectionDivider } from "@/components/shared/SectionDivider";
import { OrderStatusBadge, PaymentBadge } from "./OrderStatusBadge";
import { getDeliveryDetail } from "@/lib/api/adminApi";
import {
  Phone, MapPin, ExternalLink, User, Clock, Ruler,
  Package, AlertCircle, Image, CreditCard, Star,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtRupees(v: number) {
  return `₹${v.toFixed(2)}`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function shortId(id: string) {
  return "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function mapsUrl(lat: number | null, lng: number | null, address: string) {
  if (lat !== null && lng !== null) return `https://maps.google.com/?q=${lat},${lng}`;
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-foreground text-right">{value ?? "—"}</span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-secondary/50 border border-border/50 px-3 py-3 flex-1 text-center">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-7 w-48 rounded-xl" />
      <Skeleton className="h-4 w-32 rounded-xl" />
      <div className="space-y-2 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

interface OrderDetailSheetProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailSheet({ orderId, onClose }: OrderDetailSheetProps) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["delivery-detail", orderId],
    queryFn: () => getDeliveryDetail(orderId!),
    enabled: !!orderId,
    staleTime: 30_000,
  });

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">

        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          {isLoading || !order ? (
            <>
              <Skeleton className="h-6 w-40 rounded-xl" />
              <Skeleton className="h-4 w-56 mt-1 rounded-xl" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <SheetTitle className="text-lg font-mono font-bold">{shortId(order.id)}</SheetTitle>
                <OrderStatusBadge status={order.status} />
                <PaymentBadge isCOD={order.isCOD} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Placed {fmtDateTime(order.placedAt)}
                {order.deliveryDate && (
                  <> · Delivery {new Date(order.deliveryDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</>
                )}
              </p>
            </>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading || !order ? (
            <DetailSkeleton />
          ) : (
            <div className="px-6 pb-8 space-y-5 pt-4">

              {/* ── Customer ── */}
              <SectionDivider>Customer</SectionDivider>
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{order.customerName}</p>
                    <a
                      href={`tel:${order.phone}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline mt-0.5"
                    >
                      <Phone className="w-3 h-3" />
                      {order.phone}
                    </a>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{order.fullAddress}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.area} · {order.pincode}</p>
                  </div>
                  <a
                    href={mapsUrl(order.addressLatitude, order.addressLongitude, order.fullAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Maps
                  </a>
                </div>
              </div>

              {/* ── Items ── */}
              <SectionDivider>Items ({order.items.length})</SectionDivider>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="divide-y divide-border/40">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.unitWeight} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground shrink-0">
                        {fmtRupees(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Payment ── */}
              <SectionDivider>Payment</SectionDivider>
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
                <InfoRow label="Subtotal" value={fmtRupees(order.subTotal)} />
                {order.deliveryFee > 0 && (
                  <InfoRow label="Delivery Fee" value={fmtRupees(order.deliveryFee)} />
                )}
                {order.bagCharge > 0 && (
                  <InfoRow label="Bag Charge" value={fmtRupees(order.bagCharge)} />
                )}
                {order.couponDiscount > 0 && (
                  <InfoRow
                    label={order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}
                    value={<span className="text-green-600">−{fmtRupees(order.couponDiscount)}</span>}
                  />
                )}
                <Separator className="my-2" />
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="font-bold text-lg text-primary">{fmtRupees(order.finalTotal)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{order.isCOD ? "Cash on Delivery" : `Paid Online · ${order.paymentType}`}</span>
                </div>
              </div>

              {/* ── Delivery Stats (if dispatched or delivered) ── */}
              {(order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED" || order.riderName) && (
                <>
                  <SectionDivider>Delivery</SectionDivider>
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                    {order.riderName && (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{order.riderName}</p>
                          {order.riderPhone && (
                            <a href={`tel:${order.riderPhone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <Phone className="w-3 h-3" />{order.riderPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {(order.departedAt || order.deliveryMinutes || order.distanceKm) && (
                      <div className="flex gap-2 mt-2">
                        {order.departedAt && (
                          <StatTile icon={Clock} label="Departed" value={fmtTime(order.departedAt) ?? "—"} />
                        )}
                        {order.deliveredAt && (
                          <StatTile icon={Clock} label="Delivered" value={fmtTime(order.deliveredAt) ?? "—"} />
                        )}
                        {order.deliveryMinutes !== null && order.deliveryMinutes !== undefined && (
                          <StatTile icon={Clock} label="Duration" value={`${order.deliveryMinutes} min`} />
                        )}
                        {order.distanceKm !== null && order.distanceKm !== undefined && (
                          <StatTile icon={Ruler} label="Distance" value={`${order.distanceKm.toFixed(1)} km`} />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Rejection ── */}
              {order.status === "REJECTED" && order.rejectionReason && (
                <>
                  <SectionDivider>Rejection</SectionDivider>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Rejected</p>
                      <p className="text-sm text-red-600 mt-0.5">{order.rejectionReason}</p>
                      {order.rejectedAt && (
                        <p className="text-xs text-red-400 mt-1">{fmtDateTime(order.rejectedAt)}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── Proof of Delivery ── */}
              {order.proofImageUrl && (
                <>
                  <SectionDivider>Proof of Delivery</SectionDivider>
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <img
                      src={order.proofImageUrl}
                      alt="Proof of delivery"
                      className="w-full object-cover max-h-64"
                    />
                  </div>
                </>
              )}

            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
