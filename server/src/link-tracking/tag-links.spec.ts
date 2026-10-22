import { tagHtmlLinks, tagTextLinks, tagUrl } from "./tag-links";

describe("tag links", () => {
  const trackingId = "track-1";
  const originalAppUrl = process.env.APP_URL;
  beforeAll(() => {
    process.env.APP_URL = "https://app.example.org";
  });
  afterAll(() => {
    process.env.APP_URL = originalAppUrl;
  });

  it("tags app links and keeps their parameters and fragment", () => {
    expect(
      tagUrl({
        url: "https://thealliance.org/signup?ref=code#top",
        trackingId,
      }),
    ).toBe("https://thealliance.org/signup?ref=code&cid=track-1#top");
    expect(
      tagUrl({ url: "https://app.example.org/tasks?cid=old", trackingId }),
    ).toBe("https://app.example.org/tasks?cid=track-1");
  });

  it("leaves external, non-web, and share links alone", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=x",
      "https://admin.thealliance.org/x",
      "mailto:someone@example.org",
      "https://app.example.org/projects/democratic-grantmaking-26?ref=code",
    ]) {
      expect(tagUrl({ url, trackingId })).toBe(url);
    }
  });

  it("tags every app link in text, leaving punctuation after it", () => {
    expect(
      tagTextLinks({
        text: "Tasks: https://app.example.org/tasks. Group: https://thealliance.org/groups?tab=members, video https://youtube.com/x",
        trackingId,
      }),
    ).toBe(
      "Tasks: https://app.example.org/tasks?cid=track-1. Group: https://thealliance.org/groups?tab=members&cid=track-1, video https://youtube.com/x",
    );
  });

  it("tags link targets and written-out URLs in HTML", () => {
    const html = tagHtmlLinks({
      html: '<!DOCTYPE html><html><head><title>t</title></head><body><p>Go to https://app.example.org/tasks or <a href="https://thealliance.org/actions/3?a=1&amp;b=2">https://thealliance.org/actions/3</a> &amp; <a href="https://youtube.com/x">video</a></p></body></html>',
      trackingId,
    });
    expect(html).toContain("https://app.example.org/tasks?cid=track-1 or");
    expect(html).toContain(
      'href="https://thealliance.org/actions/3?a=1&amp;b=2&amp;cid=track-1"',
    );
    expect(html).toContain(">https://thealliance.org/actions/3</a>");
    expect(html).toContain('href="https://youtube.com/x"');
    expect(html).toContain("&amp; <a");
  });
});
