import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";

export function ProfileMenu() {
  const { userProfile, setUserProfile } = useAppStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", role: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = userProfile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const openDialog = () => {
    setDraft({ name: userProfile.name, role: userProfile.role });
    setAvatarPreview(null);
    setOpen(true);
  };

  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) setAvatarPreview(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    setUserProfile({
      name: draft.name || userProfile.name,
      role: draft.role || userProfile.role,
      avatarUrl: avatarPreview ?? userProfile.avatarUrl,
    });
    setOpen(false);
  };

  return (
    <>
      <div
        className="flex items-center gap-3 border-l border-border pl-6 cursor-pointer group"
        onClick={openDialog}
      >
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {userProfile.name}
          </p>
          <p className="text-xs text-muted-foreground">{userProfile.role}</p>
        </div>
        <div className="relative">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
            <AvatarImage src={userProfile.avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-background rounded-full flex items-center justify-center border border-border">
            <Camera className="w-2.5 h-2.5 text-muted-foreground" />
          </span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                  <AvatarImage src={avatarPreview ?? userProfile.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">{initials}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow hover:bg-primary/90 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline">
                Change photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="rounded-xl h-11" placeholder="e.g. Admin User" />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Role</Label>
              <Input value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} className="rounded-xl h-11" placeholder="e.g. Store Manager" />
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={save}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
