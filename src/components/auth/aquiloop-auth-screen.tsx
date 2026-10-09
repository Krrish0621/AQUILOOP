"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  resendSignUpCode,
} from "aws-amplify/auth";
import {
  CloudRain,
  Coins,
  Sprout,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  RefreshCw,
  Droplets,
} from "lucide-react";
import {
  useCurrentRole,
  AquiloopRole,
  PublicSignupRole,
  ROLE_META,
  savePendingSignupRole,
  getPendingSignupRole,
} from "@/lib/auth-context";
import {
  formatCognitoError,
  logAuthDiagnostic,
  validateSignupEmail,
  validateSignupPassword,
} from "@/lib/auth-errors";

type AuthMode = "SIGN_IN" | "SIGN_UP" | "CONFIRM_SIGN_UP";

interface DemoRoleOption {
  role: AquiloopRole;
  label: string;
  demoEmail: string;
  selfSignupAllowed: boolean;
}

const DEMO_ROLES: DemoRoleOption[] = [
  {
    role: "OPERATOR",
    label: "Operator",
    demoEmail: "operator.demo@aquiloop.test",
    selfSignupAllowed: false,
  },
  {
    role: "WORKER",
    label: "Worker",
    demoEmail: "worker.demo@aquiloop.test",
    selfSignupAllowed: true,
  },
  {
    role: "FARMER",
    label: "Farmer",
    demoEmail: "farmer.demo@aquiloop.test",
    selfSignupAllowed: true,
  },
  {
    role: "BUYER",
    label: "Buyer",
    demoEmail: "buyer.demo@aquiloop.test",
    selfSignupAllowed: true,
  },
];

const FEATURE_CARDS = [
  {
    id: "monsoonloop",
    title: "MONSOONLOOP",
    subtitle: "Flood Prevention",
    description:
      "Track 72-hour rainfall against ward drainage capacity and dispatch crews before waterlogging starts.",
    icon: CloudRain,
    accentClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
  },
  {
    id: "flood-bounties",
    title: "FLOOD & WASTE BOUNTIES",
    subtitle: "Drain Clearance",
    description:
      "Claim blocked storm drain jobs, upload before-and-after cleanup photos, and earn verified rewards.",
    icon: Coins,
    accentClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  },
  {
    id: "stubble-to-water",
    title: "STUBBLE-TO-WATER",
    subtitle: "Residue Recovery",
    description:
      "List post-harvest straw for scheduled buyer pickup to prevent open burning and protect soil moisture.",
    icon: Sprout,
    accentClass: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  },
];

const RESEND_COOLDOWN_SECONDS = 30;

