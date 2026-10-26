import { describe, expect, test } from "bun:test";
import { adminPathFor, memberPathFor } from "./zoneLinks";

describe("adminPathFor", () => {
  test.each([
    ["/actions/12", "/actions/12"],
    ["/actions/12/activity/3", "/actions/12"],
    ["/feed/12", "/actions/12"],
    ["/member/7", "/member/7"],
    ["/forum/post/4", "/posts/4"],
    ["/forum/edit/4", "/posts/4"],
    ["/groups", "/groups"],
    ["/groups-guide", "/"],
    ["/actions", "/"],
    ["/tasks", "/"],
  ])("%s → %s", (pathname, expected) => {
    expect(adminPathFor(pathname)).toBe(expected);
  });
});

describe("memberPathFor", () => {
  test.each([
    ["/actions/12", "/actions/12"],
    ["/actions/12/updates/3", "/actions/12"],
    ["/member/7", "/member/7"],
    ["/posts/4", "/forum/post/4"],
    ["/members/tags", "/members"],
    ["/posts", "/tasks"],
    ["/", "/tasks"],
  ])("%s → %s", (pathname, expected) => {
    expect(memberPathFor(pathname)).toBe(expected);
  });
});
