"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudRain,
  LogOut,
  MapPin,
  Menu,
  ShieldAlert,
  Sprout,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AquiloopRole,
  ROLE_META,
  useCurrentRole,
} from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
}

const QUICK_FEATURES: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: AquiloopRole[];
}> = [
  {
    href: "/monsoonloop",
    label: "MONSOONLOOP",
    icon: CloudRain,
    allowedRoles: ["OPERATOR", "WORKER"],
  },
  {
    href: "/flood-bounties",
    label: "Flood & Waste Bounties",
    icon: ShieldAlert,
    allowedRoles: ["OPERATOR", "WORKER"],
  },
  {
    href: "/stubble-exchange",
    label: "Stubble-to-Water",
    icon: Sprout,
    allowedRoles: ["OPERATOR", "FARMER", "BUYER"],
  },
];

export function TopHeader({ onOpenMobileMenu }: TopHeaderProps) {
  const pathname = usePathname();
  const { user, role, signOut } = useCurrentRole();

  const visibleFeatures = React.useMemo(() => {
    if (!role) return QUICK_FEATURES;
    return QUICK_FEATURES.filter((feat) => feat.allowedRoles.includes(role));
  }, [role]);

  const roleBadge = role ? ROLE_META[role] : null;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile Menu Button + Clean User-Facing Context */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="secondary"
          size="icon"
          onClick={onOpenMobileMenu}
          className="lg:hidden shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground truncate">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-foreground">Delhi NCR</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">Rain event today</span>
        </div>
      </div>

      {/* Right: Role-Filtered Feature Switcher + Authenticated Profile & Sign Out */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden xl:flex items-center gap-1.5">
          {visibleFeatures.map((feat) => {
            const Icon = feat.icon;
            const isActive = pathname.startsWith(feat.href);
            return (
              <Link
                key={feat.href}
                href={feat.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary/45 bg-primary/15 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span>{feat.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Authenticated User Profile + Role Badge + Sign Out */}
        {user && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5">
            <div className="hidden sm:flex items-center gap-2 pr-1">
              <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              <span
                className="max-w-[165px] truncate text-xs font-medium text-foreground"
                title={user.email}
              >
                {user.email}
              </span>
            </div>

            {role && roleBadge && (
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                  roleBadge.badgeClass
                )}
              >
                {roleBadge.label}
              </span>
            )}

            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              title="Sign out of AQUILOOP"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
