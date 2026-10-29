import { fireEvent, screen } from "@testing-library/react";
import { expect, it, setSystemTime } from "bun:test";
import {
  api,
  renderPanel,
  serveLaunchApi,
} from "./SuiteLaunchPanel.testHarness";

serveLaunchApi();

it("links a task form finding to the form and a body finding to its text in the action", async () => {
  api.formPages = [{ id: "p1", title: "Page  one", fields: [] }];
  renderPanel();

  const formFinding = (
    await screen.findAllByText("Double space · Call · Task form")
  )[0].closest("li");
  const bodyFinding = screen
    .getByText("Double space · Call · Body")
    .closest("li");
  expect(
    formFinding
      ?.querySelector('[aria-label="Edit this text in the form"]')
      ?.getAttribute("href"),
  ).toBe("/forms/5?select=p1");
  expect(
    bodyFinding
      ?.querySelector('[aria-label="Edit this text"]')
      ?.getAttribute("href"),
  ).toBe("/actions/1?tab=details&field=body&from=4&to=6");
});

it("previews the actions assigned to a picked member", async () => {
  renderPanel();
  await screen.findByText("Double space · Call · Body");

  fireEvent.change(screen.getByPlaceholderText("Search by name"), {
    target: { value: "Ana" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Ana/ }));

  const row = (
    await screen.findByRole("link", { name: "Log in as this member" })
  ).closest("li");
  expect(row?.textContent).toContain("Ana10 min");
  expect(row?.textContent).toContain("Call");
  expect(row?.textContent).not.toContain("Write");
  expect(
    screen
      .getByRole("link", { name: "Log in as this member" })
      .getAttribute("href"),
  ).toEndWith("/auth/impersonate/10");
  expect(
    screen.getByText(/Logging in as a member signs this browser out/),
  ).toBeTruthy();
  expect(
    row
      ?.querySelector('[aria-label="Preview task form as this member"]')
      ?.getAttribute("href"),
  ).toBe("/forms/5?previewAs=10");
});

it("groups members by the actions they get and previews one from a group", async () => {
  renderPanel();
  await screen.findByText("Double space · Call · Body");

  const mixes = screen.getAllByRole("button", {
    name: "Preview a member who gets these actions",
  });
  const cells = (button: HTMLElement) =>
    [...(button.closest("tr")?.querySelectorAll("td") ?? [])].map((td) =>
      [...td.querySelectorAll("span")].map((line) => line.textContent),
    );
  expect(
    mixes.map((button) => {
      const [members, minutes] = [
        ...(button.closest("tr")?.querySelectorAll("td") ?? []),
      ].map((td) => td.textContent);
      return { members, minutes, actions: cells(button)[2] };
    }),
  ).toEqual([
    { members: "1", minutes: "18", actions: ["Call", "Write"] },
    { members: "1", minutes: "10", actions: ["Call"] },
  ]);
  fireEvent.click(mixes[0]);

  const row = (
    await screen.findByRole("link", { name: "Log in as this member" })
  ).closest("li");
  expect(row?.textContent).toContain("Ben18 min");
});

it("lists the reminders the launch creates", async () => {
  renderPanel();
  expect(await screen.findByText("7 created on launch")).toBeTruthy();
  expect(screen.getByText("Member Action announcement")).toBeTruthy();
  expect(screen.getByText("Missed deadline message")).toBeTruthy();
});

it("shows each action's audience, task form link, and what to look at before checking it", async () => {
  api.served[2] = { ...api.served[2], archived: true };
  renderPanel();

  const write = (await screen.findByText(/^1 members ·/)).closest("li");
  expect(write?.textContent).not.toContain("cover image");
  expect(write?.textContent).toContain("Archived");
  expect(
    write?.querySelector('[aria-label="Edit task form"]')?.getAttribute("href"),
  ).toBe("/forms/5");
  expect(screen.getByText(/^2 members ·/)).toBeTruthy();
});

it("counts only members with an active contract, as the server admits them", async () => {
  api.benSigned = false;
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 members" }),
  ).toBeTruthy();
  expect(screen.getByText(/^1 members ·/)).toBeTruthy();
  expect(screen.getByText(/^0 members ·/)).toBeTruthy();
});

it("notes the reminders that reach members at night in their own zone", async () => {
  // 9am Pacific, so the default start is 7pm the same day.
  setSystemTime(new Date("2026-10-28T16:00:00Z"));
  renderPanel();

  const note = await screen.findByText(
    "Reaches 2 members between 10pm and 8am their time",
  );
  expect(note.closest("li")?.textContent).toContain("Missed deadline message");
  expect(
    screen.getByText("24-48h reminder").closest("li")?.textContent,
  ).not.toContain("their time");
});

