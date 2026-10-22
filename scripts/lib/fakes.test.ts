import { describe, expect, test } from "bun:test";
import {
  dateShifter,
  type FakeFile,
  fakeFileSchema,
  splitEvents,
  syncFileDates,
} from "./fakes";

const staging = {
  kind: "staging",
  recordedAt: "2026-10-10T12:00:00Z",
  action: { name: "Synthetic action" },
  events: [],
  participants: [
    { userId: 1, at: "2026-10-09T12:00:00Z", outcome: "dismissed" },
  ],
  updates: [],
};

describe("fakeFileSchema", () => {
  test("accepts a staging file", () => {
    expect(fakeFileSchema.safeParse(staging).success).toBe(true);
  });

  test("rejects a completion without answers", () => {
    const file = {
      ...staging,
      participants: [
        {
          userId: 1,
          at: "2026-10-09T12:00:00Z",
          outcome: "completed",
          deviceType: "desktop",
        },
      ],
    };
    expect(fakeFileSchema.safeParse(file).success).toBe(false);
  });

  test("rejects a device the server doesn't accept", () => {
    const file = {
      ...staging,
      participants: [
        {
          userId: 1,
          at: "2026-10-09T12:00:00Z",
          outcome: "completed",
          deviceType: "watch",
          answers: {},
        },
      ],
    };
    expect(fakeFileSchema.safeParse(file).success).toBe(false);
  });

  test("rejects unknown keys", () => {
    expect(fakeFileSchema.safeParse({ ...staging, extra: 1 }).success).toBe(
      false,
    );
  });

  test("rejects activity after recordedAt", () => {
    const file = {
      ...staging,
      participants: [
        { userId: 1, at: "2026-10-11T12:00:00Z", outcome: "idle" },
      ],
    };
    const parsed = fakeFileSchema.safeParse(file);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.message).toContain("after recordedAt");
  });
});

describe("dateShifter", () => {
  test("lands recordedAt on now and keeps spacing", () => {
    const shift = dateShifter({
      recordedAt: "2026-10-10T12:00:00Z",
      now: new Date("2026-11-01T12:00:00Z"),
    });
    expect(shift("2026-10-10T12:00:00Z").toISOString()).toBe(
      "2026-11-01T12:00:00.000Z",
    );
    expect(shift("2026-10-08T12:00:00Z").toISOString()).toBe(
      "2026-10-30T12:00:00.000Z",
    );
  });
});

describe("splitEvents", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const shift = (iso: string) => new Date(iso);
  const event = (newStatus: string, date: string) => ({
    title: newStatus,
    description: "",
    newStatus,
    date,
  });

  test("defers only past events that end the member phase", () => {
    const launch = event("member_action", "2026-10-20T12:00:00Z");
    const closed = event("office_action", "2026-10-25T12:00:00Z");
    const deadline = event("office_action", "2026-11-05T12:00:00Z");
    expect(
      splitEvents({ events: [launch, closed, deadline], shift, now }),
    ).toEqual({ before: [launch, deadline], after: [closed] });
  });
});

describe("syncFileDates", () => {
  test("takes the db's dates and moves what the db lacks by the delta", () => {
    const file = fakeFileSchema.parse({
      ...staging,
      events: [
        {
          title: "Close",
          description: "",
          newStatus: "office_action",
          date: "2026-10-09T00:00:00Z",
        },
      ],
      participants: [
        { userId: 1, at: "2026-10-09T12:00:00Z", outcome: "dismissed" },
        { userId: 2, at: "2026-10-09T13:00:00Z", outcome: "idle" },
      ],
    }) satisfies FakeFile;
    const synced = syncFileDates({
      file,
      db: {
        events: [
          {
            title: "Close",
            newStatus: "office_action",
            date: "2026-09-20T00:00:00.000Z",
          },
        ],
        activityByUser: new Map([[1, "2026-09-18T08:00:00.000Z"]]),
        updateByTitle: new Map(),
      },
      deltaMs: -864e5,
      now: new Date("2026-10-22T00:00:00Z"),
    });
    expect(synced.recordedAt).toBe("2026-10-22T00:00:00.000Z");
    expect(synced.events[0].date).toBe("2026-09-20T00:00:00.000Z");
    expect(synced.participants.map((p) => p.at)).toEqual([
      "2026-09-18T08:00:00.000Z",
      "2026-10-08T13:00:00.000Z",
    ]);
  });
});
