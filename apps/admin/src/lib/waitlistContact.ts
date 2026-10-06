import { formatPhoneNumberForDisplay } from "@alliance/common/phone";

export function waitlistContactLabel(entry: {
  email: string | null;
  phoneNumber: string | null;
}): string | null {
  return entry.phoneNumber
    ? formatPhoneNumberForDisplay(entry.phoneNumber)
    : entry.email;
}
