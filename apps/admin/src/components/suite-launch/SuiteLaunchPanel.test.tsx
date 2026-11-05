import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, setSystemTime } from "bun:test";
import { blockStorage } from "../../lib/testing/blockStorage";
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

  expect(
    (await screen.findByText(": 18 min (Call, Write)", { exact: false }))
      .textContent,
  ).toContain("Ben");
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

it.each([
  ["its body", { body: "Write the letter." }],
  ["whether it's onboarding", { onboarding: true }],
])(
  "unmarks an action whose %s changed after it was marked ready",
  async (_, edit) => {
    const first = renderPanel();
    await resolveEveryCheck();
    await waitFor(() =>
      expect(launchButton().hasAttribute("disabled")).toBe(false),
    );
    first.unmount();

    api.served[2] = { ...api.served[2], ...edit };
    renderPanel();

    expect(
      await screen.findByText("Edited since it was marked ready"),
    ).toBeTruthy();
    expect(
      screen.getByText("1 action isn't marked ready to launch."),
    ).toBeTruthy();
    expect(launchButton().hasAttribute("disabled")).toBe(true);
  },
);

it.each([
  ["task form", 5],
  ["variant form", 9],
])(
  "unmarks an action whose %s was saved after it was marked ready",
  async (_, formId) => {
    api.actionList = [1, 2].map((id) => ({
      id,
      name: api.served[id].name,
      taskFormId: 5,
      variantFormIds: id === 2 ? [9] : [],
      onboarding: false,
      memberActionDeadline: null,
    }));
    const first = renderPanel();
    await resolveEveryCheck();
    await waitFor(() =>
      expect(launchButton().hasAttribute("disabled")).toBe(false),
    );
    first.unmount();

    api.formSnapshotIdById[formId] = 2;
    renderPanel();

    expect(
      (await screen.findAllByText("Edited since it was marked ready")).length,
    ).toBeGreaterThan(0);
    expect(launchButton().hasAttribute("disabled")).toBe(true);
  },
);

it("keeps an action marked ready when only its timestamp and counts change", async () => {
  const first = renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  first.unmount();

  api.served[2] = {
    ...api.served[2],
    updatedAt: "2026-10-30T12:00:00.000Z",
    usersJoined: 7,
    usersCompleted: 3,
  };
  renderPanel();

  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  expect(screen.queryByText("Edited since it was marked ready")).toBeNull();
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

it("starts from the default schedule when the saved start has passed", async () => {
  setSystemTime(new Date("2099-01-01T12:00:00Z"));
  const first = renderPanel();
  await resolveEveryCheck();
  fireEvent.change(
    first.container.querySelectorAll('input[type="datetime-local"]')[0],
    { target: { value: "2099-01-02T10:00" } },
  );
  first.unmount();

  setSystemTime(new Date("2099-01-05T12:00:00Z"));
  renderPanel();

  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
});

it("pre-fills the schedule afresh on a later visit when staff left it untouched", async () => {
  setSystemTime(new Date("2099-01-01T12:00:00Z"));
  renderPanel().unmount();

  setSystemTime(new Date("2099-01-02T02:45:00Z"));
  const { container } = renderPanel();

  const memberStart = container.querySelectorAll(
    'input[type="datetime-local"]',
  )[0];
  expect(memberStart instanceof HTMLInputElement && memberStart.value).toBe(
    "2099-01-02T04:00",
  );
});

it("says so when the browser won't save progress", async () => {
  const restore = blockStorage();
  try {
    renderPanel();
    expect(
      await screen.findByText(
        "This browser isn't saving launch progress, so a reload starts over.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/couldn't be read/)).toBeNull();
  } finally {
    restore();
  }
});

it("says saved progress it can't read starts over, without claiming it isn't saving", async () => {
  window.localStorage.setItem("alliance.suiteLaunch.v2.3", "{not json");
  renderPanel();

  expect(
    await screen.findByText(
      "Saved launch progress couldn't be read, so this starts over.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/isn't saving launch progress/)).toBeNull();
});

it("states how long members have to complete their actions", async () => {
  setSystemTime(new Date("2026-01-15T20:00:00Z"));
  renderPanel();
  const sentence = await screen.findByText(
    "Members have 7 days 4 hours 59 minutes to complete their actions",
  );
  expect(sentence.tagName).toBe("P");
});

it("doesn't offer to notify 0 members while the checks load", async () => {
  renderPanel();

  expect(screen.getByRole("button", { name: "Running checks…" })).toBeTruthy();
  expect(
    await screen.findByRole("button", { name: /Launch and notify 2/ }),
  ).toBeTruthy();
});

it("says checks are running while the spelling dictionary loads", async () => {
  renderPanel({ dictionaryLoads: true });

  expect(
    await screen.findByText("Loading the spelling dictionary…"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Running checks…" })).toBeTruthy();
});

it("restores a dismissed finding, which blocks launch again", async () => {
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  fireEvent.click(screen.getByRole("button", { name: "Show dismissed" }));
  const misspelling = screen
    .getByText("Possible misspelling · Write · Body")
    .closest("li");
  const restore = misspelling?.querySelector('[aria-label="Restore"]');
  if (!restore) throw new Error("no restore button on the dismissed finding");
  fireEvent.click(restore);

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
  expect(row?.textContent).toContain("Call · Body");
  expect(row?.textContent).toContain("Write · Body");
  expect(screen.getByText("1 text finding to fix or dismiss.")).toBeTruthy();

  const dismiss = row?.querySelector('[aria-label="Dismiss"]');
  if (!dismiss) throw new Error("no dismiss button on the grouped finding");
  fireEvent.click(dismiss);
  expect(screen.queryByText(/text findings? to fix or dismiss/)).toBeNull();
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
      "Members start Oct 28, 2026 at 7:00 PM PT and have until Nov 4, 2026 at 11:59 PM PT, 7 days 4 hours 59 minutes. This creates both events and 7 reminders, notifying 2 members. Group leads reminders also reach each unfinished member's group lead, counted only if they're assigned an action themselves.",
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
