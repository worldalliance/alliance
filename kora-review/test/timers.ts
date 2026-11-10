import { vi } from "bun:test";

const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

// Bun's fake timers have no async advance, so this steps the clock and lets
// promise callbacks run between steps, as vitest's advanceTimersByTimeAsync does.
export async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  await settle();
  for (let left = ms; left > 0; left -= 10) {
    vi.advanceTimersByTime(Math.min(left, 10));
    await settle();
  }
}
