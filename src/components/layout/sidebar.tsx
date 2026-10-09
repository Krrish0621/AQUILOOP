"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CloudRain,
  HardHat,
  Home,
  ListFilter,
  LogOut,
  PlusCircle,
  ShieldAlert,
  Sprout,
  Truck,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  type AquiloopRole,
  ROLE_META,
  useCurrentRole,
} from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMobileNavigate?: () => void;
}

interface RoleNavItem {
  id: string;
  label: string;
  href: string;
  matchPath: string;
  matchView?: string;
  defaultForPath?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

function getNavigationForRole(role: AquiloopRole | null): RoleNavItem[] {
  if (role === "FARMER") {
    return [
      {
        id: "farmer-my-listings",
        label: "My Listings",
        href: "/stubble-exchange?view=listings",
        matchPath: "/stubble-exchange",
        matchView: "listings",
        defaultForPath: true,
        icon: Sprout,
      },
      {
        id: "farmer-create-listing",
        label: "List Stubble for Pickup",
        href: "/stubble-exchange?view=create",
        matchPath: "/stubble-exchange",
        matchView: "create",
        icon: PlusCircle,
      },
    ];
  }

  if (role === "BUYER") {
    return [
      {
        id: "buyer-available",
        label: "Available Listings",
        href: "/stubble-exchange?view=available",
        matchPath: "/stubble-exchange",
        matchView: "available",
        defaultForPath: true,
        icon: ListFilter,
      },
      {
        id: "buyer-my-pickups",
        label: "My Pickups",
        href: "/stubble-exchange?view=pickups",
        matchPath: "/stubble-exchange",
        matchView: "pickups",
        icon: Truck,
      },
    ];
  }

  if (role === "WORKER") {
    return [
      {
        id: "worker-monsoonloop",
        label: "Assigned Pre-Storm Tasks",
        href: "/monsoonloop",
        matchPath: "/monsoonloop",
        icon: HardHat,
      },
      {
        id: "worker-bounties",
        label: "Flood & Waste Bounties",
        href: "/flood-bounties",
        matchPath: "/flood-bounties",
        icon: ShieldAlert,
      },
    ];
  }

  // OPERATOR (or fallback)
  return [
    {
      id: "aquiloop-home",
      label: "Home",
      href: "/",
      matchPath: "/",
      icon: Home,
    },
    {
      id: "monsoonloop",
      label: "MONSOONLOOP",
      href: "/monsoonloop",
      matchPath: "/monsoonloop",
      icon: CloudRain,
    },
    {
      id: "flood-bounties",
      label: "Flood & Waste Bounties",
      href: "/flood-bounties",
      matchPath: "/flood-bounties",
      icon: ShieldAlert,
    },
    {
      id: "stubble-exchange",
      label: "Stubble-to-Water",
      href: "/stubble-exchange",
      matchPath: "/stubble-exchange",
      icon: Sprout,
    },
  ];
}

function SidebarNavLinks({
  collapsed,
  onMobileNavigate,
  role,
}: {
  collapsed: boolean;
  onMobileNavigate?: () => void;
  role: AquiloopRole | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  const navItems = React.useMemo(() => getNavigationForRole(role), [role]);

  return (
    <nav className="flex-1 space-y-2 px-3.5 py-6 overflow-y-auto">
      {!collapsed && role && (
        <div className="px-2 pb-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {role === "FARMER"
              ? "Farmer Navigation"
              : role === "BUYER"
              ? "Buyer Navigation"
              : role === "WORKER"
              ? "Field Worker Navigation"
              : "Operator Command"}
          </span>
        </div>
      )}

      {navItems.map((item) => {
        const Icon = item.icon;
        const pathMatches =
          item.matchPath === "/"
            ? pathname === "/"
            : pathname.startsWith(item.matchPath);

        const isActive = pathMatches
          ? item.matchView
            ? currentView === item.matchView ||
              (!currentView && Boolean(item.defaultForPath))
            : true
          : false;

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onMobileNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium tracking-tight transition-all duration-150",
              isActive
                ? "bg-primary/14 text-foreground border border-primary/40 shadow-sm"
                : "text-muted-foreground border border-transparent hover:bg-surface-muted/70 hover:text-foreground"
            )}
          >
            {isActive && (
              <span
                className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-primary"
                aria-hidden="true"
              />
            )}

            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />

            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onMobileNavigate,
}: SidebarProps) {
  const { user, role, signOut } = useCurrentRole();
  const roleBadge = role ? ROLE_META[role] : null;

  return (
    <aside
      aria-label="Primary Navigation"
      className={cn(
        "flex h-full flex-col border-r border-border/80 bg-surface/95 backdrop-blur-md transition-[width] duration-200 ease-out select-none",
        collapsed ? "w-[76px]" : "w-[260px]"
      )}
    >
      {/* Top Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/70 px-5">
        <Link
          href={roleBadge?.primaryHref ?? "/"}
          onClick={onMobileNavigate}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <BrandLogo collapsed={collapsed} />
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-surface-muted/70 text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Role-Specific Navigation Links */}
      <React.Suspense
        fallback={
          <div className="flex-1 space-y-2 px-3.5 py-6">
            <div className="h-10 rounded-xl bg-surface-muted/50 animate-pulse" />
            <div className="h-10 rounded-xl bg-surface-muted/50 animate-pulse" />
          </div>
        }
      >
        <SidebarNavLinks
          collapsed={collapsed}
          onMobileNavigate={onMobileNavigate}
          role={role}
        />
      </React.Suspense>

      {/* Authenticated Identity Footer in Sidebar */}
      {user && !collapsed && (
        <div className="border-t border-border/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              {user.email}
            </span>
            {role && roleBadge && (
              <span
                className={cn(
                  "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                  roleBadge.badgeClass
                )}
              >
                {roleBadge.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-muted py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </aside>
  );
}
