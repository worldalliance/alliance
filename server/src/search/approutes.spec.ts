import { passwordResetUrl, verifyEmailUrl } from "./approutes";

describe("account email links", () => {
  let originalAppUrl: string | undefined;
  let originalAltAppUrl: string | undefined;

  beforeEach(() => {
    originalAppUrl = process.env.APP_URL;
    originalAltAppUrl = process.env.ALT_APP_URL;
    process.env.APP_URL = "https://app.example.org";
    process.env.ALT_APP_URL = "https://alt.example.org";
  });

  afterEach(() => {
    process.env.APP_URL = originalAppUrl;
    process.env.ALT_APP_URL = originalAltAppUrl;
  });

  it("sends email verification to ALT_APP_URL", () => {
    expect(verifyEmailUrl("tok")).toBe(
      "https://alt.example.org/verifyEmail?token=tok",
    );
  });

  it("sends password reset to ALT_APP_URL", () => {
    expect(passwordResetUrl("tok")).toBe(
      "https://alt.example.org/resetpassword?token=tok",
    );
  });
});
