import type {
  SaveSplitDto,
  SaveSplitResultDto,
  SplitPreviewResultDto,
  SuiteSplitDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import SuiteSplitSection from "./SuiteSplitSection";

const EVERYONE_ELSE = "00000000-0000-4000-8000-0000000000e1";
const LISTED = "00000000-0000-4000-8000-0000000000a1";
const split = (versionId: number): SuiteSplitDto => ({
  versionId,
  groups: [
    {
      id: LISTED,
      name: "Listed",
      text: 'isOnList("A")',
      fallback: null,
      noRequiredWorkTick: null,
      cells: [{ actionId: 1, assignment: "required" }],
    },
    {
      id: EVERYONE_ELSE,
      name: "Everyone else",
      text: null,
      fallback: null,
      noRequiredWorkTick: null,
      cells: [],
    },
  ],
  actions: [
    { id: 1, name: "Call" },
    { id: 2, name: "Write" },
  ],
  launched: false,
  launchFailedAt: null,
  launchFailure: null,
});

let stored: SuiteSplitDto;
let saves: SaveSplitDto[];
let saveAnswer: Omit<SaveSplitResultDto, "split">;
let previewAnswer: SplitPreviewResultDto;
let saveStatus: number;
let previewStatus: number;
let keepsVersion: boolean;
let saveGate: Promise<void>;
let gets: number;
let getGate: Promise<void> | null;

serveApi(
  routes({
    "GET /actions/suite/:suiteId/split": async () => {
      gets += 1;
      const snapshot = stored;
      const gate = getGate;
      getGate = null;
      await gate;
      return Response.json(snapshot);
    },
    "POST /actions/suite/:suiteId/split/save": async ({ request }) => {
      saves.push(await request.json());
      await saveGate;
      if (saveStatus !== 200)
        return Response.json(
          { message: "Unavailable" },
          { status: saveStatus },
        );
      if (saveAnswer.problems.length > 0)
        return Response.json({ ...saveAnswer, split: null });
      if (!keepsVersion) stored = split(stored.versionId + 1);
      return Response.json({ ...saveAnswer, split: stored });
    },
    "POST /actions/suite/:suiteId/split/preview": () =>
      Response.json(
        previewStatus === 200 ? previewAnswer : { message: "Unavailable" },
        { status: previewStatus },
      ),
  }),
);

beforeEach(() => {
  stored = split(3);
  saves = [];
  saveAnswer = { problems: [], warnings: [] };
  previewAnswer = { problems: [] };
  saveStatus = 200;
  previewStatus = 200;
  keepsVersion = false;
  saveGate = Promise.resolve();
  gets = 0;
  getGate = null;
});

const renderSection = () => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <SuiteSplitSection suiteId={7} usesGroups scheduled={false} />,
      },
    ],
    { initialEntries: ["/"] },
  );
  const query = queryWrapper();
  render(<RouterProvider router={router} />, query);
  return query.client;
};

it("saves a new group before Everyone else, with its grid cells, and shows the save's warnings until an edit", async () => {
  saveAnswer = {
    problems: [],
    warnings: [
      { groupId: EVERYONE_ELSE, message: "No member is in it today." },
    ],
  };
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));
  const added = screen.getByRole("group", { name: "2. Unnamed group" });
  fireEvent.change(within(added).getByLabelText("Name"), {
    target: { value: "Volunteers" },
  });
  fireEvent.change(within(added).getByRole("textbox", { name: /Condition/ }), {
    target: { value: 'isOnList("V")' },
  });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Write for Volunteers" }),
    {
      target: { value: "optional" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));

  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0].baseVersionId).toBe(3);
  expect(saves[0].groups.map((group) => group.name)).toEqual([
    "Listed",
    "Volunteers",
    "Everyone else",
  ]);
  expect(saves[0].groups[1]).toMatchObject({
    text: 'isOnList("V")',
    cells: [{ actionId: 2, assignment: "optional" }],
  });
  expect(
    await screen.findByText("Warning: No member is in it today."),
  ).toBeTruthy();

  fireEvent.change(screen.getAllByLabelText("Name")[0], {
    target: { value: "Listed members" },
  });
  expect(screen.queryByText("Warning: No member is in it today.")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes.");
});

it("shows each refusal at its group and keeps the edits", async () => {
  saveAnswer = {
    problems: [
      {
        groupId: LISTED,
        text: "maybe",
        diagnostics: [
          { message: "Pick what happens to those members.", start: 0, end: 5 },
        ],
      },
    ],
    warnings: [],
  };
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Listed members" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  expect(
    await screen.findByText("Pick what happens to those members."),
  ).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
    "Listed members",
  );
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes.");
});

