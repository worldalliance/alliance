import { R } from "./result";
import { TIME_ZONE_ALIASES, TIME_ZONE_CATALOG } from "./timezone-catalog.gen";

const TZDB_NAMES: ReadonlySet<string> = new Set([
  ...TIME_ZONE_CATALOG.map((entry) => entry.tz),
  ...TIME_ZONE_ALIASES.keys(),
]);

/**
 * An identifier the runtime resolves to itself, or one the catalog lists as a
 * row or alias. Raw offsets like `-08:00`, which `Intl` resolves, and tzdb's
 * placeholder `Factory`, which Bun resolves, name no place, so both fail.
 */
export function isTimeZoneIdentifier(value: unknown): value is string {
  if (typeof value !== "string" || /^[+-]/.test(value) || value === "Factory") {
    return false;
  }
  const resolved = R.fromThrowable(
    () =>
      new Intl.DateTimeFormat(undefined, { timeZone: value }).resolvedOptions()
        .timeZone,
  );
  // V8 and FormatJS swap an alias for its canonical zone, so the catalog
  // vouches for the spelling of the aliases it knows. Bun keeps an alias as
  // sent.
  return (
    R.isSuccess(resolved) && (resolved.value === value || TZDB_NAMES.has(value))
  );
}
