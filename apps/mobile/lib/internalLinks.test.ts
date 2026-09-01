import { extractPathFromInternalUrl, getInternalRoute } from "./internalLinks";

describe("extractPathFromInternalUrl", () => {
  it("takes the path from either of our domains", () => {
    expect(
      extractPathFromInternalUrl("https://thealliance.org/actions/12"),
    ).toBe("/actions/12");
    expect(
      extractPathFromInternalUrl("https://www.worldalliance.org/forum/3"),
    ).toBe("/forum/3");
    expect(
      extractPathFromInternalUrl("https://staging.thealliance.org/feed"),
    ).toBe("/feed");
  });

  it("keeps the query and hash", () => {
    expect(
      extractPathFromInternalUrl(
        "https://thealliance.org/actions?tab=open#top",
      ),
    ).toBe("/actions?tab=open#top");
  });

  it("leaves other hosts on our domains, other hosts, and other schemes alone", () => {
    expect(
      extractPathFromInternalUrl("https://admin.thealliance.org/actions/12"),
    ).toBeNull();
    expect(
      extractPathFromInternalUrl("https://help.thealliance.org/actions/12"),
    ).toBeNull();
    expect(
      extractPathFromInternalUrl("https://example.com/actions/12"),
    ).toBeNull();
    expect(
      extractPathFromInternalUrl("mailto:contact@thealliance.org"),
    ).toBeNull();
    expect(extractPathFromInternalUrl("/actions/12")).toBeNull();
  });
});

describe("getInternalRoute", () => {
  it("routes an absolute link on our domain", () => {
    const path = extractPathFromInternalUrl(
      "https://thealliance.org/action/12?ref=email",
    );
    expect(path && getInternalRoute(path)).toBe("/actions/12?ref=email");
  });

  it("is null for a path with no screen", () => {
    expect(getInternalRoute("/api/images/1765.webp")).toBeNull();
  });
});
