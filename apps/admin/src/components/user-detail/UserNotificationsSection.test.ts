import { expect, it } from "bun:test";
import { linkClickedLabel } from "./UserNotificationsSection";

it("says when a link was clicked and how long after it was sent", () => {
  expect(
    linkClickedLabel({
      clickedAt: new Date(2030, 0, 2, 14, 15).toISOString(),
      sentAt: new Date(2030, 0, 2, 12, 15).toISOString(),
    }),
  ).toBe("Link clicked Jan 2, 2:15 PM, 2 hours after sending");
});

it("says only that it was clicked when the time wasn't recorded", () => {
  expect(
    linkClickedLabel({
      clickedAt: null,
      sentAt: new Date(2030, 0, 2).toISOString(),
    }),
  ).toBe("Link clicked");
});
