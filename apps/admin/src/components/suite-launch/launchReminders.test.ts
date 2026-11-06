import { describe, expect, it } from "bun:test";
import { defaultReminderBodies } from "../reminders/presets";
import {
  nightRecipientCount,
  remindersBeforeLaunch,
  reminderSendWindows,
  reminderVariants,
  renderLaunchReminder,
} from "./launchReminders";

const schedule = {
  memberActionAt: new Date("2026-11-01T02:00:00Z"),
  officeActionAt: new Date("2026-11-08T07:59:00Z"),
};
const bodies = defaultReminderBodies({ suiteId: 3, hasDeadline: true });

describe("reminderSendWindows", () => {
  it("times each default reminder from the launch or the office action deadline", () => {
    const windows = reminderSendWindows({ bodies, schedule });
    expect(
      windows.map(({ name, start, end }) => [
        name,
        start.toISOString(),
        end.toISOString(),
      ]),
    ).toEqual([
      [
        "Member Action announcement",
        "2026-11-01T02:00:00.000Z",
        "2026-11-01T02:00:00.000Z",
      ],
      [
        "24-48h reminder",
        "2026-11-06T07:59:00.000Z",
        "2026-11-07T07:59:00.000Z",
      ],
      [
        "6-24h reminder",
        "2026-11-07T07:59:00.000Z",
        "2026-11-08T01:59:00.000Z",
      ],
      [
        "3 hour reminder",
        "2026-11-08T04:59:00.000Z",
        "2026-11-08T04:59:00.000Z",
      ],
      [
        "Missed deadline message",
        "2026-11-08T07:59:00.000Z",
        "2026-11-08T07:59:00.000Z",
      ],
      [
        "Group leads 3 days reminder",
        "2026-11-05T07:59:00.000Z",
        "2026-11-06T07:59:00.000Z",
      ],
      [
        "Group leads 2 days reminder",
        "2026-11-06T07:59:00.000Z",
        "2026-11-07T07:59:00.000Z",
      ],
    ]);
    expect(remindersBeforeLaunch(windows, schedule)).toEqual([]);
  });

  it("flags reminders a short window would send before members start", () => {
    const short = {
      ...schedule,
      officeActionAt: new Date("2026-11-03T02:00:00Z"),
    };
    expect(
      remindersBeforeLaunch(
        reminderSendWindows({ bodies, schedule: short }),
        short,
      ).map(({ name }) => name),
    ).toEqual(["Group leads 3 days reminder"]);
  });

  it("refuses a deadline reminder with no offset, as the server does", () => {
    expect(() =>
      reminderSendWindows({
        bodies: [{ ...bodies[3], sendAtSecondsFromDeadline: undefined }],
        schedule,
      }),
    ).toThrow("a launch reminder needs its offsets from the deadline");
  });
});

describe("nightRecipientCount", () => {
  const at = (iso: string) => ({
    name: "Reminder",
    start: new Date(iso),
    end: new Date(iso),
  });

  it("counts members it reaches between 10pm and 8am their time, Pacific when unset", () => {
    // 11:59pm Pacific, 2:59am Eastern, 4:59pm Tokyo.
    const window = at("2026-11-08T07:59:00Z");
    expect(
      nightRecipientCount({
        window,
        timeZones: [null, "America/New_York", "Asia/Tokyo"],
      }),
    ).toBe(2);
  });

  it("treats 8am as morning and 10pm as night", () => {
    expect(
      nightRecipientCount({
        window: at("2026-11-08T16:00:00Z"),
        timeZones: ["America/Los_Angeles"],
      }),
    ).toBe(0);
    expect(
      nightRecipientCount({
        window: at("2026-11-09T06:00:00Z"),
        timeZones: ["America/Los_Angeles"],
      }),
    ).toBe(1);
  });

  it("never counts a range reminder, which sends at each member's preferred time", () => {
    expect(
      nightRecipientCount({
        window: {
          name: "24-48h reminder",
          start: new Date("2026-11-06T07:59:00Z"),
          end: new Date("2026-11-07T07:59:00Z"),
        },
        timeZones: [null],
      }),
    ).toBe(0);
  });
});

