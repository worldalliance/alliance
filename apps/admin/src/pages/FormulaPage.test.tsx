import type {
  FormulaDto,
  FormulaProblemDto,
  SaveFormulasDto,
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
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import FormulaPage from "./FormulaPage";

const base: FormulaDto = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "base",
  text: "2",
  notes: null,
  versionId: 1,
  reads: [],
  updatedAt: "2026-11-19T00:00:00.000Z",
};
const doubled: FormulaDto = {
  id: "00000000-0000-4000-8000-00000000000b",
  name: "doubled",
  text: "base * 2",
  notes: null,
  versionId: 2,
  reads: [base.id],
  updatedAt: "2026-11-19T00:00:00.000Z",
};
const breaksDoubled: FormulaProblemDto = {
  kind: "named",
  id: doubled.id,
  text: "base * 2",
  diagnostics: [
    {
      message: "The left of this operator has to be a number.",
      start: 0,
      end: 4,
    },
  ],
};

let stored: FormulaDto[];
let saves: SaveFormulasDto[];
let answers: (FormulaProblemDto[] | number)[];
let listFails: boolean;
let listHeld: Promise<void> | undefined;
let listFetches: number;

serveApi(
  routes({
    "GET /formulas": async () => {
      listFetches += 1;
      await listHeld;
      return listFails
        ? Response.json({ message: "Unavailable" }, { status: 503 })
        : Response.json(stored);
    },
    "GET /formulas/:id/versions": () => Response.json([]),
    "POST /formulas/save": async ({ request }) => {
      const body: SaveFormulasDto = await request.json();
      saves.push(body);
      const answer = answers.shift() ?? [];
      if (typeof answer === "number") {
        return Response.json(
          {
            message:
              "`base` was changed since you opened it. Reload to see the latest version.",
          },
          { status: answer },
        );
      }
      if (answer.length === 0) {
        const deleted = new Set(body.deletions.map((each) => each.id));
        const edited = new Map(body.edits.map((each) => [each.id, each]));
        stored = [
          ...stored
            .filter((each) => !deleted.has(each.id) && !edited.has(each.id))
            .concat(
              body.edits.map((each) => ({
                ...each,
                versionId: 100 + saves.length,
                reads: [],
                updatedAt: "2026-11-20T00:00:00.000Z",
              })),
            ),
        ];
      }
      return Response.json({ problems: answer });
    },
  }),
);

beforeEach(() => {
  stored = [base, doubled];
  saves = [];
  answers = [];
  listFails = false;
  listHeld = undefined;
  listFetches = 0;
});

const renderPage = (path: string, cached?: FormulaDto[]) => {
  const router = createMemoryRouter(
    [
      { path: "/formulas", element: <p>All formulas</p> },
      { path: "/formulas/:formulaId", element: <FormulaPage /> },
    ],
    { initialEntries: [path] },
  );
  const query = queryWrapper();
  if (cached !== undefined) {
    query.client.setQueryData(queryKeys.formulasAdmin(), cached);
  }
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return { router, client: query.client };
};
const typeText = (label: string, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(new RegExp(`^${label}`))[index], {
    target: { value },
  });

test("saves a new formula and moves to its page, focusing Save", async () => {
  const { router } = renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      `/formulas/${saves[0].edits[0].id}`,
    ),
  );
  expect(saves[0]).toEqual({
    edits: [
      {
        id: expect.any(String),
        baseVersionId: null,
        name: "tripled",
        text: "base * 3",
        notes: null,
      },
    ],
    deletions: [],
  });
  await screen.findByRole("heading", { name: "tripled" });
  await waitFor(() => expect(document.activeElement?.textContent).toBe("Save"));
  expect(listFetches).toBe(2);
});

test("shows what a save would break, and saves the fix with it", async () => {
  answers = [[breaksDoubled], []];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("The left of this operator has to be a number."),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Nothing was saved. Fix the problems below, then save again.",
    ),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Fixing doubled in this save" }),
  );
  typeText("Formula", "base + base", 1);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saves).toHaveLength(2));
  expect(
    saves[1].edits.map(({ id, baseVersionId, text }) => ({
      id,
      baseVersionId,
      text,
    })),
  ).toEqual([
    { id: base.id, baseVersionId: 1, text: '"two"' },
    { id: doubled.id, baseVersionId: 2, text: "base + base" },
  ]);
  await waitFor(() =>
    expect(screen.queryByText("Fixing", { exact: false })).toBeNull(),
  );
});

