import type { ActionStatus } from "@alliance/shared/client";
import { describe, expect, it } from "bun:test";
import { ActionStatusBucket } from "./actionStatusBucket";
import { inProgressSuites } from "./inProgressSuites";

const action = (params: {
  id?: number;
  status: ActionStatus;
  suiteId?: number;
  onboarding?: boolean;
  archived?: boolean;
}) => ({
  id: params.id ?? 0,
  name: `Action ${params.id ?? 0}`,
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
        action({ id: 10, status: "member_action", suiteId: 2 }),
        action({ id: 11, status: "draft", suiteId: 1 }),
        action({ id: 12, status: "draft", suiteId: 2 }),
        action({ id: 13, status: "office_action", suiteId: 2 }),
      ]),
    ).toEqual([
      {
        id: 2,
        name: "Suite 2",
        draftCount: 1,
        activeCount: 1,
        actions: [
          { id: 10, name: "Action 10", bucket: ActionStatusBucket.Active },
          { id: 12, name: "Action 12", bucket: ActionStatusBucket.Draft },
        ],
      },
      {
        id: 1,
        name: "Suite 1",
        draftCount: 1,
        activeCount: 0,
        actions: [
          { id: 11, name: "Action 11", bucket: ActionStatusBucket.Draft },
        ],
      },
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
