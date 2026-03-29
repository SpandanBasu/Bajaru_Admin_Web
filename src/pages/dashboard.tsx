import { Package, TrendingUp, Clock, Truck } from "lucide-react";
import { CHART_DATA, INITIAL_PRODUCTS } from "@/lib/mock-data";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/features/dashboard/StatCard";
import { RevenueChart } from "@/features/dashboard/RevenueChart";
import { LowStockList } from "@/features/dashboard/LowStockList";
import type { Product } from "@/lib/types";

const STATS_CONFIG = [
  { title: "Orders Today",       key: "ordersToday",      icon: Package,       color: "text-blue-500",   bg: "bg-blue-500/10"   },
  { title: "Pending Packing",    key: "pendingPacking",   icon: Clock,         color: "text-purple-500", bg: "bg-purple-500/10" },
  { title: "Active Deliveries",  key: "activeDeliveries", icon: Truck,         color: "text-amber-500",  bg: "bg-amber-500/10"  },
  { title: "Revenue Today",      key: "revenueToday",     icon: TrendingUp,    color: "text-primary",    bg: "bg-primary/10"    },
] as const;

const MOCK_STATS = {
  ordersToday:      42,
  pendingPacking:   8,
  activeDeliveries: 15,
  revenueToday:     "₹24,500",
};

export default function Dashboard() {
  const lowStockProducts: Product[] = INITIAL_PRODUCTS
    .filter((p) => p.stock < 50);

  const statValues: Record<string, string | number> = {
    ordersToday:      MOCK_STATS.ordersToday,
    pendingPacking:   MOCK_STATS.pendingPacking,
    activeDeliveries: MOCK_STATS.activeDeliveries,
    revenueToday:     MOCK_STATS.revenueToday,
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard Overview"
        subtitle="Welcome back. Here's what's happening in your store today."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS_CONFIG.map((stat, i) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={statValues[stat.key]}
            icon={stat.icon}
            color={stat.color}
            bg={stat.bg}
            animationIndex={i}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueChart data={CHART_DATA} />
        <LowStockList products={lowStockProducts} />
      </div>
    </div>
  );
}
