import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { rowTzOf, selectedLabel, uncataloguedLabel } from "./timeZoneSelect";

export type DeviceTimeZoneOffer = { tz: string; label: string };

/**
 * The detected zone, as reported, when it lists as a different row than the
 * saved one, so a saved alias of the device's zone offers nothing.
 */
export function deviceTimeZoneOffer({
  saved,
  device,
}: {
  saved: string | undefined;
  device: string | undefined;
}): DeviceTimeZoneOffer | null {
  if (!isTimeZoneIdentifier(device)) return null;
  if (saved !== undefined && rowTzOf(saved) === rowTzOf(device)) return null;
  const label = selectedLabel(device) ?? uncataloguedLabel(device);
  return { tz: device, label: label?.labelLeft ?? device };
}
