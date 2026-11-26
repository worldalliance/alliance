import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, setSystemTime } from "bun:test";
import { LaunchSection } from "../../../components/suite-launch/launchBlockers";
import {
  api,
  launchButton,
  manual,
  onClose,
  renderPanel,
  resolveEveryCheck,
  serveLaunchApi,
} from "./SuiteLaunchPanel.testHarness";

serveLaunchApi();

it("flags overloaded members and text findings, and blocks launch until each is resolved", async () => {
  renderPanel();

  const overload = await screen.findByText(
    "1 of 2 members gets more than 15 minutes",
  );
  expect(overload.parentElement?.textContent).toContain("Needs attention");
  expect(screen.getByText("18").className).toContain("text-danger");
  expect(screen.getByText("10").className).not.toContain("text-danger");
  expect(screen.getAllByText("over 15 minutes")).toHaveLength(1);
  expect(
    screen.getByText("Double space · Call · Task page description"),
  ).toBeTruthy();
  expect(
    screen.getByText("Possible misspelling · Write · Task page description"),
  ).toBeTruthy();
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

it("shows the contract warning first, above every check", async () => {
  renderPanel();

  await screen.findByText(
    "1 member is assigned more than 15 minutes. The contract assigns tasks in 15-minute blocks.",
  );
  const contract = document.getElementById(LaunchSection.Contract);
  expect(contract?.parentElement?.firstElementChild).toBe(contract);
  expect(
    screen.getByRole("button", {
      name: "1 contract violation to fix or accept.",
    }),
  ).toBeTruthy();
});

it("passes the members' actions check when no member gets more than 15 minutes", async () => {
  api.served[2] = { ...api.served[2], timeEstimate: 5 };
  renderPanel();

  const summary = await screen.findByText(
    "No member gets more than 15 minutes",
  );
  expect(summary.parentElement?.textContent).toContain("Passes");
  expect(screen.queryByText("over 15 minutes")).toBeNull();
});

it("counts a single assigned member in the singular", async () => {
  api.served[1] = { ...api.served[1], cohortExpression: manual([11]) };
  renderPanel();

  expect(
    await screen.findByText("1 of 1 member gets more than 15 minutes"),
  ).toBeTruthy();
});

it("lists each action's unfinished checklist items", async () => {
  api.served[2] = {
    ...api.served[2],
    body: "",
    taskFormId: null,
    taskKind: "form",
    project: null,
  };
  renderPanel();

  expect(
    await screen.findByText(
      "Unfinished: Full body content, Part of a project, Task form linked, Task form has an output view, for the completion card",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Couldn't load the task form/)).toBeNull();
  await resolveEveryCheck();
  expect(
    screen.getByText("1 task has unfinished checklist items."),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);
});

it("launches with unfinished checklist items once they're dismissed, until they're restored", async () => {
  api.served[2] = { ...api.served[2], project: null };
  renderPanel();
  await resolveEveryCheck();
  expect(
    await screen.findByText("1 task has unfinished checklist items."),
  ).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Dismiss unfinished items" }),
  );

  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  expect(
    screen.getByText("Unfinished (dismissed): Part of a project"),
  ).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Restore unfinished items" }),
  );
  expect(
    screen.getByText("1 task has unfinished checklist items."),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);
});

it("marks the dismissed items when another goes missing, which blocks launch again", async () => {
  api.served[2] = { ...api.served[2], project: null };
  const first = renderPanel();
  await resolveEveryCheck();
  fireEvent.click(
    await screen.findByRole("button", { name: "Dismiss unfinished items" }),
  );
  first.unmount();

  api.served[2] = { ...api.served[2], image: null };
  renderPanel();

  expect(await screen.findByText("Part of a project (dismissed)")).toBeTruthy();
  const row = screen.getByText("Part of a project (dismissed)").parentElement;
  expect(row?.textContent).toContain("Image set");
  expect(row?.textContent).not.toContain("Image set (dismissed)");
  expect(
    screen.getByRole("button", { name: "Dismiss unfinished items" }),
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

  const error = await screen.findByText(
    "Members taking action must start in the future. Pick a later time.",
  );
  expect(launchButton().previousElementSibling).toBe(error);
  expect(api.createdEvents).toEqual([]);
});

it("asks again to break the contract once the violations change", async () => {
  const first = renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  first.unmount();

  api.served[2] = {
    ...api.served[2],
    cohortExpression: manual([10, 11]),
  };
  renderPanel();

  expect(
    await screen.findByText(
      "2 members are assigned more than 15 minutes. The contract assigns tasks in 15-minute blocks.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("1 contract violation to fix or accept."),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);
});

it("states how long members have to complete their tasks", async () => {
  setSystemTime(new Date("2026-01-15T20:00:00Z"));
  renderPanel();
  const sentence = await screen.findByText(
    "Members have 7 days 4 hours 59 minutes to complete their tasks",
  );
  expect(sentence.tagName).toBe("P");
});

it("restores a dismissed finding, which blocks launch again", async () => {
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  fireEvent.click(screen.getByRole("button", { name: "Show dismissed" }));
  const misspelling = screen
    .getByText("Possible misspelling · Write · Task page description")
    .closest("li");
  if (!misspelling) throw new Error("no dismissed finding");
  fireEvent.click(within(misspelling).getByRole("button", { name: "Restore" }));

  expect(screen.getByText("1 text finding to fix or dismiss.")).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);
  expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(1);
});

it("jumps from a blocker to the section that resolves it", async () => {
  renderPanel();
  const scrolled: string[] = [];
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };

  fireEvent.click(
    await screen.findByRole("button", {
      name: "2 text findings to fix or dismiss.",
    }),
  );
  Element.prototype.scrollIntoView = original;

  expect(scrolled).toEqual(["launch-text"]);
  expect(document.getElementById("launch-text")?.textContent).toContain(
    "Spelling and grammar",
  );
});

it("lists every instance of one misspelling as one finding, dismissed at once", async () => {
  api.served[1] = { ...api.served[1], body: "Call teh office." };
  renderPanel();

  const row = (
    await screen.findByText("Possible misspelling · 2 places")
  ).closest("li");
  expect(row?.textContent).toContain("Call · Task page description");
  expect(row?.textContent).toContain("Write · Task page description");
  expect(screen.getByText("1 text finding to fix or dismiss.")).toBeTruthy();

  if (!row) throw new Error("no grouped finding");
  fireEvent.click(within(row).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByText(/text findings? to fix or dismiss/)).toBeNull();
});

it("marks an excerpt with … only on the side it cuts", async () => {
  api.served[1] = {
    ...api.served[1],
    body: "Call teh office before the deadline arrives.",
  };
  api.served[2] = {
    ...api.served[2],
    body: "Please write to your representative about teh",
  };
  renderPanel();

  await screen.findByText("Possible misspelling · 2 places");
  const excerpt = (text: string) =>
    screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text);
  expect(
    excerpt("Call · Task page descriptionCall teh office before the d…"),
  ).toBeTruthy();
  expect(
    excerpt("Write · Task page description…epresentative about teh"),
  ).toBeTruthy();
});

it("states the schedule in Pacific time when asking to launch", async () => {
  // 9am Pacific, so the default start is 7pm the same day; daylight saving ends before the deadline.
  setSystemTime(new Date("2026-10-28T16:00:00Z"));
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  fireEvent.click(launchButton());
  expect(
    await screen.findByText(
      "Members start Wed, Oct 28, 7:00 PM PT and have until Wed, Nov 4, 11:59 PM PT, 7 days 4 hours 59 minutes. This creates both events and 7 reminders, notifying 2 members. Group leads reminders also reach each unfinished member's group lead, counted only if they're assigned a task themselves.",
    ),
  ).toBeTruthy();
});

it("re-runs the checks without failing the loads an action doesn't make", async () => {
  api.served[2] = { ...api.served[2], taskFormId: null };
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Re-run checks" }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(
    screen.queryByText("Couldn't load the task form for Write."),
  ).toBeNull();
});
