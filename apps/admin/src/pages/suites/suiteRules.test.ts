import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { expect, test } from "bun:test";
import { suiteDates, suitePhase, suiteRows } from "./suiteRules";

const now = new Date("2026-11-25T12:00:00Z");
const start = makeEvent({
  id: 1,
  newStatus: "member_action",
  date: "2026-11-18T03:00:00Z",
  suiteManaged: true,
});
const deadline = makeEvent({
  id: 2,
  newStatus: "office_action",
  date: "2026-12-02T07:59:00Z",
  suiteManaged: true,
});

test("a suite with no event in effect is a draft, a launch still ahead included", () => {
  expect(suitePhase([], now)).toBe("draft");
  expect(suitePhase([{ ...start, date: "2026-11-26T03:00:00Z" }], now)).toBe(
    "draft",
  );
});

test("a suite's phase is that of its latest shared event to take effect", () => {
  expect(suitePhase([deadline, start], now)).toBe("member_action");
  expect(suitePhase([start, deadline], new Date(deadline.date))).toBe(
    "office_action",
  );
});

test("members' deadline is the first event after their start", () => {
  expect(suiteDates([deadline, start])).toEqual({
    membersStart: start.date,
    deadline: deadline.date,
  });
  expect(suiteDates([deadline])).toEqual({
    membersStart: null,
    deadline: null,
  });
});

test("a suite's row takes its tasks and shared events from the tasks list", () => {
  const own = makeEvent({ id: 3, newStatus: "completed", date: start.date });
  const rows = suiteRows({
    suites: [
      { id: 1, name: "Launched" },
      { id: 2, name: "Empty" },
    ],
    tasks: [
      {
        ...makeAction({ id: 7, name: "Survey" }),
        suite: { id: 1 },
        events: [start, deadline, own],
      },
      { ...makeAction({ id: 8, name: "No suite" }), events: [start] },
    ],
    now,
  });

  expect(rows).toEqual([
    {
      id: 2,
      name: "Empty",
      tasks: [],
      phase: "draft",
      membersStart: null,
      deadline: null,
    },
    {
      id: 1,
      name: "Launched",
      tasks: [{ id: 7, name: "Survey" }],
      phase: "member_action",
      membersStart: start.date,
      deadline: deadline.date,
    },
  ]);
});

test("a suite's row reads its shared events from the first task that has them", () => {
  const [row] = suiteRows({
    suites: [{ id: 1, name: "Joined late" }],
    tasks: [
      { ...makeAction({ id: 7 }), suite: { id: 1 }, events: [] },
      { ...makeAction({ id: 8 }), suite: { id: 1 }, events: [start, deadline] },
    ],
    now,
  });

  expect(row.phase).toBe("member_action");
  expect(row.membersStart).toBe(start.date);
});

test("a suite's row says nothing of its tasks when they didn't load", () => {
  expect(
    suiteRows({ suites: [{ id: 1, name: "Any" }], tasks: undefined, now }),
  ).toEqual([
    {
      id: 1,
      name: "Any",
      tasks: null,
      phase: null,
      membersStart: null,
      deadline: null,
    },
  ]);
});
