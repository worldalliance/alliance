import { setEnv } from "@alliance/common/set-env";
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
    setEnv("APP_URL", originalAppUrl);
    setEnv("ALT_APP_URL", originalAltAppUrl);
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

  it("links to whichever of the two URLs is off the legacy domain", () => {
    process.env.APP_URL = "https://staging.thealliance.org";
    process.env.ALT_APP_URL = "https://staging.worldalliance.org";
    expect(verifyEmailUrl("tok")).toBe(
      "https://staging.thealliance.org/verifyEmail?token=tok",
    );
  });
});
