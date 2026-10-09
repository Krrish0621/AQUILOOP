"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { AquiloopAuthScreen } from "@/components/auth/aquiloop-auth-screen";
import { useCurrentRole } from "@/lib/auth-context";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isAuthenticated } = useCurrentRole();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Unauthenticated gate: render AQUILOOP authentication experience immediately on first paint
  if (!isAuthenticated) {
    return <AquiloopAuthScreen />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop Sticky Sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
        >
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[268px] flex-col bg-surface shadow-elevated">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar
              collapsed={false}
              onToggleCollapse={() => {}}
              onMobileNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main
          id="main-content"
          className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 max-w-[1480px] w-full mx-auto"
        >
          {children}
        </main>

        {/* Unobtrusive Footer */}
        <footer className="border-t border-border bg-surface/50 px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1480px] flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">AQUILOOP</span>
              <span>—</span>
              <span>
                Turn rainfall, waste, and crop residue into local climate
                action.
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">
              Delhi NCR
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
