import type {
  ActionSuiteDto,
  SaveSuiteSplitDto,
  SuiteSplitDto,
} from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import ActionSuitePage from "./ActionSuitePage";

const suite: ActionSuiteDto = {
  id: 3,
  name: "Suite",
  actions: [
    makeAction({ id: 1, name: "Call" }),
    makeAction({ id: 2, name: "Write" }),
  ],
  events: [makeEvent({ id: 1, title: "Launch" })],
  reminderGroups: [],
  generalUpdates: [],
};

const letters = (overrides: Partial<SuiteSplitDto> = {}): SuiteSplitDto => ({
  id: 4,
  title: "Letters",
  visibilityMode: "combined",
  filterExpression: null,
  launched: false,
  arms: [
    { id: 1, actionId: 1, rule: { type: "USMember" }, optional: false },
    { id: 2, actionId: 2, rule: null, optional: true },
  ],
  ...overrides,
});

let stored: SuiteSplitDto[] = [];
let saved: { method: string; body: SaveSuiteSplitDto }[] = [];
let deleted: string[] = [];
let refusal: string | null = null;

const failure = () => Response.json({}, { status: 500 });

const save = async ({ request }: { request: Request }) => {
  const body: SaveSuiteSplitDto = await request.json();
  saved.push({ method: request.method, body });
  if (refusal) return Response.json({ message: refusal }, { status: 400 });
  stored = [
    letters({
      title: body.title,
      arms: body.arms.map((arm, index) => ({ ...arm, id: index + 1 })),
    }),
  ];
  return Response.json(stored);
};

serveApi(
  routes(
    {
      "GET /actions/suite/:id": () => Response.json(suite),
      "GET /actions/suite/:suiteId/splits": () => Response.json(stored),
      "POST /actions/suite/:suiteId/splits": save,
      "PUT /actions/suite/:suiteId/splits/:splitId": save,
      "DELETE /actions/suite/:suiteId/splits/:splitId": ({ params }) => {
        deleted.push(params.splitId);
        stored = [];
        return Response.json(stored);
      },
    },
    failure,
  ),
);

afterEach(() => {
  stored = [];
  saved = [];
  deleted = [];
  refusal = null;
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/suites/3"]}>
      <ToastProvider>
        <Routes>
          <Route path="/suites/:suiteId" element={<ActionSuitePage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("lists each split's arms in order, with their rules", async () => {
  stored = [letters()];
  renderPage();

  const split = await screen.findByRole("region", { name: "Letters" });
  expect(split.textContent).toContain(
    "Combined visibility · Reaches every member",
  );
  expect(
    within(split)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Call: US Member", "Write (optional): everyone else"]);
});

it("creates a split whose last arm catches everyone else", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "New split" }));
  const form = screen.getByRole("form", { name: "New split" });
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "Letters" },
  });
  fireEvent.change(within(form).getByLabelText("Arm 1"), {
    target: { value: "1" },
  });
  fireEvent.change(within(form).getByLabelText("Arm 2"), {
    target: { value: "2" },
  });
  expect(
    within(form).getByText(
      "Catches everyone else the split reaches, so it takes no rule.",
    ),
  ).toBeTruthy();
  fireEvent.click(within(form).getByRole("button", { name: "Add Condition" }));
  fireEvent.click(within(form).getByRole("button", { name: "Save split" }));

  expect(await screen.findByRole("region", { name: "Letters" })).toBeTruthy();
  expect(saved).toEqual([
    {
      method: "POST",
      body: {
        title: "Letters",
        visibilityMode: "combined",
        filterExpression: null,
        arms: [
          { actionId: 1, rule: { type: "Tag", tagId: "" }, optional: false },
          { actionId: 2, rule: null, optional: false },
        ],
      },
    },
  ]);
});

it("says what's missing instead of saving an incomplete split", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "New split" }));
  fireEvent.click(screen.getByRole("button", { name: "Save split" }));

  expect(screen.getByText("Give the split a title.")).toBeTruthy();
  expect(screen.getByText("Give arm 1 a rule.")).toBeTruthy();
  expect(saved).toEqual([]);
});

it("locks a launched split's arms and rules, saving its optional flags, and shows a refusal", async () => {
  stored = [letters({ launched: true })];
  refusal = "Title is too long";
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Edit Letters" }));
  const form = screen.getByRole("form", { name: "Edit Letters" });
  expect(within(form).getByText(/This split has launched/)).toBeTruthy();
  expect(within(form).queryByRole("combobox")).toBeNull();
  expect(within(form).queryByRole("button", { name: /Move/ })).toBeNull();
  fireEvent.click(
    within(form).getAllByRole("checkbox", { name: "Optional" })[0],
  );
  fireEvent.click(within(form).getByRole("button", { name: "Save split" }));

  expect(await screen.findByText("Title is too long")).toBeTruthy();
  expect(saved.map(({ method, body }) => [method, body.arms])).toEqual([
    [
      "PUT",
      [
        { actionId: 1, rule: { type: "USMember" }, optional: true },
        { actionId: 2, rule: null, optional: true },
      ],
    ],
  ]);
  expect(screen.queryByRole("button", { name: "Delete Letters" })).toBeNull();
});

it("deletes a split before launch once confirmed", async () => {
  stored = [letters()];
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Delete Letters" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Delete split" }));

  expect(await screen.findByText(/No splits yet/)).toBeTruthy();
  expect(deleted).toEqual(["4"]);
});
