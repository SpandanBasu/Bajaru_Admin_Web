import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getAdminRatings } from "@/lib/api/adminApi";
import type { AdminRatingItem } from "@/lib/api/adminApi";
import { Star, MessageSquare, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function shortId(id: string) {
  return "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// ─── Star display ─────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">No rating</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-foreground">{rating}/5</span>
    </div>
  );
}

// ─── Rating card (mobile-friendly) ───────────────────────────────────────────

function RatingCard({ item }: { item: AdminRatingItem }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{item.customerName}</p>
          <p className="text-xs font-mono text-muted-foreground">{shortId(item.orderId)}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <StarRow rating={item.rating} />
          <p className="text-xs text-muted-foreground">{fmtDate(item.deliveredAt)}</p>
        </div>
      </div>
      {item.feedback ? (
        <div className="flex items-start gap-2 bg-secondary/40 rounded-lg px-3 py-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed">{item.feedback}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No written feedback</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function Ratings() {
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-ratings", page],
    queryFn: () => getAdminRatings(page, PAGE_SIZE),
    staleTime: 60_000,
  });

  const items = data?.content ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const fromItem = page * PAGE_SIZE + 1;
  const toItem = Math.min((page + 1) * PAGE_SIZE, total);

  // Average rating from current page (approximate)
  const ratedItems = items.filter((i) => i.rating !== null);
  const avgRating = ratedItems.length
    ? (ratedItems.reduce((s, i) => s + (i.rating ?? 0), 0) / ratedItems.length).toFixed(1)
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Ratings & Feedback"
        subtitle={total > 0 ? `${total} rating${total !== 1 ? "s" : ""} received from customers` : "View customer ratings and feedback for delivered orders."}
      >
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </PageHeader>

      {/* Summary row */}
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Ratings</p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
          {avgRating && (
            <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Avg Rating (this page)</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <p className="text-2xl font-bold text-foreground">{avgRating}</p>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">With Feedback</p>
            <p className="text-2xl font-bold text-foreground">
              {items.filter((i) => i.feedback).length}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {items.length}</span>
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Star className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">No ratings yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Ratings will appear here once customers start rating their delivered orders.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RatingCard key={item.orderId} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{fromItem}–{toItem}</span> of{" "}
            <span className="font-semibold text-foreground">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-1">Page {page + 1}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={!hasMore || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
