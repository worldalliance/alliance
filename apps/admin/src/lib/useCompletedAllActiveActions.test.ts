import type {
  ActionStatus,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { cleanup, renderHook } from "@testing-library/react";
import { useCompletedAllActiveActions } from "./useCompletedAllActiveActions";

afterEach(cleanup);

function summary(id: number, status: ActionStatus): UserActionSummaryDto {
  return {
    id,
    name: `action ${id}`,
    status,
    weekNumber: null,
    allMembersParticipating: false,
    memberActionDeadline: null,
  };
}

test("counts only member actions toward completion", () => {
  const { result } = renderHook(() =>
    useCompletedAllActiveActions({
      actionSummaries: [summary(1, "member_action"), summary(2, "completed")],
      userActionRelations: {
        10: [
          { actionId: 1, status: "completed" },
          { actionId: 2, status: "todo" },
        ],
        11: [{ actionId: 1, status: "todo" }],
      },
    }),
  );
  expect(result.current).toEqual({ 10: true, 11: false });
});

test("is empty before relations load", () => {
  const { result } = renderHook(() =>
    useCompletedAllActiveActions({
      actionSummaries: [summary(1, "member_action")],
      userActionRelations: null,
    }),
  );
  expect(result.current).toEqual({});
});
