import { renderHook } from "@testing-library/react";
import { addDays, subDays } from "date-fns";
import type { UserActionStatusDto } from "../client/types.gen";
import { useHomePageActions } from "./homePage";
import { makeAction, makeEvent, makeViewer } from "./testFixtures";

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
