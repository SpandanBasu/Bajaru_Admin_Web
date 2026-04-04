import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingBasket, Truck, ClipboardList, LogOut,
  HeadphonesIcon, Star, Shield, Bike,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

export function Sidebar() {
  const [location] = useLocation();
  const { signOut } = useAppStore();

  const navItems = [
    { name: "Dashboard",    href: "/",            icon: LayoutDashboard },
    { name: "Orders",       href: "/orders",       icon: ClipboardList },
    { name: "Products",     href: "/products",     icon: ShoppingBasket },
    { name: "Procurement",  href: "/procurement",  icon: Truck },
    { name: "Riders",       href: "/riders",       icon: Bike },
    { name: "Customers",    href: "/customers",    icon: HeadphonesIcon },
    { name: "Ratings",      href: "/ratings",      icon: Star },
    { name: "Permissions",  href: "/permissions",  icon: Shield },
  ];

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen fixed left-0 top-0 shadow-xl z-20">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
        <img src="/app-icon.png" alt="Bajaru logo" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
        <h1 className="text-xl font-bold font-display tracking-wide text-white">
          Bajaru<span className="text-primary-foreground/70 font-normal">Admin</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md font-medium"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
                }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-sidebar-foreground/60 group-hover:text-white"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sidebar-foreground/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
