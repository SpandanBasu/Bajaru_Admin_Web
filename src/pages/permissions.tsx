import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  checkSuperAdmin, listAllowedAdmins, addAllowedAdmin, removeAllowedAdmin,
  listAllowedRiders, addAllowedRider, removeAllowedRider, getWarehouses,
  generateRiderMagicLink,
} from "@/lib/api/adminApi";
import type { AllowedAdminEntry, AllowedRiderEntry, MagicLinkResult } from "@/lib/api/adminApi";
import {
  Shield, ShieldCheck, UserPlus, Trash2, Search, Bike, AlertTriangle, Link2, Copy, CheckCheck, Clock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function filterBySearch<T extends { name: string; phoneNumber: string }>(items: T[], q: string) {
  if (!q) return items;
  const lower = q.toLowerCase();
  return items.filter((i) => i.name.toLowerCase().includes(lower) || i.phoneNumber.includes(lower));
}

// ── Magic Link Display ────────────────────────────────────────────────────────
// Reused both in AddRiderDialog (post-add state) and MagicLinkDialog.
// The Copy button copies the full WhatsApp-ready greeting message, not just the URL.

function buildGreeting(riderName: string, magicLink: string): string {
  return `Hi ${riderName}! 👋\n\nPlease use the link below to log in to the Bajaru Delivery rider app:\n\n${magicLink}\n\nThis link can only be used once and expires in 24 hours. Tap it on your phone to sign in instantly.`;
}

function MagicLinkBox({ result, riderName }: { result: MagicLinkResult; riderName: string }) {
  const [copied, setCopied] = useState(false);

  const greeting = buildGreeting(riderName, result.magicLink);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(greeting);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard without user interaction
      const ta = document.createElement("textarea");
      ta.value = greeting;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const hours = Math.round(result.expiresIn / 3600);

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-800">Login link ready</p>
          <p className="text-xs text-green-600">Copy the message below and send to <strong>{riderName}</strong>.</p>
        </div>
      </div>

      {/* Message preview — what gets copied */}
      <div className="rounded-lg border border-green-200 bg-white px-3 py-2.5 space-y-1">
        <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-1.5">Message preview</p>
        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed select-all">
          {greeting}
        </p>
      </div>

      {/* Copy button + expiry */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Expires in {hours} hour{hours !== 1 ? "s" : ""} · one-time use
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`shrink-0 gap-1.5 border-green-200 transition-colors ${
            copied
              ? "bg-green-600 text-white border-green-600 hover:bg-green-600"
              : "bg-white text-green-700 hover:bg-green-50"
          }`}
          onClick={handleCopy}
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Message"}
        </Button>
      </div>
    </div>
  );
}

// ── Magic Link Dialog (for existing riders) ───────────────────────────────────

