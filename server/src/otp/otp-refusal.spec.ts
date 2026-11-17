import { OtpError } from "@alliance/common/otp";
import { milliseconds } from "date-fns";
import { OtpPurpose } from "./otp-copy";
import { otpRefusalException } from "./otp-refusal";

describe("otpRefusalException", () => {
  it.each([
    [OtpError.WrongCode, 400, "That code isn’t correct. Try again."],
    [
      OtpError.CodeInvalid,
      400,
      "That code is no longer valid. Request a new code.",
    ],
    [
      OtpError.DeliveryFailed,
      503,
      "We couldn’t send your code. Try again later or use another sign-in method.",
    ],
  ] as const)("refuses %s with its copy", (error, status, message) => {
    const exception = otpRefusalException({ error }, OtpPurpose.KoraSignIn);
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toEqual({
      statusCode: status,
      message,
      error,
    });
  });

  it("words a failed phone verification send for that purpose", () => {
    expect(
      otpRefusalException(
        { error: OtpError.DeliveryFailed },
        OtpPurpose.PhoneVerification,
      ).message,
    ).toBe(
      "We couldn’t send a code to this number. Check the number or try again later.",
    );
  });

  it("says how long a throttled caller waits, rounding up", () => {
    const retryAt = new Date(
      Date.now() + milliseconds({ minutes: 4, seconds: 10 }),
    );
    const exception = otpRefusalException(
      { error: OtpError.Throttled, retryAt },
      OtpPurpose.KoraSignIn,
    );
    expect(exception.getStatus()).toBe(429);
    expect(exception.getResponse()).toEqual({
      statusCode: 429,
      message: "Too many attempts. Try again in 5 minutes.",
      error: OtpError.Throttled,
    });
  });
});