it("shows the problems of a refusal and a preview of the same groups once", async () => {
  const problems = [
    {
      groupId: LISTED,
      text: "maybe",
      diagnostics: [
        { message: "Pick what happens to those members.", start: 0, end: 5 },
      ],
    },
  ];
  saveAnswer = { problems, warnings: [] };
  previewAnswer = { problems };
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await screen.findByText("Pick what happens to those members.");
  fireEvent.click(screen.getByRole("button", { name: "Run preview" }));
  screen.getByRole("button", { name: "Running preview…" });
  await screen.findByRole("button", { name: "Run preview" });
  expect(
    screen.getAllByText("Pick what happens to those members."),
  ).toHaveLength(1);
});

it("moves a group but never past Everyone else", async () => {
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Move up" })[1]);
  expect(
    screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(["1. Unnamed group", "2. Listed", "3. Everyone else"]);
  const down = screen.getAllByRole("button", { name: "Move down" })[1];
  expect(down.getAttribute("aria-disabled")).toBe("true");
});

it("removes a group and moves focus to Add group", async () => {
  renderSection();
  await screen.findByText("1. Listed");
  const remove = screen.getByRole("button", { name: "Remove Listed" });
  remove.focus();
  fireEvent.click(remove);
  expect(screen.queryByText("1. Listed")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Add group" }),
  );
});

it("previews the groups and marks the preview out of date after an edit, still naming the groups it counted", async () => {
  previewAnswer = {
    problems: [],
    preview: {
      population: 10,
      groups: [
        { groupId: LISTED, count: 4 },
        { groupId: EVERYONE_ELSE, count: 6 },
      ],
      byWork: { required: 4, optionalOnly: 0, nothing: 6 },
      couldNotDecide: 0,
      errors: [{ message: "No such list.", count: 2 }],
      untakenBranches: [{ where: "Listed", text: "1 > 0" }],
    },
  };
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.click(screen.getByRole("button", { name: "Run preview" }));
  expect(
    await screen.findByText("Preview of 10 members with an agreement"),
  ).toBeTruthy();
  expect(screen.getByText("Nothing assigned: 6")).toBeTruthy();
  expect(screen.getByText("1 > 0")).toBeTruthy();
  expect(screen.getByText("No such list. (2 members)")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Call for Listed" }), {
    target: { value: "optional" },
  });
  expect(
    screen.getByText(
      "The groups changed since this preview. Run it again to update it.",
    ),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Renamed" },
  });
  expect(screen.getByRole("rowheader", { name: "Listed" })).toBeTruthy();
});

it("says a failed save failed and keeps the edits", async () => {
  saveStatus = 503;
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Listed members" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Couldn't save the groups."),
  );
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
    "Listed members",
  );
});

it("clears the no-required-work tick when the group's kind of work changes", async () => {
  stored = split(3);
  stored.groups[1].noRequiredWorkTick = "nothing";
  renderSection();
  await screen.findByText("1. Listed");
  const tick = () =>
    screen.getAllByRole<HTMLInputElement>("checkbox", {
      name: "This group intentionally has no required work",
    })[0];
  expect(tick().checked).toBe(true);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Write for Everyone else" }),
    { target: { value: "optional" } },
  );
  expect(tick().checked).toBe(false);
});

it("shows no unsaved changes after a save the server stored as it was", async () => {
  keepsVersion = true;
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.change(screen.getByRole("textbox", { name: /Condition/ }), {
    target: { value: 'isOnList("A") ' },
  });
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes.");
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await waitFor(() => expect(saves).toHaveLength(1));
  await waitFor(() =>
    expect(screen.queryByText("Unsaved changes.")).toBeNull(),
  );
});

it("keeps unsaved edits when the groups were saved elsewhere, until asked to load the latest", async () => {
  const client = renderSection();
  await screen.findByText("1. Listed");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Listed members" },
  });
  stored = split(4);
  await client.invalidateQueries();

  await screen.findByText(/saved elsewhere since you opened them/);
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
    "Listed members",
  );
  saveStatus = 409;
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0].baseVersionId).toBe(3);
  await screen.findByText("Unavailable");

  fireEvent.click(await screen.findByRole("button", { name: "Load latest" }));
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Listed");
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Groups" }),
  );
  expect(screen.queryByText(/saved elsewhere/)).toBeNull();
  expect(screen.queryByText("Unavailable")).toBeNull();
});

