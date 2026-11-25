import type { ActionSuiteDto } from "@alliance/shared/client";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { SuiteTasksTab } from "./SuiteTasksTab";

const suite = {
  id: 3,
  name: "Suite",
  actions: [
    makeAction({
      id: 1,
      name: "Low",
      priority: 1,
      timeEstimate: 4,
      shortDescription: "Do the low thing",
    }),
    makeAction({
      id: 2,
      name: "High",
      priority: 9,
      timeEstimate: null,
      archived: true,
      optional: true,
    }),
  ],
  events: [],
  reminderGroups: [],
  generalUpdates: [],
  isPartitioned: false,
} satisfies ActionSuiteDto;

it("lists the tasks highest priority first, each linking to its task", () => {
  render(
    <MemoryRouter>
      <SuiteTasksTab suite={suite} />
    </MemoryRouter>,
  );

  const [, first, second] = screen.getAllByRole("row");
  expect(
    within(first).getByRole("link", { name: "High" }).getAttribute("href"),
  ).toBe("/tasks/2");
  expect(within(first).getByText("Archived")).toBeTruthy();
  expect(within(first).getByText("Optional")).toBeTruthy();
  expect(
    within(second).getByRole("link", { name: "Low" }).getAttribute("title"),
  ).toBe("Low\n\nDo the low thing");
  expect(within(second).getByText("4")).toBeTruthy();
});