test("opens a fix with the names the save gives", async () => {
  answers = [[{ ...breaksDoubled, text: "bar * 2" }]];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Name", "bar");
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  expect(screen.getAllByLabelText(/^Formula/)[1]).toHaveProperty(
    "value",
    "bar * 2",
  );
});

test("says to reload when someone else saved first", async () => {
  answers = [409];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText(
      "`base` was changed since you opened it. Reload to see the latest version.",
    ),
  ).toBeTruthy();
  const assign = jest
    .spyOn(window.location, "assign")
    .mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(assign).toHaveBeenCalledWith(`/formulas/${base.id}`);
  assign.mockRestore();
});

test("reloads an unsaved new formula to a blank one", async () => {
  answers = [[breaksDoubled], 409];
  renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const assign = jest
    .spyOn(window.location, "assign")
    .mockImplementation(() => {});
  fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("/formulas/new"));
  assign.mockRestore();
});

test("reloads a new formula to its page when a lost answer hid its save", async () => {
  answers = [500, 409];
  renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Couldn't save.");
  const { id } = saves[0].edits[0];
  stored = [...stored, { ...base, id, name: "tripled", text: "base * 3" }];
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const assign = jest
    .spyOn(window.location, "assign")
    .mockImplementation(() => {});
  fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith(`/formulas/${id}`));
  assign.mockRestore();
});

test("offers no reload for a save refused for another reason", async () => {
  answers = [400];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("was changed since you opened it", { exact: false });
  expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
});

test("keeps unsaved edits when the list refreshes with a newer version", async () => {
  const { client } = renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  stored = [{ ...base, text: "7", versionId: 5 }, doubled];
  await act(() => client.invalidateQueries());
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  answers = [409];
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Reload" });
  expect(saves[0].edits[0].baseVersionId).toBe(1);
});

test("opens on the fetched list rather than an older cached one", async () => {
  stored = [{ ...base, text: "3", versionId: 50 }, doubled];
  renderPage(`/formulas/${base.id}`, [base, doubled]);
  await screen.findByRole("heading", { name: "base" });
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  typeText("Formula", "4");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0].edits[0].baseVersionId).toBe(50);
});

test("shows a failed fetch rather than opening on a cached list", async () => {
  listFails = true;
  renderPage(`/formulas/${base.id}`, [base, doubled]);
  await screen.findByText("Couldn't load formulas.");
  expect(screen.queryByLabelText(/^Formula/)).toBeNull();
});

