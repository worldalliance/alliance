import { NodeEnv } from "@alliance/common/node-env";
import { OtpChannel } from "./otp-copy";
import { isTestPhone } from "./test-phone";

const sms = (destination: string) => ({
  channel: OtpChannel.Sms,
  destination,
});

describe("isTestPhone", () => {
  it.each([NodeEnv.Staging, NodeEnv.Development, NodeEnv.Test])(
    "takes +1415555 numbers in %s",
    (nodeEnv) => {
      expect(isTestPhone(sms("+14155550042"), nodeEnv)).toBe(true);
    },
  );

  it("takes none in production", () => {
    expect(isTestPhone(sms("+14155550042"), NodeEnv.Production)).toBe(false);
  });

  it("takes no other number or channel", () => {
    expect(isTestPhone(sms("+14155560042"), NodeEnv.Staging)).toBe(false);
    expect(
      isTestPhone(
        { channel: OtpChannel.Email, destination: "+14155550042" },
        NodeEnv.Staging,
      ),
    ).toBe(false);
  });
});
