import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sharePayload, type SharePayload } from "@/lib/share";
import { cn } from "@/lib/utils";

export function ShareButton({
  payload,
  label = "Share",
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: {
  payload: SharePayload;
  label?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "icon" | "default";
  className?: string;
  iconOnly?: boolean;
}) {
  async function onShare() {
    try {
      const result = await sharePayload(payload);
      if (result === "copied") toast.success("Copied — paste it anywhere");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={cn(iconOnly && "size-9", className)}
      onClick={onShare}
      aria-label={label}
    >
      <Share2 />
      {iconOnly ? null : label}
    </Button>
  );
}
