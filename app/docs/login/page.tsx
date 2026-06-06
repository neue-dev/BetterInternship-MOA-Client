"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderIcon, HeaderText } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { requestLoginOtp, verifyLoginOtp } from "@/app/api/docs.api";

function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<HTMLInputElement[]>([]);
  const vals = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusAt = (i: number) => refs.current[i]?.focus();

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const key = e.key;

    if (key === "Backspace") {
      if (vals[i]) {
        // clear current
        const next = value.substring(0, i) + "" + value.substring(i + 1);
        onChange(next);
      } else if (i > 0) {
        focusAt(i - 1);
        // also clear previous
        const next = value.substring(0, i - 1) + "" + value.substring(i);
        onChange(next);
      }
      e.preventDefault();
    }

    if (key === "ArrowLeft" && i > 0) {
      focusAt(i - 1);
      e.preventDefault();
    }
    if (key === "ArrowRight" && i < length - 1) {
      focusAt(i + 1);
      e.preventDefault();
    }
  };

  const onChangeBox = (i: number, s: string) => {
    if (disabled) return;
    const onlyDigits = s.replace(/\D/g, "").slice(0, 1);
    if (!onlyDigits && s) return;

    const next = value.substring(0, i) + (onlyDigits || "") + value.substring(i + 1);
    onChange(next);

    if (onlyDigits && i < length - 1) focusAt(i + 1);
  };

  const onPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const clip = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!clip) return;
    e.preventDefault();

    const next = value.split("");
    for (let k = 0; k < clip.length && i + k < length; k++) {
      next[i + k] = clip[k];
    }
    onChange(next.join(""));

    const last = Math.min(i + clip.length - 1, length - 1);
    focusAt(last);
  };

  return (
    <div className="flex items-center gap-2">
      {vals.map((ch, i) => (
        <Input
          key={i}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={ch}
          disabled={disabled}
          onKeyDown={(e) => onKey(i, e)}
          onChange={(e) => onChangeBox(i, e.target.value)}
          onPaste={(e) => onPaste(i, e)}
          className="h-11 w-11 text-center text-lg tracking-widest"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

type Step = "email" | "otp";

export default function DocsLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("email");

  // email step
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // otp step
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState<string | null>(null);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [resendWait, setResendWait] = useState(0);

  useEffect(() => {
    if (step !== "otp") return;

    const confirmRefresh = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", confirmRefresh);
    return () => window.removeEventListener("beforeunload", confirmRefresh);
  }, [step]);

  // countdown for resend
  useEffect(() => {
    if (!resentAt) return;
    const now = Date.now();
    const remain = Math.max(0, 60 - Math.floor((now - resentAt) / 1000));
    setResendWait(remain);

    if (remain <= 0) return;

    const t = setInterval(() => {
      const now2 = Date.now();
      const r = Math.max(0, 60 - Math.floor((now2 - resentAt) / 1000));
      setResendWait(r);
      if (r <= 0) clearInterval(t);
    }, 500);

    return () => clearInterval(t);
  }, [resentAt]);

  const validEmail = useMemo(() => {
    const em = email.trim();
    if (!em) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  }, [email]);

  const startOtpFlow = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setEmailErr(null);

    if (!validEmail) {
      setEmailErr("Enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const res = await requestLoginOtp(email.trim());
      if (!res.success) {
        setEmailErr(res.message);
        return;
      }
      setStep("otp");
      setOtp("");
      // start resend countdown. If the server provided `resendIn` (seconds), use it
      if (typeof res.resendIn === "number") {
        // server may give seconds remaining; our UI uses a 60s window, so adjust resentAt
        const resendIn = Math.max(0, res.resendIn);
        const assumedWindow = 60;
        const resentAtTs = Date.now() - (assumedWindow - resendIn) * 1000;
        setResentAt(resentAtTs);
      } else {
        setResentAt(Date.now());
      }
    } catch (error) {
      setEmailErr(error instanceof Error ? error.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setOtpErr(null);

    if (otp.length !== 6) {
      setOtpErr("Enter the 6-digit code we sent.");
      return;
    }

    setBusy(true);
    try {
      const res = await verifyLoginOtp(email.trim(), otp);
      if (!res.success) {
        setOtpErr(res.message);
        return;
      }
      // success → go to dashboard
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      router.push("/docs/dashboard");
    } catch (error) {
      setOtpErr(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendWait > 0) return;
    setBusy(true);
    try {
      const res = await requestLoginOtp(email.trim());
      if (!res.success) {
        setOtpErr(res.message);
        return;
      }
      if (typeof res.resendIn === "number") {
        const resendIn = Math.max(0, res.resendIn);
        const assumedWindow = 60;
        const resentAtTs = Date.now() - (assumedWindow - resendIn) * 1000;
        setResentAt(resentAtTs);
      } else {
        setResentAt(Date.now());
      }
    } catch (error) {
      setOtpErr(error instanceof Error ? error.message : "Failed to resend code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex h-full max-w-lg flex-col overflow-hidden px-4 pt-10 sm:px-10 sm:pt-16">
      <div className="mb-6 space-y-4 sm:mb-8">
        <div className="flex items-center gap-3">
          <HeaderIcon icon={Lock} />
          <HeaderText>Sign in to Docs</HeaderText>
        </div>
        <p className="text-sm text-gray-600 sm:text-base">
          You will receive a one-time password to login.
        </p>
      </div>

      {step === "email" && (
        <Card className="space-y-4 p-5 sm:p-6">
          <form className="space-y-4" onSubmit={(e) => void startOtpFlow(e)} noValidate>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Email</label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className=""
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {emailErr && <p className="mt-1 text-xs text-red-600">{emailErr}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </span>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </Card>
      )}

      {step === "otp" && (
        <Card className="gap-4 p-5 sm:p-6">
          <div className="">
            <div className="text-sm font-medium">Enter the 6-digit code</div>
            <p className="text-muted-foreground text-sm">
              We sent a code to <span className="font-medium">{email}</span>.
            </p>
          </div>

          <form onSubmit={(e) => void verifyOtp(e)} className="space-y-4" noValidate>
            <div className="flex flex-col items-center">
              <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            </div>
            {otpErr && <p className="text-xs text-red-600">{otpErr}</p>}

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-primary underline underline-offset-4"
                disabled={busy}
              >
                Use a different email
              </button>

              <button
                type="button"
                onClick={() => void resend()}
                className={`underline underline-offset-4 ${resendWait > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary"}`}
                disabled={busy || resendWait > 0}
                aria-disabled={busy || resendWait > 0}
                title={resendWait > 0 ? `Try again in ${resendWait}s` : "Resend code"}
              >
                {resendWait > 0 ? `Resend in ${resendWait}s` : "Resend code"}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify & Continue"
              )}
            </Button>
          </form>

          <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
            <ShieldCheck className="h-4 w-4" />
            Your one-time passcode expires shortly for your security.
          </div>
        </Card>
      )}

      <div className="hidden min-h-0 flex-1 overflow-hidden sm:block">
        <img className="mx-auto w-3/4" src="/login.png" alt="Login graphic" />
      </div>
    </div>
  );
}
