import { describe, expect, it } from "bun:test";
import { notificationRoute } from "./notificationRoute";

describe("notificationRoute", () => {
  it("adds a leading slash and keeps the query", () => {
    expect(notificationRoute("forum/post/22?ref=push")).toBe(
      "/forum/post/22?ref=push",
    );
    expect(notificationRoute("/actions/5")).toBe("/actions/5");
    expect(notificationRoute("/a?next=/b?c=1")).toBe("/a?next=/b?c=1");
  });

  it("opens home for the web-only tasks page", () => {
    expect(notificationRoute("/tasks")).toBe("/");
    expect(notificationRoute("tasks?ref=push")).toBe("/");
  });

  it("has no route without a location", () => {
    expect(notificationRoute(undefined)).toBeNull();
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute("")).toBeNull();
  });
});
