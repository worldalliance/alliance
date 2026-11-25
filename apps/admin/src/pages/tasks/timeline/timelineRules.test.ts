import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";
import type { TimelineRow } from "../../../lib/actionTimelineData";
import {
  GROUP_PX,
  GroupBy,
  groupRows,
  projectCat,
  readGroupBy,
  ROW_PX,
  rowTops,
  suitePhase,
  suiteWindow,
} from "./timelineRules";

const now = new Date("2026-11-25T12:00:00Z");

const event = (
  date: string,
  newStatus: ActionStatus,
  suiteManaged = true,
): ActionEventDto => ({
  id: Math.random(),
  title: "",
  description: "",
  date,
  newStatus,
  suiteManaged,
});

const row = (id: number): TimelineRow => ({
  action: { id, name: `Task ${id}`, status: "draft" },
  phases: [],
});

describe("readGroupBy", () => {
  it("groups by suite unless the param names project", () => {
    expect(readGroupBy(null)).toBe(GroupBy.Suite);
    expect(readGroupBy("nonsense")).toBe(GroupBy.Suite);
    expect(readGroupBy("project")).toBe(GroupBy.Project);
  });
});

describe("suitePhase", () => {
  it("is the shared event in effect now, ignoring a task's own events", () => {
    const events = [
      event("2026-11-20T03:00:00Z", "member_action"),
      event("2026-11-23T03:00:00Z", "office_action", false),
      event("2026-11-30T07:59:00Z", "office_action"),
    ];
    expect(suitePhase(events, now)).toBe("member_action");
  });

  it("is a draft before any shared event", () => {
    expect(
      suitePhase([event("2026-12-01T00:00:00Z", "member_action")], now),
    ).toBe("draft");
    expect(suitePhase([], now)).toBe("draft");
  });
});

describe("suiteWindow", () => {
  it("runs from the shared member action to the shared deadline", () => {
    expect(
      suiteWindow([
        event("2026-11-20T03:00:00Z", "member_action"),
        event("2026-11-30T07:59:00Z", "office_action"),
      ]),
    ).toEqual({
      start: new Date("2026-11-20T03:00:00Z"),
      end: new Date("2026-11-30T07:59:00Z"),
    });
  });

  it("is null without a deadline", () => {
    expect(
      suiteWindow([event("2026-11-20T03:00:00Z", "member_action")]),
    ).toBeNull();
  });
});

describe("groupRows", () => {
  const suiteA = { id: 1, name: "Suite A" };
  const suiteB = { id: 2, name: "Suite B" };
  const sources = new Map([
    [10, { suite: null, project: { id: 7, name: "Heat" }, events: [] }],
    [11, { suite: suiteB, project: null, events: [] }],
    [12, { suite: suiteA, project: { id: 7, name: "Heat" }, events: [] }],
    [13, { suite: suiteB, project: null, events: [] }],
  ]);
  const rows = [row(10), row(11), row(12), row(13)];

  it("puts a group where its first row was, keeping row order, no suite last", () => {
    const groups = groupRows({ rows, sources, by: GroupBy.Suite, now });
    expect(groups.map((group) => group.name)).toEqual([
      "Suite B",
      "Suite A",
      "No suite",
    ]);
    expect(groups[0].rows.map((r) => r.action.id)).toEqual([11, 13]);
    expect(groups[0].phase).toBe("draft");
    expect(groups[2].phase).toBeNull();
  });

  it("takes a suite's phase and window from a task holding its shared events, shown or not", () => {
    const launched = [
      event("2026-11-20T08:00:00Z", "member_action"),
      event("2026-11-27T08:00:00Z", "office_action"),
    ];
    const groups = groupRows({
      rows: [row(20)],
      sources: new Map([
        [20, { suite: suiteA, project: null, events: [] }],
        [21, { suite: suiteA, project: null, events: launched }],
      ]),
      by: GroupBy.Suite,
      now,
    });
    expect(groups[0].phase).toBe("member_action");
    expect(groups[0].span).toEqual({
      start: new Date("2026-11-20T08:00:00Z"),
      end: new Date("2026-11-27T08:00:00Z"),
    });
  });

  it("ends a project's stretch at its last completion, not past it", () => {
    const start = new Date("2026-09-01T00:00:00Z");
    const done = new Date("2026-09-08T00:00:00Z");
    const finished: TimelineRow = {
      action: { id: 30, name: "Done", status: "completed" },
      phases: [
        {
          status: "member_action",
          startDate: start,
          endDate: done,
          duration: done.getTime() - start.getTime(),
          isActive: false,
        },
        {
          status: "completed",
          startDate: done,
          endDate: now,
          duration: now.getTime() - done.getTime(),
          isActive: true,
        },
      ],
    };
    const [group] = groupRows({
      rows: [finished],
      sources: new Map([
        [30, { suite: null, project: { id: 7, name: "Heat" }, events: [] }],
      ]),
      by: GroupBy.Project,
      now,
    });
    expect(group.span).toEqual({ start, end: done });
  });

  it("groups by project with no project last", () => {
    const groups = groupRows({ rows, sources, by: GroupBy.Project, now });
    expect(groups.map((group) => [group.name, group.rows.length])).toEqual([
      ["Heat", 2],
      ["No project", 2],
    ]);
    expect(groups[0].phase).toBeNull();
  });
});

describe("rowTops", () => {
  it("counts a header above each group when there are headers", () => {
    const groups = [{ rows: [row(1), row(2)] }, { rows: [row(3)] }];
    expect([...rowTops({ groups, withHeaders: true })]).toEqual([
      [1, GROUP_PX],
      [2, GROUP_PX + ROW_PX],
      [3, 2 * GROUP_PX + 2 * ROW_PX],
    ]);
    expect(rowTops({ groups, withHeaders: false }).get(3)).toBe(2 * ROW_PX);
  });
});

describe("projectCat", () => {
  it("gives a project the same colour every time", () => {
    expect(projectCat(42)).toBe(projectCat(42));
    expect(
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(projectCat)).size,
    ).toBeGreaterThan(1);
  });
});
