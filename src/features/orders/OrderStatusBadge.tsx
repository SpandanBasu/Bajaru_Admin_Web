const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  CONFIRMED:        { label: "Pending",          className: "bg-amber-100 text-amber-700 border-amber-200" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery",  className: "bg-blue-100 text-blue-700 border-blue-200" },
  DELIVERED:        { label: "Delivered",         className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:        { label: "Cancelled",         className: "bg-muted text-muted-foreground border-border" },
  REJECTED:         { label: "Rejected",          className: "bg-red-100 text-red-700 border-red-200" },
};

interface OrderStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function OrderStatusBadge({ status, size = "md" }: OrderStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${px} ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function PaymentBadge({ isCOD }: { isCOD: boolean }) {
  return isCOD
    ? <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 border-orange-200">COD</span>
    : <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 border-violet-200">Online</span>;
}
