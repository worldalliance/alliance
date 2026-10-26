import type {
  ActionEventDto,
  ActionStatus,
  ActionUpdateDto,
  AdminProjectDto,
} from "@alliance/shared/client";
import { describe, expect, it } from "bun:test";
import { addDays } from "date-fns";
import {
  buildProjectCards,
  cardsByLifecycle,
  ProjectCardKind,
  ProjectFlagKind,
  ProjectLifecycle,
  StepCountBucket,
  type ProjectCard,
  type ProjectStep,
} from "./projectCards";
import { adminActionListItem } from "./testing/adminActionListItem";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const day = (offset: number) => addDays(NOW, offset).toISOString();

const project = (id: number, name = `Project ${id}`): AdminProjectDto => ({
  id,
  name,
  slug: `project-${id}`,
  category: [],
});

const event = (newStatus: ActionStatus, date: string): ActionEventDto => ({
  id: 0,
  title: newStatus,
  description: "",
  newStatus,
  date,
  suiteManaged: false,
});

const update = (visibleAt: string | null): ActionUpdateDto => ({
  id: 0,
  actionId: 0,
  title: "Update",
  schemaSnapshotId: 0,
  date: visibleAt ?? day(0),
  visibleAt,
  shortNotifString: "",
  associatedEventId: null,
  notifyType: "none",
  notifiedAt: null,
  schema: {},
});

const step = (
  id: number,
  overrides: Partial<ProjectStep> & { projectId?: number } = {},
): ProjectStep => {
  const { projectId, ...rest } = overrides;
  return adminActionListItem(id, `Action ${id}`, {
    project: projectId === undefined ? null : project(projectId),
    ...rest,
  });
};

const cards = (params: {
  projects?: AdminProjectDto[];
  actions: ProjectStep[];
}) =>
  buildProjectCards({
    projects: params.projects ?? [],
    actions: params.actions,
    now: NOW,
  });

const only = (list: ProjectCard[]) => {
  expect(list).toHaveLength(1);
  return list[0];
};

const flagKinds = (card: ProjectCard) => card.flags.map((flag) => flag.kind);

describe("buildProjectCards", () => {
  it("takes the first step's member-action start as the start and orders steps by it", () => {
    const card = only(
      cards({
        projects: [project(1)],
        actions: [
          step(3, { projectId: 1, memberActionStart: day(-3) }),
          step(2, { projectId: 1, memberActionStart: null }),
          step(1, { projectId: 1, memberActionStart: day(-10) }),
        ],
      }),
    );

    expect(card.startedAt).toEqual(new Date(day(-10)));
    expect(card.steps.map((s) => s.id)).toEqual([1, 3, 2]);
  });

  it("shows no start for a project nothing has opened", () => {
    expect(
      only(cards({ projects: [project(1)], actions: [] })).startedAt,
    ).toBeNull();
  });

  it.each([
    [["completed", "member_action", "planned"], ProjectLifecycle.Live],
    [["office_action", "planned", "draft"], ProjectLifecycle.Upcoming],
    [["office_action", "draft"], ProjectLifecycle.InTheWorks],
    [[], ProjectLifecycle.InTheWorks],
    [["completed", "resolution"], ProjectLifecycle.Awaiting],
    [["completed", "failed", "abandoned"], ProjectLifecycle.Done],
  ] satisfies [ActionStatus[], ProjectLifecycle][])(
    "puts a project with %p in %s",
    (statuses, lifecycle) => {
      const card = only(
        cards({
          projects: [project(1)],
          actions: statuses.map((status, index) =>
            step(index + 1, { projectId: 1, status }),
          ),
        }),
      );
      expect(card.lifecycle).toBe(lifecycle);
    },
  );

  it("counts steps per bucket", () => {
    const card = only(
      cards({
        projects: [project(1)],
        actions: (
          [
            "member_action",
            "planned",
            "draft",
            "office_action",
            "resolution",
            "completed",
            "failed",
          ] satisfies ActionStatus[]
        ).map((status, index) => step(index + 1, { projectId: 1, status })),
      }),
    );

    expect(card.counts).toEqual({
      [StepCountBucket.Live]: 1,
      [StepCountBucket.Planned]: 1,
      [StepCountBucket.Draft]: 1,
      [StepCountBucket.WrappingUp]: 2,
      [StepCountBucket.Done]: 2,
    });
  });

  it("builds the funnel from completions and totals withdrawals and dismissals", () => {
    const card = only(
      cards({
        projects: [project(1)],
        actions: [
          step(1, {
            projectId: 1,
            memberActionStart: day(-20),
            usersCompleted: 100,
            usersWontComplete: 3,
            usersDismissed: 5,
          }),
          step(2, {
            projectId: 1,
            memberActionStart: day(-13),
            usersCompleted: 0,
            usersWontComplete: 1,
          }),
          step(3, {
            projectId: 1,
            memberActionStart: day(-6),
            usersCompleted: 20,
            usersDismissed: 2,
          }),
        ],
      }),
    );

    expect(card.funnel).toEqual([
      { stepId: 1, completions: 100, retention: null },
      { stepId: 2, completions: 0, retention: 0 },
      { stepId: 3, completions: 20, retention: null },
    ]);
    expect(card.wontComplete).toBe(4);
    expect(card.dismissed).toBe(7);
  });

  it("leaves archived and onboarding actions out entirely", () => {
    const result = cards({
      projects: [project(1)],
      actions: [
        step(1, { projectId: 1, archived: true }),
        step(2, { onboarding: true }),
        step(3, { archived: true }),
      ],
    });

    expect(only(result).steps).toEqual([]);
  });

  it("gives each action without a project its own card", () => {
    const card = only(
      cards({ actions: [step(5, { status: "member_action" })] }),
    );

    expect(card.kind).toBe(ProjectCardKind.Standalone);
    expect(card.name).toBe("Action 5");
    expect(card.lifecycle).toBe(ProjectLifecycle.Live);
  });

  it("orders cards by most recent start, unstarted last", () => {
    const result = cards({
      projects: [project(1, "Old"), project(2, "New"), project(3, "Empty")],
      actions: [
        step(1, { projectId: 1, memberActionStart: day(-30) }),
        step(2, { projectId: 2, memberActionStart: day(-2) }),
      ],
    });

    expect(result.map((card) => card.name)).toEqual(["New", "Old", "Empty"]);
  });
});

