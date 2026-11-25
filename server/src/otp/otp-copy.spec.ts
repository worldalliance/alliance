import { OtpPurpose, otpEmail, otpText } from "./otp-copy";

describe("participant sign-in copy", () => {
  const purpose = OtpPurpose.KoraSignIn;

  it("puts the code in the email subject and body", () => {
    expect(otpEmail({ purpose, code: "012345" })).toEqual({
      subject: "Your sign-in code is 012345",
      context: {
        code: "012345",
        action: "continue to Safer Chatbots for Children",
        expiry: "10 minutes",
      },
    });
  });

  it("ends the text with a WebOTP line for the site", () => {
    expect(
      otpText({ purpose, code: "012345", webOtpHost: "example.org" }),
    ).toBe(
      "Your Alliance sign-in code is 012345. It expires in 10 minutes.\n\n@example.org #012345",
    );
  });

  it("words a phone verification text for its purpose", () => {
    expect(
      otpText({
        purpose: OtpPurpose.PhoneVerification,
        code: "012345",
        webOtpHost: null,
      }),
    ).toBe(
      "Your Alliance phone verification code is 012345. It expires in 10 minutes.",
    );
  });

  it("leaves the WebOTP line off a text with no site to autofill", () => {
    expect(
      otpText({
        purpose: OtpPurpose.KoraSignIn,
        code: "012345",
        webOtpHost: null,
      }),
    ).toBe("Your Alliance sign-in code is 012345. It expires in 10 minutes.");
  });
});
