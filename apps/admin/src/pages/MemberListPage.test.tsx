import type {
  FormulaDto,
  FormulaProblemDto,
  MemberListDto,
  SaveFormulasDto,
  SaveMemberListDto,
  UpdateMemberListDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import MemberListPage from "./MemberListPage";

const volunteers: MemberListDto = {
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Volunteers",
  versionId: 5,
  userIds: [7],
};
const onVolunteers: FormulaDto = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "onVolunteers",
  text: 'isOnList("Volunteers")',
  notes: null,
  versionId: 9,
  reads: [],
  updatedAt: "2026-11-19T00:00:00.000Z",
};
const readsVolunteers: FormulaProblemDto = {
  kind: "named",
  id: onVolunteers.id,
  text: 'isOnList("Volunteers")',
  diagnostics: [
    {
      message: "This uses a list that no longer exists.",
      start: 0,
      end: 22,
    },
  ],
};
const users = [
  { id: 7, name: "Ana", email: "ana@example.com", profilePicture: null },
  { id: 12, name: "Bo", email: "bo@example.com", profilePicture: null },
];

let lists: MemberListDto[];
let listSaves: (SaveMemberListDto | UpdateMemberListDto)[];
let formulaSaves: SaveFormulasDto[];
let formulaAnswers: FormulaProblemDto[][];
let updateStatus: number;
let updateHeld: Promise<void>;
let usersStatus: number;
let formulasHeld: Promise<void>;

serveApi(
  routes({
    "GET /member-lists": () => Response.json(lists),
    "POST /member-lists": async ({ request }) => {
      const body: SaveMemberListDto = await request.json();
      listSaves.push(body);
      const created = { ...body, id: volunteers.id, versionId: 1 };
      lists = [created];
      return Response.json(created);
    },
    "PUT /member-lists/:id": async ({ request }) => {
      const body: UpdateMemberListDto = await request.json();
      listSaves.push(body);
      await updateHeld;
      if (updateStatus !== 200) {
        return Response.json(
          {
            message:
              "This list changed since you opened it. Reload to see the changes.",
          },
          { status: updateStatus },
        );
      }
      const saved = {
        id: volunteers.id,
        name: body.name,
        userIds: body.userIds,
        versionId: 6,
      };
      lists = [saved];
      return Response.json(saved);
    },
    "GET /formulas": async () => {
      await formulasHeld;
      return Response.json([onVolunteers]);
    },
    "POST /formulas/save": async ({ request }) => {
      formulaSaves.push(await request.json());
      return Response.json({ problems: formulaAnswers.shift() ?? [] });
    },
    "GET /user/list": () =>
      usersStatus === 200
        ? Response.json(users)
        : Response.json({ message: "Down" }, { status: usersStatus }),
  }),
);

beforeEach(() => {
  lists = [volunteers];
  listSaves = [];
  formulaSaves = [];
  formulaAnswers = [];
  updateStatus = 200;
  updateHeld = Promise.resolve();
  usersStatus = 200;
  formulasHeld = Promise.resolve();
});

const renderPage = (path: string, cachedFormulas?: FormulaDto[]) => {
  const router = createMemoryRouter(
    [
      { path: "/member-lists", element: <p>All lists</p> },
      { path: "/member-lists/:listId", element: <MemberListPage /> },
    ],
    { initialEntries: [path] },
  );
  const query = queryWrapper();
  if (cachedFormulas) {
    query.client.setQueryData(queryKeys.formulasAdmin(), cachedFormulas);
  }
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return router;
};

