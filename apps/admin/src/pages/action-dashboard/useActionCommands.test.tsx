import type { CreateActionDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { createActionForm } from "../../lib/testing/createActionForm";
import { useActionCommands } from "./useActionCommands";

let getFormStatus = 200;
let createFormStatus = 200;

serveApi(
  routes({
    "GET /tasks/slug/:id": () =>
      getFormStatus === 200
        ? Response.json({ id: 4, title: "Survey", schema: {} })
        : Response.json(
            { message: "Form 4 is gone" },
            { status: getFormStatus },
          ),
    "POST /tasks/createForm": () =>
      createFormStatus === 200
        ? Response.json({ id: 9, title: "Survey (Copy)", schema: {} })
        : Response.json(
            { message: "Form schema is invalid" },
            { status: createFormStatus },
          ),
  }),
);

beforeEach(() => {
  getFormStatus = 200;
  createFormStatus = 200;
});

const duplicate = async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const createAction = jest.fn((_form: CreateActionDto) =>
    Promise.reject(new Error("not created in this test")),
  );
  const setError = jest.fn();
  const { wrapper: QueryWrapper } = queryWrapper();
  const { result } = renderHook(
    () =>
      useActionCommands({
        admin: {
          action: null,
          createAction,
          removeAction: jest.fn(),
          archiveAction: jest.fn(),
          unarchiveAction: jest.fn(),
        },
        actionId: 1,
        form: createActionForm({ taskFormId: 4 }),
        imageKey: null,
        imageUploading: false,
        setError,
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryWrapper>
          <MemoryRouter>
            <ToastProvider>{children}</ToastProvider>
          </MemoryRouter>
        </QueryWrapper>
      ),
    },
  );
  await act(() => result.current.handleDuplicate());
  return { createAction, setError };
};

it.each([
  ["loading", () => (getFormStatus = 400), "Form 4 is gone"],
  ["copying", () => (createFormStatus = 400), "Form schema is invalid"],
])(
  "says why %s the task form was refused and creates no copy",
  async (_, refuse, message) => {
    refuse();
    const { createAction, setError } = await duplicate();
    expect(setError).toHaveBeenCalledWith(message);
    expect(createAction).not.toHaveBeenCalled();
  },
);

it("gives the copy its own task form", async () => {
  const { createAction } = await duplicate();
  expect(createAction).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Call your rep (Copy)", taskFormId: 9 }),
  );
});
