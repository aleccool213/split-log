import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { noFlashScript, THEME_KEY } from "@omarchy/ui/core";
import appCss from "../styles.css?url";

const APP_NAME = "Split Log";

// Sets .dark/.light on <html> before first paint. The legacy key carries a
// choice saved under this app's old "split-log-theme" over to the shared
// "om-theme", so nobody's light/dark preference resets.
const THEME_BOOT = noFlashScript(THEME_KEY, "split-log-theme");

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#dedede", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#121212", media: "(prefers-color-scheme: dark)" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        name: "description",
        content: "Concept 2 training log — splits, volume, and the next session.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Outlet />
            <Toaster
              theme="system"
              position="top-center"
              toastOptions={{
                className: "font-sans",
              }}
            />
          </TooltipProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
