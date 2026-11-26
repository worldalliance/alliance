import type { ActionSuiteDto } from "@alliance/shared/client";
import { screen } from "@testing-library/react";
import { options, renderForm } from "./renderDetailsForm";

const suite = (isPartitioned: boolean): ActionSuiteDto => ({
  id: 3,
  name: "Climate",
  actions: [],
  events: [],
  reminderGroups: [],
  generalUpdates: [],
  isPartitioned,
});

const optionalDisabled = () =>
  screen.getByLabelText<HTMLInputElement>(/^Optional/).disabled;
const rules = (name: string) => screen.queryByRole("group", { name });

describe("TaskDetailsForm suites", () => {
  it("offers the available suites and shows the stored one", () => {
    renderForm({
      form: { suiteId: 3 },
      lookups: { availableSuites: [suite(false)] },
    });

    expect(options("Suite")).toEqual([
      ["", "No suite"],
      ["3", "Climate"],
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>(/^Suite/).value).toBe("3");
  });

  it("leaves optional work, prerequisites and participants to the parts of a suite that uses them", () => {
    renderForm({
      form: { suiteId: 3, optional: false },
      lookups: { availableSuites: [suite(true)] },
    });

    expect(optionalDisabled()).toBe(true);
    screen.getByText("Set by the suite's partition.");
    expect(rules("Prerequisites")).toBeNull();
    expect(rules("Participating members")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Edit the suite's partition" })
        .getAttribute("href"),
    ).toBe("/tasks/suites/3");
  });

  it("shows no prerequisites or participants, and holds optional work, until the suites load", () => {
    renderForm({ form: { suiteId: 3 }, lookups: { suitesLoading: true } });

    expect(optionalDisabled()).toBe(true);
    expect(rules("Prerequisites")).toBeNull();
    expect(rules("Participating members")).toBeNull();
    screen.getByText("Prerequisites and participants show once suites load.");
  });

  it("shows no prerequisites or participants when the suites failed to load", () => {
    renderForm({ form: { suiteId: 3 }, lookups: { suitesError: true } });

    expect(optionalDisabled()).toBe(true);
    screen.getByText("Can't be changed until suites load. Reload the page.");
    expect(rules("Prerequisites")).toBeNull();
    expect(
      screen.getByText(/^Suites couldn't load, so/).closest('[role="alert"]'),
    ).toBeTruthy();
  });

  it("shows optional work and prerequisites of a task with no suite while the suites load", () => {
    renderForm({ form: { suiteId: null }, lookups: { suitesLoading: true } });

    expect(optionalDisabled()).toBe(false);
    expect(rules("Prerequisites")).toBeTruthy();
  });

  it("keeps showing the prerequisites and participants a task brings into a partitioned suite", () => {
    renderForm({
      form: { suiteId: 3, optional: true, prerequisiteActionIds: [9] },
      lookups: { availableSuites: [suite(true)] },
    });

    expect(optionalDisabled()).toBe(true);
    expect(rules("Prerequisites")).toBeTruthy();
    screen.getByText(
      "Clear this task's prerequisites and participants below before saving.",
    );
  });

  it("keeps showing the participants a task brings into a partitioned suite, after they're cleared too", () => {
    const { rerender } = renderForm({
      form: { suiteId: 3 },
      lookups: { availableSuites: [suite(true)] },
      editor: { cohortExpression: { type: "Tag", tagId: "x" } },
    });
    screen.getByText(/^Clear this task's prerequisites/);
    rerender({ cohortExpression: null });

    expect(rules("Participating members")).toBeTruthy();
    expect(screen.queryByText(/^Clear this task's prerequisites/)).toBeNull();
  });
});
