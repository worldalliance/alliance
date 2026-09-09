import { renderHook } from "@testing-library/react";
import { useHomePageActions } from "./homePage";
import { makeAction, makeEvent, makeViewer } from "./testFixtures";

function deadlineInDays(days: number) {
  return [
    makeEvent({
      newStatus: "office_action",
      date: new Date(Date.now() + days * 86_400_000).toISOString(),
    }),
  ];
}

const required = makeAction({
  id: 1,
  timeEstimate: 20,
  events: deadlineInDays(3),
});

const optional = makeAction({
  id: 2,
  optional: true,
  timeEstimate: 30,
  events: deadlineInDays(3),
});

const away = makeAction({
  id: 3,
  timeEstimate: 40,
  awayStatus: "away_currently",
  viewer: makeViewer({ away: "away_currently" }),
  events: deadlineInDays(3),
});

const afterDeadline = makeAction({
  id: 4,
  timeEstimate: 50,
  status: "resolution",
  shouldCompleteAfterDeadline: true,
  events: deadlineInDays(3),
});

const upcoming = makeAction({
  id: 5,
  timeEstimate: 60,
  events: deadlineInDays(21),
});

const actions = [required, optional, away, afterDeadline, upcoming];

function ids(list: { id: number }[]) {
  return list.map((action) => action.id).sort();
}

function homePageActions() {
  return renderHook(() => useHomePageActions(actions)).result.current;
}

describe("useHomePageActions", () => {
  it("keeps away and past-deadline todos out of both week lists", () => {
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
