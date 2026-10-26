import {
  FORM_ALREADY_SUBMITTED,
  MEMBER_ACTION_DEADLINE_PASSED,
} from "@alliance/common/actionActivity";
import { act, renderHook } from "@testing-library/react";
import {
  type ActionWithdrawal,
  formAlreadySubmitted,
  memberActionDeadlinePassed,
  useTaskFormHandlers,
} from "./actionTaskPanel";
import { makeAction } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";

const api = serveApi(routes({}));

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

describe("formAlreadySubmitted", () => {
  it("recognizes only the already-submitted refusal", () => {
    expect(formAlreadySubmitted(refusal(400, FORM_ALREADY_SUBMITTED))).toBe(
      true,
    );
    expect(
      formAlreadySubmitted(refusal(400, "A withdrawal reason is required")),
    ).toBe(false);
    expect(formAlreadySubmitted(refusal(500, FORM_ALREADY_SUBMITTED))).toBe(
      false,
    );
  });
});

describe("useTaskFormHandlers", () => {
  const withdrawal: ActionWithdrawal = {
    outOfTime: true,
    isMoral: false,
    reason: "",
    partialFormData: { answers: {}, actionId: 1, deviceType: "mobile" },
  };

  const renderHandlers = (status: number) => {
    api.alsoServing({
      "POST /tasks/optout/:id": () => new Response("{}", { status }),
    });
    const { wrapper } = queryWrapper();
    const onOptOutAction = jest.fn();
    const view = renderHook(
      () =>
        useTaskFormHandlers({
          action: makeAction({ id: 1, taskFormId: 7 }),
          onCompleteAction: () => {},
          onOptOutAction,
        }),
      { wrapper },
    );
    return { view, onOptOutAction };
  };

  it("reports the withdrawal once the server confirms", async () => {
    const { view, onOptOutAction } = renderHandlers(201);

    await act(() => view.result.current.handleAbandonAction(withdrawal));

    expect(onOptOutAction).toHaveBeenCalled();
    expect(view.result.current.actionError).toBeNull();
  });

  it("shows an error instead when the withdrawal fails", async () => {
    const { view, onOptOutAction } = renderHandlers(500);

    await act(() => view.result.current.handleAbandonAction(withdrawal));

    expect(onOptOutAction).not.toHaveBeenCalled();
    expect(view.result.current.actionError).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
