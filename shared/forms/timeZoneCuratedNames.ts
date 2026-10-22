// Names a search ranks this zone first for when typed in full, and ahead of
// the places a query only starts. A name covering several zones picks the one
// most of it keeps, or offset order opens "china" on Urumqi and "eastern" on
// Atikokan, which keeps no DST. Greenwich and GMT go to London, since tzdb
// aliases give them to UTC. The rest are places no city, country, or alias spells.
export const CURATED_NAMES: Record<string, string[]> = {
  "Europe/London": [
    "UK",
    "Britain",
    "Great Britain",
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
    "Greenwich",
    "GMT",
  ],
  "Australia/Perth": ["Western Australia"],
  "Pacific/Honolulu": ["Hawaii"],
  "Asia/Shanghai": ["China", "China mainland"],
  "America/New_York": ["United States", "US", "USA", "America", "Eastern Time"],
  "America/Chicago": ["Central Time"],
  "America/Denver": ["Mountain Time"],
  "America/Los_Angeles": ["Pacific Time"],
  "America/Halifax": ["Atlantic Time"],
  "America/Toronto": ["Canada"],
  "America/Mexico_City": ["Mexico"],
  "America/Sao_Paulo": ["Brazil", "Brasilia Time"],
  "America/Santiago": ["Chile"],
  "America/Guayaquil": ["Ecuador"],
  "America/Nuuk": ["Greenland"],
  "Africa/Maputo": ["Central Africa Time"],
  "Europe/Paris": ["Central European Time"],
  "Europe/Athens": ["Eastern European Time"],
  "Europe/Madrid": ["Spain"],
  "Europe/Lisbon": ["Portugal"],
  "Europe/Moscow": ["Russia"],
  "Asia/Ulaanbaatar": ["Mongolia"],
  "Asia/Seoul": ["Korea"],
  "Australia/Sydney": ["Australia"],
  "Australia/Darwin": ["Central Australia"],
};

export const curatedNamesOf = (tz: string): string[] => CURATED_NAMES[tz] ?? [];

// English names people type for a country CLDR names another way. They match
// as the country does, with no rank over the places a query only starts, so
// "ho" still opens on Honolulu rather than on Holland's Amsterdam.
export const COMMON_COUNTRY_NAMES: Record<string, string[]> = {
  "Asia/Dubai": ["UAE"],
  "Africa/Abidjan": ["Ivory Coast"],
  "Europe/Prague": ["Czech Republic"],
  "Asia/Dili": ["East Timor"],
  "Asia/Gaza": ["Palestine"],
  "Asia/Hebron": ["Palestine"],
  "Africa/Mbabane": ["Swaziland"],
  "Africa/Kinshasa": [
    "DRC",
    "DR Congo",
    "Democratic Republic of the Congo",
    "Democratic Republic of Congo",
  ],
  "Africa/Lubumbashi": [
    "DRC",
    "DR Congo",
    "Democratic Republic of the Congo",
    "Democratic Republic of Congo",
  ],
  "Africa/Brazzaville": ["Republic of the Congo", "Republic of Congo"],
  "Europe/Amsterdam": ["Holland"],
};

export const commonCountryNamesOf = (tz: string): string[] =>
  COMMON_COUNTRY_NAMES[tz] ?? [];
