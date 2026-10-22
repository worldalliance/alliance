import { getCalendars } from "expo-localization";

export function getDeviceTimeZone(): string | undefined {
  return getCalendars()[0].timeZone ?? undefined;
}
