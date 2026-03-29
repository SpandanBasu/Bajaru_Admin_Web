import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationsPopover } from "./NotificationsPopover";
import { ProfileMenu } from "./ProfileMenu";

export function Header() {
  return (
    <header className="h-20 bg-background/80 backdrop-blur-md border-b border-border/40 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex-1 max-w-md relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products or orders..."
          className="pl-10 bg-card border-border/50 rounded-xl shadow-sm focus-visible:ring-primary/20 h-11"
        />
      </div>
      <div className="flex items-center gap-6">
        <NotificationsPopover />
        <ProfileMenu />
      </div>
    </header>
  );
}
