"use client";

import * as React from "react";
import {
  fetchAuthSession,
  getCurrentUser,
  signOut as amplifySignOut,
} from "aws-amplify/auth";
import { configureAmplifyClient } from "@/lib/amplify-config";

export type AquiloopRole = "OPERATOR" | "WORKER" | "FARMER" | "BUYER";
export type PublicSignupRole = "WORKER" | "FARMER" | "BUYER";

export const AQUILOOP_ROLE_ORDER: readonly AquiloopRole[] = [
  "OPERATOR",
  "WORKER",
  "FARMER",
  "BUYER",
];

export const ROLE_META: Record<
  AquiloopRole,
  {
    label: string;
    shortTitle: string;
    description: string;
    badgeClass: string;
    primaryHref: string;
  }
> = {
  OPERATOR: {
    label: "Operator",
    shortTitle: "Municipal & Resilience Command",
    description:
      "Pre-rain risk assessment, task dispatch, and evidence verification across all modules.",
    badgeClass: "border-primary/45 bg-primary/15 text-primary",
    primaryHref: "/monsoonloop",
  },
  WORKER: {
    label: "Field Worker",
    shortTitle: "Field Cleanup & Drain Execution",
    description:
      "Execute dispatched drain tasks, claim flood waste bounties, and submit geotagged before/after photos.",
    badgeClass: "border-warning/45 bg-warning/15 text-warning",
    primaryHref: "/monsoonloop",
  },
  FARMER: {
    label: "Farmer",
    shortTitle: "Crop Residue & Stubble Listing",
    description:
      "List unburned harvest residue for pickup and track verified Aquiloop Resilience Credits (ARC).",
    badgeClass: "border-secondary/45 bg-secondary/15 text-emerald-400",
    primaryHref: "/stubble-exchange?view=listings",
  },
  BUYER: {
    label: "Buyer",
    shortTitle: "Biomass Collection & Pickup",
    description:
      "Browse available NCR crop residue listings, schedule field pickups, and submit collection proof.",
    badgeClass: "border-info/45 bg-info/15 text-sky-400",
    primaryHref: "/stubble-exchange?view=available",
  },
};

export interface AuthenticatedAquiloopUser {
  userId: string;
  username: string;
  email: string;
  groups: string[];
}

export interface CurrentRoleContextValue {
  role: AquiloopRole | null;
  isAuthenticated: boolean;
  user: AuthenticatedAquiloopUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: (
    pendingSignupRole?: PublicSignupRole
  ) => Promise<AquiloopRole | null>;
}

const AuthContext = React.createContext<CurrentRoleContextValue | undefined>(
  undefined
);

function extractGroupsFromPayload(
  payload: Record<string, unknown> | undefined
): string[] {
  if (!payload) return [];
  const raw = payload["cognito:groups"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function resolveAuthoritativeRole(groups: string[]): AquiloopRole | null {
  for (const candidate of AQUILOOP_ROLE_ORDER) {
    if (groups.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

const PENDING_ROLE_STORAGE_PREFIX = "aquiloop_pending_signup_role:";

export function savePendingSignupRole(
  email: string,
  role: PublicSignupRole
): void {
  if (typeof window === "undefined") return;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    window.localStorage.setItem(
      `${PENDING_ROLE_STORAGE_PREFIX}${cleanEmail}`,
      role
    );
  } catch {
    // Ignore localStorage quota/privacy errors
  }
}

export function getPendingSignupRole(email: string): PublicSignupRole | null {
  if (typeof window === "undefined") return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    const raw = window.localStorage.getItem(
      `${PENDING_ROLE_STORAGE_PREFIX}${cleanEmail}`
    );
    if (raw === "WORKER" || raw === "FARMER" || raw === "BUYER") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingSignupRole(email: string): void {
  if (typeof window === "undefined") return;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    window.localStorage.removeItem(
      `${PENDING_ROLE_STORAGE_PREFIX}${cleanEmail}`
    );
  } catch {
    // Ignore localStorage errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthenticatedAquiloopUser | null>(
    null
  );
  const [role, setRole] = React.useState<AquiloopRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);

  const refreshSession = React.useCallback(
    async (
      pendingSignupRole?: PublicSignupRole
    ): Promise<AquiloopRole | null> => {
      configureAmplifyClient();

      try {
        const currentUser = await getCurrentUser();
        let session = await fetchAuthSession();

        const accessToken = session.tokens?.accessToken;
        const idToken = session.tokens?.idToken;

        if (!accessToken || !idToken) {
          setUser(null);
          setRole(null);
          setIsAuthenticated(false);
          return null;
        }

        const emailClaim =
          (idToken.payload?.email as string | undefined) ??
          currentUser.signInDetails?.loginId ??
          currentUser.username;

        let groups = Array.from(
          new Set([
            ...extractGroupsFromPayload(
              accessToken.payload as Record<string, unknown>
            ),
            ...extractGroupsFromPayload(
              idToken.payload as Record<string, unknown>
            ),
          ])
        );

        let resolvedRole = resolveAuthoritativeRole(groups);

        // If a newly registered user has no Cognito group yet, request server-side
        // assignment to their non-privileged onboarding role (WORKER | FARMER | BUYER),
        // then force-refresh the Cognito JWT session so cognito:groups is authoritative.
        const roleToAssign =
          pendingSignupRole ?? getPendingSignupRole(emailClaim) ?? "WORKER";

        if (!resolvedRole && roleToAssign) {
          const assignResp = await fetch("/api/auth/assign-role", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken.toString()}`,
            },
            body: JSON.stringify({ role: roleToAssign }),
          });

          if (assignResp.ok) {
            session = await fetchAuthSession({ forceRefresh: true });
            const refreshedAccess = session.tokens?.accessToken;
            const refreshedId = session.tokens?.idToken;
            groups = Array.from(
              new Set([
                ...extractGroupsFromPayload(
                  refreshedAccess?.payload as Record<string, unknown>
                ),
                ...extractGroupsFromPayload(
                  refreshedId?.payload as Record<string, unknown>
                ),
              ])
            );
            resolvedRole = resolveAuthoritativeRole(groups);
          }
        }

        if (resolvedRole) {
          clearPendingSignupRole(emailClaim);
        }

        setUser({
          userId: currentUser.userId,
          username: currentUser.username,
          email: emailClaim,
          groups,
        });
        setRole(resolvedRole);
        setIsAuthenticated(true);

        if (resolvedRole) {
          void import("@/lib/data-client").then(({ ensureUserProfileRecord }) =>
            ensureUserProfileRecord({
              userId: currentUser.userId,
              email: emailClaim,
              role: resolvedRole,
            })
          );
        }

        return resolvedRole;
      } catch {

        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const handleSignOut = React.useCallback(async () => {
    setLoading(true);
    try {
      await amplifySignOut();
    } finally {
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  const value = React.useMemo<CurrentRoleContextValue>(
    () => ({
      role,
      isAuthenticated,
      user,
      loading,
      signOut: handleSignOut,
      refreshSession,
    }),
    [role, isAuthenticated, user, loading, handleSignOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Authoritative hook for reading the authenticated user's Cognito identity and group role.
 */
export function useCurrentRole(): CurrentRoleContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useCurrentRole must be used within an AuthProvider");
  }
  return context;
}
