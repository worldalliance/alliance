import type { Action } from "src/actions/entities/action.entity";
import type { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { groupTaskScopeActionIds } from "./action-event-reminder.service";

// Fixtures carry only the fields groupTaskScopeActionIds reads.
const group = (params: {
  useSuiteTaskCount: boolean;
  suiteActionIds: number[] | undefined;
}) =>
  ({
    useSuiteTaskCount: params.useSuiteTaskCount,
    actionSuite: {
      id: 7,
      actions: params.suiteActionIds?.map((id) => ({ id }) as Action),
    },
    memberActionEvent: { action: { id: 1 } },
  }) as ReminderGroup;

describe("groupTaskScopeActionIds", () => {
  it("scopes a group that doesn't use the suite task count to its member action", () => {
    expect(
      groupTaskScopeActionIds(
        group({ useSuiteTaskCount: false, suiteActionIds: [2, 3] }),
      ),
    ).toEqual([1]);
  });

  it("scopes a suite-count group to its suite's actions", () => {
    expect(
      groupTaskScopeActionIds(
        group({ useSuiteTaskCount: true, suiteActionIds: [2, 3] }),
      ),
    ).toEqual([2, 3]);
  });

  it("scopes a suite-count group whose suite has no actions to its member action", () => {
    expect(
      groupTaskScopeActionIds(
        group({ useSuiteTaskCount: true, suiteActionIds: [] }),
      ),
    ).toEqual([1]);
  });

  it("throws for a suite-count group whose suite's actions aren't loaded", () => {
    expect(() =>
      groupTaskScopeActionIds(
        group({ useSuiteTaskCount: true, suiteActionIds: undefined }),
      ),
    ).toThrow("actions of action suite 7 not loaded");
  });
});
