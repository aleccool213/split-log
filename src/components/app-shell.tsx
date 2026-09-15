import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { History, LayoutDashboard, SlidersHorizontal } from "lucide-react";
import { SplitMark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShareButton } from "@/components/share-button";
import { PushSetup } from "@/components/push-setup";
import { shareBoardPayload } from "@/lib/share";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Board", icon: LayoutDashboard },
  { to: "/history", label: "Logbook", icon: History },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="pixel-field min-h-dvh">
      <PushSetup />
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-fg no-underline">
            <SplitMark className="size-8" />
            <span className="font-display text-lg font-semibold tracking-tight">
              Split Log
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-0 md:flex">
              {NAV.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex h-9 items-center px-3 text-sm font-medium no-underline transition-colors",
                      active
                        ? "bg-primary text-primary-fg"
                        : "text-fg hover:bg-surface",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <ShareButton payload={shareBoardPayload()} label="Share board" iconOnly variant="ghost" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-12">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-3">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium no-underline",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center",
                      active && "bg-primary text-primary-fg",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
