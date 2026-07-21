/**
 * Client-side-only id for React keys on locally created rows (staged
 * variants, reviewer rows, ...). Never sent to the server.
 */
export function makeTempId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random()}`;
}
