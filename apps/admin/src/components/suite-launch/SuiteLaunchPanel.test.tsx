import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, setSystemTime } from "bun:test";
import {
  api,
  launchButton,
  onClose,
  renderPanel,
  resolveEveryCheck,
  serveLaunchApi,
} from "./SuiteLaunchPanel.testHarness";

serveLaunchApi();

it("flags overloaded members and text findings, and blocks launch until each is resolved", async () => {
  renderPanel();

  expect(await screen.findByText(/Ben/)).toBeTruthy();
  expect(
    screen.getByText(": 18 min (Call, Write)", { exact: false }),
  ).toBeTruthy();
  expect(screen.getByText("Double space · Call · Body")).toBeTruthy();
  expect(screen.getByText("Possible misspelling · Write · Body")).toBeTruthy();
  expect(
    screen.getByText(
      "1 member is assigned more than 15 minutes. The contract assigns tasks in 15-minute blocks.",
    ),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);

  await resolveEveryCheck();

  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  expect(launchButton().textContent).toContain("Launch and notify 2 members");
});

it("lists each action's unfinished checklist items", async () => {
  api.served[2] = {
    ...api.served[2],
    body: "",
    taskFormId: null,
    project: null,
  };
  renderPanel();

  expect(
    await screen.findByText(
      "Unfinished: Full body content, Part of a project, Task form linked, Task form has an output view, for the completion card",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Failed to load the task form/)).toBeNull();
  await resolveEveryCheck();
  expect(
    screen.getByText("1 action has unfinished checklist items."),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);
});

it("creates both events and the default reminders once the count is typed", async () => {
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  fireEvent.click(launchButton());
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 2 real members"),
    { target: { value: "I am going to notify 2 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(api.createdEvents.map((event) => event.newStatus)).toEqual([
    "member_action",
    "office_action",
  ]);
  expect(api.reminderEventIds).toEqual(Array(7).fill("100"));
});

it("refuses to launch once the member start has passed while the panel sat open", async () => {
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  setSystemTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
  fireEvent.click(launchButton());
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 2 real members"),
    { target: { value: "I am going to notify 2 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  expect(
    await screen.findByText(
      "Members taking action must start in the future. Pick a later time.",
    ),
  ).toBeTruthy();
  expect(api.createdEvents).toEqual([]);
});

it("links a task form finding to the form and a body finding to the action", async () => {
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
      ?.querySelector('[aria-label="Edit task form"]')
      ?.getAttribute("href"),
  ).toBe("/forms/5");
  expect(
    bodyFinding
      ?.querySelector('[aria-label="Edit action"]')
      ?.getAttribute("href"),
  ).toBe("/actions/1");
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
});

it("groups members by the actions they get and previews one from a group", async () => {
  renderPanel();
  await screen.findByText("Double space · Call · Body");

  const mixes = screen.getAllByRole("button", {
    name: "Preview a member who gets these actions",
  });
  expect(mixes.map((button) => button.closest("tr")?.textContent)).toEqual([
    "118Call, Write",
    "110Call",
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
  api.served[2] = { ...api.served[2], image: null, archived: true };
  renderPanel();

  const write = (await screen.findByText(/^1 member ·/)).closest("li");
  expect(write?.textContent).not.toContain("cover image");
  expect(write?.textContent).toContain("Archived");
  expect(
    write?.querySelector('[aria-label="Edit task form"]')?.getAttribute("href"),
  ).toBe("/forms/5");
  expect(screen.getByText(/^2 members ·/)).toBeTruthy();
});

it("states how long members have to complete their actions", async () => {
  setSystemTime(new Date("2026-01-15T20:00:00Z"));
  renderPanel();
  const sentence = await screen.findByText(
    "Members have 7 days 4 hours 59 minutes to complete their actions",
  );
  expect(sentence.tagName).toBe("P");
});

it("counts only members with an active contract, as the server admits them", async () => {
  api.benSigned = false;
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
  expect(screen.getByText(/^1 member ·/)).toBeTruthy();
  expect(screen.getByText(/^0 members ·/)).toBeTruthy();
});

it("counts no one for an action without a cohort, as the server does", async () => {
  api.served[1] = { ...api.served[1], cohortExpression: null };
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
});

it("counts an onboarding action's unsigned members", async () => {
  api.benSigned = false;
  api.served[2] = { ...api.served[2], onboarding: true };
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 2 members" }),
  ).toBeTruthy();
});

it("leaves out of an onboarding action the members who have already signed", async () => {
  api.benSigned = false;
  api.benEverSigned = true;
  api.served[1] = { ...api.served[1], onboarding: true };
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
});

it("leaves out members away during the launch", async () => {
  api.awayRanges = [{ userId: 11, fromDay: -1, toDay: 30 }];
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
});

it("counts members away only before members start or after office taking action", async () => {
  api.awayRanges = [
    { userId: 10, fromDay: -10, toDay: -1 },
    { userId: 11, fromDay: 10, toDay: 20 },
  ];
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 2 members" }),
  ).toBeTruthy();
});

