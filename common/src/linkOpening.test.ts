import {
  MAX_DESTINATION_LENGTH,
  normalizeDestination,
  trackedArrival,
} from "./linkOpening";

describe("normalizeDestination", () => {
  it("keeps content parameters and drops the rest, with the fragment", () => {
    expect(
      normalizeDestination(
        "/forum/post/12?replyId=34&ref=invitecode&token=secret#comment",
      ),
    ).toBe("/forum/post/12?replyId=34");
    expect(normalizeDestination("/groups?tab=members&communityId=5")).toBe(
      "/groups?communityId=5&tab=members",
    );
  });

  it("replaces a segment that isn't a plain word or ID", () => {
    expect(normalizeDestination("/progress/a%20b/")).toBe("/progress/:param");
  });

  it("drops a content parameter with an unexpected value", () => {
    expect(normalizeDestination("/groups?tab=<script>")).toBe("/groups");
  });

  it("reads a doubled leading slash as a path", () => {
    expect(normalizeDestination("//forum/post/12")).toBe("/forum/post/12");
    expect(normalizeDestination("/\\forum/post/12")).toBe("/forum/post/12");
    expect(normalizeDestination("/\\:x")).toBe("/:param");
    expect(normalizeDestination("/\t/[x")).toBe("/:param");
    expect(normalizeDestination(" //[")).toBe("/:param");
    expect(normalizeDestination("/\n/evil.example/tasks")).toBe(
      "/evil.example/tasks",
    );

    expect(normalizeDestination("http://[")).toBe("/:param/:param");
    expect(normalizeDestination("tasks")).toBe("/tasks");
  });

  it("keeps only the first segment of a destination past the limit", () => {
    const long = `/forum/${Array(10).fill("a".repeat(100)).join("/")}`;
    expect(normalizeDestination(long)).toBe("/forum");
    const first = `/${"a".repeat(128)}`;
    const fallback = normalizeDestination(
      `${first}/${Array(5).fill("b".repeat(128)).join("/")}`,
    );
    expect(fallback).toBe(first);
    expect(fallback.length).toBeLessThanOrEqual(MAX_DESTINATION_LENGTH);
  });

  it("is idempotent", () => {
    for (const path of [
      "/",
      "/progress/a%20b/",
      "/forum/post/12?replyId=34&ref=x#c",
      "/groups?tab=members&communityId=5",
      "/groups?tab=<script>",
      "//forum/post/12",
      `/forum/${Array(10).fill("a".repeat(100)).join("/")}`,
    ]) {
      expect(normalizeDestination(normalizeDestination(path))).toBe(
        normalizeDestination(path),
      );
    }
  });
});

describe("trackedArrival", () => {
  it("strips the tracking ID and keeps functional parameters and the fragment", () => {
    expect(
      trackedArrival(
        "https://thealliance.org/signup?ref=invitecode&cid=abc123#top",
      ),
    ).toEqual({
      trackingId: "abc123",
      destination: "/signup",
      url: "https://thealliance.org/signup?ref=invitecode#top",
    });
  });

  it("reads an app-scheme URL's host as its first segment", () => {
    expect(trackedArrival("alliance://actions/7?cid=abc123")).toEqual({
      trackingId: "abc123",
      destination: "/actions/7",
      url: "alliance://actions/7",
    });
  });

  it("reads an app-scheme URL whose path starts with a backslash", () => {
    expect(
      trackedArrival("alliance:///\\x/tasks?cid=abc123")?.destination,
    ).toBe("/x/tasks");
  });

  it("reads an app-scheme URL without a host by its path", () => {
    expect(
      trackedArrival("alliance:///actions/7?cid=abc123")?.destination,
    ).toBe("/actions/7");
  });

  it("is null for a malformed tracking ID", () => {
    expect(
      trackedArrival("https://thealliance.org/tasks?cid=a%20b"),
    ).toBeNull();
    expect(
      trackedArrival(`https://thealliance.org/tasks?cid=${"a".repeat(65)}`),
    ).toBeNull();
  });

  it("is null without a tracking ID", () => {
    expect(trackedArrival("https://thealliance.org/tasks")).toBeNull();
    expect(trackedArrival("https://thealliance.org/tasks?cid=")).toBeNull();
    expect(trackedArrival("not a url")).toBeNull();
  });
});
