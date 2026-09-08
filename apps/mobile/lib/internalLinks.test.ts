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

  it("routes one action's activity feed to the action's activity tab", () => {
    expect(getInternalRoute("/feed/146")).toBe("/actions/146?tab=activity");
    expect(getInternalRoute("/feed/146?ref=email")).toBe(
      "/actions/146?tab=activity&ref=email",
    );
    expect(getInternalRoute("/feed")).toBe("/feed");
  });

  it("routes a path written without a leading slash", () => {
    expect(getInternalRoute("forum/post/22")).toBe("/forum/post/22");
    expect(getInternalRoute("actions/5")).toBe("/actions/5");
    expect(getInternalRoute("search")).toBe("/search");
    expect(getInternalRoute("feed/146?ref=email")).toBe(
      "/actions/146?tab=activity&ref=email",
    );
  });

  it("keeps the query string and hash on a schemeless path", () => {
    expect(getInternalRoute("forum/post/22#c3")).toBe("/forum/post/22#c3");
    expect(getInternalRoute("member/7?tab=posts")).toBe("/member/7?tab=posts");
  });

  it("declines a URL that carries a scheme", () => {
    expect(getInternalRoute("mailto:a@b.org")).toBeNull();
    expect(getInternalRoute("tel:+15551234567")).toBeNull();
    expect(
      getInternalRoute("https://worldalliance.org/forum/post/22"),
    ).toBeNull();
    expect(getInternalRoute("JAVASCRIPT:alert(1)")).toBeNull();
  });

  it("declines a protocol-relative URL", () => {
    expect(getInternalRoute("//worldalliance.org/forum/post/22")).toBeNull();
  });

  it("is null for a path with no screen", () => {
    expect(getInternalRoute("/api/images/1765.webp")).toBeNull();
    expect(getInternalRoute("faq")).toBeNull();
    expect(getInternalRoute("#intro")).toBeNull();
    expect(getInternalRoute("?q=hi")).toBeNull();
  });
});
