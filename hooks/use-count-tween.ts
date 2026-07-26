"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Keep large jumps short — never feel like counting every unit. */
function durationForDelta(delta: number) {
  const abs = Math.abs(delta);
  if (abs < 50) return 180;
  if (abs < 1_000) return 220;
  if (abs < 100_000) return 260;
  return 280;
}

/**
 * Quantize so million→thousand style jumps only show ~10 readable steps,
 * instead of hundreds of intermediate integers.
 */
function quantize(value: number, origin: number, target: number, steps: number) {
  if (origin === target) return target;
  const span = target - origin;
  const step = span / steps;
  if (Math.abs(step) < 1) return Math.round(value);

  const progressed = value - origin;
  const index = Math.round(progressed / step);
  const snapped = origin + index * step;

  // Always land exactly on the target at the end.
  if (
    (span > 0 && snapped >= target) ||
    (span < 0 && snapped <= target)
  ) {
    return target;
  }
  return Math.round(snapped);
}

type Options = {
  /** Hard cap; adaptive duration still used under this. */
  durationMs?: number;
  /** Distinct values shown during the tween (larger = smoother, slower feel). */
  steps?: number;
};

/**
 * Race-safe numeric tween between successive targets.
 * Large deltas skip aggressively and finish fast; generation tokens cancel stale frames.
 */
export function useCountTween(target: number, options: Options = {}) {
  const { durationMs: durationCap, steps = 10 } = options;
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const generationRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const origin = displayRef.current;
    if (origin === target) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const generation = ++generationRef.current;
    cancelAnimationFrame(frameRef.current);

    const adaptive = durationForDelta(target - origin);
    const durationMs = Math.min(durationCap ?? adaptive, adaptive);

    const snap = (value: number) => {
      displayRef.current = value;
      setDisplay(value);
    };

    if (reduced || durationMs <= 0) {
      snap(target);
      return;
    }

    const delta = target - origin;
    const start = performance.now();

    const tick = (now: number) => {
      if (generation !== generationRef.current) return;
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = origin + delta * easeOutCubic(progress);
      const next =
        progress >= 1
          ? target
          : quantize(eased, origin, target, Math.max(4, steps));

      displayRef.current = next;
      setDisplay(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setDisplay(target);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (generation === generationRef.current) {
        generationRef.current += 1;
      }
      cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationCap, steps]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return display;
}
