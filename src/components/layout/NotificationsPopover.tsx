import { useState } from "react";
import { Bell, AlertTriangle, ShoppingCart, TrendingUp, Package, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LucideIcon } from "lucide-react";

interface Notification {
  id: number;
  icon: LucideIcon;
  color: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 1, icon: AlertTriangle, color: "text-amber-500 bg-amber-50", title: "Low stock alert", body: "Green Spinach is below 30 units.", time: "2 min ago", read: false },
  { id: 2, icon: ShoppingCart, color: "text-blue-500 bg-blue-50", title: "New order placed", body: "Organic Garlic order received.", time: "15 min ago", read: false },
  { id: 3, icon: TrendingUp, color: "text-green-500 bg-green-50", title: "Sales milestone", body: "₹50,000 revenue reached today!", time: "1 hr ago", read: true },
  { id: 4, icon: Package, color: "text-purple-500 bg-purple-50", title: "Procurement received", body: "Green Chillies marked as received.", time: "3 hr ago", read: true },
];

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const allRead = notifications.every((n) => n.read);

  const markRead = (id: number) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary">
          <Bell className="w-6 h-6" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background px-0.5"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl shadow-xl border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline font-medium">
              Mark all read
            </button>
          )}
        </div>

        <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${!n.read ? "bg-primary/[0.03]" : ""}`}
            >
              <div className={`p-2 rounded-xl shrink-0 h-fit ${n.color}`}>
                <n.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{n.title}</p>
                  {!n.read && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
              </div>
            </div>
          ))}
        </div>

        {allRead && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Check className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            You're all caught up!
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
