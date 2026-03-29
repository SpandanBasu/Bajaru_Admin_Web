import { Separator } from "@/components/ui/separator";

interface SectionDividerProps {
  children: React.ReactNode;
}

export function SectionDivider({ children }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-sm font-bold text-foreground">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}