describe("cardsByLifecycle", () => {
  it("groups cards into every section", () => {
    const sections = cardsByLifecycle(
      cards({
        projects: [project(1), project(2)],
        actions: [step(1, { projectId: 1, status: "completed" })],
      }),
    );

    expect(sections[ProjectLifecycle.Done].map((card) => card.key)).toEqual([
      "project-1",
    ]);
    expect(
      sections[ProjectLifecycle.InTheWorks].map((card) => card.key),
    ).toEqual(["project-2"]);
    expect(sections[ProjectLifecycle.Live]).toEqual([]);
  });
});

describe("flags", () => {
  const flagsFor = (overrides: Partial<ProjectStep>) =>
    flagKinds(only(cards({ actions: [step(1, overrides)] })));

  it("flags an action in office action for three weeks without an update since", () => {
    const events = [
      event("member_action", day(-30)),
      event("office_action", day(-21)),
    ];
    expect(flagsFor({ status: "office_action", events })).toEqual([
      ProjectFlagKind.Stuck,
    ]);
    expect(
      flagsFor({
        status: "office_action",
        events,
        updates: [update(day(-22))],
      }),
    ).toEqual([ProjectFlagKind.Stuck]);
    expect(
      flagsFor({ status: "office_action", events, updates: [update(day(-5))] }),
    ).toEqual([]);
    expect(
      flagsFor({
        status: "resolution",
        events: [event("resolution", day(-20))],
      }),
    ).toEqual([]);
  });

  it("flags a completed action with no posted update three weeks on", () => {
    const events = [event("completed", day(-21))];
    expect(flagsFor({ status: "completed", events })).toEqual([
      ProjectFlagKind.NoUpdate,
    ]);
    expect(
      flagsFor({ status: "completed", events, updates: [update(null)] }),
    ).toEqual([ProjectFlagKind.NoUpdate]);
    expect(
      flagsFor({ status: "completed", events, updates: [update(day(-1))] }),
    ).toEqual([]);
    expect(
      flagsFor({
        status: "completed",
        events: [event("completed", day(-20))],
      }),
    ).toEqual([]);
  });

  it("flags a deadline or launch within three days", () => {
    expect(
      flagsFor({ status: "member_action", memberActionDeadline: day(3) }),
    ).toEqual([ProjectFlagKind.DeadlineSoon]);
    expect(
      flagsFor({ status: "member_action", memberActionDeadline: day(4) }),
    ).toEqual([]);
    expect(flagsFor({ status: "planned", memberActionStart: day(2) })).toEqual([
      ProjectFlagKind.LaunchSoon,
    ]);
    expect(flagsFor({ status: "planned", memberActionStart: day(-1) })).toEqual(
      [],
    );
  });

  it("flags a live last step with nothing scheduled after it, on projects only", () => {
    const live = {
      status: "member_action",
      memberActionStart: day(-2),
    } as const;
    const projectFlags = (actions: ProjectStep[]) =>
      flagKinds(only(cards({ projects: [project(1)], actions })));

    expect(projectFlags([step(1, { projectId: 1, ...live })])).toEqual([
      ProjectFlagKind.GapBeforeNextStep,
    ]);
    expect(
      projectFlags([
        step(1, { projectId: 1, ...live }),
        step(2, {
          projectId: 1,
          status: "planned",
          memberActionStart: day(10),
        }),
      ]),
    ).toEqual([]);
    expect(flagsFor(live)).toEqual([]);
  });
});
