import type {
  ActionEventDto,
  ActionSuiteDto,
  CreateActionEventDto,
  CreateReminderGroupDto,
} from "@alliance/shared/client";
import { describe, expect, it, mock } from "bun:test";
import { defaultReminderBodies } from "../reminders/presets";
import { launchSuite, refetchedOrThrow } from "./launchSuite";

const schedule = {
  memberActionAt: new Date("2026-01-16T03:00:00Z"),
  officeActionAt: new Date("2026-01-23T07:59:00Z"),
};

const event = (id: number, body: CreateActionEventDto): ActionEventDto => ({
  id,
  ...body,
  suiteManaged: true,
});

const suiteWith = (events: ActionEventDto[]): ActionSuiteDto => ({
  id: 3,
  name: "Suite",
  actions: [],
  events,
  reminderGroups: [],
  generalUpdates: [],
});

const appendingAddEvent = (initial: ActionEventDto[]) => {
  const events = [...initial];
  return mock(async (body: CreateActionEventDto) => {
    events.push(event(100 + events.length, body));
    return suiteWith([...events]);
  });
};

const draftEvent = event(1, {
  title: "Draft",
  description: "",
  newStatus: "draft",
  date: "2026-01-01T00:00:00Z",
});

describe("launchSuite", () => {
  it("creates the member and office events, then the default reminders on the new member event", async () => {
    const addEvent = appendingAddEvent([draftEvent]);
    const createReminders = mock(
      async (_: { eventId: number; bodies: CreateReminderGroupDto[] }) => [],
    );

    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([draftEvent]),
      schedule,
      addEvent,
      createReminders,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(addEvent.mock.calls.map(([body]) => body)).toEqual([
      {
        title: "Members taking action",
        description: "",
        newStatus: "member_action",
        date: "2026-01-16T03:00:00.000Z",
      },
      {
        title: "Office taking action",
        description: "",
        newStatus: "office_action",
        date: "2026-01-23T07:59:00.000Z",
      },
    ]);
    expect(createReminders.mock.calls).toEqual([
      [
        {
          eventId: 101,
          bodies: defaultReminderBodies({ suiteId: 3, hasDeadline: true }),
        },
      ],
    ]);
  });

  it("stops before anything else when the member event fails", async () => {
    const addEvent = mock(async () => {
      throw new Error("boom");
    });
    const createReminders = mock(async () => []);

    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([]),
      schedule,
      addEvent,
      createReminders,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("Nothing was launched");
    expect(addEvent).toHaveBeenCalledTimes(1);
    expect(createReminders).not.toHaveBeenCalled();
  });

  it("reports a declined member event as cancelled", async () => {
    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([]),
      schedule,
      addEvent: async () => null,
      createReminders: async () => [],
    });

    expect(result).toEqual({
      ok: false,
      error: "Launch cancelled. Nothing was created.",
    });
  });

  it("says what exists when the office event fails", async () => {
    const appending = appendingAddEvent([]);
    const addEvent = mock(async (body: CreateActionEventDto) => {
      if (body.newStatus === "office_action") throw new Error("boom");
      return appending(body);
    });
    const createReminders = mock(async () => []);

    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([]),
      schedule,
      addEvent,
      createReminders,
    });

    expect(!result.ok && result.error).toStartWith(
      "Created the member action event, but not the office action event",
    );
    expect(createReminders).not.toHaveBeenCalled();
  });

  it("says what exists when the reminders fail", async () => {
    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([]),
      schedule,
      addEvent: appendingAddEvent([]),
      createReminders: async () => {
        throw new Error("boom");
      },
    });

    expect(!result.ok && result.error).toStartWith(
      "Created both events, but not all default reminders",
    );
    expect(!result.ok && result.error).toEndWith(
      "Add the missing ones in Reminders on the suite page.",
    );
  });

  it("refuses when someone launched the suite since the page loaded", async () => {
    const memberEvent = event(2, {
      title: "Members taking action",
      description: "",
      newStatus: "member_action",
      date: "2026-01-16T03:00:00Z",
    });
    const addEvent = appendingAddEvent([memberEvent]);

    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([memberEvent]),
      schedule,
      addEvent,
      createReminders: async () => [],
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Someone launched this suite since this page loaded. Nothing was created.",
    });
    expect(addEvent).not.toHaveBeenCalled();
  });

  it("creates nothing when it can't reload the suite to check", async () => {
    const addEvent = appendingAddEvent([]);

    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => {
        throw new Error("offline");
      },
      schedule,
      addEvent,
      createReminders: async () => [],
    });

    expect(!result.ok && result.error).toEndWith("Nothing was launched.");
    expect(addEvent).not.toHaveBeenCalled();
  });

  it("refuses a suite that gained a deadline event since the page loaded", async () => {
    const officeEvent = event(2, {
      title: "Office taking action",
      description: "",
      newStatus: "office_action",
      date: "2026-01-23T07:59:00Z",
    });
    const addEvent = appendingAddEvent([officeEvent]);

    const result = await launchSuite({
      suiteId: 3,
      fetchSuite: async () => suiteWith([officeEvent]),
      schedule,
      addEvent,
      createReminders: async () => [],
    });

    expect(!result.ok && result.error).toEndWith("Nothing was created.");
    expect(addEvent).not.toHaveBeenCalled();
  });
});

describe("refetchedOrThrow", () => {
  it("throws when the reload failed, even with cached data still around", async () => {
    const cached = suiteWith([]);
    const failure = new Error("offline");

    await expect(
      refetchedOrThrow(async () => ({
        data: cached,
        isError: true,
        error: failure,
      })),
    ).rejects.toBe(failure);
    expect(
      await refetchedOrThrow(async () => ({
        data: cached,
        isError: false,
        error: null,
      })),
    ).toBe(cached);
  });
});
