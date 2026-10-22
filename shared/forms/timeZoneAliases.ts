import { TIME_ZONE_ALIASES } from "@alliance/common/timezone-catalog.gen";

// tzdb links abbreviations like MST and CET to one fixed zone each, so "mst"
// would find Phoenix alone, and a member in Denver who picked it would run an
// hour off all summer.
const ABBREVIATION = /^[A-Z]{2}T$/;

const aliasesByZone = new Map<string, string[]>();
for (const [alias, tz] of TIME_ZONE_ALIASES) {
  if (ABBREVIATION.test(alias)) continue;
  aliasesByZone.set(tz, [...(aliasesByZone.get(tz) ?? []), alias]);
}

export const aliasesOf = (tz: string): string[] => aliasesByZone.get(tz) ?? [];
