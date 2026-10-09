"use client";

import React from "react";
import Link from "next/link";
import { CloudRain, Coins, Sprout, ArrowRight, Lock } from "lucide-react";
import {
  useCurrentRole,
  ROLE_META,
  type AquiloopRole,
} from "@/lib/auth-context";

function canRoleAccessModule(role: AquiloopRole, href: string): boolean {
  if (role === "OPERATOR") return true;
  if (role === "WORKER") {
    return href === "/monsoonloop" || href === "/flood-bounties";
  }
  if (role === "FARMER" || role === "BUYER") {
    return href === "/stubble-exchange";
  }
  return false;
}

interface ModuleCardConfig {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ctaLabel: string;
  accentColor: "cyan" | "emerald" | "amber";
  description: string;
  svgIllustration: React.ReactNode;
}

const MODULES: ModuleCardConfig[] = [
  {
    id: "monsoonloop",
    title: "MONSOONLOOP",
    subtitle: "Flood Prevention",
    href: "/monsoonloop",
    icon: CloudRain,
    ctaLabel: "Open MONSOONLOOP",
    accentColor: "cyan",
    description:
      "Track 72-hour rainfall against ward drainage capacity and dispatch crews before waterlogging starts.",
    svgIllustration: (
      <svg
        className="w-full h-full"
        viewBox="0 0 400 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="0"
          y1="35"
          x2="400"
          y2="35"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="75"
          x2="400"
          y2="75"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
        <path
          d="M0 96 C75 92, 125 78, 185 48 C240 20, 295 26, 350 42 C375 48, 390 52, 400 54"
          stroke="#06B6D4"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M0 96 C75 92, 125 78, 185 48 C240 20, 295 26, 350 42 C375 48, 390 52, 400 54 L400 120 L0 120 Z"
          fill="url(#cyanHomeFade)"
          opacity="0.2"
        />
        <circle cx="185" cy="48" r="4" fill="#06B6D4" />
        <circle cx="265" cy="26" r="5" fill="#F59E0B" />
        <defs>
          <linearGradient id="cyanHomeFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "flood-bounties",
    title: "FLOOD & WASTE BOUNTIES",
    subtitle: "Drain Clearance",
    href: "/flood-bounties",
    icon: Coins,
    ctaLabel: "Open Flood Bounties",
    accentColor: "emerald",
    description:
      "Claim blocked storm drain jobs, upload before-and-after cleanup photos, and earn verified rewards.",
    svgIllustration: (
      <svg
        className="w-full h-full"
        viewBox="0 0 400 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="60"
          y1="60"
          x2="340"
          y2="60"
          stroke="rgba(16, 185, 129, 0.22)"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <rect
          x="52"
          y="42"
          width="36"
          height="36"
          rx="10"
          fill="#0B1322"
          stroke="#10B981"
          strokeWidth="2"
        />
        <circle cx="70" cy="60" r="5" fill="#10B981" />
        <rect
          x="182"
          y="42"
          width="36"
          height="36"
          rx="10"
          fill="#0B1322"
          stroke="#10B981"
          strokeWidth="2"
        />
        <path
          d="M194 60 L198 64 L207 55"
          stroke="#10B981"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="312"
          y="42"
          width="36"
          height="36"
          rx="10"
          fill="rgba(16, 185, 129, 0.14)"
          stroke="#10B981"
          strokeWidth="2"
        />
        <path
          d="M324 60 L328 64 L337 55"
          stroke="#10B981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "stubble-exchange",
    title: "STUBBLE-TO-WATER",
    subtitle: "Residue Recovery",
    href: "/stubble-exchange",
    icon: Sprout,
    ctaLabel: "Open Stubble Exchange",
    accentColor: "amber",
    description:
      "List post-harvest straw for scheduled buyer pickup to prevent open burning and protect soil moisture.",
    svgIllustration: (
      <svg
        className="w-full h-full"
        viewBox="0 0 400 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M85 82 C145 32, 255 32, 315 82"
          stroke="#F59E0B"
          strokeWidth="2.2"
          fill="none"
        />
        <path
          d="M315 82 C255 108, 145 108, 85 82"
          stroke="#06B6D4"
          strokeWidth="2.2"
          strokeDasharray="5 5"
          fill="none"
        />
        <circle
          cx="85"
          cy="82"
          r="14"
          fill="#0B1322"
          stroke="#F59E0B"
          strokeWidth="2"
        />
        <circle cx="85" cy="82" r="4.5" fill="#F59E0B" />
        <circle
          cx="200"
          cy="45"
          r="14"
          fill="#0B1322"
          stroke="#10B981"
          strokeWidth="2"
        />
        <circle cx="200" cy="45" r="4.5" fill="#10B981" />
        <circle
          cx="315"
          cy="82"
          r="14"
          fill="#0B1322"
          stroke="#06B6D4"
          strokeWidth="2"
        />
        <circle cx="315" cy="82" r="4.5" fill="#06B6D4" />
      </svg>
    ),
  },
];

export function AquiloopHome() {
  const { role } = useCurrentRole();
  const activeRole: AquiloopRole = role ?? "OPERATOR";
  const roleMeta = ROLE_META[activeRole];

  React.useEffect(() => {
    if (role === "WORKER" || role === "FARMER" || role === "BUYER") {
      window.location.replace(ROLE_META[role].primaryHref);
    }
  }, [role]);

  return (
    <div className="relative max-w-6xl mx-auto space-y-10 pb-12 pt-2 font-sans">
      {/* Subtle Blue / Cyan Atmospheric Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 -top-6 h-72 overflow-hidden -z-10"
      >
        <div className="absolute top-0 left-8 h-56 w-96 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute top-6 right-12 h-56 w-96 rounded-full bg-sky-500/10 blur-[110px]" />
      </div>

      {/* Simple, Clean Header */}
      <section className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight">
          Turn rainfall, drain waste, and crop residue into local action.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          Pre-storm flood prevention, verified drain cleanup bounties, and
          harvest straw collection across Delhi-NCR.
        </p>
      </section>

      {/* Three Feature Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {MODULES.map((module) => {
          const Icon = module.icon;
          const isAllowed = canRoleAccessModule(activeRole, module.href);

          const accentBadge =
            module.accentColor === "cyan"
              ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/25"
              : module.accentColor === "emerald"
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                : "text-amber-400 bg-amber-500/10 border-amber-500/25";

          const ctaStyles =
            module.accentColor === "cyan"
              ? "bg-cyan-500/12 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              : module.accentColor === "emerald"
                ? "bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/12 hover:bg-amber-500/20 text-amber-300 border-amber-500/30";

          return (
            <div
              key={module.id}
              className={`rounded-2xl bg-surface/95 backdrop-blur-md border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-panel ${
                isAllowed
                  ? "border-cyan-500/20 hover:border-cyan-400/45 hover:shadow-[0_8px_30px_rgba(6,182,212,0.08)]"
                  : "border-border/60 opacity-65"
              }`}
            >
              <div>
                <div className="h-28 bg-background/70 border-b border-border relative overflow-hidden flex items-center justify-center">
                  {module.svgIllustration}
                  <div className="absolute top-3.5 left-4 flex items-center gap-2">
                    <span className={`p-2 rounded-lg border ${accentBadge}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {module.subtitle}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-2.5">
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                    {module.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {module.description}
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2">
                {isAllowed ? (
                  <Link
                    href={module.href}
                    className={`w-full py-2.5 px-4 rounded-xl border font-semibold text-xs flex items-center justify-between transition-all ${ctaStyles}`}
                  >
                    <span>{module.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <div className="w-full py-2.5 px-4 rounded-xl bg-background/60 border border-border text-muted-foreground text-xs font-medium flex items-center justify-between">
                    <span>Not assigned to {roleMeta.label}</span>
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
