import type { ActionSuiteDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { SuiteTimelineTab } from "./SuiteTimelineTab";

const suiteOf = (actions: ActionSuiteDto["actions"]): ActionSuiteDto => ({
  id: 3,
  name: "Suite",
  actions,
  events: [],
  reminderGroups: [],
  generalUpdates: [],
  isPartitioned: false,
});

const renderTab = (suite: ActionSuiteDto) =>
  render(
    <MemoryRouter>
      <SuiteTimelineTab
        suite={suite}
        now={new Date()}
        onReminderClick={() => {}}
      />
    </MemoryRouter>,
  );

it("lists a draft's tasks with the ways to add more when none has an event", () => {
  renderTab(suiteOf([makeAction({ id: 7, name: "Call", events: [] })]));

  expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe(
    "/tasks/7",
  );
  expect(
    screen.getByRole("link", { name: "New task" }).getAttribute("href"),
  ).toBe("/tasks/new?suiteId=3");
  expect(
    screen.getByRole("link", { name: "Launch tab" }).getAttribute("href"),
  ).toBe("/tasks/suites/3?tab=launch");
  expect(screen.getAllByText("Set at launch")).toHaveLength(2);
});

it("charts the tasks once one has an event", () => {
  renderTab(
    suiteOf([
      makeAction({
        id: 7,
        name: "Call",
        events: [makeEvent({ id: 1, newStatus: "member_action" })],
      }),
    ]),
  );

  expect(screen.getByRole("region", { name: "Timeline" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "New task" })).toBeNull();
});
