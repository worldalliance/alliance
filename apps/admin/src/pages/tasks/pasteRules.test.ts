import {
  EventsOutcomeKind,
  eventsOutcome,
  parsePastedTask,
  pasteBody,
  type PastedEvent,
} from "./pasteRules";

const now = new Date("2026-11-25T12:00:00.000Z");
const event = (
  newStatus: PastedEvent["newStatus"],
  date: string,
): PastedEvent => ({
  newStatus,
  date,
});

it("reads a task as live when an event other than Draft is in effect now", () => {
  const live = event("member_action", "2026-11-20T17:00:00.000Z");
  expect(
    eventsOutcome(
      [live, event("office_action", "2026-12-01T17:00:00.000Z")],
      now,
    ),
  ).toEqual({ kind: EventsOutcomeKind.Live, event: live });
});

it("reads a task as scheduled by its first later event other than Draft", () => {
  const launch = event("member_action", "2026-12-01T17:00:00.000Z");
  expect(
    eventsOutcome(
      [
        event("draft", "2026-11-01T17:00:00.000Z"),
        event("office_action", "2026-12-08T17:00:00.000Z"),
        launch,
      ],
      now,
    ),
  ).toEqual({ kind: EventsOutcomeKind.Scheduled, event: launch });
});

it("reads a task whose events are all Draft as staying a draft", () => {
  expect(
    eventsOutcome([event("draft", "2026-12-01T17:00:00.000Z")], now),
  ).toEqual({ kind: EventsOutcomeKind.StaysDraft });
});

it("drops the events from the body unless they are included, keeping every other field", () => {
  const parsed = parsePastedTask(
    JSON.stringify({
      name: "Call your rep",
      priority: 4,
      events: [
        { newStatus: "member_action", date: "2026-11-20T17:00:00.000Z" },
      ],
    }),
  );
  if (!parsed.ok) throw new Error(parsed.error);
  expect(JSON.parse(pasteBody(parsed.value, { includeEvents: false }))).toEqual(
    {
      name: "Call your rep",
      priority: 4,
    },
  );
  expect(
    JSON.parse(pasteBody(parsed.value, { includeEvents: true })).events,
  ).toHaveLength(1);
});

it("refuses text that isn't JSON or a task", () => {
  expect(parsePastedTask("{").ok).toBe(false);
  expect(parsePastedTask("").ok).toBe(false);
  expect(parsePastedTask(JSON.stringify({ name: "" })).ok).toBe(false);
  expect(
    parsePastedTask(
      JSON.stringify({
        name: "x",
        events: [{ newStatus: "live", date: "soon" }],
      }),
    ).ok,
  ).toBe(false);
});
