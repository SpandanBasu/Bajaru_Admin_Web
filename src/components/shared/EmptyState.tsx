import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-20 bg-card rounded-2xl border border-border/50", className)}>
      <Icon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}
