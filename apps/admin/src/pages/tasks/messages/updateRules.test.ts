import {
  audienceOf,
  dateHelpOf,
  detailsSaveNoteOf,
  hiddenNoticeOf,
  missingForCreate,
  notificationFactOf,
  pacific,
  visibilityOf,
} from "./updateRules";

const now = new Date("2026-10-10T12:00:00.000Z");
const past = "2026-10-01T00:00:00.000Z";
const future = "2026-10-20T00:00:00.000Z";

describe("audienceOf", () => {
  it("names the tag a tag audience reaches", () => {
    expect(audienceOf({ notifyType: "tag", tag: { name: "Captains" } })).toBe(
      "every member tagged “Captains”",
    );
  });

  it("says all members means members with an active contract", () => {
    expect(audienceOf({ notifyType: "all_members" })).toBe(
      "every member with an active contract",
    );
  });
});

describe("notificationFactOf", () => {
  it("claims only the latest a sent notification reaches members", () => {
    expect(
      notificationFactOf(
        {
          notifyType: "all_members",
          notifiedAt: past,
          date: future,
          visibleAt: past,
        },
        now,
      ),
    ).toBe(`Sent ${pacific(past)}, members get it by ${pacific(future)}`);
    expect(
      notificationFactOf(
        {
          notifyType: "all_members",
          notifiedAt: past,
          date: past,
          visibleAt: null,
        },
        now,
      ),
    ).toBe(`Sent ${pacific(past)}`);
  });
});

describe("dateHelpOf", () => {
  it("doesn't promise a published update hides until its date", () => {
    expect(dateHelpOf(visibilityOf({ visibleAt: past }, now))).toContain(
      "changing the date doesn't hide it",
    );
  });
});

describe("detailsSaveNoteOf", () => {
  it("says nothing for an update members can't see yet", () => {
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: null, date: future, notifiedAt: null },
        date: past,
        now,
      }),
    ).toBe("");
  });

  it("says a scheduled update whose date is moved into the past publishes at once", () => {
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: future, date: future, notifiedAt: null },
        date: past,
        now,
      }),
    ).toMatch(/publishes the update to members at once/);
  });

  it("says when a scheduled update's new date publishes it", () => {
    const later = "2026-10-25T00:00:00.000Z";
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: future, date: future, notifiedAt: null },
        date: later,
        now,
      }),
    ).toBe(`Saving moves its publication to ${pacific(later)}.`);
  });

  it("says a new past date sends a sent notification still on its way at once", () => {
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: future, date: future, notifiedAt: past },
        date: past,
        now,
      }),
    ).toBe(
      "Saving publishes the update to members at once, since its date has passed. Saving sends the notification to members at once.",
    );
  });

  it("says where a new date moves a sent notification still on its way", () => {
    const later = "2026-10-25T00:00:00.000Z";
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: past, date: future, notifiedAt: past },
        date: later,
        now,
      }),
    ).toBe(
      `Members who can see the task see the changes at once. Saving moves the notification to ${pacific(later)}.`,
    );
  });

  it("says nothing of a notification already delivered", () => {
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: past, date: past, notifiedAt: past },
        date: future,
        now,
      }),
    ).toBe("Members who can see the task see the changes at once.");
  });

  it("says a published update's changes reach members at once", () => {
    expect(
      detailsSaveNoteOf({
        saved: { visibleAt: past, date: past, notifiedAt: null },
        date: past,
        now,
      }),
    ).toMatch(/at once/);
  });
});

it("says when a scheduled update publishes", () => {
  expect(hiddenNoticeOf(visibilityOf({ visibleAt: future }, now))).toContain(
    pacific(future),
  );
});

it("lists everything a new update still needs", () => {
  expect(
    missingForCreate({
      title: " ",
      date: "",
      notifyType: "tag",
      shortNotifString: "a vote",
    }),
  ).toBe("Add a title. Pick a date. Pick the tag to notify.");
});
