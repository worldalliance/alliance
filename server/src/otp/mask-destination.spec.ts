import { maskDestination } from "./mask-destination";
import { OtpChannel } from "./otp-copy";

describe("maskDestination", () => {
  it.each([
    [OtpChannel.Email, "someone@example.com", "s•••@example.com"],
    [OtpChannel.Email, "a@b.example", "a•••@b.example"],
    [OtpChannel.Sms, "+447700900123", "•••0123"],
  ])("masks a %s destination", (channel, destination, masked) => {
    expect(maskDestination({ channel, destination })).toBe(masked);
  });
});