test("opens a linked formula on a list fetched for it", async () => {
  renderPage(`/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  stored = [{ ...base, text: "3", versionId: 50 }, doubled];
  fireEvent.click(screen.getByRole("link", { name: "base" }));
  await screen.findByRole("heading", { name: "base" });
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  typeText("Formula", "4");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0].edits[0].baseVersionId).toBe(50);
});

test("keeps unsaved edits through a refresh that fails", async () => {
  const { client } = renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  listFails = true;
  await act(() => client.invalidateQueries());
  // Query observers notify on a timer.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
});

test("keeps the fields read-only while the list reloads after a save", async () => {
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  let release = () => {};
  listHeld = new Promise((resolve) => (release = resolve));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved.");
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("readOnly", true);
  expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy();
  release();
  await screen.findByRole("button", { name: "Save" });
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("readOnly", false);
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
});

test("gives focus back to Save once a save remounts the editor", async () => {
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved.");
  const save = await screen.findByRole("button", { name: "Save" });
  await waitFor(() => expect(document.activeElement).toBe(save));
});

test("links a problem in a formula newer than the page to its own page", async () => {
  const newer = "00000000-0000-4000-8000-00000000000c";
  answers = [[{ ...breaksDoubled, id: newer }]];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const link = await screen.findByRole("link", {
    name: `${newer} opens in new tab`,
  });
  expect(link.getAttribute("href")).toBe(`/formulas/${newer}`);
  expect(
    screen.getByText(
      "Added since this page opened, so fix it on its own page.",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Fix it in this save" }),
  ).toBeNull();
});

test("stays where the admin went while a new formula's page loads", async () => {
  const { router } = renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  let release = () => {};
  listHeld = new Promise((resolve) => (release = resolve));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Loading formula…");
  await act(() => router.navigate("/formulas"));
  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(router.state.location.pathname).toBe("/formulas");
});

test("keeps the saved text when the list can't load after a save", async () => {
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  listFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText(
      "Saved, but couldn't load it again. Reload to see it.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("value", "3");
  expect(screen.getByLabelText(/^Formula/)).toHaveProperty("readOnly", true);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(saves).toHaveLength(1);
});

test("leaves without asking when the list can't load after a save", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { router } = renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", "3");
  listFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved, but couldn't load it again.", {
    exact: false,
  });
  await act(() => router.navigate("/formulas"));
  expect(router.state.location.pathname).toBe("/formulas");
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test("moves to a new formula's page even when the list can't load after its save", async () => {
  renderPage("/formulas/new");
  await screen.findByRole("heading", { name: "New formula" });
  typeText("Name", "tripled");
  typeText("Formula", "base * 3");
  listFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  // Only the new formula's page, not the editor, says this.
  await screen.findByText("Couldn't load formulas.");
});

test("says to delete again when a delete is refused", async () => {
  answers = [[breaksDoubled], []];
  const { router } = renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  const confirm = () =>
    fireEvent.click(
      Array.from(screen.getByRole("dialog").querySelectorAll("button")).find(
        (button) => button.textContent === "Delete formula",
      ) ?? screen.getByRole("dialog"),
    );
  await screen.findByRole("dialog");
  confirm();
  expect(
    await screen.findByText(
      "Nothing was deleted. Fix the problems below, then delete again.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fix it in this save" }));
  typeText("Formula", "2", 1);
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  await screen.findByRole("dialog");
  confirm();
  await waitFor(() => expect(router.state.location.pathname).toBe("/formulas"));
  expect(saves[1]).toEqual({
    edits: [expect.objectContaining({ id: doubled.id, text: "2" })],
    deletions: [{ id: base.id, baseVersionId: 1 }],
  });
});

test("drops a fix's problems when the admin stops fixing it", async () => {
  answers = [[breaksDoubled], [{ ...breaksDoubled, text: "base + oops" }]];
  renderPage(`/formulas/${base.id}`);
  await screen.findByRole("heading", { name: "base" });
  typeText("Formula", '"two"');
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix it in this save" }),
  );
  typeText("Formula", "base + oops", 1);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saves).toHaveLength(2));
  await screen.findByRole("button", { name: "Save" });
  fireEvent.click(screen.getByRole("button", { name: "Stop fixing it" }));
  expect(screen.queryByText("Problems in other formulas")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Save" }),
  );
});

test("deletes after confirmation and returns to the list", async () => {
  const { router, client } = renderPage(`/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  typeText("Name", "half_typed");
  listHeld = new Promise(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Delete formula" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete formula",
    ) ?? dialog,
  );
  await waitFor(() => expect(router.state.location.pathname).toBe("/formulas"));
  expect(screen.getByText("Deleted doubled.")).toBeTruthy();
  expect(client.getQueryData(queryKeys.formulasAdmin())).toEqual([base]);
  expect(saves).toEqual([
    { edits: [], deletions: [{ id: doubled.id, baseVersionId: 2 }] },
  ]);
});

test("lists what it uses and what reads it", async () => {
  renderPage(`/formulas/${doubled.id}`);
  await screen.findByRole("heading", { name: "doubled" });
  expect(screen.getByRole("link", { name: "base" })).toBeTruthy();
  expect(screen.getByText("Nothing reads this formula yet.")).toBeTruthy();
});

test("says so for a formula that doesn't exist", async () => {
  renderPage("/formulas/00000000-0000-4000-8000-0000000000ff");
  expect(
    await screen.findByText("This formula doesn't exist, or was deleted."),
  ).toBeTruthy();
});
