"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AquiloopRole,
  ROLE_META,
  useCurrentRole,
} from "@/lib/auth-context";

interface RoleAccessNoticeProps {
  moduleName: string;
  allowedRoles: AquiloopRole[];
}

export function RoleAccessNotice({
  moduleName,
  allowedRoles,
}: RoleAccessNoticeProps) {
  const { role } = useCurrentRole();
  const currentMeta = role ? ROLE_META[role] : null;
  const allowedRoleLabels = allowedRoles
    .map((r) => ROLE_META[r]?.label ?? r)
    .join(" and ");

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-panel space-y-5">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl border border-warning/40 bg-warning/15 text-warning">
        <Lock className="h-5 w-5" />
      </div>

      <div className="space-y-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-warning">
          Workspace Access
        </span>
        <h2 className="text-xl font-bold text-foreground">
          {moduleName} is available to {allowedRoleLabels} accounts
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You are currently signed in as{" "}
          <strong className="font-semibold text-foreground">
            {currentMeta?.label ?? "a different role"}
          </strong>
          {currentMeta ? ` (${currentMeta.shortTitle})` : ""}.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {currentMeta && (
          <Button asChild variant="default" size="default" className="gap-2">
            <Link href={currentMeta.primaryHref}>
              <span>Open My {currentMeta.label} Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}

        <Button asChild variant="secondary" size="default">
          <Link href="/">Return to AQUILOOP Home</Link>
        </Button>
      </div>
    </div>
  );
}
