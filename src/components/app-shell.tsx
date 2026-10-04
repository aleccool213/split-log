import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { History, LayoutDashboard, SlidersHorizontal } from "lucide-react";
import { OmPageHeader, type OmNavItem } from "@omarchy/ui/react";
import { SplitMark } from "@/components/mark";
import { ShareButton } from "@/components/share-button";
import { RefreshButton } from "@/components/refresh-button";
import { PushSetup } from "@/components/push-setup";
import { shareBoardPayload } from "@/lib/share";

const NAV = [
  { to: "/", label: "Board", icon: LayoutDashboard },
  { to: "/history", label: "Logbook", icon: History },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav: OmNavItem[] = NAV.map((item) => {
    const Icon = item.icon;
    return {
      href: item.to,
      label: item.label,
      active: pathname === item.to,
      icon: <Icon className="size-4" />,
    };
  });

  return (
    <div className="pixel-field min-h-dvh">
      <PushSetup />
      {/* Header, desktop nav, mobile dock and theme toggle come from
          @omarchy/ui. renderLink keeps navigation client-side; exact matching
          stops "/" reading as active on every page. */}
      <OmPageHeader
        title="Split Log"
        logo={<SplitMark className="om-header__logo" />}
        nav={nav}
        dock
        actions={
          <>
            <RefreshButton />
            <ShareButton payload={shareBoardPayload()} label="Share board" iconOnly variant="ghost" />
          </>
        }
        renderLink={(item, children, props) => (
          <Link to={item.href} activeOptions={{ exact: true }} {...props}>
            {children}
          </Link>
        )}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-12">
        {children}
      </main>
    </div>
  );
}
