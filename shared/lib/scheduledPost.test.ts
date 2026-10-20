import { describe, expect, test } from "bun:test";
import { formatFullDateTime } from "./dateFormatters";
import { isScheduledPost, scheduledPostNotice } from "./scheduledPost";

const now = new Date("2026-05-01T12:00:00.000Z");

describe("isScheduledPost", () => {
  test("a post with no visibleAt is not scheduled", () => {
    expect(isScheduledPost({ visibleAt: null }, now)).toBe(false);
  });

  test("a post whose visibleAt has passed is not scheduled", () => {
    expect(
      isScheduledPost({ visibleAt: "2026-05-01T11:59:59.000Z" }, now),
    ).toBe(false);
  });

  test("a post visible exactly now is not scheduled", () => {
    expect(isScheduledPost({ visibleAt: now.toISOString() }, now)).toBe(false);
  });

  test("a post whose visibleAt is still ahead is scheduled", () => {
    expect(
      isScheduledPost({ visibleAt: "2026-05-01T12:00:01.000Z" }, now),
    ).toBe(true);
  });
});

describe("scheduledPostNotice", () => {
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  test("list says how long until the post goes out", () => {
    expect(scheduledPostNotice.list(inThreeDays.toISOString())).toBe(
      "Not visible to members yet - will be posted in 3 days",
    );
  });

  test("detail names the full date and time the post goes out", () => {
    expect(scheduledPostNotice.detail(inThreeDays.toISOString())).toBe(
      `Not visible to members yet. This post is scheduled for ${formatFullDateTime(inThreeDays)}.`,
    );
  });
});
