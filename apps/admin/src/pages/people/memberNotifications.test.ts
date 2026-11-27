import { expect, it } from "bun:test";
import { byChannel, linkClickedLabel } from "./memberNotifications";

it("says when a link was clicked and how long after it was sent", () => {
  expect(
    linkClickedLabel({
      clickedAt: new Date(2030, 0, 2, 14, 15).toISOString(),
      sentAt: new Date(2030, 0, 2, 12, 15).toISOString(),
    }),
    // eslint-disable-next-line admin/test-clock -- date-fns format, always without a year
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

it("orders texts and emails by each channel's own send time", () => {
  const emailedLate = {
    id: 1,
    mail: { createdAt: "2030-01-05T00:00:00Z" },
    mms: { createdAt: "2030-01-01T00:00:00Z" },
  };
  const textedLate = {
    id: 2,
    mail: { createdAt: "2030-01-02T00:00:00Z" },
    mms: { createdAt: "2030-01-03T00:00:00Z" },
  };

  const { texts, emails } = byChannel([emailedLate, textedLate]);

  expect(texts.map((notif) => notif.id)).toEqual([2, 1]);
  expect(emails.map((notif) => notif.id)).toEqual([1, 2]);
});