function MagicLinkDialog({
  rider, open, onClose,
}: { rider: AllowedRiderEntry | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => generateRiderMagicLink(rider!.phoneNumber),
    onError: () => {
      toast({ title: "Failed to generate link", description: "Please try again.", variant: "destructive" });
    },
  });

  // Auto-generate when the dialog opens
  const handleOpen = (v: boolean) => {
    if (!v) { onClose(); return; }
  };

  // Trigger generation when rider changes and dialog becomes visible
  const wasOpen = open && rider !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpen}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Login Link — {rider?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a one-time magic login link for{" "}
            <strong>{rider?.name}</strong> ({rider?.phoneNumber}).
            Send it via WhatsApp — the rider taps it to sign in instantly.
          </p>

          {mutation.data ? (
            <MagicLinkBox result={mutation.data} riderName={rider?.name ?? ""} />
          ) : (
            <Button
              className="w-full"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <>
                  <span className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                  Generating…
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Generate Login Link
                </>
              )}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {mutation.data && (
            <Button
              variant="ghost"
              onClick={() => { mutation.reset(); mutation.mutate(); }}
              disabled={mutation.isPending}
              className="text-muted-foreground"
            >
              Generate New Link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Admin Dialog ──────────────────────────────────────────────────────────

function AddAdminDialog({
  open, isSuperAdmin: currentUserIsSuperAdmin, onClose, onAdded,
}: { open: boolean; isSuperAdmin: boolean; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [makeSuperAdmin, setMakeSuperAdmin] = useState(false);

  const mutation = useMutation({
    mutationFn: () => addAllowedAdmin(phone.trim(), name.trim(), makeSuperAdmin),
    onSuccess: () => {
      toast({ title: "Admin added", description: `${name} can now log in to the Admin app.` });
      setPhone(""); setName(""); setMakeSuperAdmin(false);
      onAdded();
      onClose();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast({
        title: status === 409 ? "Already registered" : "Failed to add admin",
        description: status === 409 ? "This phone number is already an admin." : "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="admin-phone">Phone Number</Label>
            <Input
              id="admin-phone"
              placeholder="+91XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="admin-name">Name</Label>
            <Input
              id="admin-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          {currentUserIsSuperAdmin && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="admin-super"
                checked={makeSuperAdmin}
                onCheckedChange={(v) => setMakeSuperAdmin(!!v)}
              />
              <Label htmlFor="admin-super">Make Super Admin</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!phone.trim() || !name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Adding…" : "Add Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Rider Dialog ──────────────────────────────────────────────────────────
//
// Three internal states:
//   "form"    → rider details input
//   "linking" → rider added, auto-generating magic link
//   "done"    → magic link ready to copy

type AddRiderStep = "form" | "linking" | "done";

function AddRiderDialog({
  open, onClose, onAdded,
}: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [step, setStep] = useState<AddRiderStep>("form");
  const [magicLink, setMagicLink] = useState<MagicLinkResult | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  const reset = () => {
    setPhone(""); setName(""); setWarehouseId("");
    setStep("form"); setMagicLink(null);
  };

  const handleClose = () => { reset(); onClose(); };

  // Step 1: add rider to whitelist
  const addMutation = useMutation({
    mutationFn: () => addAllowedRider(phone.trim(), name.trim(), warehouseId),
    onSuccess: () => {
      onAdded(); // refresh the riders list in the background
      setStep("linking");
      linkMutation.mutate(); // immediately kick off link generation
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast({
        title: status === 409 ? "Already registered" : "Failed to add rider",
        description: status === 409 ? "This phone number is already a rider." : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Step 2: generate the magic link
  const linkMutation = useMutation({
    mutationFn: () => generateRiderMagicLink(phone.trim()),
    onSuccess: (result) => {
      setMagicLink(result);
      setStep("done");
    },
    onError: () => {
      // Link generation failed, but the rider was already added — close and let
      // the admin use the per-row "Get Login Link" button instead.
      toast({
        title: "Rider added",
        description: `${name} was added. Use "Get Login Link" on their row to generate a link.`,
      });
      handleClose();
    },
  });

  const currentName = name.trim() || "the rider";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {step === "form"    ? "Add Rider"              : ""}
            {step === "linking" ? "Adding Rider…"          : ""}
            {step === "done"    ? "Rider Added — Share Link" : ""}
          </DialogTitle>
        </DialogHeader>

        {/* ── Form step ── */}
        {step === "form" && (
          <>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="rider-phone">Phone Number</Label>
                <Input
                  id="rider-phone"
                  placeholder="+91XXXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="rider-name">Name</Label>
                <Input
                  id="rider-name"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Warehouse</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.warehouseId} value={w.warehouseId}>
                        {w.displayName} — {w.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                disabled={!phone.trim() || !name.trim() || !warehouseId || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? "Adding…" : "Add Rider"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Generating link step ── */}
        {step === "linking" && (
          <div className="py-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-sm text-foreground">Generating login link…</p>
              <p className="text-xs text-muted-foreground">{currentName} has been added. Creating their login link.</p>
            </div>
          </div>
        )}

        {/* ── Done step — magic link ready ── */}
        {step === "done" && magicLink && (
          <>
            <div className="py-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{currentName}</strong> has been added to the rider whitelist.
                Copy the link below and send it on WhatsApp — they tap it to log in instantly.
              </p>
              <MagicLinkBox result={magicLink} riderName={currentName} />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => { linkMutation.reset(); linkMutation.mutate(); }}
                disabled={linkMutation.isPending}
              >
                Generate New Link
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Remove Confirm Dialog ─────────────────────────────────────────────────────

function RemoveConfirmDialog({
  open, name, onCancel, onConfirm, isPending,
}: { open: boolean; name: string; onCancel: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Remove Access
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{name}</strong>? They will no longer be able to log in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-500 hover:bg-red-600"
          >
            {isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Admins Tab ────────────────────────────────────────────────────────────────

function AdminsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AllowedAdminEntry | null>(null);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["allowed-admins"],
    queryFn: listAllowedAdmins,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeAllowedAdmin(removeTarget!.phoneNumber),
    onSuccess: () => {
      toast({ title: "Admin removed" });
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["allowed-admins"] });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const filtered = filterBySearch(admins, search);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search admins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setAddOpen(true)} className="rounded-xl">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Admin
            </Button>
          )}
        </div>

        {!isSuperAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            Only super admins can add or remove other admins.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/50 text-xs text-muted-foreground font-medium">
              {filtered.length} admin{filtered.length !== 1 ? "s" : ""}
            </div>
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No admins found.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        {admin.isSuperAdmin
                          ? <ShieldCheck className="w-4 h-4 text-primary" />
                          : <Shield className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {admin.name}
                          {admin.isSuperAdmin && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Super</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{admin.phoneNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-xs text-muted-foreground hidden sm:block">Added {fmtDate(admin.createdAt)}</p>
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setRemoveTarget(admin)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AddAdminDialog
        open={addOpen}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setAddOpen(false)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ["allowed-admins"] })}
      />

      <RemoveConfirmDialog
        open={!!removeTarget}
        name={removeTarget?.name ?? ""}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeMutation.mutate()}
        isPending={removeMutation.isPending}
      />
    </>
  );
}

// ── Riders Tab ────────────────────────────────────────────────────────────────

function RidersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AllowedRiderEntry | null>(null);
  const [linkTarget, setLinkTarget] = useState<AllowedRiderEntry | null>(null);

  const { data: riders = [], isLoading } = useQuery({
    queryKey: ["allowed-riders"],
    queryFn: listAllowedRiders,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  const warehouseMap = Object.fromEntries(warehouses.map((w) => [w.warehouseId, w.displayName]));

  const removeMutation = useMutation({
    mutationFn: () => removeAllowedRider(removeTarget!.phoneNumber),
    onSuccess: () => {
      toast({ title: "Rider removed" });
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["allowed-riders"] });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const filtered = filterBySearch(riders, search);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search riders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setAddOpen(true)} className="rounded-xl">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Rider
            </Button>
          )}
        </div>

        {!isSuperAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            Only super admins can add or remove riders. You can still generate login links for existing riders.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/50 text-xs text-muted-foreground font-medium">
              {filtered.length} rider{filtered.length !== 1 ? "s" : ""}
            </div>
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No riders found.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((rider) => (
                  <div key={rider.id} className="flex items-center justify-between px-4 py-3.5">
                    {/* Left: avatar + name */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                        <Bike className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{rider.name}</p>
                        <p className="text-xs text-muted-foreground">{rider.phoneNumber}</p>
                      </div>
                    </div>

                    {/* Right: warehouse badge + date + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {rider.warehouseId && (
                        <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full hidden sm:block">
                          {warehouseMap[rider.warehouseId] ?? rider.warehouseId}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground hidden md:block">Added {fmtDate(rider.createdAt)}</p>

                      {/* Get Login Link */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => setLinkTarget(rider)}
                        title="Generate login link"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Get Login Link</span>
                      </Button>

                      {/* Remove — super admins only */}
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setRemoveTarget(rider)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AddRiderDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ["allowed-riders"] })}
      />

      <MagicLinkDialog
        rider={linkTarget}
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
      />

      <RemoveConfirmDialog
        open={!!removeTarget}
        name={removeTarget?.name ?? ""}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeMutation.mutate()}
        isPending={removeMutation.isPending}
      />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Permissions() {
  const { data: isSuperAdmin = false } = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: checkSuperAdmin,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Permissions"
        subtitle={
          isSuperAdmin
            ? "Manage who can access the Admin and Rider apps."
            : "Manage who can access the Rider app."
        }
      />

      <Tabs defaultValue="riders">
        <TabsList className="mb-6">
          <TabsTrigger value="admins" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Admins
          </TabsTrigger>
          <TabsTrigger value="riders" className="flex items-center gap-2">
            <Bike className="w-4 h-4" />
            Riders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="mt-0">
          <AdminsTab isSuperAdmin={isSuperAdmin} />
        </TabsContent>

        <TabsContent value="riders" className="mt-0">
          <RidersTab isSuperAdmin={isSuperAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
