import type { ActionSuiteDto } from "@alliance/shared/client";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { SuiteGeneralUpdatesTab } from "./SuiteGeneralUpdatesTab";

const suiteWith = (
  generalUpdates: ActionSuiteDto["generalUpdates"],
): ActionSuiteDto => ({
  id: 3,
  name: "Suite",
  actions: [],
  events: [],
  reminderGroups: [],
  generalUpdates,
  isPartitioned: false,
});

const renderTab = (suite: ActionSuiteDto) =>
  render(
    <MemoryRouter>
      <SuiteGeneralUpdatesTab suite={suite} />
    </MemoryRouter>,
  );

it("links each update to its record and creates one for the suite", () => {
  renderTab(
    suiteWith([
      {
        id: 8,
        name: "Week recap",
        startDate: "2020-01-02T03:00:00Z",
        endDate: null,
        priority: 0,
        schema: {},
      },
    ]),
  );

  expect(
    screen.getByRole("link", { name: "Week recap" }).getAttribute("href"),
  ).toBe("/content/general-updates/8");
  expect(screen.getByText("Active")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Create general update" })
      .getAttribute("href"),
  ).toBe("/content/general-updates/new?suiteId=3");
});

it("says when the suite has no general updates", () => {
  renderTab(suiteWith([]));

  expect(
    screen.getByText("No general updates for this suite yet"),
  ).toBeTruthy();
});
