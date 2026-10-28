import type { ActionStatus } from "@alliance/shared/client";
import { describe, expect, it } from "bun:test";
import { inProgressSuites } from "./inProgressSuites";

const action = (params: {
  status: ActionStatus;
  suiteId?: number;
  onboarding?: boolean;
  archived?: boolean;
}) => ({
  status: params.status,
  onboarding: params.onboarding ?? false,
  archived: params.archived ?? false,
  suite:
    params.suiteId === undefined
      ? undefined
      : { id: params.suiteId, name: `Suite ${params.suiteId}` },
});

describe("inProgressSuites", () => {
  it("counts draft and active actions per suite, in first-seen order", () => {
    expect(
      inProgressSuites([
        action({ status: "member_action", suiteId: 2 }),
        action({ status: "draft", suiteId: 1 }),
        action({ status: "draft", suiteId: 2 }),
        action({ status: "draft", suiteId: 2 }),
      ]),
    ).toEqual([
      { id: 2, name: "Suite 2", draftCount: 2, activeCount: 1 },
      { id: 1, name: "Suite 1", draftCount: 1, activeCount: 0 },
    ]);
  });

  it("leaves out suites with only pending, completed, onboarding, or archived actions", () => {
    expect(
      inProgressSuites([
        action({ status: "office_action", suiteId: 1 }),
        action({ status: "completed", suiteId: 2 }),
        action({ status: "draft", suiteId: 3, onboarding: true }),
        action({ status: "draft", suiteId: 4, archived: true }),
        action({ status: "draft" }),
      ]),
    ).toEqual([]);
  });
});