it("notes an action that takes longer to read than its time estimate", async () => {
  api.served[2] = {
    ...api.served[2],
    timeEstimate: 1,
    body: "Write the letter. ".repeat(70),
  };
  renderPanel();

  expect(
    await screen.findByText(
      "Reading alone takes about 2 min, more than its 1 min estimate",
    ),
  ).toBeTruthy();
  expect(screen.getAllByText(/Reading alone takes/)).toHaveLength(1);
});

it("warns when a cohort reads another action that's still open at launch", async () => {
  api.served[2] = {
    ...api.served[2],
    cohortExpression: { type: "CompletedAction", actionId: 1 },
  };
  api.actionList = [1, 2].map((id) => ({
    id,
    name: api.served[id].name,
    taskFormId: 5,
    variantFormIds: [],
    onboarding: false,
    memberActionDeadline: null,
  }));
  renderPanel();

  const warning = await screen.findByText(
    /These conditions read "Call", still open when members are decided at launch/,
  );
  expect(warning.closest("li")?.textContent).toContain("Write");
});

it("shows each reminder as the picked group of members gets it", async () => {
  renderPanel();

  const announcement = (
    await screen.findByText("New Alliance tasks: Call, Write", { exact: false })
  ).closest("li");
  expect(announcement?.textContent).toContain("Member Action announcement");
  expect(announcement?.textContent).toContain("As Ben gets it");

  fireEvent.click(screen.getAllByRole("radio")[1]);
  expect(
    await screen.findByText("New Alliance task: Call", { exact: false }),
  ).toBeTruthy();
  expect(screen.getAllByText("As Ana gets it").length).toBeGreaterThan(0);
});

it("checks the text of each variant form, linking to that form", async () => {
  api.formPages = [{ id: "p1", title: "Page  one", fields: [] }];
  api.actionList = [1, 2].map((id) => ({
    id,
    name: api.served[id].name,
    taskFormId: 5,
    variantFormIds: id === 1 ? [9] : [],
    onboarding: false,
    memberActionDeadline: null,
  }));
  renderPanel();

  const variantFinding = (
    await screen.findAllByText("Double space · Call · Variant form")
  )[0].closest("li");
  expect(
    variantFinding
      ?.querySelector('[aria-label="Edit this text in the form"]')
      ?.getAttribute("href"),
  ).toBe("/forms/9?select=p1");
});

it("notes reading time from the longest variant form", async () => {
  api.served[2] = { ...api.served[2], timeEstimate: 1 };
  api.formPagesById[9] = [
    { id: "p1", title: "Write the letter. ".repeat(70), fields: [] },
  ];
  api.actionList = [1, 2].map((id) => ({
    id,
    name: api.served[id].name,
    taskFormId: 5,
    variantFormIds: id === 2 ? [9] : [],
    onboarding: false,
    memberActionDeadline: null,
  }));
  renderPanel();

  expect(
    await screen.findByText(
      "Reading alone takes about 2 min, more than its 1 min estimate",
    ),
  ).toBeTruthy();
});

it("notes an action that already has its own members taking action event", async () => {
  api.actionList = [1, 2].map((id) => ({
    id,
    name: api.served[id].name,
    taskFormId: 5,
    variantFormIds: [],
    onboarding: false,
    memberActionDeadline: null,
    memberActionStart: id === 2 ? "2026-10-01T02:00:00.000Z" : null,
  }));
  renderPanel();

  const note = await screen.findByText(
    /^Already has its own members taking action event \(Sep 30, 2026 at 7:00 PM PT\)/,
  );
  expect(note.closest("li")?.textContent).toContain("Write");
  expect(screen.getAllByText(/Already has its own/)).toHaveLength(1);
});

it("previews a task form as each kind of member among the action's own recipients", async () => {
  api.served[1] = { ...api.served[1], taskFormId: 7 };
  api.formPagesById[7] = [
    {
      id: "p1",
      title: "Only with a city",
      fields: [],
      visibleIfFormula: {
        formula: "c1",
        conditions: { c1: { kind: "userHasCity", userHasCity: true } },
      },
    },
  ];
  renderPanel();

  expect(await screen.findByText("2 variants")).toBeTruthy();
  fireEvent.click(screen.getByText("Call", { selector: "summary" }));
  const cards = await screen.findAllByRole("radio", {
    name: /1 member.*has city/,
  });
  expect(api.visibilityProfileRequests).toEqual([{ userIds: [10, 11] }]);
  expect(screen.queryByText("Write", { selector: "summary" })).toBeNull();

  fireEvent.click(cards[1]);
  expect(await screen.findByText("As Ben sees it")).toBeTruthy();
});

it("leaves out task forms that show every member the same thing", async () => {
  renderPanel();
  await screen.findByText("Double space · Call · Body");

  expect(screen.queryByText("Task forms by member")).toBeNull();
  expect(api.visibilityProfileRequests).toEqual([]);
});
