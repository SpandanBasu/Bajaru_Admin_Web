import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionDivider } from "@/components/shared/SectionDivider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  getWarehouses, listRiders, getRiderDetail, patchRiderOnlineStatus,
} from "@/lib/api/adminApi";
import type { AdminRider, AdminRiderShiftDetail } from "@/lib/api/adminApi";
import {
  Bike, Phone, CheckCircle2, XCircle, Clock, MapPin, IndianRupee,
  Package, Banknote, Smartphone, TrendingUp, Users,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRupees(v: number) { return `₹${v.toFixed(2)}`; }

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function shiftDuration(startIso: string | null, endIso: string | null): string {
  const start = startIso ? new Date(startIso).getTime() : null;
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (!start) return "—";
  const mins = Math.round((end - start) / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function riderInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// deterministic colour per rider id
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label, value, sub, color = "text-foreground",
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Rider Detail Sheet ────────────────────────────────────────────────────────

interface RiderDetailSheetProps {
  rider: AdminRider | null;
  onClose: () => void;
}

function RiderDetailSheet({ rider, onClose }: RiderDetailSheetProps) {
  const { data: detail, isLoading } = useQuery<AdminRiderShiftDetail>({
    queryKey: ["rider-detail", rider?.id],
    queryFn: () => getRiderDetail(rider!.id),
    enabled: !!rider,
    staleTime: 30_000,
  });

  return (
    <Sheet open={!!rider} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          {!rider ? null : (
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${avatarColor(rider.id)}`}>
                {riderInitials(rider.name)}
              </div>
              <div>
                <SheetTitle className="text-lg">{rider.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${rider.isOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{rider.isOnline ? "Online" : "Offline"}</span>
                  <span className="text-muted-foreground/40">·</span>
                  {rider.phoneNumber && (
                    <a href={`tel:${rider.phoneNumber}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone className="w-3 h-3" /> {rider.phoneNumber}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : !detail ? null : (
            <div className="px-6 pb-8 space-y-5 pt-4">

              {/* Shift */}
              <SectionDivider>Today's Shift</SectionDivider>
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="text-sm font-bold mt-0.5">{fmtTime(detail.shiftStartedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ended</p>
                    <p className="text-sm font-bold mt-0.5">{fmtTime(detail.shiftEndedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-bold mt-0.5">{shiftDuration(detail.shiftStartedAt, detail.shiftEndedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Activity */}
              <SectionDivider>Today's Activity</SectionDivider>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Assigned" value={detail.assigned} color="text-blue-600" />
                <StatTile label="Delivered" value={detail.delivered} color="text-green-600" />
                <StatTile label="Rejected" value={detail.rejected} color="text-red-500" />
                <StatTile label="Cancelled" value={detail.cancelled} color="text-amber-600" />
              </div>

              {/* COD */}
              {detail.codOrderCount > 0 && (
                <>
                  <SectionDivider>Cash Collection (COD)</SectionDivider>
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Package className="w-4 h-4" /> Total to Collect
                        <span className="text-xs">({detail.codOrderCount} orders)</span>
                      </span>
                      <span className="font-bold">{fmtRupees(detail.codTotal)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Banknote className="w-4 h-4" /> Cash Collected
                        <span className="text-xs">({detail.codCollectedCashCount})</span>
                      </span>
                      <span className="font-medium text-green-600">{fmtRupees(detail.codCollectedCash)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Smartphone className="w-4 h-4" /> UPI Collected
                        <span className="text-xs">({detail.codCollectedUpiCount})</span>
                      </span>
                      <span className="font-medium text-green-600">{fmtRupees(detail.codCollectedUpi)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending Collection</span>
                      <span className="font-bold text-amber-600">
                        {fmtRupees(detail.codTotal - detail.codCollectedCash - detail.codCollectedUpi)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Earnings */}
              {detail.earningsTotal > 0 && (
                <>
                  <SectionDivider>Today's Earnings</SectionDivider>
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Earnings</span>
                      <span className="text-lg font-bold text-primary">{fmtRupees(detail.earningsTotal)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-4 h-4" /> Delivery Pay
                        <span className="text-xs">({detail.earningsDeliveryCount} orders)</span>
                      </span>
                      <span className="font-medium">{fmtRupees(detail.earningsDelivery)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" /> Wait Time Bonus
                      </span>
                      <span className="font-medium">{fmtRupees(detail.earningsWait)}</span>
                    </div>
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

// ── Rider Card ────────────────────────────────────────────────────────────────

interface RiderCardProps {
  rider: AdminRider;
  onToggle: (id: string, online: boolean) => void;
  toggling: boolean;
  onClick: () => void;
}

function RiderCard({ rider, onToggle, toggling, onClick }: RiderCardProps) {
  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor(rider.id)}`}>
          {riderInitials(rider.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-foreground text-sm truncate">{rider.name}</p>
            <Switch
              checked={rider.isOnline}
              disabled={toggling}
              onCheckedChange={(v) => { onToggle(rider.id, v); }}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            />
          </div>
          {rider.phoneNumber && (
            <p className="text-xs text-muted-foreground mt-0.5">{rider.phoneNumber}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-foreground font-medium">{rider.deliveredToday}</span>
              <span className="text-muted-foreground">delivered</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-foreground font-medium">{rider.totalAssigned}</span>
              <span className="text-muted-foreground">assigned</span>
            </div>
            {rider.shiftStartedAt && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Since {fmtTime(rider.shiftStartedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Riders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [location] = useLocation();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedRider, setSelectedRider] = useState<AdminRider | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Close the detail sheet when navigating away so its overlay doesn't block page transitions
  useEffect(() => {
    setSelectedRider(null);
  }, [location]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].warehouseId);
    }
  }, [warehouses]);

  const { data: riders = [], isLoading } = useQuery({
    queryKey: ["riders", selectedWarehouseId, today],
    queryFn: () => listRiders(selectedWarehouseId, today),
    enabled: !!selectedWarehouseId,
    refetchInterval: 30_000,
  });

  const onlineMutation = useMutation({
    mutationFn: ({ id, online }: { id: string; online: boolean }) =>
      patchRiderOnlineStatus(id, online),
    onMutate: ({ id }) => setTogglingId(id),
    onSettled: () => setTogglingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["riders"] }),
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const onlineRiders = riders.filter((r) => r.isOnline);
  const offlineRiders = riders.filter((r) => !r.isOnline);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Rider Dispatch"
        subtitle={`${onlineRiders.length} rider${onlineRiders.length !== 1 ? "s" : ""} online today`}
      />

      {/* Warehouse selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
          <SelectTrigger className="w-64 rounded-xl">
            <SelectValue placeholder="Select warehouse" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.warehouseId} value={w.warehouseId}>
                {w.displayName} — {w.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Auto-refreshes every 30s</span>
      </div>

      {/* Summary stats */}
      {!isLoading && riders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Total Riders" value={riders.length} />
          <StatTile
            label="Online"
            value={onlineRiders.length}
            color="text-green-600"
          />
          <StatTile
            label="Deliveries Today"
            value={riders.reduce((s, r) => s + r.deliveredToday, 0)}
            color="text-primary"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : riders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bike className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No riders found for this warehouse today.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {onlineRiders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <h3 className="text-sm font-semibold text-foreground">On Duty ({onlineRiders.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {onlineRiders.map((r) => (
                  <RiderCard
                    key={r.id}
                    rider={r}
                    onToggle={(id, online) => onlineMutation.mutate({ id, online })}
                    toggling={togglingId === r.id}
                    onClick={() => setSelectedRider(r)}
                  />
                ))}
              </div>
            </div>
          )}

          {offlineRiders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">Off Duty ({offlineRiders.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70">
                {offlineRiders.map((r) => (
                  <RiderCard
                    key={r.id}
                    rider={r}
                    onToggle={(id, online) => onlineMutation.mutate({ id, online })}
                    toggling={togglingId === r.id}
                    onClick={() => setSelectedRider(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <RiderDetailSheet rider={selectedRider} onClose={() => setSelectedRider(null)} />
    </div>
  );
}
