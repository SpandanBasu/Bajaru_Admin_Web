import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, ArrowLeft, Loader2, CheckCircle2, ShoppingBasket, BarChart3, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { sendOtp, verifyOtp } from "@/lib/api/apiClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: ShoppingBasket, label: "Real-time inventory tracking" },
  { icon: Truck,          label: "Seamless procurement management" },
  { icon: BarChart3,      label: "Analytics & business insights" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimer(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { response?: { data?: { error?: string; message?: string }; status?: number } };
    const msg = e.response?.data?.error ?? e.response?.data?.message;
    if (msg) return msg;
    const status = e.response?.status;
    if (status === 401) return "Invalid OTP or session expired.";
    if (status === 403) return "This number is not authorised to access this app.";
    if (status === 400) return "Invalid request. Please check your input.";
  }
  return "Something went wrong. Please try again.";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignIn() {
  const { signIn } = useAppStore();

  // ── Step state ──
  const [step, setStep] = useState<"phone" | "otp">("phone");

  // ── Phone step ──
  const [phone, setPhone] = useState("");

  // ── OTP step ──
  const [otpDigits, setOtpDigits] = useState(Array(4).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Timer / resend ──
  const [canResend, setCanResend] = useState(false);
  const [tooManyAttempts, setTooManyAttempts] = useState(false);
  const [sendCount, setSendCount] = useState(0);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Loading / error ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Cleanup on unmount ──
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Timer logic ──
  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCanResend(false);
    setTooManyAttempts(false);
    setTimer(seconds);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  // When timer reaches 0, decide canResend vs tooManyAttempts
  useEffect(() => {
    if (timer === 0 && step === "otp") {
      // sendCount is already incremented after each send
      // backend drives this via nextResendAfterSeconds being 0 when exhausted
      // If canResend/tooManyAttempts haven't been set by timer expiry, show resend
      setCanResend((prev) => !prev && !tooManyAttempts ? true : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer]);

  // ── Send OTP ──
  const handleSendOtp = async () => {
    if (phone.length !== 10) { setError("Enter a valid 10-digit phone number."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await sendOtp(phone);
      const newCount = sendCount + 1;
      setSendCount(newCount);
      setOtpDigits(Array(4).fill(""));
      setStep("otp");

      if (data.nextResendAfterSeconds > 0) {
        startTimer(data.nextResendAfterSeconds);
        setCanResend(false);
        setTooManyAttempts(false);
      } else {
        // Backend says no more resends
        setTimer(0);
        setCanResend(false);
        setTooManyAttempts(true);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await sendOtp(phone);
      const newCount = sendCount + 1;
      setSendCount(newCount);
      setOtpDigits(Array(4).fill(""));

      if (data.nextResendAfterSeconds > 0) {
        startTimer(data.nextResendAfterSeconds);
        setCanResend(false);
        setTooManyAttempts(false);
      } else {
        setTimer(0);
        setCanResend(false);
        setTooManyAttempts(true);
      }

      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ──
  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const digit = val.slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setError("");
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = "";
        setOtpDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!text) return;
    const next = Array(4).fill("");
    text.split("").forEach((ch, i) => { next[i] = ch; });
    setOtpDigits(next);
    inputRefs.current[Math.min(text.length, 3)]?.focus();
  };

  // ── Verify OTP ──
  const handleVerify = async () => {
    const code = otpDigits.join("");
    if (code.length < 4) { setError("Please enter the complete 4-digit OTP."); return; }
    setError("");
    setLoading(true);
    try {
      const auth = await verifyOtp(phone, code);
      signIn({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        expiresAt: Date.now() + auth.expiresIn * 1000,
        user: auth.user,
      });
    } catch (err) {
      setError(apiErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-sidebar flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/[0.03] pointer-events-none" />
        <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/[0.03] pointer-events-none" />
        <div className="absolute top-1/2 -right-20 w-56 h-56 rounded-full bg-primary/10 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <img src="/app-icon.png" alt="Bajaru" className="w-11 h-11 rounded-xl object-cover shadow-lg" />
          <span className="text-2xl font-bold font-display text-white tracking-wide">
            Bajaru<span className="text-white/50 font-normal">Admin</span>
          </span>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-display font-bold text-white leading-tight">
              Manage your store<br />
              <span className="text-primary">with confidence.</span>
            </h2>
            <p className="text-white/60 text-lg leading-relaxed">
              Everything you need to run your business — in one clean dashboard.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-white/75 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-white/30 text-xs relative z-10">
          © {new Date().getFullYear()} Bajaru. All rights reserved.
        </p>
      </div>

      {/* ── Right sign-in panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/app-icon.png" alt="Bajaru" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-lg font-bold font-display">BajaruAdmin</span>
          </div>

          {step === "phone" ? (
            <PhoneStep
              phone={phone}
              setPhone={setPhone}
              onSend={handleSendOtp}
              loading={loading}
              error={error}
              setError={setError}
            />
          ) : (
            <OtpStep
              phone={phone}
              otpDigits={otpDigits}
              inputRefs={inputRefs}
              onDigitChange={handleOtpChange}
              onKeyDown={handleOtpKeyDown}
              onPaste={handleOtpPaste}
              onVerify={handleVerify}
              onResend={handleResend}
              onChangeNumber={() => { setStep("phone"); setOtpDigits(Array(4).fill("")); setError(""); }}
              timer={timer}
              canResend={canResend}
              tooManyAttempts={tooManyAttempts}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Phone step ───────────────────────────────────────────────────────────────

interface PhoneStepProps {
  phone: string;
  setPhone: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
}

function PhoneStep({ phone, setPhone, onSend, loading, error, setError }: PhoneStepProps) {
  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-display font-bold text-foreground">Welcome back</h1>
        <p className="text-muted-foreground">Enter your phone number to receive an OTP.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Phone Number</label>
          <div className={`flex rounded-xl overflow-hidden border-2 transition-colors h-12
            ${error ? "border-destructive" : "border-border/60 focus-within:border-primary"}`}
          >
            <div className="flex items-center gap-1.5 px-3.5 border-r border-border/60 bg-muted/40 shrink-0">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground select-none">+91</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhone(val);
                setError("");
              }}
              onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
              placeholder="98765 43210"
              className="flex-1 px-4 bg-transparent outline-none text-sm tracking-widest font-mono placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <Button
          className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20"
          onClick={onSend}
          disabled={loading || phone.length !== 10}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? "Sending OTP…" : "Send OTP"}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our Terms of Service.
      </p>
    </div>
  );
}

// ─── OTP step ─────────────────────────────────────────────────────────────────

interface OtpStepProps {
  phone: string;
  otpDigits: string[];
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onDigitChange: (i: number, val: string) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onVerify: () => void;
  onResend: () => void;
  onChangeNumber: () => void;
  timer: number;
  canResend: boolean;
  tooManyAttempts: boolean;
  loading: boolean;
  error: string;
}

function OtpStep({
  phone, otpDigits, inputRefs,
  onDigitChange, onKeyDown, onPaste,
  onVerify, onResend, onChangeNumber,
  timer, canResend, tooManyAttempts,
  loading, error,
}: OtpStepProps) {
  const filled = otpDigits.filter(Boolean).length;

  // Auto-verify when all 4 digits entered
  useEffect(() => {
    if (filled === 4) onVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-display font-bold text-foreground">Enter OTP</h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            Sent to <span className="font-semibold text-foreground">+91 {phone}</span>
          </p>
          <button
            onClick={onChangeNumber}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            <ArrowLeft className="w-3 h-3" /> Change
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* 4-digit OTP boxes */}
        <div className="flex gap-2.5 justify-between">
          {otpDigits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => onDigitChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={i === 0 ? onPaste : undefined}
              className={`w-full aspect-square max-w-[52px] text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-secondary/50
                ${digit ? "border-primary bg-primary/5 text-primary" : "border-border/60 text-foreground"}
                focus:border-primary focus:bg-background focus:ring-0`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        {/* Verify button */}
        <Button
          className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20"
          onClick={onVerify}
          disabled={loading || filled < 4}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          {loading ? "Verifying…" : "Verify & Sign In"}
        </Button>

        {/* Resend section */}
        <div className="text-center">
          {timer > 0 && (
            <p className="text-sm text-muted-foreground">
              Resend OTP in{" "}
              <span className="font-bold text-foreground tabular-nums">{formatTimer(timer)}</span>
            </p>
          )}
          {canResend && (
            <button
              onClick={onResend}
              disabled={loading}
              className="text-sm text-primary hover:underline font-semibold disabled:opacity-50"
            >
              {loading ? "Sending…" : "Resend OTP"}
            </button>
          )}
          {tooManyAttempts && (
            <p className="text-sm text-muted-foreground">
              Too many attempts.{" "}
              <span className="text-destructive font-semibold">Please try again later.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
