import { jest } from "bun:test";
import { leaveGuardTestAnswer } from "../../components/LeaveGuard";

/**
 * Answers the leave guard every time it asks, as staff who always leave or
 * always stay, until mocks are restored. The mock it returns is called once
 * per ask.
 */
export function answerLeaveGuard(leave: boolean) {
  return jest.spyOn(leaveGuardTestAnswer, "get").mockReturnValue(leave);
}
