import { isAllianceAppHostname, siteHref, urlMatchesDomain } from "./url";

describe("urlMatchesDomain", () => {
  it("matches the domain itself and its subdomains", () => {
    expect(urlMatchesDomain("https://linkedin.com/in/x", "linkedin.com")).toBe(
      true,
    );
    expect(
      urlMatchesDomain("https://www.linkedin.com/in/x", "linkedin.com"),
    ).toBe(true);
  });

  it("tolerates scheme-less input", () => {
    expect(urlMatchesDomain("linkedin.com/in/x", "linkedin.com")).toBe(true);
    expect(urlMatchesDomain("www.linkedin.com", "linkedin.com")).toBe(true);
  });

  it("ignores the domain elsewhere in the url", () => {
    expect(
      urlMatchesDomain("https://evil.com/linkedin.com", "linkedin.com"),
    ).toBe(false);
    expect(
      urlMatchesDomain("https://evil.com/?u=linkedin.com", "linkedin.com"),
    ).toBe(false);
    expect(
      urlMatchesDomain("https://linkedin.com.evil.com/x", "linkedin.com"),
    ).toBe(false);
  });

  it("is false for non-matching or unparseable values", () => {
    expect(urlMatchesDomain("https://example.com", "linkedin.com")).toBe(false);
    expect(urlMatchesDomain("", "linkedin.com")).toBe(false);
    expect(urlMatchesDomain("   ", "linkedin.com")).toBe(false);
  });
});

describe("isAllianceAppHostname", () => {
  it("accepts the web app's hosts on both domains", () => {
    expect(isAllianceAppHostname("worldalliance.org")).toBe(true);
    expect(isAllianceAppHostname("thealliance.org")).toBe(true);
    expect(isAllianceAppHostname("www.thealliance.org")).toBe(true);
    expect(isAllianceAppHostname("staging.thealliance.org")).toBe(true);
    expect(isAllianceAppHostname("www.staging.worldalliance.org")).toBe(true);
    expect(isAllianceAppHostname("TheAlliance.org")).toBe(true);
  });

  it("rejects hosts that are not the web app", () => {
    expect(isAllianceAppHostname("admin.thealliance.org")).toBe(false);
    expect(isAllianceAppHostname("admin.staging.worldalliance.org")).toBe(
      false,
    );
    expect(isAllianceAppHostname("help.thealliance.org")).toBe(false);
  });

  it("rejects lookalikes and other hosts", () => {
    expect(isAllianceAppHostname("thealliance.org.evil.com")).toBe(false);
    expect(isAllianceAppHostname("notthealliance.org")).toBe(false);
    expect(isAllianceAppHostname("example.com")).toBe(false);
  });
});

describe("siteHref", () => {
  it("strips the web app's own hosts down to a path", () => {
    expect(siteHref("https://worldalliance.org/forum/post/22")).toBe(
      "/forum/post/22",
    );
    expect(siteHref("https://www.thealliance.org/actions/5")).toBe(
      "/actions/5",
    );
    expect(siteHref("https://www.staging.thealliance.org/actions/5")).toBe(
      "/actions/5",
    );
  });

  it("keeps the query and hash", () => {
    expect(
      siteHref("https://worldalliance.org/actions/5?tab=tasks#comments"),
    ).toBe("/actions/5?tab=tasks#comments");
  });

  it("leaves paths alone", () => {
    expect(siteHref("/forum/post/22")).toBe("/forum/post/22");
    expect(siteHref("#comments")).toBe("#comments");
  });

  it("keeps a path that would resolve against another host absolute", () => {
    expect(siteHref("https://worldalliance.org//evil.com/x")).toBe(
      "https://worldalliance.org//evil.com/x",
    );
  });

  it("leaves everywhere else as authored", () => {
    expect(siteHref("https://admin.worldalliance.org/actions/5")).toBe(
      "https://admin.worldalliance.org/actions/5",
    );
    expect(siteHref("https://www.regulations.gov/document/FS-1")).toBe(
      "https://www.regulations.gov/document/FS-1",
    );
    expect(siteHref("mailto:contact@worldalliance.org")).toBe(
      "mailto:contact@worldalliance.org",
    );
  });
});
