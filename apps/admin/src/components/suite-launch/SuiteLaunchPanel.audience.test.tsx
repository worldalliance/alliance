import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it } from "bun:test";
import {
  api,
  launchButton,
  renderPanel,
  serveLaunchApi,
} from "./SuiteLaunchPanel.testHarness";

serveLaunchApi();

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
    screen.getByText("Minutes unknown until every member count loads"),
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
