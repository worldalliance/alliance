// Tremor Raw cx [v0.0.0]

import { formatDistanceToNow } from "date-fns";

// Tremor focusInput [v0.0.2]

export const focusInput = [
  // base
  "focus:ring-2",
  // ring color
  "focus:ring-blue-200 dark:focus:ring-blue-700/30",
  // border color
  "focus:border-blue-500 dark:focus:border-blue-700",
];

// Tremor Raw focusRing [v0.0.1]

export const focusRing = [
  // base
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  // outline color
  "outline-blue-500 dark:outline-blue-500",
];

// Tremor Raw hasErrorInput [v0.0.1]

export const hasErrorInput = [
  // base
  "ring-2",
  // border color
  "border-red-500 dark:border-red-700",
  // ring color
  "ring-red-200 dark:ring-red-700/30",
];

export const formatTime = (time: Date, { addSuffix = true }) => {
  return formatDistanceToNow(time, {
    addSuffix,
  }).replace("about ", "");
};

/**
 * Run an async function without awaiting; use in event handlers to avoid floating promises.
 * Optionally pass an onError callback for centralised error handling.
 */
export function runAsync(
  fn: () => Promise<void>,
  onError?: (err: unknown) => void,
): void {
  void fn().catch((err) => {
    onError?.(err);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** 0–100 width % for progress UI; denominator ≤ 0 is treated as full (100%). */
export function completedBarPercentage(
  numerator: number,
  denominator: number,
): number {
  return (denominator > 0 ? clamp(numerator / denominator, 0, 1) : 1) * 100;
}
