/**
 * Hands control back to the event loop (macrotask, unlike an awaited resolved
 * promise which only drains microtasks). Sprinkle into long CPU-bound loops so
 * pending requests get served between iterations.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
