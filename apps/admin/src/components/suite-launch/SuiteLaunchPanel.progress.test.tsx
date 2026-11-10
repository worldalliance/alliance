import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, setSystemTime } from "bun:test";
import { blockStorage } from "../../lib/testing/blockStorage";
import {
  api,
  launchButton,
  onClose,
  renderPanel,
  resolveEveryCheck,
  serveLaunchApi,
} from "./SuiteLaunchPanel.testHarness";

serveLaunchApi();

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
  ["share", { variantSplit: 0.5 }],
  ["name", { variantName: "Version" }],
])(
  "unmarks an action whose variant's %s changed after it was marked ready",
  async (_, edit) => {
    api.actionList = [1, 2].map((id) => ({
      id,
      name: api.served[id].name,
      taskFormId: 5,
      taskKind: "form",
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

    Object.assign(api, edit);
    renderPanel();

    expect(
      await screen.findByText("Edited since it was marked ready"),
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
      taskKind: "form",
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

it("doesn't call a marked action edited while its task form fails to load", async () => {
  const first = renderPanel();
  await resolveEveryCheck();
  first.unmount();

  api.formLoadFails = true;
  renderPanel();
  expect(
    await screen.findByText("Failed to load the task form for Call."),
  ).toBeTruthy();
  expect(screen.queryByText("Edited since it was marked ready")).toBeNull();
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
  window.localStorage.setItem("alliance.suiteLaunch.v3.3", "{not json");
  renderPanel();

  expect(
    await screen.findByText(
      "Saved launch progress couldn't be read, so this starts over.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/isn't saving launch progress/)).toBeNull();
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
