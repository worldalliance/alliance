import { TaskFlowMode } from "@alliance/shared/forms/useTaskFlow";
import { makeAction, makeUser } from "@alliance/shared/lib/testFixtures";
import { render } from "@testing-library/react";
import { type ComponentProps } from "react";
import { type TaskFlowHost } from "./host";
import TaskFlow from "./TaskFlow";

const host: TaskFlowHost = {
  useChrome: () => {},
  useResume: () => {},
  useCompletionExits: () => ({
    leavesToTasks: false,
    close: (finish) => finish(),
    invite: null,
    signUp: null,
  }),
  panelClassName: "",
};

const renderLive = (overrides: Partial<ComponentProps<typeof TaskFlow>>) =>
  render(
    <TaskFlow
      host={host}
      viewer={{
        user: makeUser(),
        isAuthenticated: true,
        userLoading: false,
        isImpersonation: false,
      }}
      action={makeAction()}
      mode={TaskFlowMode.Live}
      schema={{ pages: [{ id: "p1", fields: [] }], outputViews: [] }}
      formId={1}
      taskFormId={1}
      formSnapshotId={1}
      draftFormResponse={null}
      phDistinctId=""
      sessionReplayUrl={undefined}
      submitTaskForm={async () => true}
      submitError={null}
      onCompleteAction={() => {}}
      onFormStarted={() => {}}
      {...overrides}
    />,
  );

describe("TaskFlow", () => {
  it.each([
    [
      "a staff preview",
      {
        viewer: {
          user: makeUser(),
          isAuthenticated: true,
          userLoading: false,
          isImpersonation: false,
          previewUserId: 2,
        },
      },
    ],
    ["an unsaved form", { formSnapshotId: null }],
  ])("refuses to record answers for %s", (_, overrides) => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      expect(() => renderLive(overrides)).toThrow(
        "runs only in a mode that records nothing",
      );
    } finally {
      console.error = consoleError;
    }
  });
});