it.each([
  ["Save groups", () => (saveStatus = 409)],
  ["Run preview", () => (previewStatus = 409)],
])(
  "offers the latest groups after %s is refused because an action left, keeping the edits until asked",
  async (button, refuse) => {
    renderSection();
    await screen.findByText("1. Listed");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Listed members" },
    });
    stored = { ...split(3), actions: [{ id: 2, name: "Write" }] };
    stored.groups[0].cells = [];
    refuse();
    fireEvent.click(screen.getByRole("button", { name: button }));

    await screen.findByRole("button", { name: "Load latest" });
    screen.getByText(/An action left this suite since you opened these groups/);
    expect(screen.queryByText(/saved elsewhere/)).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "Listed members",
    );
  },
);

it("hides a refused save's problems once the group is edited", async () => {
  saveAnswer = {
    problems: [
      {
        groupId: LISTED,
        text: "maybe",
        diagnostics: [
          { message: "Pick what happens to those members.", start: 0, end: 5 },
        ],
      },
    ],
    warnings: [],
  };
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await screen.findByText("Pick what happens to those members.");
  fireEvent.change(screen.getByRole("textbox", { name: /Condition/ }), {
    target: { value: "true" },
  });
  expect(screen.queryByText("Pick what happens to those members.")).toBeNull();
});

it("shows no unsaved changes after a cell is changed and changed back", async () => {
  stored.groups[0].cells.unshift({ actionId: 2, assignment: "optional" });
  renderSection();
  await screen.findByText("1. Listed");
  const call = () => screen.getByRole("combobox", { name: "Call for Listed" });
  fireEvent.change(call(), { target: { value: "optional" } });
  fireEvent.change(call(), { target: { value: "required" } });
  expect(screen.getByRole("status").textContent).toBe("");
  fireEvent.change(call(), { target: { value: "not_assigned" } });
  fireEvent.change(call(), { target: { value: "required" } });
  expect(screen.getByRole("status").textContent).toBe("");
});

it("keeps a refused save's problems hidden after the next save fails", async () => {
  saveAnswer = {
    problems: [
      {
        groupId: LISTED,
        text: "maybe",
        diagnostics: [
          { message: "Pick what happens to those members.", start: 0, end: 5 },
        ],
      },
    ],
    warnings: [],
  };
  renderSection();
  await screen.findByText("1. Listed");
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await screen.findByText("Pick what happens to those members.");
  fireEvent.change(screen.getByRole("textbox", { name: /Condition/ }), {
    target: { value: "true" },
  });
  saveStatus = 503;
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await screen.findByText(/Couldn't save the groups\./);
  expect(screen.queryByText("Pick what happens to those members.")).toBeNull();
});

it("keeps edits made while a save runs", async () => {
  let open!: () => void;
  saveGate = new Promise((resolve) => (open = resolve));
  renderSection();
  await screen.findByText("1. Listed");
  const name = () => screen.getByLabelText<HTMLInputElement>("Name");
  fireEvent.change(name(), { target: { value: "A" } });
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await waitFor(() => expect(saves).toHaveLength(1));
  fireEvent.change(name(), { target: { value: "AB" } });
  open();

  await screen.findByRole("button", { name: "Save groups" });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Saving…" })).toBeNull(),
  );
  expect(name().value).toBe("AB");
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes.");
  expect(screen.queryByText(/saved elsewhere/)).toBeNull();
});

it("adopts the groups the save returns, not a refetch that started before the save", async () => {
  const client = renderSection();
  await screen.findByText("1. Listed");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "A" } });
  let open!: () => void;
  getGate = new Promise((resolve) => (open = resolve));
  void client.invalidateQueries();
  await waitFor(() => expect(gets).toBe(2));
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("Saved."),
  );
  open();
  await waitFor(() => expect(client.isFetching()).toBe(0));

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "B" } });
  fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
  await waitFor(() => expect(saves).toHaveLength(2));
  expect(saves[1].baseVersionId).toBe(4);
  expect(gets).toBe(2);
  expect(screen.queryByText(/saved elsewhere/)).toBeNull();
});

it("keeps unsaved edits without offering the latest when only an action's name changed", async () => {
  const client = renderSection();
  await screen.findByText("1. Listed");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "A" } });
  stored = {
    ...split(3),
    actions: [{ id: 1, name: "Call members" }, stored.actions[1]],
  };
  await client.invalidateQueries();

  await screen.findByRole("combobox", { name: "Call members for A" });
  expect(screen.queryByText(/saved elsewhere/)).toBeNull();
});
