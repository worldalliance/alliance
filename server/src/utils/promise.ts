/**
 * Used to immediately invoke a function expression
 *
 * e.g. to create a promise of some expression:
 * ```
 * run(async () => {
 *   // some async operation
 * })
 * ```
 * 
 * Equivalent to (but more readable than):
 * ```
 * (async () => {
 *   // some async operation
 * })()
 * ```
 */
export function run<T>(fn: () => T): T {
  return fn();
}
