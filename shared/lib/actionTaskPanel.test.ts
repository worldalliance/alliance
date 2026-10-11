import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { renderHook } from "@testing-library/react";
import {
  memberActionDeadlinePassed,
  useTaskFormHandlers,
} from "./actionTaskPanel";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";

serveApi(
  routes({
    "POST /tasks/optout/3": () => Response.json({}),
  }),
);

const refusal = (status: number, message: string) => ({
  response: new Response(null, { status }),
  error: { statusCode: status, message },
});

describe("memberActionDeadlinePassed", () => {
  it("keeps the refusal's text, which installed apps match on", () => {
    expect(MEMBER_ACTION_DEADLINE_PASSED).toBe(
      "The deadline for this action has passed.",
    );
  });

  it("recognizes only the deadline refusal", () => {
    expect(
      memberActionDeadlinePassed(refusal(403, MEMBER_ACTION_DEADLINE_PASSED)),
    ).toBe(true);
    expect(
      memberActionDeadlinePassed(
        refusal(403, "This action is not available to you"),
      ),
    ).toBe(false);
  });
});

it("a withdrawal invalidates the visibility context", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.myVisibilityContext(), {});
  const onOptOutAction = jest.fn();
  const handlers = renderHook(
    () =>
      useTaskFormHandlers({
        action: { id: 7, taskFormId: 3 },
        onCompleteAction: () => true,
        onOptOutAction,
      }),
    { wrapper },
  );

  await handlers.result.current.handleAbandonAction({
    outOfTime: true,
    isMoral: false,
    reason: "",
    partialFormData: { answers: {}, actionId: 7, deviceType: "desktop" },
  });

  expect(onOptOutAction).toHaveBeenCalled();
  expect(
    client.getQueryState(queryKeys.myVisibilityContext())?.isInvalidated,
  ).toBe(true);
});
