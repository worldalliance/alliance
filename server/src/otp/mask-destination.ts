import { OtpChannel } from "./otp-copy";
import type { OtpContact } from "./otp.service";

export function maskDestination(contact: OtpContact): string {
  switch (contact.channel) {
    case OtpChannel.Email: {
      const at = contact.destination.lastIndexOf("@");
      return `${contact.destination.slice(0, 1)}•••${contact.destination.slice(at)}`;
    }
    case OtpChannel.Sms:
      return `•••${contact.destination.slice(-4)}`;
    default:
      throw new Error(`unknown channel: ${contact.channel satisfies never}`);
  }
}