async function checkAccountSignupStatus(
  email: string
): Promise<"UNCONFIRMED" | "CONFIRMED" | "NOT_FOUND" | "UNKNOWN"> {
  try {
    const res = await fetch("/api/auth/assign-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CHECK_SIGNUP_STATUS",
        email: email.trim().toLowerCase(),
      }),
      cache: "no-store",
    });
    if (!res.ok) return "UNKNOWN";
    const data = (await res.json()) as { userStatus?: string };
    if (
      data.userStatus === "UNCONFIRMED" ||
      data.userStatus === "CONFIRMED" ||
      data.userStatus === "NOT_FOUND"
    ) {
      return data.userStatus;
    }
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export function AquiloopAuthScreen() {
  const router = useRouter();
  const { refreshSession } = useCurrentRole();

  const [mode, setMode] = useState<AuthMode>("SIGN_IN");
  const [selectedRole, setSelectedRole] = useState<AquiloopRole | null>(null);
  const [signupRole, setSignupRole] = useState<PublicSignupRole>("WORKER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [deliveryDestination, setDeliveryDestination] = useState<string | null>(
    null
  );

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [localDemoPassword, setLocalDemoPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/demo-credentials", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.available && typeof data.password === "string") {
          setLocalDemoPassword(data.password);
        }
      })
      .catch(() => {
        // Ignore if unavailable
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setInfoMessage(null);
    if (nextMode === "CONFIRM_SIGN_UP" && email.trim()) {
      const storedRole = getPendingSignupRole(email);
      if (storedRole) {
        setSignupRole(storedRole);
      }
    }
  };

  const executeSignInAndNavigate = async (
    targetEmail: string,
    targetPassword: string,
    pendingSignupRole?: PublicSignupRole,
    fallbackRole?: AquiloopRole
  ) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const effectiveSignupRole =
      pendingSignupRole ?? getPendingSignupRole(cleanEmail) ?? undefined;
    try {
      const result = await signIn({
        username: cleanEmail,
        password: targetPassword,
      });

      if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        if (effectiveSignupRole) {
          setSignupRole(effectiveSignupRole);
        }
        setMode("CONFIRM_SIGN_UP");
        setInfoMessage(
          `Your email (${cleanEmail}) is not verified yet. Enter your 6-digit verification code below, or click 'Resend verification code' to request a new one.`
        );
        return;
      }

      if (result.isSignedIn) {
        const resolvedRole = await refreshSession(effectiveSignupRole);
        const activeRole = resolvedRole ?? fallbackRole ?? effectiveSignupRole;
        if (activeRole && ROLE_META[activeRole]) {
          router.push(ROLE_META[activeRole].primaryHref);
        }
        return;
      }

      setErrorMessage("Additional verification is required to sign in.");
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name;
      if (errName === "UserAlreadyAuthenticatedException") {
        await signOut();
        const retryResult = await signIn({
          username: cleanEmail,
          password: targetPassword,
        });
        if (retryResult.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
          if (effectiveSignupRole) {
            setSignupRole(effectiveSignupRole);
          }
          setMode("CONFIRM_SIGN_UP");
          setInfoMessage(
            `Your email (${cleanEmail}) is not verified yet. Enter your 6-digit verification code below, or click 'Resend verification code' to request a new one.`
          );
          return;
        }
        if (retryResult.isSignedIn) {
          const resolvedRole = await refreshSession(effectiveSignupRole);
          const activeRole =
            resolvedRole ?? fallbackRole ?? effectiveSignupRole;
          if (activeRole && ROLE_META[activeRole]) {
            router.push(ROLE_META[activeRole].primaryHref);
          }
          return;
        }
      }
      throw err;
    }
  };

  const handleSelectDemoRole = async (option: DemoRoleOption) => {
    setErrorMessage(null);
    setInfoMessage(null);
    setMode("SIGN_IN");
    setSelectedRole(option.role);
    setEmail(option.demoEmail);
    setSubmitting(true);

    try {
      let pwd = localDemoPassword;
      if (!pwd) {
        const res = await fetch("/api/auth/demo-credentials", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.available && typeof data.password === "string") {
            pwd = data.password;
            setLocalDemoPassword(pwd);
          }
        }
      }

      if (!pwd) {
        setErrorMessage(
          "Demo login is only available in local development (.env.local)."
        );
        return;
      }

      setPassword(pwd);
      await executeSignInAndNavigate(
        option.demoEmail,
        pwd,
        undefined,
        option.role
      );
    } catch (err: unknown) {
      logAuthDiagnostic("demoSignIn", err, {
        email: option.demoEmail,
        role: option.role,
      });
      setErrorMessage(formatCognitoError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await executeSignInAndNavigate(
        cleanEmail,
        password,
        getPendingSignupRole(cleanEmail) ?? undefined,
        selectedRole ?? undefined
      );
    } catch (err: unknown) {
      logAuthDiagnostic("signIn", err, { email: cleanEmail });
      const errName = (err as { name?: string })?.name;
      if (errName === "UserNotConfirmedException") {
        const storedRole = getPendingSignupRole(cleanEmail);
        if (storedRole) {
          setSignupRole(storedRole);
        }
        setMode("CONFIRM_SIGN_UP");
        setInfoMessage(
          `Your email (${cleanEmail}) is not verified yet. Enter your 6-digit verification code below, or click 'Resend verification code' to request a new one.`
        );
      } else {
        setErrorMessage(formatCognitoError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailError = validateSignupEmail(cleanEmail);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    const passwordError = validateSignupPassword(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please try again.");
      return;
    }

    savePendingSignupRole(cleanEmail, signupRole);
    setSubmitting(true);
    try {
      const { nextStep, isSignUpComplete } = await signUp({
        username: cleanEmail,
        password,
        options: {
          userAttributes: {
            email: cleanEmail,
          },
        },
      });

      if (nextStep.signUpStep === "CONFIRM_SIGN_UP" && !isSignUpComplete) {
        const destination = nextStep.codeDeliveryDetails?.destination ?? null;
        const deliveryMedium = nextStep.codeDeliveryDetails?.deliveryMedium;
        setDeliveryDestination(destination);
        setMode("CONFIRM_SIGN_UP");

        if (destination && (!deliveryMedium || deliveryMedium === "EMAIL")) {
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          setInfoMessage(
            `Verification code sent to ${cleanEmail} (${destination}). Enter the 6-digit code below.`
          );
        } else {
          setResendCooldown(0);
          setErrorMessage(
            `Account created for ${cleanEmail}, but verification email delivery could not be confirmed. Click 'Resend verification code' below to request a code.`
          );
        }
        return;
      }

      if (isSignUpComplete) {
        await executeSignInAndNavigate(
          cleanEmail,
          password,
          signupRole,
          signupRole
        );
      }
    } catch (err: unknown) {
      logAuthDiagnostic("signUp", err, {
        email: cleanEmail,
        role: signupRole,
      });
      const errName = (err as { name?: string })?.name;

      if (errName === "UsernameExistsException") {
        const status = await checkAccountSignupStatus(cleanEmail);
        if (status === "UNCONFIRMED") {
          setResendCooldown(0);
          setMode("CONFIRM_SIGN_UP");
          setInfoMessage(
            `An account for ${cleanEmail} already exists and is awaiting email verification. Click 'Resend verification code' below to receive a new 6-digit OTP, or enter your existing code.`
          );
          return;
        }
        setErrorMessage(
          "An account with this email already exists. Please sign in instead."
        );
        return;
      }

      setErrorMessage(formatCognitoError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = confirmationCode.trim();

    const emailError = validateSignupEmail(cleanEmail);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
      setErrorMessage("Please enter a valid 6-digit verification code.");
      return;
    }

    const effectiveRole = getPendingSignupRole(cleanEmail) ?? signupRole;
    savePendingSignupRole(cleanEmail, effectiveRole);

    setSubmitting(true);
    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: cleanEmail,
        confirmationCode: cleanCode,
      });

      if (isSignUpComplete) {
        if (password) {
          await executeSignInAndNavigate(
            cleanEmail,
            password,
            effectiveRole,
            effectiveRole
          );
          return;
        }
        setMode("SIGN_IN");
        setInfoMessage("Email verified. You can now sign in.");
      }
    } catch (err: unknown) {
      logAuthDiagnostic("confirmSignUp", err, {
        email: cleanEmail,
        role: effectiveRole,
      });
      const errMsg = formatCognitoError(err);
      if (errMsg.toLowerCase().includes("already verified")) {
        setMode("SIGN_IN");
        setInfoMessage(errMsg);
      } else {
        setErrorMessage(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resending || resendCooldown > 0) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailError = validateSignupEmail(cleanEmail);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    savePendingSignupRole(cleanEmail, signupRole);
    setResending(true);
    try {
      const status = await checkAccountSignupStatus(cleanEmail);
      if (status === "CONFIRMED") {
        setMode("SIGN_IN");
        setInfoMessage(
          `This email (${cleanEmail}) is already verified. Please sign in with your password.`
        );
        return;
      }
      if (status === "NOT_FOUND") {
        setErrorMessage(
          `No unverified account was found for ${cleanEmail}. Please create an account first.`
        );
        return;
      }

      const deliveryDetails = await resendSignUpCode({ username: cleanEmail });
      const destination = deliveryDetails?.destination ?? null;
      setDeliveryDestination(destination);

      if (destination) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setInfoMessage(
          `A new 6-digit verification code has been sent to ${cleanEmail} (${destination}).`
        );
      } else {
        setErrorMessage(
          `Could not confirm verification code delivery to ${cleanEmail}. Please try again.`
        );
      }
    } catch (err: unknown) {
      logAuthDiagnostic("resendSignUpCode", err, {
        email: cleanEmail,
        role: signupRole,
      });
      setErrorMessage(formatCognitoError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground flex flex-col justify-between font-sans">
      {/* Restrained Blue / Cyan Atmospheric Lighting & Water-Signal Contour */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-36 -left-24 h-[480px] w-[620px] rounded-full bg-cyan-500/12 blur-[130px]" />
        <div className="absolute top-1/4 -right-24 h-[440px] w-[540px] rounded-full bg-sky-500/10 blur-[140px]" />
        <div className="absolute -bottom-32 left-1/3 h-[360px] w-[520px] rounded-full bg-blue-600/10 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(6, 182, 212, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <svg
          className="absolute inset-x-0 top-12 h-72 w-full opacity-25"
          viewBox="0 0 1440 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 160 C320 90, 620 210, 960 120 C1180 65, 1320 110, 1440 85"
            stroke="url(#aquiloopSignalGrad)"
            strokeWidth="1.5"
          />
          <path
            d="M0 195 C380 135, 700 225, 1040 150 C1240 105, 1350 140, 1440 120"
            stroke="url(#aquiloopSignalGrad)"
            strokeWidth="1"
            strokeDasharray="6 6"
          />
          <defs>
            <linearGradient id="aquiloopSignalGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
              <stop offset="35%" stopColor="#06B6D4" stopOpacity="0.65" />
              <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/35 shadow-[0_0_20px_rgba(6,182,212,0.2)] flex items-center justify-center">
            <Droplets className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            AQUILOOP
          </span>
        </div>
        <span className="text-xs font-medium text-cyan-300/80 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1">
          Delhi-NCR
        </span>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headline + 3 Feature Cards */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
              Turn rainfall, drain waste, and crop residue into local action.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
              Pre-storm flood prevention, verified drain cleanup bounties, and
              harvest straw collection across Delhi-NCR.
            </p>
          </div>

          {/* Three Feature Cards */}
          <div className="grid grid-cols-1 gap-4">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="group rounded-xl bg-surface/90 backdrop-blur-md border border-cyan-500/20 p-5 flex items-start gap-4 transition-all duration-200 hover:border-cyan-400/45 hover:bg-surface-elevated/90 hover:shadow-[0_8px_30px_rgba(6,182,212,0.08)]"
                >
                  <div
                    className={`p-2.5 rounded-lg border shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-105 ${card.accentClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-sm font-bold text-foreground tracking-tight">
                        {card.title}
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        · {card.subtitle}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Sign In / Create Account Card */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl bg-surface/95 backdrop-blur-xl border border-cyan-500/25 p-6 sm:p-8 shadow-[0_16px_48px_rgba(2,8,20,0.65),0_0_32px_rgba(6,182,212,0.07)] space-y-6">
            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-background border border-border">
              <button
                type="button"
                onClick={() => switchMode("SIGN_IN")}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === "SIGN_IN"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("SIGN_UP")}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === "SIGN_UP" || mode === "CONFIRM_SIGN_UP"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Active Mode Heading */}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                {mode === "SIGN_IN" && "Sign In"}
                {mode === "SIGN_UP" && "Create Account"}
                {mode === "CONFIRM_SIGN_UP" && "Verify Email"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "SIGN_IN" &&
                  "Sign in with your account or select a demo role below."}
                {mode === "SIGN_UP" &&
                  "Create a Worker, Farmer, or Buyer account."}
                {mode === "CONFIRM_SIGN_UP" &&
                  "Enter the 6-digit verification code sent to your email."}
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-2.5 text-xs text-danger">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Info Banner */}
            {infoMessage && (
              <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 flex items-start gap-2.5 text-xs text-success">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{infoMessage}</div>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === "SIGN_IN" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Compact Demo Role Selector: Operator | Worker | Farmer | Buyer */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Demo Role
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Click to sign in
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-background border border-border">
                    {DEMO_ROLES.map((option) => {
                      const isSelected = selectedRole === option.role;
                      return (
                        <button
                          key={option.role}
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleSelectDemoRole(option)}
                          data-testid={`demo-login-${option.role.toLowerCase()}`}
                          className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                          } disabled:opacity-50`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:opacity-95 disabled:opacity-50 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* SIGN UP FORM */}
            {mode === "SIGN_UP" && (
              <form onSubmit={handleSignUp} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Role
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-background border border-border">
                    {(["WORKER", "FARMER", "BUYER"] as PublicSignupRole[]).map(
                      (r) => (
                        <button
                          key={r}
                          type="button"
                          data-testid={`signup-role-${r.toLowerCase()}`}
                          onClick={() => setSignupRole(r)}
                          className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                            signupRole === r
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {r === "WORKER"
                            ? "Worker"
                            : r === "FARMER"
                              ? "Farmer"
                              : "Buyer"}
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Operator accounts are provisioned by city administration.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use 8+ characters with uppercase, lowercase, a number, and a
                    symbol.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:opacity-95 disabled:opacity-50 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    data-testid="goto-verify-email"
                    onClick={() => switchMode("CONFIRM_SIGN_UP")}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Already have an unverified account? Verify email or resend
                    code
                  </button>
                </div>
              </form>
            )}

            {/* CONFIRM SIGN UP FORM */}
            {mode === "CONFIRM_SIGN_UP" && (
              <form
                onSubmit={handleConfirmSignUp}
                noValidate
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Account Role
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-background border border-border">
                    {(["WORKER", "FARMER", "BUYER"] as PublicSignupRole[]).map(
                      (r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setSignupRole(r);
                            if (email.trim()) {
                              savePendingSignupRole(email, r);
                            }
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                            signupRole === r
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {r === "WORKER"
                            ? "Worker"
                            : r === "FARMER"
                              ? "Farmer"
                              : "Buyer"}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-foreground">
                      Email Destination
                    </label>
                    {deliveryDestination && (
                      <span className="text-[11px] font-mono text-cyan-300/90">
                        Sent to {deliveryDestination}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Verification Code (6-Digit OTP)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={confirmationCode}
                      onChange={(e) =>
                        setConfirmationCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm font-mono tracking-widest text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-success hover:opacity-95 disabled:opacity-50 text-success-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify &amp; Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    data-testid="resend-verification-code"
                    disabled={resending || resendCooldown > 0}
                    onClick={() => void handleResendCode()}
                    className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                  >
                    {resending && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>
                      {resending
                        ? "Sending code..."
                        : resendCooldown > 0
                          ? `Resend verification code (${resendCooldown}s)`
                          : "Resend verification code"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("SIGN_IN")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">AQUILOOP</span>
        <span>Delhi-NCR</span>
      </footer>
    </div>
  );
}
