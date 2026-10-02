import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { memberActionDeadlinePassed } from "./actionTaskPanel";

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