test("creates a list from pasted ids and emails, listing what didn't match", async () => {
  lists = [];
  const router = renderPage("/member-lists/new");
  await screen.findByRole("heading", { name: "New list" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Volunteers" },
  });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "7, BO@example.com\nnobody@example.com" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add members" }));
  expect(
    await screen.findByText(
      "This matched no member, so it wasn't added: nobody@example.com",
    ),
  ).toBeTruthy();
  // The unmatched entry stays in the box to correct.
  expect(screen.getByLabelText(/^Add by id or email/)).toHaveProperty(
    "value",
    "nobody@example.com",
  );
  expect(screen.getByText("Members (2)")).toBeTruthy();
  // An entry still unmatched stops the save.
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText(
    "This matched no member, so it wasn't added: nobody@example.com",
  );
  expect(listSaves).toEqual([]);
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/member-lists/${volunteers.id}`,
    ),
  );
  expect(listSaves).toEqual([{ name: "Volunteers", userIds: [7, 12] }]);
});

test("saves an edit against the version it opened, and offers Reload on a conflict", async () => {
  updateStatus = 409;
  renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Helpers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText(
      "This list changed since you opened it. Reload to see the changes.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  expect(listSaves).toEqual([
    { name: "Helpers", userIds: [7], baseVersionId: 5, baseName: "Volunteers" },
  ]);
});

test("saves entries left in the paste box without Add members", async () => {
  renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "12" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved.");
  expect(listSaves).toEqual([
    {
      name: "Volunteers",
      userIds: [7, 12],
      baseVersionId: 5,
      baseName: "Volunteers",
    },
  ]);
  expect(screen.getByText("Members (2)")).toBeTruthy();
});

test("keeps members removed while a save is in flight", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  updateHeld = promise;
  renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Name/), {
    target: { value: "Helpers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saving…");
  fireEvent.click(await screen.findByRole("button", { name: "Remove Ana" }));
  resolve();
  await screen.findByText("Saved.");
  expect(screen.getByRole("heading", { name: "Helpers" })).toBeTruthy();
  expect(screen.getByText("Members (0)")).toBeTruthy();
});

test("clears the unmatched entries alert once the paste box is emptied", async () => {
  renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  const box = screen.getByLabelText(/^Add by id or email/);
  fireEvent.change(box, { target: { value: "nobody@example.com" } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add members" }).ariaDisabled,
    ).not.toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add members" }));
  await screen.findByText(/matched no member/);
  fireEvent.change(box, { target: { value: "" } });
  expect(screen.queryByText(/matched no member/)).toBeNull();
});

test("shows the formulas a delete would break, and deletes with the fix", async () => {
  formulaAnswers = [[readsVolunteers], []];
  const router = renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  expect(
    await screen.findByText("This uses a list that no longer exists."),
  ).toBeTruthy();
  expect(formulaSaves[0]).toEqual({
    edits: [],
    deletions: [],
    deletedLists: [{ id: volunteers.id, baseVersionId: 5 }],
    partFixes: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  fireEvent.change(await screen.findByLabelText(/^Formula/), {
    target: { value: "false" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/member-lists"),
  );
  expect(formulaSaves[1]).toEqual({
    edits: [
      {
        id: onVolunteers.id,
        baseVersionId: 9,
        name: "onVolunteers",
        text: "false",
        notes: null,
      },
    ],
    deletions: [],
    deletedLists: [{ id: volunteers.id, baseVersionId: 5 }],
    partFixes: [],
  });
});

const partReadsVolunteers: FormulaProblemDto = {
  ...readsVolunteers,
  kind: "dependent",
  id: "partition:4:part-1",
  partition: {
    suiteId: 4,
    suiteName: "Week 12",
    versionId: 2,
    partId: "part-1",
    partName: "Listed",
    fallback: null,
  },
};

const remove = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
};

test("deletes a list with the fix of a part that reads it", async () => {
  formulaAnswers = [[partReadsVolunteers], []];
  const router = renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  await remove();
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Condition" }), {
    target: { value: "false" },
  });
  await remove();

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/member-lists"),
  );
  expect(formulaSaves[1].partFixes).toEqual([
    {
      suiteId: 4,
      baseVersionId: 2,
      partId: "part-1",
      text: "false",
      fallback: null,
    },
  ]);
});

test("asks before leaving while a part's fix differs from how it opened", async () => {
  formulaAnswers = [[partReadsVolunteers]];
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const router = renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  await remove();
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  const condition = () => screen.getByRole("textbox", { name: "Condition" });
  fireEvent.change(condition(), { target: { value: "false" } });
  await act(() => router.navigate("/member-lists"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe(`/member-lists/${volunteers.id}`);

  fireEvent.change(condition(), {
    target: { value: partReadsVolunteers.text },
  });
  await act(() => router.navigate("/member-lists"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/member-lists");
  confirm.mockRestore();
});

test("opens on fetched formulas, not cached ones a fix would conflict with", async () => {
  let release = () => {};
  formulasHeld = new Promise((resolve) => (release = resolve));
  formulaAnswers = [[readsVolunteers]];
  renderPage(`/member-lists/${volunteers.id}`, [
    { ...onVolunteers, versionId: 8 },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole("heading", { name: "Volunteers" })).toBeNull();
  release();
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
  await waitFor(() => expect(formulaSaves[1]?.edits[0]?.baseVersionId).toBe(9));
});

test("refuses to save pasted entries when members couldn't load", async () => {
  usersStatus = 500;
  renderPage(`/member-lists/${volunteers.id}`);
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.change(screen.getByLabelText(/^Add by id or email/), {
    target: { value: "12" },
  });
  await screen.findByText("Failed to load users.");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText(
      "Members couldn't load, so the pasted entries can't be matched. Reload the page to try again.",
    ),
  ).toBeTruthy();
  expect(listSaves).toEqual([]);
});
