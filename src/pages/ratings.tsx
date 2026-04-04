import { PageHeader } from "@/components/shared/PageHeader";
import { Star, Construction } from "lucide-react";

export default function Ratings() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Ratings & Feedback"
        subtitle="View customer ratings and feedback for all orders."
      />

      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Star className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Coming Soon</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            The ratings and feedback system is not yet enabled in the backend.
            Once the backend endpoint is live, all customer ratings will appear here.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/50 rounded-full px-4 py-2">
          <Construction className="w-3.5 h-3.5" />
          Backend endpoint pending
        </div>
      </div>
    </div>
  );
}
