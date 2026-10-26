import type { CreateActionDto } from "@alliance/shared/client";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { testActions } from "../../lib/testData";
import { useActionCommands } from "./useActionCommands";

let createFormStatus: number;
let created: CreateActionDto[];
let errors: (string | null)[];

serveApi(
  routes({
    "GET /tasks/adminForm/:id": ({ params }) =>
      Response.json({ id: Number(params.id), title: "Task", schema: {} }),
    "POST /tasks/createForm": () =>
      createFormStatus === 200
        ? Response.json({ id: 9, title: "Task (Copy)", formSnapshotId: 1 })
        : Response.json({ message: "Nope" }, { status: createFormStatus }),
  }),
);

beforeEach(() => {
  createFormStatus = 200;
  created = [];
  errors = [];
});

const notCalled = () => Promise.reject(new Error("not called"));

function renderCommands() {
  const { wrapper: QueryWrapper } = queryWrapper();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryWrapper>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryWrapper>
  );
  return renderHook(
    () =>
      useActionCommands({
        admin: {
          action: null,
          createAction: (body: CreateActionDto) => {
            created.push(body);
            return Promise.resolve({
              ...makeAction({ id: 2 }),
              staffPreview: false,
              prerequisiteActionIds: [],
              memberActionStart: null,
              memberActionDeadline: null,
              followUpForms: [],
            });
          },
          removeAction: notCalled,
          archiveAction: notCalled,
          unarchiveAction: notCalled,
        },
        actionId: 1,
        form: { ...testActions[0], taskFormId: 3 },
        imageKey: null,
        imageUploading: false,
        setError: (error) => errors.push(error),
      }),
    { wrapper },
  );
}

test("duplicating an action points the copy at a clone of its task form", async () => {
  const view = renderCommands();
  await view.result.current.handleDuplicate();
  expect(errors).toEqual([]);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({
    name: `${testActions[0].name} (Copy)`,
    taskFormId: 9,
  });
});

test("a task form that fails to clone stops the duplicate", async () => {
  createFormStatus = 500;
  const view = renderCommands();
  await view.result.current.handleDuplicate();
  expect(created).toEqual([]);
  expect(errors).toHaveLength(1);
});
