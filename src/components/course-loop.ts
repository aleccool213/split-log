import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { FINISHED_FRAME, frameAt, type LoopFrame, type LoopOptions } from "@/lib/course";

export { FINISHED_FRAME, type LoopFrame };

export type CourseLoop = {
  frame: LoopFrame;
  paused: boolean;
  togglePaused: () => void;
  /** The viewer asked for reduced motion: keep the loop, drop the flourishes. */
  calm: boolean;
};

/**
 * Drives a self-looping course animation: row, hold at the finish, fade, repeat,
 * forever. It stops while scrolled off screen, in a hidden tab, or when the
 * viewer pauses it; a pause keeps the current frame and resumes from it.
 */
export function useCourseLoop(
  target: RefObject<Element | null>,
  options: LoopOptions = {},
): CourseLoop {
  const [frame, setFrame] = useState<LoopFrame>(FINISHED_FRAME);
  const [paused, setPaused] = useState(false);
  const [calm, setCalm] = useState(false);
  const pausedRef = useRef(false);
  const syncRef = useRef<() => void>(() => {});
  const { durationMs, holdMs, fadeMs } = options;

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    setCalm(media.matches);
    const onChange = () => setCalm(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = target.current;
    if (!el) return;

    let onScreen = false;
    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;

    const active = () => onScreen && !pausedRef.current && document.visibilityState === "visible";
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
    syncRef.current = sync;

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
      syncRef.current = () => {};
    };
  }, [target, durationMs, holdMs, fadeMs]);

  const togglePaused = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    syncRef.current();
  }, []);

  return { frame, paused, togglePaused, calm };
}
