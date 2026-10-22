import { siteUrlForHost } from "./site-url";

const URLS = {
  appUrl: "https://worldalliance.org",
  altAppUrl: "https://thealliance.org",
};

describe("siteUrlForHost", () => {
  it.each([
    ["thealliance.org", URLS.altAppUrl],
    ["worldalliance.org", URLS.appUrl],
    ["THEALLIANCE.ORG", URLS.altAppUrl],
  ])("serves %s from %s", (host, expected) => {
    expect(siteUrlForHost({ host, ...URLS })).toBe(expected);
  });

  it.each([undefined, "localhost:3005", "thealliance.org.evil.example.com"])(
    "falls back to the app URL for host %s",
    (host) => {
      expect(siteUrlForHost({ host, ...URLS })).toBe(URLS.appUrl);
    },
  );

  it("falls back to the app URL when no alt URL is set", () => {
    expect(
      siteUrlForHost({ host: "thealliance.org", appUrl: URLS.appUrl }),
    ).toBe(URLS.appUrl);
  });
});