describe("renderLaunchReminder", () => {
  const windows = reminderSendWindows({ bodies, schedule });
  const rendered = (name: string) => {
    const index = bodies.findIndex((body) => body.name === name);
    return renderLaunchReminder({
      body: bodies[index],
      window: windows[index],
      schedule,
      member: { id: 10, name: "Ana Lopez" },
      memberActions: [
        { name: "Call", timeEstimate: 10, optional: false },
        { name: "Write", timeEstimate: 5, optional: true },
      ],
      suiteActionName: "Call",
      siteUrl: "https://example.org",
      isFirstAssignedSuite: false,
    });
  };

  it("fills the announcement with the member's actions and time to finish", () => {
    const announcement = rendered("Member Action announcement");
    expect(announcement.textMessage).toBe(
      "New Alliance tasks: Call, Write. Complete within 7 days (https://example.org/tasks)",
    );
    expect(announcement.emailSubject).toBe(
      "2 new Alliance tasks need completion within 7 days",
    );
    expect(announcement.emailMessage).toStartWith("Hi Ana,");
    expect(announcement.pushMessage).toBe("New tasks: Call, Write");
  });

  it("counts time left from the send time, and leaves out optional actions when the reminder does", () => {
    expect(rendered("3 hour reminder").textMessage).toBe(
      "You have 3 hours left to complete 2 Alliance tasks (https://example.org/tasks)",
    );
    const missed = bodies.findIndex(
      (body) => body.name === "Missed deadline message",
    );
    expect(
      renderLaunchReminder({
        body: { ...bodies[missed], textMessage: "#{n}: #{tasknames}" },
        window: windows[missed],
        schedule,
        member: { id: 10, name: "Ana Lopez" },
        memberActions: [
          { name: "Call", timeEstimate: 10, optional: false },
          { name: "Write", timeEstimate: 5, optional: true },
        ],
        suiteActionName: "Call",
        siteUrl: "",
        isFirstAssignedSuite: false,
      }).textMessage,
    ).toBe("1: Call");
  });

  it("previews the missed deadline message as each kind of miss gets it", () => {
    const missed = bodies.findIndex(
      (body) => body.name === "Missed deadline message",
    );
    const emails = reminderVariants(bodies[missed]).map(
      ({ body, isFirstAssignedSuite }) =>
        renderLaunchReminder({
          body,
          window: windows[missed],
          schedule,
          member: { id: 10, name: "Ana Lopez" },
          memberActions: [{ name: "Call", timeEstimate: 5, optional: false }],
          suiteActionName: "Call",
          siteUrl: "",
          isFirstAssignedSuite,
        }).emailMessage,
    );
    expect(emails).toHaveLength(4);
    const [first, before, variant, second] = emails;
    expect(first).toContain("suspend your contract");
    expect(before).not.toContain("suspend your contract");
    expect(variant).toContain(
      "The deadline for Call passed and we have no completion recorded for you.",
    );
    expect(second).toContain("You have missed two consecutive weeks of tasks.");
    expect(reminderVariants(bodies[0]).map((variant) => variant.label)).toEqual(
      [null],
    );
  });

  it("recognizes a missed deadline message the way the server does", () => {
    const body = bodies[0];
    expect(
      reminderVariants({ ...body, emailMessage: "#{secondmisswarning}" }),
    ).toHaveLength(4);
    expect(
      reminderVariants({ ...body, textMessage: "#{missedactioncontext}" }),
    ).toHaveLength(1);
  });

  it("renders a group leads reminder for a sample group", () => {
    expect(rendered("Group leads 3 days reminder").emailSubject).toBe(
      "3 of your Alliance group members have not yet completed their upcoming task",
    );
  });
});
