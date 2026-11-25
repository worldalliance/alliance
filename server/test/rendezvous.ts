/** Holds each caller until `parties` callers have arrived or `timeoutMs` has
 * passed, so a party that never arrives releases the others. */
export function rendezvous(params: { parties: number; timeoutMs: number }) {
  let arrived = 0;
  const all = Promise.withResolvers<void>();
  return async () => {
    arrived += 1;
    if (arrived >= params.parties) all.resolve();
    await Promise.race([
      all.promise,
      new Promise((resolve) => setTimeout(resolve, params.timeoutMs)),
    ]);
  };
}
