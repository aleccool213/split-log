import { useEffect, useState, type RefObject } from "react";
import { FINISHED_FRAME, frameAt, type LoopFrame, type LoopOptions } from "@/lib/course";

export { FINISHED_FRAME, type LoopFrame };

/**
 * Drives a self-looping course animation: row, hold at the finish, fade, repeat.
 * Pauses while scrolled off screen or in a hidden tab, and never starts under
 * `prefers-reduced-motion`, where the finished frame stays up.
 */
export function useCourseLoop(
  target: RefObject<Element | null>,
  options: LoopOptions = {},
): LoopFrame {
  const [frame, setFrame] = useState<LoopFrame>(FINISHED_FRAME);
  const { durationMs, holdMs, fadeMs } = options;

  useEffect(() => {
    const el = target.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let onScreen = false;
    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;

    const active = () => onScreen && document.visibilityState === "visible";
    const tick = (now: number) => {
      if (last != null) elapsed += Math.min(now - last, 100);
      last = now;
      setFrame(frameAt(elapsed, { durationMs, holdMs, fadeMs }));
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (active() && !raf) {
        last = null;
        raf = requestAnimationFrame(tick);
      } else if (!active() && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, durationMs, holdMs, fadeMs]);

  return frame;
}
