import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStandalonePwa } from "@/lib/push-client";

/** Installed PWAs have no browser chrome, so there's no way to reload. This
 *  renders only in standalone mode (after mount, to keep SSR markup stable). */
export function RefreshButton() {
  const [show, setShow] = useState(false);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => setShow(isStandalonePwa()), []);

  if (!show) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label="Refresh"
      onClick={() => {
        setSpinning(true);
        window.location.reload();
      }}
    >
      <RefreshCw className={spinning ? "animate-spin" : undefined} />
    </Button>
  );
}