it("keeps the checks up while away dates load past the year ahead", async () => {
  const { container } = renderPanel();
  await screen.findByRole("button", { name: "Launch and notify 2 members" });
  fireEvent.click(
    screen.getAllByRole("button", {
      name: "Preview a member who gets these actions",
    })[0],
  );
  fireEvent.change(
    container.querySelectorAll('input[type="datetime-local"]')[1],
    { target: { value: "2099-01-10T10:00" } },
  );
  expect(screen.queryByText("Running checks…")).toBeNull();
  expect(launchButton().textContent).toBe("Launch and notify ? members");
  expect(screen.getByText("Actions unknown")).toBeTruthy();
  await screen.findByRole("button", { name: "Launch and notify 2 members" });
  expect(screen.queryByText("Actions unknown")).toBeNull();
});

it("blocks launch, counting no one, when members' away dates fail to load", async () => {
  api.awayRangesFail = true;
  renderPanel();

  expect(
    await screen.findByText("Failed to load members' away dates."),
  ).toBeTruthy();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(true),
  );
  expect(screen.getAllByText(/^\? members ·/)).toHaveLength(2);
  expect(launchButton().textContent).toBe("Launch and notify ? members");
  expect(screen.queryByText("No member is assigned any action.")).toBeNull();
  expect(
    screen.getByText("Unknown until every member count loads"),
  ).toBeTruthy();
});

it("blocks launch when members' contract status fails to load", async () => {
  api.userListFails = true;
  renderPanel();

  expect(
    await screen.findByText("Failed to load members' contract status."),
  ).toBeTruthy();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(true),
  );
  expect(screen.getByText("Some checks failed to load.")).toBeTruthy();
  expect(screen.getAllByText(/^\? members ·/)).toHaveLength(2);
  expect(launchButton().textContent).toBe("Launch and notify ? members");
  expect(screen.queryByText("No member is assigned any action.")).toBeNull();
});

it("keeps the schedule, checks, and dismissals across a reload, until launch", async () => {
  const first = renderPanel();
  await resolveEveryCheck();
  fireEvent.change(
    first.container.querySelectorAll('input[type="datetime-local"]')[0],
    { target: { value: "2099-01-02T10:00" } },
  );
  fireEvent.change(
    first.container.querySelectorAll('input[type="datetime-local"]')[1],
    { target: { value: "2099-01-10T10:00" } },
  );
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  first.unmount();

  const second = renderPanel();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  const memberStart = second.container.querySelectorAll(
    'input[type="datetime-local"]',
  )[0];
  expect(memberStart instanceof HTMLInputElement && memberStart.value).toBe(
    "2099-01-02T10:00",
  );

  fireEvent.click(launchButton());
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 2 real members"),
    { target: { value: "I am going to notify 2 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(window.localStorage.length).toBe(0);
});

it("says saved progress it can't read starts over", async () => {
  window.localStorage.setItem("alliance.suiteLaunch.v1.3", "{not json");
  renderPanel();

  expect(
    await screen.findByText(
      "Saved launch progress couldn't be read, so this starts over.",
    ),
  ).toBeTruthy();
});

it("re-runs the checks without failing the loads an action doesn't make", async () => {
  api.served[2] = { ...api.served[2], taskFormId: null };
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Re-run checks" }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(
    screen.queryByText("Failed to load the task form for Write."),
  ).toBeNull();
});
