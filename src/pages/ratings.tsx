import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminRatings } from "@/lib/api/adminApi";
import type { AdminRatingItem, AdminRatingsFilter } from "@/lib/api/adminApi";
import {
  Star, MessageSquare, ChevronLeft, ChevronRight, RefreshCw,
  SlidersHorizontal, X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Star display ─────────────────────────────────────────────────────────────

function StarRow({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "md" }) {
  if (rating === null) return <span className="text-xs text-muted-foreground italic">No star rating</span>;
  const cls = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= rating ? "fill-amber-400 text-amber-400" : "fill-none text-border"}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-foreground">{rating}/5</span>
    </div>
  );
}

// ─── Rating colour by score ───────────────────────────────────────────────────

function ratingColor(rating: number | null): string {
  if (rating === null) return "border-border/50 bg-card";
  if (rating <= 2) return "border-red-200 bg-red-50/50";
  if (rating === 3) return "border-amber-200 bg-amber-50/50";
  return "border-green-200 bg-green-50/50";
}

// ─── Rating card ──────────────────────────────────────────────────────────────

function RatingCard({ item }: { item: AdminRatingItem }) {
  return (
    <div className={`rounded-xl border p-4 space-y-2.5 ${ratingColor(item.rating)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{item.customerName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.phone ?? "—"}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <StarRow rating={item.rating} />
          <p className="text-xs text-muted-foreground">{fmtDate(item.deliveredAt)}</p>
        </div>
      </div>
      {item.feedback ? (
        <div className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2 border border-white/80">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed">{item.feedback}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No written feedback</p>
      )}
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors
        ${active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        }`}
    >
      {label}
      {active && <X className="w-3 h-3 opacity-70" />}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: AdminRatingsFilter["sort"]; label: string }[] = [
  { value: "recent",  label: "Most Recent" },
  { value: "oldest",  label: "Oldest First" },
  { value: "lowest",  label: "Lowest Rating" },
  { value: "highest", label: "Highest Rating" },
];

export default function Ratings() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<AdminRatingsFilter>({ sort: "recent" });

  // Changing any filter resets to page 0
  function applyFilter(patch: Partial<AdminRatingsFilter>) {
    setFilter((prev) => ({ ...prev, ...patch }));
    setPage(0);
  }

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-ratings", page, filter],
    queryFn: () => getAdminRatings(page, PAGE_SIZE, filter),
    staleTime: 60_000,
  });

  const items = data?.content ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const fromItem = page * PAGE_SIZE + 1;
  const toItem = Math.min((page + 1) * PAGE_SIZE, total);

  const ratedItems = items.filter((i) => i.rating !== null);
  const avgRating = ratedItems.length
    ? (ratedItems.reduce((s, i) => s + (i.rating ?? 0), 0) / ratedItems.length).toFixed(1)
    : null;

  const activeFilterCount =
    (filter.maxRating !== undefined ? 1 : 0) +
    (filter.hasFeedback ? 1 : 0) +
    (filter.sort !== "recent" ? 1 : 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <PageHeader
        title="Ratings & Feedback"
        subtitle={total > 0
          ? `${total} rating${total !== 1 ? "s" : ""} received from customers`
          : "View customer ratings and feedback for delivered orders."}
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

      {/* ── Filter bar ── */}
      <div className="rounded-2xl border border-border/50 bg-card px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
              {activeFilterCount}
            </span>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setFilter({ sort: "recent" }); setPage(0); }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset all
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort selector */}
          <Select
            value={filter.sort ?? "recent"}
            onValueChange={(v) => applyFilter({ sort: v as AdminRatingsFilter["sort"] })}
          >
            <SelectTrigger className="h-8 text-xs rounded-xl border-border/50 bg-secondary/40 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value!} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-border/50 mx-1" />

          {/* Low ratings filter chip */}
          <FilterChip
            label="3★ and below"
            active={filter.maxRating === 3}
            onClick={() =>
              applyFilter({ maxRating: filter.maxRating === 3 ? undefined : 3 })
            }
          />

          {/* 1–2 stars only */}
          <FilterChip
            label="1–2★ only"
            active={filter.maxRating === 2}
            onClick={() =>
              applyFilter({ maxRating: filter.maxRating === 2 ? undefined : 2 })
            }
          />

          {/* Has feedback */}
          <FilterChip
            label="Has written feedback"
            active={!!filter.hasFeedback}
            onClick={() => applyFilter({ hasFeedback: !filter.hasFeedback })}
          />
        </div>
      </div>

      {/* ── Summary stats ── */}
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {activeFilterCount > 0 ? "Matching Ratings" : "Total Ratings"}
            </p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
          {avgRating && (
            <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Avg (this page)</p>
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

      {/* ── Content ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Star className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {activeFilterCount > 0 ? "No ratings match these filters" : "No ratings yet"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {activeFilterCount > 0
                ? "Try removing some filters to see more results."
                : "Ratings will appear here once customers start rating their delivered orders."}
            </p>
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => { setFilter({ sort: "recent" }); setPage(0); }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RatingCard key={item.orderId} item={item} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">{fromItem}–{toItem}</span>{" "}
            of <span className="font-semibold text-foreground">{total}</span>
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
