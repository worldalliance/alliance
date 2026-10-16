/**
 * Each event is in effect over `[its date, the next event's date)`, so an event
 * has taken effect at the instant of its own date.
 */
export function hasTakenEffect(date: Date | string, at: Date): boolean {
  return new Date(date) <= at;
}
