import type { CreateActionDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { LAUNCH_CONFIRM_TEXT } from "../../components/CreateEventForm";
import { testActions } from "../../lib/testData";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import { ToastProvider } from "../../ui/ToastProvider";
import { useActionCommands } from "./useActionCommands";

let getFormStatus: number;
let createFormStatus: number;
let created: CreateActionDto[];
let errors: (string | null)[];

serveApi(
  routes({
    "GET /tasks/adminForm/:id": ({ params }) =>
      getFormStatus === 200
        ? Response.json({ id: Number(params.id), title: "Task", schema: {} })
        : Response.json(
            { message: "Form 3 is gone" },
            { status: getFormStatus },
          ),
    "POST /tasks/createForm": () =>
      createFormStatus === 200
        ? Response.json({ id: 9, title: "Task (Copy)", formSnapshotId: 1 })
        : Response.json({ message: "Nope" }, { status: createFormStatus }),
  }),
);

beforeEach(() => {
  getFormStatus = 200;
  createFormStatus = 200;
  created = [];
  errors = [];
});

const notCalled = () => Promise.reject(new Error("not called"));

function renderCommands(
  form: CreateActionDto = { ...testActions[0], taskFormId: 3 },
  action: ParsedActionDto | null = null,
  unarchiveAction: () => Promise<ParsedActionDto> = notCalled,
) {
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
          action,
          createAction: (body: CreateActionDto) => {
            created.push(body);
            return Promise.resolve({
              ...makeAction({ id: 2 }),
              slug: "copy",
              staffPreview: false,
              cohortExpression: null,
              prerequisiteActionIds: [],
              storedImage: null,
              memberActionStart: null,
              memberActionDeadline: null,
              storedSquareThumbnailImage: null,
              followUpForms: [],
            });
          },
          archiveAction: notCalled,
          unarchiveAction,
        },
        actionId: 1,
        form,
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
  expect(await screen.findByText("Task duplicated")).toBeTruthy();
});

test("duplicating a Kora review action keeps its task kind", async () => {
  const view = renderCommands({
    ...testActions[0],
    taskFormId: undefined,
    taskKind: "kora_review",
  });
  await view.result.current.handleDuplicate();
  expect(errors).toEqual([]);
  expect(created[0]).toMatchObject({ taskKind: "kora_review" });
});

test("a task form that fails to clone stops the duplicate", async () => {
  createFormStatus = 500;
  const view = renderCommands();
  await view.result.current.handleDuplicate();
  expect(created).toEqual([]);
  expect(errors).toHaveLength(1);
});

test("a task form that fails to load stops the duplicate", async () => {
  getFormStatus = 404;
  const view = renderCommands();
  await view.result.current.handleDuplicate();
  expect(created).toEqual([]);
  expect(errors).toEqual(["Form 3 is gone"]);
});

test.each([
  [false, "Only admins can open it."],
  [true, "Its public page stays open to anyone with the link."],
])(
  "archiving an action with publicOnly %s says who can still open it",
  async (publicOnly, consequence) => {
    const view = renderCommands(undefined, makeParsedAction({ publicOnly }));
    act(() => void view.result.current.handleArchive());
    expect(await screen.findByText(new RegExp(`^${consequence}`))).toBeTruthy();
  },
);

const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();

test.each([
  [
    "a task out of draft",
    { events: [makeEvent()] },
    /^It is out of draft, so everyone who could see it before it was archived sees it again at once\./,
    true,
  ],
  [
    "a draft",
    { events: [] },
    /^It is a draft, so it stays out of members' feeds\./,
    false,
  ],
  [
    "a draft in staff preview",
    { events: [], staffPreview: true },
    /^It is a draft, so it stays out of members' feeds\. Staff preview is on, so staff see it again at once\./,
    false,
  ],
  [
    "a draft with a launch scheduled",
    { events: [makeEvent({ date: inAnHour })] },
    /^It is a draft until .+, when its audience sees it without another step\./,
    true,
  ],
])(
  "unarchiving %s asks first, saying who sees it again",
  async (_name, overrides, consequence, typed) => {
    const unarchived = jest.fn();
    const view = renderCommands(
      undefined,
      makeParsedAction({ archived: true, ...overrides }),
      async () => {
        unarchived();
        return makeParsedAction();
      },
    );
    act(() => void view.result.current.handleArchive());
    expect(await screen.findByText(consequence)).toBeTruthy();
    const unarchive = screen.getByRole("button", { name: "Unarchive task" });
    if (typed) {
      expect(unarchive).toHaveProperty("disabled", true);
      fireEvent.change(screen.getByPlaceholderText(LAUNCH_CONFIRM_TEXT), {
        target: { value: LAUNCH_CONFIRM_TEXT },
      });
    } else {
      expect(screen.queryByPlaceholderText(LAUNCH_CONFIRM_TEXT)).toBeNull();
    }
    expect(unarchived).not.toHaveBeenCalled();

    fireEvent.click(unarchive);
    await waitFor(() => expect(unarchived).toHaveBeenCalledTimes(1));
  },
);

test("declining the unarchive leaves the task archived", async () => {
  const unarchived = jest.fn();
  const view = renderCommands(
    undefined,
    makeParsedAction({ archived: true, status: "draft" }),
    async () => {
      unarchived();
      return makeParsedAction();
    },
  );
  let answered: Promise<void> | undefined;
  act(() => void (answered = view.result.current.handleArchive()));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  await act(() => answered);
  expect(unarchived).not.toHaveBeenCalled();
});
