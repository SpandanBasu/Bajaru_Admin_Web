import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}
