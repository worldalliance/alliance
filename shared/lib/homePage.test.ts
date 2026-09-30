import { renderHook } from "@testing-library/react";
import { addDays, subDays } from "date-fns";
import type { UserActionStatusDto } from "../client/types.gen";
import type { ParsedGeneralUpdate } from "./generalUpdates";
import { interleaveActionsAndUpdates, useHomePageActions } from "./homePage";
import {
  makeAction,
  makeEvent,
  makeLegacyAction,
  makeViewer,
} from "./testFixtures";

function deadlineInDays(
  days: number,
  viewer: Partial<UserActionStatusDto> = {},
) {
  const deadlineAt = addDays(new Date(), days).toISOString();
  return {
    events: [
      makeEvent({
        id: 1,
        newStatus: "member_action",
        date: subDays(new Date(), 7).toISOString(),
      }),
      makeEvent({ id: 2, newStatus: "office_action", date: deadlineAt }),
    ],
    viewer: makeViewer({ deadlineAt, deadlinePassed: days < 0, ...viewer }),
  };
}

const required = makeAction({
  id: 1,
  timeEstimate: 20,
  ...deadlineInDays(3),
});

const optional = makeAction({
  id: 2,
  optional: true,
  timeEstimate: 30,
  ...deadlineInDays(3, { optional: true, display: "optional_task" }),
});

const away = makeAction({
  id: 3,
  timeEstimate: 40,
  awayStatus: "away_currently",
  ...deadlineInDays(3, { away: "away_currently", display: "away" }),
});

const afterDeadline = makeAction({
  id: 4,
  timeEstimate: 50,
  status: "resolution",
  shouldCompleteAfterDeadline: true,
  ...deadlineInDays(-3, { display: "missed_deadline" }),
});

const upcoming = makeAction({
  id: 5,
  timeEstimate: 60,
  ...deadlineInDays(21),
});

const actions = [required, optional, away, afterDeadline, upcoming];

function ids(list: { id: number }[]) {
  return list.map((action) => action.id).sort((a, b) => a - b);
}

function homePageActions() {
  return renderHook(() => useHomePageActions(actions)).result.current;
}

describe("useHomePageActions", () => {
  it("keeps away and past-deadline todos out of the current week", () => {
    const { todoActions, currentWeekTodoActions, nextWeekTodoActions } =
      homePageActions();
    expect(ids(todoActions)).toEqual([1, 2, 3, 4, 5]);
    expect(ids(currentWeekTodoActions)).toEqual([1, 2]);
    expect(ids(nextWeekTodoActions)).toEqual([5]);
  });

  it("counts the minutes of the required current-week actions only", () => {
    expect(homePageActions().remainingTasksEstimatedTimeCurrentWeek).toBe(20);
  });
});

describe("home task order", () => {
  const contractGap = {
    optional: true,
    optionalReason: "contract_gap",
  } as const;
  const ongoing = makeAction({ id: 10, priority: 3 });
  const onboarding = makeAction({ id: 11, priority: 2, onboarding: true });
  const explicitlyOptional = makeAction({
    id: 12,
    priority: 1,
    optional: true,
  });
  const lateOngoing = makeAction({
    id: 10,
    priority: 3,
    viewer: makeViewer(contractGap),
  });

  function order(list: Parameters<typeof useHomePageActions>[0]) {
    const { todoActions, currentTask } = renderHook(() =>
      useHomePageActions(list),
    ).result.current;
    return { ids: todoActions.map((a) => a.id), currentTask: currentTask?.id };
  }

  it("keeps the admin order for a member assigned the whole window", () => {
    expect(order([explicitlyOptional, onboarding, ongoing]).ids).toEqual([
      10, 11, 12,
    ]);
  });

  it("moves a task optional only for a late joiner after their other tasks", () => {
    expect(order([explicitlyOptional, onboarding, lateOngoing])).toEqual({
      ids: [11, 12, 10],
      currentTask: 11,
    });
  });

  it("keeps the baseline order among several late-joiner tasks", () => {
    const lateFirst = makeAction({
      id: 20,
      priority: 5,
      viewer: makeViewer(contractGap),
    });
    const lateSecond = makeAction({
      id: 21,
      priority: 4,
      viewer: makeViewer(contractGap),
    });
    expect(
      order([lateSecond, ongoing, explicitlyOptional, lateFirst]).ids,
    ).toEqual([10, 12, 20, 21]);
  });

  it("breaks full ties by id regardless of response order", () => {
    const a = makeAction({ id: 31 });
    const b = makeAction({ id: 30 });
    expect(order([a, b]).ids).toEqual([30, 31]);
    expect(order([b, a]).ids).toEqual([30, 31]);
  });

  it("does not defer a legacy payload without viewer data", () => {
    const legacy = makeLegacyAction({ id: 10, priority: 3 });
    expect(order([onboarding, legacy]).ids).toEqual([10, 11]);
  });
});

describe("interleaveActionsAndUpdates", () => {
  const update: ParsedGeneralUpdate = {
    id: 1,
    name: "Weekly note",
    priority: 1,
    schema: null,
  };
  const required = makeAction({ id: 1, priority: 0 });
  const late = makeAction({
    id: 2,
    priority: 5,
    viewer: makeViewer({ optional: true, optionalReason: "contract_gap" }),
  });

  it("puts an update ahead of a higher-priority late-joiner task", () => {
    const sequence = interleaveActionsAndUpdates({
      todoActions: [late, required],
      generalUpdates: [update],
    });
    expect(
      sequence.map((item) =>
        item.kind === "action"
          ? `action-${item.action.id}`
          : `update-${item.generalUpdate.id}`,
      ),
    ).toEqual(["update-1", "action-1", "action-2"]);
  });
});
