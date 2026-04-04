import { useQuery } from "@tanstack/react-query";
import { Package, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CHART_DATA } from "@/lib/mock-data";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/features/dashboard/StatCard";
import { RevenueChart } from "@/features/dashboard/RevenueChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/api/adminApi";
import type { DashboardOverview } from "@/lib/api/adminApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRupees(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function shortId(id: string) {
  return "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

const PHASE_LABEL: Record<string, string> = {
  orderAccumulation: "Order Accumulation",
  procurement: "Procurement",
  packing: "Packing",
  dispatch: "Dispatch",
};

// ── Stats config (maps backend fields) ───────────────────────────────────────

const STATS_CONFIG: Array<{
  title: string;
  key: keyof DashboardOverview;
  icon: LucideIcon;
  color: string;
  bg: string;
  fmt?: (v: number) => string;
}> = [
  { title: "Orders Today",          key: "totalOrders",         icon: Package,       color: "text-blue-500",   bg: "bg-blue-500/10",   },
  { title: "Pending Packing",       key: "pendingItems",        icon: Clock,         color: "text-purple-500", bg: "bg-purple-500/10", },
  { title: "Completed Deliveries",  key: "completedDeliveries", icon: CheckCircle2,  color: "text-amber-500",  bg: "bg-amber-500/10",  },
  { title: "Revenue Today",         key: "totalRevenue",        icon: TrendingUp,    color: "text-primary",    bg: "bg-primary/10",    fmt: fmtRupees },
];

// ── Recent Deliveries ─────────────────────────────────────────────────────────

function RecentDeliveries({ data }: { data: DashboardOverview["recentDeliveries"] }) {
  return (
    <Card className="border-border/50 rounded-2xl shadow-sm">
      <CardHeader className="pb-3 pt-5 px-6">
        <p className="text-base font-bold font-display">Recent Deliveries</p>
        <p className="text-xs text-muted-foreground">Latest completed orders today</p>
      </CardHeader>
      <CardContent className="px-0 pb-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No deliveries yet today.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {data.map((d) => (
              <div key={d.orderId} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{d.customerName}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{d.address}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-primary">{fmtRupees(d.amount)}</p>
                  <p className="text-xs text-muted-foreground">{fmtTime(d.completedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  const phaseLabel = stats ? (PHASE_LABEL[stats.currentPhase] ?? stats.currentPhase) : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard Overview"
        subtitle={
          phaseLabel
            ? `Current phase: ${phaseLabel} · Here's what's happening in your store today.`
            : "Welcome back. Here's what's happening in your store today."
        }
      />

      {isLoading || !stats ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS_CONFIG.map((cfg, i) => {
            const raw = stats[cfg.key] as number;
            const value = cfg.fmt ? cfg.fmt(raw) : raw;
            return (
              <StatCard
                key={cfg.title}
                title={cfg.title}
                value={value}
                icon={cfg.icon}
                color={cfg.color}
                bg={cfg.bg}
                animationIndex={i}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueChart data={CHART_DATA} />
        {isLoading || !stats ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : (
          <RecentDeliveries data={stats.recentDeliveries} />
        )}
      </div>
    </div>
  );
}
